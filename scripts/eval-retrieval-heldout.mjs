// Frozen, offline held-out evaluation over synthetic notes only. No Vault path is accepted.
import { randomUUID } from 'node:crypto';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { invalidateCorpusSearchIndex, listNotes, searchCorpus } from '../workflow/corpus.mjs';
import { buildSegmentedBm25Index, searchSegmentedBm25 } from './retrieval-baselines.mjs';
import { heldoutDocuments, heldoutQueries } from './retrieval-heldout-set.mjs';

function scoreGroup(records) {
  let precisionAt3 = 0, recallAt3 = 0, reciprocalRank = 0, discountedGain = 0, idealGain = 0;
  for (const { query, hits } of records) {
    const relevant = new Set(query.relevant);
    const top3 = hits.slice(0, 3);
    precisionAt3 += top3.filter(hit => relevant.has(hit.path)).length / 3;
    recallAt3 += top3.filter(hit => relevant.has(hit.path)).length / relevant.size;
    const rank = hits.findIndex(hit => relevant.has(hit.path));
    if (rank >= 0 && rank < 5) reciprocalRank += 1 / (rank + 1);
    for (const [index, hit] of hits.slice(0, 5).entries()) if (relevant.has(hit.path)) discountedGain += 1 / Math.log2(index + 2);
    for (let index = 0; index < Math.min(5, relevant.size); index++) idealGain += 1 / Math.log2(index + 2);
  }
  if (!records.length) return { queries: 0, precisionAt3: 0, recallAt3: 0, mrrAt5: 0, nDcgAt5: 0 };
  return {
    queries: records.length,
    precisionAt3: precisionAt3 / records.length,
    recallAt3: recallAt3 / records.length,
    mrrAt5: reciprocalRank / records.length,
    nDcgAt5: idealGain ? discountedGain / idealGain : 0,
  };
}

const duplicateQueries = heldoutQueries.filter((item, index) => heldoutQueries.findIndex(other => other.query === item.query) !== index);
if (duplicateQueries.length) throw new Error('Held-out set contains duplicate query strings.');
const allowed = new Set(Object.keys(heldoutDocuments));
if (heldoutQueries.some(item => !Array.isArray(item.relevant) || !item.relevant.length || item.relevant.some(path => !allowed.has(path))))
  throw new Error('Held-out relevance judgments refer to missing synthetic documents.');

const root = await mkdtemp(join(tmpdir(), 'aster-retrieval-heldout-' + randomUUID() + '-'));
try {
  for (const [path, content] of Object.entries(heldoutDocuments)) {
    const target = join(root, path);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, content);
  }
  const paths = await listNotes(root);
  if (paths.length !== allowed.size || paths.some(path => !allowed.has(path))) throw new Error('Held-out synthetic Corpus does not match its frozen document list.');

  const current = [];
  for (const query of heldoutQueries) {
    invalidateCorpusSearchIndex();
    const result = await searchCorpus(root, query.query, 5);
    for (const hit of result.results) {
      const source = heldoutDocuments[hit.path];
      if (!source?.includes(hit.excerpt) || hit.startLine !== source.slice(0, source.indexOf(hit.excerpt)).split('\n').length)
        throw new Error(`Invalid held-out excerpt locator for ${query.query}: ${hit.path}`);
    }
    current.push({ query, hits: result.results });
  }
  const bm25Index = await buildSegmentedBm25Index(paths, path => readFile(join(root, path), 'utf8'));
  const experimental = heldoutQueries.map(query => ({ query, hits: searchSegmentedBm25(bm25Index, query.query, 5) }));
  const groups = ['lexical', 'paraphrase', 'hard-negative'];
  const summarize = records => Object.fromEntries([
    ['overall', records],
    ...groups.map(group => [group, records.filter(item => item.query.group === group)]),
  ].map(([group, subset]) => [group, scoreGroup(subset)]));
  const misses = records => records.filter(item => !item.hits.slice(0, 3).some(hit => item.query.relevant.includes(hit.path)))
    .map(item => ({ group: item.query.group, query: item.query.query, relevant: item.query.relevant, top3: item.hits.slice(0, 3).map(hit => hit.path) }));

  console.log(JSON.stringify({
    dataset: {
      partition: 'held-out query and corpus split; no ranking changes are made from these scores',
      documents: paths.length,
      queries: heldoutQueries.length,
      groups: Object.fromEntries(groups.map(group => [group, heldoutQueries.filter(item => item.group === group).length])),
      judgments: 'maintainer-authored, synthetic, closed-world; remaining fixture notes are treated as nonrelevant',
      limits: 'not an independent assessor study or evidence of personal-Vault quality',
    },
    quality: {
      currentSubstringBaseline: summarize(current),
      experimentalSegmentedBm25: summarize(experimental),
    },
    top3Misses: { currentSubstringBaseline: misses(current), experimentalSegmentedBm25: misses(experimental) },
  }, null, 2));
} finally {
  invalidateCorpusSearchIndex();
  await rm(root, { recursive: true, force: true });
}
