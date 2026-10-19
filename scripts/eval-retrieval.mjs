// Repeatable, offline retrieval evaluation over generated synthetic notes only.
// This runner has no Vault path argument and never reads the user's Corpus.
import { randomUUID } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import { LIMITS, listNotes, searchCorpus } from '../workflow/corpus.mjs';

const segmenter = new Intl.Segmenter('zh-TW', { granularity: 'word' });
const stopWords = new Set('a an and are as at be does for from how in is it of on or the this through to with why'.split(' '));
const nearLimit = process.argv.includes('--near-limit');

function terms(text) {
  return [...segmenter.segment(text.normalize('NFKC').toLowerCase())]
    .filter(part => part.isWordLike)
    .map(part => part.segment)
    .filter(term => !stopWords.has(term) && (term.length > 1 || /\p{Script=Han}/u.test(term)));
}

function termFrequencies(tokens) {
  const frequencies = new Map();
  for (const token of tokens) frequencies.set(token, (frequencies.get(token) || 0) + 1);
  return frequencies;
}

async function buildSegmentedBm25Index(root) {
  const started = performance.now();
  const indexed = [];
  for (const path of await listNotes(root)) {
    const body = await readFile(join(root, path), 'utf8');
    indexed.push({ path, title: path.split('/').pop().replace(/\.md$/i, ''), bodyTerms: terms(body), titleTerms: terms(path) });
  }
  const averageBodyLength = indexed.reduce((sum, doc) => sum + doc.bodyTerms.length, 0) / indexed.length;
  const averageTitleLength = indexed.reduce((sum, doc) => sum + doc.titleTerms.length, 0) / indexed.length;
  const documentFrequency = new Map();
  for (const doc of indexed) for (const token of new Set([...doc.bodyTerms, ...doc.titleTerms]))
    documentFrequency.set(token, (documentFrequency.get(token) || 0) + 1);
  const indexBytes = Buffer.byteLength(JSON.stringify(indexed.map(doc => [doc.path, doc.titleTerms, doc.bodyTerms])));
  return { documents: indexed.map(doc => ({ ...doc, bodyTf: termFrequencies(doc.bodyTerms), titleTf: termFrequencies(doc.titleTerms) })),
    averageBodyLength, averageTitleLength, documentFrequency, indexBytes, buildMs: performance.now() - started };
}

function searchSegmentedBm25(index, query, limit = 5) {
  const queryTerms = [...new Set(terms(query))];
  const k1 = 1.2, b = 0.75;
  const fieldScore = (frequency, length, averageLength) => frequency * (k1 + 1)
    / (frequency + k1 * (1 - b + b * length / Math.max(1, averageLength)));
  const hits = [];
  for (const doc of index.documents) {
    let score = 0, matched = 0;
    for (const term of queryTerms) {
      const bodyFrequency = doc.bodyTf.get(term) || 0;
      const titleFrequency = doc.titleTf.get(term) || 0;
      if (!bodyFrequency && !titleFrequency) continue;
      matched++;
      const df = index.documentFrequency.get(term) || 0;
      const inverseDocumentFrequency = Math.log(1 + (index.documents.length - df + 0.5) / (df + 0.5));
      score += inverseDocumentFrequency * (fieldScore(bodyFrequency, doc.bodyTerms.length, index.averageBodyLength)
        + 2.5 * fieldScore(titleFrequency, doc.titleTerms.length, index.averageTitleLength));
    }
    if (queryTerms.length && matched / queryTerms.length < 0.2) continue;
    if (score) hits.push({ path: doc.path, score });
  }
  return hits.sort((a, b) => b.score - a.score || a.path.localeCompare(b.path)).slice(0, limit);
}

const canonicalNotes = {
  'Research/神經可塑性.md': '# 神經可塑性\n\n神經可塑性描述神經連結如何因學習與經驗改變。這篇說明大腦因學習改變連結，並討論新技能練習。\n',
  'Research/大腦學習.md': '# 大腦學習\n\n探討大腦學習、神經可塑性和不同學習方法，並比較練習如何形成新技能。\n',
  'Research/Neural circuits.md': '# Neural circuits\n\nNeural circuits coordinate signals between regions. Neurons communicate through electrical signals and synchronized synaptic activity.\n',
  'Research/Memory consolidation.md': '# Memory consolidation\n\n記憶鞏固（memory consolidation）穩定新學到的資訊。Consolidation stabilizes memories over time after learning.\n',
  'Research/Memory retrieval.md': '# Memory retrieval\n\nRetrieval practice and spaced repetition can support memory retention and later recall. The spacing effect supports learning across sessions. 間隔練習有助於記憶提取。\n',
  'Research/Sleep and memory.md': '# Sleep and memory\n\n睡眠期間，新記憶會逐步穩定並進行鞏固。Sleep supports memory stabilization after learning.\n',
  'Knowledge/AI 知識整理.md': '# AI 知識整理\n\nAgent workflow 以引用與來源追溯維護知識庫，讓讀者能回到原始證據。\n',
  'AI/Knowledge Workflow.md': '# Knowledge workflow for AI\n\nAn AI agent uses a reviewable workflow to preserve citations, evidence, and source provenance.\n',
  'AI/Agent Workflow.md': '# Agent workflow\n\nThe AI knowledge workflow connects source notes, citations, and review steps before a proposal is applied.\n',
  'Research/Source provenance.md': '# Source provenance\n\nCitation provenance records the source path and exact excerpt for each claim. 來源路徑與精確摘錄讓引用可追溯至原始段落。\n',
  'Research/Citation formats.md': '# Citation formats\n\nCitation formats differ. A source citation should identify the evidence location and preserve an exact excerpt.\n',
  'Research/Meeting.md': '# Meeting decisions\n\nDecisions assign an owner and deadline to each follow-up. 會議決策記錄負責人與截止日期。\n',
  'Archive/Meeting.md': '# Archived meeting\n\nHistorical decisions list an owner; the deadline was removed from this archived record.\n',
};

