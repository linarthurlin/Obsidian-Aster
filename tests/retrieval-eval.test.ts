import { it, expect } from 'vitest';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { searchCorpus } from '../workflow/corpus.mjs';

it('measures baseline Recall@3, MRR and excerpt locators on synthetic zh/en/mixed retrieval cases', async () => {
  const home = await mkdtemp(join(tmpdir(), 'aster-retrieval-eval-'));
  const corpus = join(home, 'Corpus');
  const documents: Record<string, string> = {
    'Research/神經可塑性.md': '# 神經可塑性\n\n本筆記整理神經可塑性研究，說明大腦如何因學習改變連結。\n',
    'Research/大腦學習.md': '# 大腦學習\n\n探討大腦與神經可塑性，並比較不同學習方法。\n',
    'Research/Memory consolidation.md': '# Memory consolidation\n\nMemory consolidation stabilizes newly learned information over time.\n',
    'Research/Memory retrieval.md': '# Memory retrieval\n\nRetrieval practice can support memory consolidation and later recall.\n',
    'Knowledge/AI 知識整理.md': '# AI 知識整理\n\nAgent workflow 以引用與來源追溯維護知識庫。\n',
    'Knowledge/AI 檢索評論.md': '# AI 檢索評論\n\nThis note reviews search systems and knowledge discovery tools.\n',
    'AI/Knowledge Workflow.md': '# Knowledge workflow for AI\n\nAn AI agent uses a reviewable workflow to preserve citations and provenance.\n',
    'AI/Agent Workflow.md': '# Agent workflow\n\nThe AI knowledge workflow connects sources, citations and review steps.\n',
    'Research/Source provenance.md': '# Source provenance\n\nCitation provenance records the source path and exact excerpt for each claim.\n',
    'Research/Citation formats.md': '# Citation formats\n\nCitation styles differ, while provenance records where a claim came from.\n',
    'Research/Meeting.md': '# Meeting decisions\n\nDecisions assign an owner and deadline to each follow-up.\n',
    'Archive/Meeting.md': '# Archived meeting\n\nHistorical decisions list an owner; the deadline was removed.\n',
  };
  try {
    for (const [path, text] of Object.entries(documents)) {
      const absolute = join(corpus, path);
      await mkdir(dirname(absolute), { recursive: true });
      await writeFile(absolute, text);
    }
    const cases = [
      { query: '神經可塑性', relevant: ['Research/神經可塑性.md'] },
      { query: '神經 可塑性', relevant: ['Research/神經可塑性.md'] },
      { query: 'memory consolidation', relevant: ['Research/Memory consolidation.md'] },
      { query: 'AI 知識整理', relevant: ['Knowledge/AI 知識整理.md'] },
      { query: 'AI knowledge workflow', relevant: ['AI/Knowledge Workflow.md'] },
      { query: 'exact excerpt claim', relevant: ['Research/Source provenance.md'] },
      { query: 'owner deadline', relevant: ['Research/Meeting.md'] },
    ];
    let reciprocalRank = 0;
    let retrievedRelevant = 0;
    let relevantCount = 0;
    let discountedGain = 0;
    let idealGain = 0;
    for (const item of cases) {
      const result = await searchCorpus(corpus, item.query, 5);
      const relevant = new Set(item.relevant);
      relevantCount += relevant.size;
      const rank = result.results.findIndex(hit => relevant.has(hit.path));
      if (rank >= 0) {
        reciprocalRank += 1 / (rank + 1);
        if (rank < 3) retrievedRelevant++;
      }
      for (const [index, hit] of result.results.entries()) {
        if (!relevant.has(hit.path)) continue;
        discountedGain += 1 / Math.log2(index + 2);
      }
      idealGain += 1;

      for (const hit of result.results) {
        const source = documents[hit.path];
        expect(source).toBeDefined();
        expect(source!.includes(hit.excerpt)).toBe(true);
        expect(hit.startLine).toBe(source!.slice(0, source!.indexOf(hit.excerpt)).split('\n').length);
      }
    }
    const recallAt3 = retrievedRelevant / relevantCount;
    const meanReciprocalRank = reciprocalRank / cases.length;
    const meanNdcg = discountedGain / idealGain;
    expect(recallAt3).toBe(1);
    expect(meanReciprocalRank).toBeGreaterThanOrEqual(0.9);
    expect(meanNdcg).toBeGreaterThanOrEqual(0.9);
    // Lexical search deliberately does not claim semantic recall for paraphrases.
    expect((await searchCorpus(corpus, 'brain rewiring', 5)).results).toHaveLength(0);
  } finally {
    await rm(home, { recursive: true, force: true });
  }
});
