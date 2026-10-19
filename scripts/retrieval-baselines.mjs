// Research-only segmented BM25 candidate shared by offline evaluation runners.
// The product's substring ranker remains implemented in workflow/corpus.mjs.
import { performance } from 'node:perf_hooks';
const segmenter = new Intl.Segmenter('zh-TW', { granularity: 'word' });
const stopWords = new Set('a an and are as at be does for from how in is it of on or the this through to with why'.split(' '));

export function tokenizeTerms(text) {
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

export async function buildSegmentedBm25Index(paths, readDocument, now = () => performance.now()) {
  const started = now();
  const indexed = [];
  for (const path of paths) {
    const body = await readDocument(path);
    indexed.push({ path, title: path.split('/').pop().replace(/\.md$/i, ''), bodyTerms: tokenizeTerms(body), titleTerms: tokenizeTerms(path) });
  }
  const averageBodyLength = indexed.reduce((sum, doc) => sum + doc.bodyTerms.length, 0) / Math.max(1, indexed.length);
  const averageTitleLength = indexed.reduce((sum, doc) => sum + doc.titleTerms.length, 0) / Math.max(1, indexed.length);
  const documentFrequency = new Map();
  for (const doc of indexed) for (const token of new Set([...doc.bodyTerms, ...doc.titleTerms]))
    documentFrequency.set(token, (documentFrequency.get(token) || 0) + 1);
  const indexBytes = Buffer.byteLength(JSON.stringify(indexed.map(doc => [doc.path, doc.titleTerms, doc.bodyTerms])));
  return {
    documents: indexed.map(doc => ({ ...doc, bodyTf: termFrequencies(doc.bodyTerms), titleTf: termFrequencies(doc.titleTerms) })),
    averageBodyLength,
    averageTitleLength,
    documentFrequency,
    indexBytes,
    buildMs: now() - started,
  };
}

export function searchSegmentedBm25(index, query, limit = 5) {
  const queryTerms = [...new Set(tokenizeTerms(query))];
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