const queries = [
  { group: 'lexical', query: '神經可塑性', relevant: ['Research/神經可塑性.md'] },
  { group: 'lexical', query: '大腦因學習改變連結', relevant: ['Research/神經可塑性.md'] },
  { group: 'lexical', query: '大腦 學習 神經可塑性', relevant: ['Research/大腦學習.md', 'Research/神經可塑性.md'] },
  { group: 'paraphrase', query: 'brain rewiring', relevant: ['Research/神經可塑性.md'] },
  { group: 'lexical', query: '記憶鞏固', relevant: ['Research/Memory consolidation.md'] },
  { group: 'lexical', query: 'memory consolidation', relevant: ['Research/Memory consolidation.md'] },
  { group: 'lexical', query: '記憶在睡眠期間穩定', relevant: ['Research/Sleep and memory.md'] },
  { group: 'lexical', query: 'spacing effect memory', relevant: ['Research/Memory retrieval.md'] },
  { group: 'lexical', query: '間隔練習記憶', relevant: ['Research/Memory retrieval.md'] },
  { group: 'lexical', query: 'AI 知識整理', relevant: ['Knowledge/AI 知識整理.md'] },
  { group: 'lexical', query: 'AI knowledge workflow citations', relevant: ['AI/Knowledge Workflow.md', 'AI/Agent Workflow.md'] },
  { group: 'lexical', query: '來源路徑 精確摘錄', relevant: ['Research/Source provenance.md'] },
  { group: 'lexical', query: 'citation provenance source path', relevant: ['Research/Source provenance.md'] },
  { group: 'lexical', query: '引用來源可追溯', relevant: ['Research/Source provenance.md'] },
  { group: 'lexical', query: '會議決策 負責人 截止日期', relevant: ['Research/Meeting.md'] },
  { group: 'lexical', query: 'meeting owner deadline', relevant: ['Research/Meeting.md', 'Archive/Meeting.md'] },
  { group: 'lexical', query: 'archived deadline removed', relevant: ['Archive/Meeting.md'] },
  { group: 'paraphrase', query: 'neurons talk to each other', relevant: ['Research/Neural circuits.md'] },
  { group: 'lexical', query: 'neural circuits coordinate signals', relevant: ['Research/Neural circuits.md'] },
  { group: 'paraphrase', query: 'how does the brain learn a new skill', relevant: ['Research/大腦學習.md', 'Research/神經可塑性.md'] },
];

function quantile(values, proportion) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * proportion) - 1)] || 0;
}

function scoreGroup(records) {
  let precisionAt3 = 0, recallAt3 = 0, reciprocalRank = 0, discountedGain = 0, idealGain = 0;
  for (const { query, hits } of records) {
    const relevant = new Set(query.relevant);
    const top3 = hits.slice(0, 3);
    precisionAt3 += top3.filter(hit => relevant.has(hit.path)).length / 3;
    recallAt3 += top3.filter(hit => relevant.has(hit.path)).length / relevant.size;
    const rank = hits.findIndex(hit => relevant.has(hit.path));
    if (rank >= 0) reciprocalRank += 1 / (rank + 1);
    for (const [index, hit] of hits.entries()) if (relevant.has(hit.path)) discountedGain += 1 / Math.log2(index + 2);
    for (let index = 0; index < Math.min(5, relevant.size); index++) idealGain += 1 / Math.log2(index + 2);
  }
  const count = records.length;
  return {
    queries: count,
    precisionAt3: precisionAt3 / count,
    recallAt3: recallAt3 / count,
    mrrAt5: reciprocalRank / count,
    nDcgAt5: idealGain ? discountedGain / idealGain : 0,
  };
}

