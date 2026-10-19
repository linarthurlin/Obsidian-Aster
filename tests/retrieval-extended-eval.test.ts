import { it, expect } from 'vitest';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { searchCorpus } from '../workflow/corpus.mjs';

it('evaluates lexical ranking against Chinese, mixed-language, same-basename, distractor and long-note fixtures', async () => {
  const home = await mkdtemp(join(tmpdir(), 'aster-retrieval-extended-'));
  const corpus = join(home, 'Corpus');
  const longText = Array.from({ length: 90 }, (_, index) => `Background paragraph ${index + 1} describes study methods and archive context.`)
    .concat(['## Late finding', 'Hippocampal consolidation stabilizes recently learned information.'])
    .join('\n') + '\n';
  const documents: Record<string, string> = {
    'Research/神經可塑性.md': '# 神經可塑性\n\n大腦如何因學習改變連結，是神經可塑性研究的核心問題。\n',
    'Research/大腦學習.md': '# 大腦學習\n\n探討大腦與神經可塑性，並比較不同學習方法。\n',
    'Research/神經訊號.md': '# 神經訊號\n\n神經元以電訊號傳遞資訊，突觸活動會影響網路同步。\n',
    'Research/Memory consolidation.md': '# Memory consolidation\n\nMemory consolidation stabilizes newly learned information over time.\n',
    'Research/Memory retrieval.md': '# Memory retrieval\n\nRetrieval practice can support memory consolidation and later recall.\n',
    'Research/AI 知識整理.md': '# AI 知識整理\n\nAgent workflow 以引用與來源追溯維護知識庫。\n',
    'AI/Knowledge Workflow.md': '# Knowledge workflow for AI\n\nAn AI agent uses a reviewable workflow to preserve citations and provenance.\n',
    'AI/Agent Workflow.md': '# Agent workflow\n\nThe AI knowledge workflow connects sources, citations and review steps.\n',
    'Research/Source provenance.md': '# Source provenance\n\nCitation provenance records the source path and exact excerpt for each claim.\n',
    'Research/Citation formats.md': '# Citation formats\n\nCitation styles differ, while provenance records where a claim came from.\n',
    'Research/Meeting.md': '# Meeting decisions\n\nDecisions assign an owner and deadline to each follow-up.\n',
    'Archive/Meeting.md': '# Archived meeting\n\nHistorical decisions list an owner; the deadline was removed.\n',
    'Archive/Body only.md': '# Notes\n\nA unique bodyonly marker exists only in this note body.\n',
    'Research/Neural circuits.md': '# Neural circuits\n\nNeural circuits coordinate signals between regions during learning.\n',
    'Research/Long synthesis.md': longText,
  };
  try {
    for (const [path, text] of Object.entries(documents)) {
      const absolute = join(corpus, path);
      await mkdir(dirname(absolute), { recursive: true });
      await writeFile(absolute, text);
    }
    const cases = [
      { query: '神經可塑性', relevant: 'Research/神經可塑性.md' },
      { query: '神經 可塑性', relevant: 'Research/神經可塑性.md' },
      { query: '大腦學習', relevant: 'Research/大腦學習.md' },
      { query: 'memory consolidation', relevant: 'Research/Memory consolidation.md' },
      { query: 'AI 知識整理', relevant: 'Research/AI 知識整理.md' },
      { query: 'AI knowledge workflow', relevant: 'AI/Knowledge Workflow.md' },
      { query: 'exact excerpt claim', relevant: 'Research/Source provenance.md' },
      { query: 'owner deadline', relevant: 'Research/Meeting.md' },
      { query: 'bodyonly marker', relevant: 'Archive/Body only.md' },
      { query: 'Hippocampal consolidation', relevant: 'Research/Long synthesis.md' },
      { query: 'neural circuits', relevant: 'Research/Neural circuits.md' },
      { query: 'Citation formats', relevant: 'Research/Citation formats.md' },
    ];
    let reciprocalRank = 0;
    let recallAt3 = 0;
    let discountedGain = 0;
    for (const item of cases) {
      const result = await searchCorpus(corpus, item.query, 5);
      const rank = result.results.findIndex(hit => hit.path === item.relevant);
      if (rank >= 0) {
        reciprocalRank += 1 / (rank + 1);
        if (rank < 3) recallAt3++;
        discountedGain += 1 / Math.log2(rank + 2);
      }
      expect(result.scannedBytes).toBeLessThanOrEqual(20_000_000);
      for (const hit of result.results) {
        const source = documents[hit.path];
        expect(source).toBeDefined();
        expect(source!.includes(hit.excerpt)).toBe(true);
        expect(hit.startLine).toBe(source!.slice(0, source!.indexOf(hit.excerpt)).split('\n').length);
      }
      if (item.query === 'Hippocampal consolidation') {
        const hit = result.results.find(candidate => candidate.path === item.relevant)!;
        expect(hit.excerpt).toContain('Hippocampal consolidation');
        expect(hit.startLine).toBeGreaterThan(80);
      }
    }
    const metrics = { recallAt3: recallAt3 / cases.length, mrr: reciprocalRank / cases.length, nDcg: discountedGain / cases.length };
    expect(metrics.recallAt3).toBeGreaterThanOrEqual(0.95);
    expect(metrics.mrr).toBeGreaterThanOrEqual(0.9);
    expect(metrics.nDcg).toBeGreaterThanOrEqual(0.9);

    const paraphrases = [
      { query: 'brain rewiring', relevant: 'Research/神經可塑性.md' },
      { query: '神經重塑', relevant: 'Research/神經可塑性.md' },
      { query: 'memory stabilization', relevant: 'Research/Memory consolidation.md' },
    ];
    const paraphraseHits = await Promise.all(paraphrases.map(item => searchCorpus(corpus, item.query, 5)));
    const paraphraseRecallAt3 = paraphraseHits.filter((result, index) => result.results.slice(0, 3).some(hit => hit.path === paraphrases[index].relevant)).length / paraphrases.length;
    expect(paraphraseRecallAt3).toBeCloseTo(1 / 3);
    expect(paraphraseHits[0].results).toHaveLength(0);
    expect(paraphraseHits[1].results).toHaveLength(0);
  } finally {
    await rm(home, { recursive: true, force: true });
  }
});
