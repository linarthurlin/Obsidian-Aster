Knowledge Agent 0.2.0 development prerelease.

- Adds explicit-folder local retrieval with bounded targets and source excerpts.
- Adds Codex CLI provider using existing CLI authentication, direct process arguments, isolated cwd, read-only sandbox, ephemeral structured output and disabled tool features. No API keys stored by the plugin.
- Adds exact-context preview/consent, source-backed model proposals, diff/evidence review, explicit single-note apply and protected rollback.
- Adds context and codex-plan CLI commands, cancellation/timeouts, stale-context checks and boundary/DOM tests.
- Installed Codex CLI 0.162.1 passed three synthetic live cases. Actual Obsidian runtime and broader retrieval-quality validation remain pending.

No personal-vault reading, transmission, deployment or organization was performed. Read docs/CODEX-CLI.zh-TW.md before using personal content: model calls transmit the approved context and use the existing account. A read-only CLI sandbox is not a complete OS read-access jail; explicit review remains required.