const parent = join(resolve('.local'), 'retrieval-eval');
await mkdir(parent, { recursive: true });
const root = await mkdtemp(join(parent, randomUUID() + '-'));
try {
  const documents = { ...canonicalNotes };
  const filler = 'Synthetic archive material about unrelated backups, catalog maintenance, and local operational history. ';
  const fillerRepeat = nearLimit ? 100 : 16;
  const fillerLimit = nearLimit ? 19_000_000 : Number.POSITIVE_INFINITY;
  let corpusBytes = Object.values(documents).reduce((sum, text) => sum + Buffer.byteLength(text), 0);
  const fillerCountLimit = LIMITS.files - Object.keys(documents).length;
  for (let index = 1; index <= fillerCountLimit; index++) {
    if (!nearLimit && index > 300) break;
    const content = `# Archive record ${index}\n\n${filler.repeat(fillerRepeat)}\n`;
    const contentBytes = Buffer.byteLength(content);
    if (corpusBytes + contentBytes > fillerLimit) break;
    documents[`Scale/Archive-${String(index).padStart(4, '0')}.md`] = content;
    corpusBytes += contentBytes;
  }
  for (const [path, content] of Object.entries(documents)) {
    const target = join(root, path);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, content);
  }

  const casesToRun = nearLimit
    ? ['記憶在睡眠期間穩定', 'AI knowledge workflow citations', 'brain rewiring'].map(value => queries.find(query => query.query === value))
    : queries;
  const measured = [];
  for (const query of casesToRun) {
    const started = performance.now();
    const result = await searchCorpus(root, query.query, 5);
    const elapsedMs = performance.now() - started;
    if (result.scannedBytes > 20_000_000) throw new Error(`Search exceeded its byte budget for: ${query.query}`);
    for (const hit of result.results) {
      const source = await readFile(join(root, hit.path), 'utf8');
      const beforeExcerpt = source.slice(0, source.indexOf(hit.excerpt));
      if (!source.includes(hit.excerpt) || hit.startLine !== beforeExcerpt.split('\n').length)
        throw new Error(`Invalid excerpt locator for ${query.query}: ${hit.path}`);
      if (hit.excerpt.length > 420) throw new Error(`Search excerpt exceeded its limit for: ${query.query}`);
    }
    measured.push({ query, hits: result.results, elapsedMs, scannedBytes: result.scannedBytes,
      excerptChars: result.results.reduce((total, hit) => total + hit.excerpt.length, 0) });
  }

  const segmentedIndex = await buildSegmentedBm25Index(root);
  const experimental = casesToRun.map(query => {
    const started = performance.now();
    const hits = searchSegmentedBm25(segmentedIndex, query.query);
    return { query, hits, elapsedMs: performance.now() - started };
  });

  const lexical = measured.filter(item => item.query.group === 'lexical');
  const paraphrase = measured.filter(item => item.query.group === 'paraphrase');
  const experimentalLexical = experimental.filter(item => item.query.group === 'lexical');
  const experimentalParaphrase = experimental.filter(item => item.query.group === 'paraphrase');
  const output = {
    dataset: 'synthetic only; hand-authored Traditional Chinese, English and mixed-language questions',
    mode: nearLimit ? 'near 20 MB Corpus budget' : 'small relevance set',
    corpus: { files: Object.keys(documents).length, bytes: corpusBytes, configuredSearchLimitBytes: LIMITS.searchBytes },
    tokenizerExample: { query: '大腦因學習改變連結', terms: terms('大腦因學習改變連結') },
    quality: {
      currentSubstringBaseline: { overall: scoreGroup(measured), lexical: scoreGroup(lexical), paraphrase: scoreGroup(paraphrase) },
      experimentalSegmentedBm25: { overall: scoreGroup(experimental), lexical: scoreGroup(experimentalLexical), paraphrase: scoreGroup(experimentalParaphrase) },
    },
    cost: {
      scanBytesPerQuery: { p50: quantile(measured.map(item => item.scannedBytes), 0.5), p95: quantile(measured.map(item => item.scannedBytes), 0.95) },
      returnedExcerptCharsPerQuery: { p50: quantile(measured.map(item => item.excerptChars), 0.5), p95: quantile(measured.map(item => item.excerptChars), 0.95), max: Math.max(...measured.map(item => item.excerptChars)) },
      latencyMs: { p50: quantile(measured.map(item => item.elapsedMs), 0.5), p95: quantile(measured.map(item => item.elapsedMs), 0.95) },
      experimentalIndex: { buildMs: segmentedIndex.buildMs, serializedTokenBytes: segmentedIndex.indexBytes,
        queryLatencyMs: { p50: quantile(experimental.map(item => item.elapsedMs), 0.5), p95: quantile(experimental.map(item => item.elapsedMs), 0.95) } },
    },
    misses: {
      current: measured.filter(item => !item.hits.some(hit => item.query.relevant.includes(hit.path))).map(item => item.query.query),
      experimental: experimental.filter(item => !item.hits.some(hit => item.query.relevant.includes(hit.path))).map(item => item.query.query),
    },
  };
  console.log(JSON.stringify(output, null, 2));
} finally {
  await rm(root, { recursive: true, force: true });
}
