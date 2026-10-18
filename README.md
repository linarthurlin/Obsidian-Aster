# Knowledge Agent

[![CI](https://github.com/linarthurlin/obsidian-knowledge-agent/actions/workflows/ci.yml/badge.svg)](https://github.com/linarthurlin/obsidian-knowledge-agent/actions/workflows/ci.yml)

Independent Obsidian knowledge-agent foundation. Installable inert workbench plus a migrated offline source/proposal/review/apply/rollback CLI. No model connection, background scanning or automatic note edits are implemented.

## Separate components

- [Theme](https://github.com/linarthurlin/obsidian-personal-glass) — visual CSS, tokens and adapters.
- [Companion](https://github.com/linarthurlin/obsidian-personal-glass-companion) — UI behavior and appearance controls.
- [Knowledge Agent](https://github.com/linarthurlin/obsidian-knowledge-agent) — knowledge review and future model orchestration.

Each has its own manifest, build, version, installer, CI and releases. No runtime imports or build dependencies on the other repositories. See [integration contract](docs/INTEGRATION-CONTRACT.md), [split/migration](docs/REPOSITORY-SPLIT.md) and [handoff](docs/HANDOFF.zh-TW.md). This Chat owns Agent development; see [current scope](docs/CHAT-SCOPE.zh-TW.md).

## Install

Download `knowledge-agent-plugin-<version>.zip` from [Releases](https://github.com/linarthurlin/obsidian-knowledge-agent/releases). Extract into `<vault>/.obsidian/plugins/knowledge-agent/`. Reload Obsidian and enable this plugin manually. The installer does not activate anything or modify notes/configuration/data.json.

Open **Knowledge Agent: Open knowledge review workbench** from the command palette. The workbench reports the current inert state; it does not pretend to provide model-driven review.

CLI: `npm run knowledge -- search --vault /explicit/corpus --query text`. Apply is a separate explicit operation requiring an exact reviewed digest and unchanged evidence. Plans/receipts contain private note text and must stay outside public source. [Offline workflow](workflow/README.md).

## Develop

Node.js 22.12+ and npm. Run independently in this repo:

```sh
npm ci
npm run check
npm run package
```

Installable output: `dist/plugin`. Release output: `release/current`. CI validates on Linux and Windows; matching `x.y.z` tags publish prereleases with SHA-256 checksums.

The split does not deploy anything into a personal vault. Runtime verification of the independent components remains pending; historical combined-app evidence is clearly separated in [testing](docs/TESTING.md).
