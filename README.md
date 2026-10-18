# Knowledge Agent

[![CI](https://github.com/linarthurlin/obsidian-knowledge-agent/actions/workflows/ci.yml/badge.svg)](https://github.com/linarthurlin/obsidian-knowledge-agent/actions/workflows/ci.yml)

Independent Obsidian knowledge agent with explicit-folder retrieval, an opt-in Codex CLI provider and a source/diff review workbench. No background scanning or automatic edits. Personal Glass Theme and Companion are optional.

## Separate components

- [Theme](https://github.com/linarthurlin/obsidian-personal-glass) — visual CSS, tokens and adapters.
- [Companion](https://github.com/linarthurlin/obsidian-personal-glass-companion) — UI behavior and appearance controls.
- [Knowledge Agent](https://github.com/linarthurlin/obsidian-knowledge-agent) — knowledge review and future model orchestration.

Each has its own manifest, build, version, installer, CI and releases. No runtime imports or build dependencies on the other repositories. See [integration contract](docs/INTEGRATION-CONTRACT.md), [split/migration](docs/REPOSITORY-SPLIT.md) and [handoff](docs/HANDOFF.zh-TW.md). This Chat owns Agent development; see [current scope](docs/CHAT-SCOPE.zh-TW.md).

## Install

Download `knowledge-agent-plugin-<version>.zip` from [Releases](https://github.com/linarthurlin/obsidian-knowledge-agent/releases). Extract into `<vault>/.obsidian/plugins/knowledge-agent/`. Reload Obsidian and enable this plugin manually. The installer does not activate anything or modify notes/configuration/data.json.

Open **Knowledge Agent: Open knowledge review workbench** from the command palette. Choose a corpus folder in Settings, load scoped notes, select a target and query, then preview and approve the exact context before asking Codex. Review the resulting diff and evidence before explicitly applying an update. [CLI setup, privacy boundaries and usage](docs/CODEX-CLI.zh-TW.md).

CLI: `npm run knowledge -- search --vault /explicit/corpus --query text`. Apply is a separate explicit operation requiring an exact reviewed digest and unchanged evidence. Plans/receipts contain private note text and must stay outside public source. [Offline workflow](workflow/README.md).

## Develop

Node.js 22.12+ and npm. Run independently in this repo:

```sh
npm ci
npm run check
npm run package
```

Installable output: `dist/plugin`. Release output: `release/current`. CI validates on Linux and Windows; matching `x.y.z` tags publish prereleases with SHA-256 checksums.

The split does not deploy anything into a personal vault. Actual Obsidian runtime verification remains pending; synthetic live Codex tests and DOM/unit tests do not replace it; historical combined-app evidence is clearly separated in [testing](docs/TESTING.md).
