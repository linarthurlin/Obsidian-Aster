import { expect, it } from 'vitest';
import { developmentQueries } from '../scripts/retrieval-development-set.mjs';
import { heldoutDocuments, heldoutQueries } from '../scripts/retrieval-heldout-set.mjs';

it('keeps held-out queries, documents and relevance judgments disjoint from the development set', () => {
  const developmentText = new Set(developmentQueries.map(item => item.query.normalize('NFKC').trim().toLowerCase()));
  expect(heldoutQueries.every(item => !developmentText.has(item.query.normalize('NFKC').trim().toLowerCase()))).toBe(true);
  expect(Object.keys(heldoutDocuments).length).toBeGreaterThanOrEqual(18);
  expect(new Set(heldoutQueries.map(item => item.query)).size).toBe(heldoutQueries.length);
  expect(Object.keys(heldoutDocuments).some(path => developmentQueries.some(query => query.relevant.includes(path)))).toBe(false);
  for (const item of heldoutQueries) {
    expect(['lexical', 'paraphrase', 'hard-negative']).toContain(item.group);
    expect(item.relevant.length).toBeGreaterThan(0);
    expect(item.relevant.every(path => Object.hasOwn(heldoutDocuments, path))).toBe(true);
  }
});

it('contains natural paraphrases and deliberately overlapping hard-negative queries', () => {
  expect(heldoutQueries.filter(item => item.group === 'paraphrase')).toHaveLength(13);
  expect(heldoutQueries.filter(item => item.group === 'hard-negative')).toHaveLength(15);
  expect(heldoutQueries.some(item => item.group === 'paraphrase' && item.query.includes('prompt capacity'))).toBe(true);
  expect(heldoutQueries.some(item => item.group === 'hard-negative' && item.query === 'meeting action owner due date')).toBe(true);
});
