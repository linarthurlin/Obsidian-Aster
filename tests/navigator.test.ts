import { describe, it, expect } from 'vitest';
import { filterFiles, relocatePaths, rememberPath, previewText, type NavigationFile, type NavigationQuery } from '../src/navigator-model';
const files: NavigationFile[] = [
  { path: 'Research/Note 10.md', name: 'Note 10', extension: 'md', mtime: 1, aliases: ['估測'], tags: ['#robotics/estimation'] },
  { path: 'Research/Note 2.md', name: 'Note 2', extension: 'md', mtime: 2, aliases: [], tags: [] },
  { path: 'Researcher/Note.md', name: 'Note', extension: 'md', mtime: 3, aliases: [], tags: [] },
  { path: 'Research/assets/plot.svg', name: 'plot', extension: 'svg', mtime: 4, aliases: [], tags: [] },
];
const query: NavigationQuery = { scope: 'all', folder: '', query: '', type: 'notes', descendants: true, sort: 'name', pinned: [], recent: [] };
describe('read-only navigation model', () => {
  it('naturally sorts numbers and separates attachments', () => {
    expect(filterFiles(files, query).map(f => f.name)).toEqual(['Note', 'Note 2', 'Note 10']);
    expect(filterFiles(files, { ...query, type: 'attachments' }).map(f => f.name)).toEqual(['plot']);
  });
  it('matches aliases and hierarchical tags', () => {
    expect(filterFiles(files, { ...query, query: '估測 #robotics' }).map(f => f.name)).toEqual(['Note 10']);
  });
  it('keeps folder boundaries and direct-child scope precise', () => {
    expect(filterFiles(files, { ...query, scope: 'folder', folder: 'Research', type: 'all', descendants: false })).toHaveLength(2);
    expect(filterFiles(files, { ...query, scope: 'folder', folder: 'Research', type: 'all' })).toHaveLength(3);
  });
  it('distinguishes recency from modification and migrates references on rename', () => {
    expect(filterFiles(files, { ...query, scope: 'recent', recent: ['Research/Note 10.md', 'Research/Note 2.md'] })[0].name).toBe('Note 10');
    expect(relocatePaths(['Research/Note 2.md', 'Researcher/Note.md'], 'Research', 'Reading')).toEqual(['Reading/Note 2.md', 'Researcher/Note.md']);
    expect(rememberPath(['a', 'b'], 'b')).toEqual(['b', 'a']);
  });
  it('strips metadata and media from a bounded local preview', () => {
    expect(previewText('---\nsecret: hidden\n---\n# Hello\n![[image.png]]\n[[Target|Alias]]')).toBe('Hello Alias');
  });
});
