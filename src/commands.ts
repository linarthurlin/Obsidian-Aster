export interface MarkdownTemplate { id: string; name: string; before: string; after: string; placeholder: string; }
export const TEMPLATES: MarkdownTemplate[] = [
  { id: 'heading-1', name: 'Insert heading 1 / 標題一', before: '# ', after: '', placeholder: 'Heading' },
  { id: 'heading-2', name: 'Insert heading 2 / 標題二', before: '## ', after: '', placeholder: 'Heading' },
  { id: 'heading-3', name: 'Insert heading 3 / 標題三', before: '### ', after: '', placeholder: 'Heading' },
  { id: 'bullet', name: 'Insert bullet list / 清單', before: '- ', after: '', placeholder: 'Item' },
  { id: 'todo', name: 'Insert task / 待辦', before: '- [ ] ', after: '', placeholder: 'Task' },
  { id: 'quote', name: 'Insert quote / 引言', before: '> ', after: '', placeholder: 'Quote' },
  ...['note', 'tip', 'warning', 'example'].map(type => ({
    id: `callout-${type}`, name: `Insert ${type} callout`,
    before: `> [!${type}]\n> `, after: '', placeholder: 'Content',
  })),
  { id: 'divider', name: 'Insert divider / 分隔線', before: '---', after: '', placeholder: '' },
  { id: 'code', name: 'Insert code block / 程式碼', before: '```text\n', after: '\n```', placeholder: 'Code' },
  { id: 'math', name: 'Insert math block / 公式', before: '$$\n', after: '\n$$', placeholder: 'A x = b' },
  { id: 'table', name: 'Insert table / 表格', before: '| Column | Value |\n| --- | --- |\n| ', after: ' |  |', placeholder: 'Item' },
];
export interface Insertion { text: string; selectionStart: number; selectionEnd: number; }
export function createInsertion(template: MarkdownTemplate, selected: string, before: string, after: string): Insertion {
  const prefix = before && !before.endsWith('\n') ? '\n' : '';
  const suffix = after && !after.startsWith('\n') ? '\n' : '';
  // Preserve every selected line inside a quote/callout/list instead of leaking outside it.
  const continuation = template.before.startsWith('>') ? '> '
    : template.id === 'bullet' ? '  ' : template.id === 'todo' ? '      ' : '';
  const content = (selected || template.placeholder).replace(/\n/g, `\n${continuation}`);
  const text = prefix + template.before + content + template.after + suffix;
  const selectionStart = prefix.length + template.before.length;
  return { text, selectionStart, selectionEnd: selectionStart + content.length };
}
