# Offline knowledge review workflow

This is an opt-in proposal/review boundary for an agent, not an AI model or automatic organizer. It makes no network requests and runs no background jobs. The Obsidian plugin does not call it automatically. Use an explicitly selected corpus, first with synthetic notes.

An agent can search for existing material, then supply an operations JSON array. Each operation updates an **existing** Markdown file and must include a reason and at least one exact excerpt from a local source. No create, rename, move or delete operations ship in this version.

```json
[
  {
    "path": "Knowledge/Filtering.md",
    "after": "# Filtering\n\nUpdated content with a source link.\n",
    "reason": "Add the missing explanation while preserving existing content",
    "sources": [{"path":"Sources/Lecture.md","excerpt":"Exact source text","locator":"Heading or page reference"}]
  }
]
```

```sh
node workflow/cli.mjs search --vault /selected/corpus --query "Filtering"
node workflow/cli.mjs plan --vault /selected/corpus --operations operations.json --out plan.json
node workflow/cli.mjs review --plan plan.json
# Read the diffs and evidence. Supply the digest of the exact reviewed plan to apply.
node workflow/cli.mjs apply --vault /selected/corpus --plan plan.json --review <digest> --transaction /outside/corpus/transaction.json
node workflow/cli.mjs rollback --vault /selected/corpus --transaction /outside/corpus/transaction.json
```

Planning is read-only. Applying requires an exact review digest, unchanged targets and unchanged source hashes. Transactions are journaled outside the selected vault before writes. Rollback refuses edited targets rather than overwriting later human work. Existing history files cannot be overwritten. Paths with hidden components, traversal and symlinks/junctions are rejected.

The excerpt check proves that quoted text exists, **not** that it logically supports an agent's claims. Human review is still required for reasoning, formula correctness and content preservation. A model confidence score is never treated as a probability of correctness. Review digests are integrity checks, not authentication or a replacement for user authorization.

Source excerpts and full before/after text make plans and receipts sensitive local artifacts. Do not publish them in the public repository. Keep them in an ignored local workspace folder. A crash can leave a `pending` journal; inspect its before/after hashes manually before recovery. This engine does not claim filesystem-wide transactions or immunity to malicious concurrent filesystem changes.
