import { it, expect } from 'vitest';
import { getCorpusAliasCollisions, getCorpusLinkHealth, getCorpusTitleCollisions, getCorpusZeroByteNotes } from '../workflow/corpus.mjs';

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

it('reports only zero-byte notes using complete, valid metadata for the selected Corpus', () => {
  expect(getCorpusZeroByteNotes('ResearchScope', ['B/Empty.md', 'A/Note.md', 'C/Placeholder.md'], {
    'B/Empty.md': 0, 'A/Note.md': 14, 'C/Placeholder.md': 0,
  })).toEqual(['B/Empty.md', 'C/Placeholder.md']);
  expect(() => getCorpusZeroByteNotes('../Outside', ['Note.md'], { 'Note.md': 0 })).toThrow('visible Corpus folder');
  expect(() => getCorpusZeroByteNotes('ResearchScope', ['Note.md'], {})).toThrow('metadata is incomplete');
  expect(() => getCorpusZeroByteNotes('ResearchScope', ['Note.md'], { 'Note.md': -1 })).toThrow('metadata is incomplete');
});

it('reports only cross-note alias and filename collisions with bounded normalized evidence', () => {
  expect(getCorpusAliasCollisions('ResearchScope', [
    'Notes/Guide.md', 'Archive/SYNTHESIS.md', 'Research/Other.md', 'Archive/Other.md',
  ], {
    'Notes/Guide.md': [' Synthesis ', 'Guide', 'GUIDE'],
    'Archive/SYNTHESIS.md': [],
    'Research/Other.md': ['guide', ' guide '],
    'Archive/Other.md': [],
    'Outside/Other.md': ['Synthesis'],
  })).toEqual([
    { alias: 'GUIDE', matches: [
      { path: 'Notes/Guide.md', filename: true, aliases: ['GUIDE', 'Guide'] },
      { path: 'Research/Other.md', filename: false, aliases: ['guide'] },
    ] },
    { alias: 'SYNTHESIS', matches: [
      { path: 'Archive/SYNTHESIS.md', filename: true, aliases: [] },
      { path: 'Notes/Guide.md', filename: false, aliases: ['Synthesis'] },
    ] },
  ]);
});

it('normalizes Unicode compatibility and whitespace but ignores filename-only title groups', () => {
  expect(getCorpusAliasCollisions('ResearchScope', ['Ａｓｔｅｒ.md', 'Archive/Aster.md', 'Uses.md'], {
    'Ａｓｔｅｒ.md': [], 'Archive/Aster.md': [], 'Uses.md': ['  aster  '],
  })).toEqual([{ alias: 'Aster', matches: [
    { path: 'Archive/Aster.md', filename: true, aliases: [] },
    { path: 'Uses.md', filename: false, aliases: ['aster'] },
    { path: 'Ａｓｔｅｒ.md', filename: true, aliases: [] },
  ] }]);
});

it('fails closed for incomplete, malformed or over-budget alias metadata', () => {
  expect(() => getCorpusAliasCollisions('ResearchScope', ['Note.md'], {})).toThrow('metadata is incomplete');
  expect(() => getCorpusAliasCollisions('ResearchScope', ['Note.md'], { 'Note.md': 'alias' as never })).toThrow('metadata is incomplete');
  expect(() => getCorpusAliasCollisions('ResearchScope', ['Note.md'], { 'Note.md': ['x'.repeat(257)] })).toThrow('oversized value');
  expect(() => getCorpusAliasCollisions('ResearchScope', ['Note.md'], { 'Note.md': Array(65).fill('alias') })).toThrow('per-note limit');
  const manyAliases = Object.fromEntries(Array.from({ length: 13 }, (_, index) => [
    `Note${index}.md`, Array(64).fill('x'.repeat(256)),
  ]));
  expect(() => getCorpusAliasCollisions('ResearchScope', Object.keys(manyAliases), manyAliases)).toThrow('scan budget');
  expect(() => getCorpusAliasCollisions('ResearchScope', ['Note.md'], { 'Note.md': ['bad\u0001alias'] })).toThrow('control characters');
  expect(() => getCorpusAliasCollisions('ResearchScope', ['../Outside.md'], { '../Outside.md': [] })).toThrow('note listing is invalid');
});
