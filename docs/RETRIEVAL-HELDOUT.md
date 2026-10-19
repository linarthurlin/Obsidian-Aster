# Retrieval held-out check

Run `node scripts/eval-retrieval-heldout.mjs` to compare the shipping substring ranker with the research-only segmented BM25 candidate. The runner generates its own temporary corpus and accepts no Vault path. Its documents and judgments are in `scripts/retrieval-heldout-set.mjs`; development judgments are stored separately in `scripts/retrieval-development-set.mjs`. A test prevents exact normalized query-string and document-path overlap between the two sets.

The held-out set contains 20 synthetic notes and 36 maintainer-authored queries: 8 lexical, 13 natural paraphrases, and 15 hard negatives. Relevance labels are closed-world: each query's listed relevant notes are positive and every other fixture note is treated as nonrelevant. This is a small internal check, not an independent assessor study, a public benchmark, or evidence of quality on a personal Vault. BEIR motivates evaluating retrieval across varied tasks and domains, while TREC describes separating development data from final evaluation topics and relevance judgments; this local fixture only borrows that discipline at a much smaller scale ([BEIR](https://arxiv.org/abs/2104.08663), [TREC evaluation process](https://trec.nist.gov/howto.html)).

| Query group | Queries | Ranker | Precision@3 | Recall@3 | MRR@5 | nDCG@5 |
| --- | ---: | --- | ---: | ---: | ---: | ---: |
| Overall | 36 | Substring | 0.306 | 0.917 | 0.825 | 0.855 |
| Overall | 36 | Segmented BM25 candidate | 0.296 | 0.889 | 0.875 | 0.879 |
| Lexical | 8 | Substring | 0.333 | 1.000 | 1.000 | 1.000 |
| Lexical | 8 | Segmented BM25 candidate | 0.333 | 1.000 | 1.000 | 1.000 |
| Paraphrase | 13 | Substring | 0.282 | 0.846 | 0.577 | 0.646 |
| Paraphrase | 13 | Segmented BM25 candidate | 0.231 | 0.692 | 0.692 | 0.692 |
| Hard negative | 15 | Substring | 0.311 | 0.933 | 0.947 | 0.959 |
| Hard negative | 15 | Segmented BM25 candidate | 0.333 | 1.000 | 0.967 | 0.975 |

The result is mixed. The current ranker has higher overall Recall@3 and performs better on the paraphrase group; the BM25 candidate ranks some hard negatives more cleanly and has higher MRR/nDCG overall. Keep the shipping ranker unchanged. Do not tune the candidate against this held-out set and then reuse these numbers as a held-out claim; further ranking experiments need a new development split, followed by a new untouched evaluation set.

The run also validates that every product-ranker result points to an exact excerpt and line locator in the synthetic source document. These quality scores do not validate Obsidian event behavior, memory use, search latency, or the UI. Those still require the disposable Windows Obsidian runtime check listed in `ROADMAP.md`.
