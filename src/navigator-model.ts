export interface NavigationFile {
  path: string; name: string; extension: string; mtime: number;
  aliases: string[]; tags: string[];
}
export type NavigationScope = 'all' | 'recent' | 'pinned' | 'folder';
export interface NavigationQuery {
  scope: NavigationScope; folder: string; query: string; type: 'notes' | 'attachments' | 'all';
  descendants: boolean; sort: 'name' | 'modified'; pinned: string[]; recent: string[];
}
const collator = new Intl.Collator('zh-Hant', { numeric: true, sensitivity: 'base' });
const notes = new Set(['md', 'canvas', 'base']);
export function filterFiles(files: NavigationFile[], options: NavigationQuery): NavigationFile[] {
  const terms = options.query.normalize('NFKC').toLocaleLowerCase().trim().split(/\s+/).filter(Boolean);
  const recent = new Map(options.recent.map((path, index) => [path, index]));
  const folder = options.folder.replace(/\/$/, '');
  return files.filter(file => {
    if (options.type === 'notes' && !notes.has(file.extension)) return false;
    if (options.type === 'attachments' && notes.has(file.extension)) return false;
    if (options.scope === 'pinned' && !options.pinned.includes(file.path)) return false;
    if (options.scope === 'recent' && !recent.has(file.path)) return false;
    if (options.scope === 'folder') {
      const parent = file.path.includes('/') ? file.path.slice(0, file.path.lastIndexOf('/')) : '';
      if (options.descendants ? folder && !file.path.startsWith(folder + '/') : parent !== folder) return false;
    }
    const text = [file.name, file.path, ...file.aliases].join(' ').normalize('NFKC').toLocaleLowerCase();
    return terms.every(term => term.startsWith('#')
      ? file.tags.some(tag => tag.toLocaleLowerCase() === term || tag.toLocaleLowerCase().startsWith(term + '/'))
      : text.includes(term));
  }).sort((a, b) => {
    if (options.scope === 'recent') return (recent.get(a.path) ?? 0) - (recent.get(b.path) ?? 0);
    if (options.sort === 'modified' && a.mtime !== b.mtime) return b.mtime - a.mtime;
    return collator.compare(a.name, b.name) || collator.compare(a.path, b.path);
  });
}
export function rememberPath(paths: string[], path: string, limit = 40): string[] {
  return [path, ...paths.filter(value => value !== path)].slice(0, limit);
}
export function relocatePaths(paths: string[], oldPath: string, newPath: string): string[] {
  return [...new Set(paths.map(path => path === oldPath ? newPath : path.startsWith(oldPath + '/') ? newPath + path.slice(oldPath.length) : path))];
}
export function previewText(markdown: string): string {
  return markdown.slice(0, 24000).replace(/^---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/, '')
    .replace(/```[\s\S]*?```/g, ' ').replace(/!\[\[[^\]]*\]\]|!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_match, target, alias) => alias || target)
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').replace(/<[^>]*>/g, '')
    .replace(/^[#>\s*-]+/gm, '').replace(/[*_`]/g, '').replace(/\s+/g, ' ').trim().slice(0, 180);
}
