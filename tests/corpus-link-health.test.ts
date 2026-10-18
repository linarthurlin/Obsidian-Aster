import { it, expect } from 'vitest';
import { getCorpusLinkHealth, getCorpusTitleCollisions } from '../workflow/corpus.mjs';

it('reports only unresolved and no-inbound links whose source and target are inside the selected Corpus', () => {
  const report = getCorpusLinkHealth('ResearchScope', ['Target.md', 'Linker.md', 'Independent.md', 'Self.md'], {
    'ResearchScope/Linker.md': { 'ResearchScope/Target.md': 2 },
    'ResearchScope/Self.md': { 'ResearchScope/Self.md': 1 },
    'Outside/Outside.md': { 'ResearchScope/Independent.md': 1 },
  }, {
    'ResearchScope/Linker.md': { 'Missing note': 2, '': 1, 'Invalid count': 0 },
    'Outside/Outside.md': { 'Another missing note': 1 },
  });

  expect(report.unresolved).toEqual([{ sourcePath: 'Linker.md', target: 'Missing note', count: 2 }]);
  expect(report.noInbound).toEqual(['Independent.md', 'Linker.md', 'Self.md']);
});

it('rejects malformed Corpus metadata instead of producing misleading health results', () => {
  expect(() => getCorpusLinkHealth('../Outside', ['Note.md'], {}, {})).toThrow('visible Corpus folder');
  expect(() => getCorpusLinkHealth('ResearchScope', ['.hidden.md'], {}, {})).toThrow('note listing is invalid');
  expect(() => getCorpusLinkHealth('ResearchScope', ['Note.md'], null as never, {})).toThrow('metadata is unavailable');
});

it('looks up only selected Corpus source keys without enumerating the app-wide link map', () => {
  const links = new Proxy({ 'ResearchScope/Selected.md': {} } as Record<string, Record<string, number>>, {
    ownKeys() { throw new Error('outside Corpus metadata must not be enumerated'); },
  });
  expect(getCorpusLinkHealth('ResearchScope', ['Selected.md'], links, links)).toEqual({ unresolved: [], noInbound: ['Selected.md'] });
});

it('reports repeated Markdown titles using only the selected Corpus paths', () => {
  expect(getCorpusTitleCollisions('ResearchScope', [
    'Research/Meeting.md', 'Archive/Meeting.md', 'Archive/meeting.md',
    'Research/Ｃａｆｅ́.md', 'Archive/Café.md', 'Research/Unique.md',
  ])).toEqual([
    { title: 'Café', paths: ['Archive/Café.md', 'Research/Ｃａｆｅ́.md'] },
    { title: 'Meeting', paths: ['Archive/Meeting.md', 'Archive/meeting.md', 'Research/Meeting.md'] },
  ]);
});

it('rejects title collision requests outside the visible Corpus contract', () => {
  expect(() => getCorpusTitleCollisions('../Outside', ['Note.md'])).toThrow('visible Corpus folder');
  expect(() => getCorpusTitleCollisions('ResearchScope', ['../Outside.md'])).toThrow('note listing is invalid');
  expect(() => getCorpusTitleCollisions('ResearchScope', ['.hidden/Note.md'])).toThrow('note listing is invalid');
});
