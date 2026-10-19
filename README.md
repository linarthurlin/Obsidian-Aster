# Aster

[![CI](https://github.com/linarthurlin/Obsidian-Aster/actions/workflows/ci.yml/badge.svg)](https://github.com/linarthurlin/Obsidian-Aster/actions/workflows/ci.yml)

Aster is an independent Obsidian AI Agent plugin. Its first release line provides scoped knowledge retrieval, an opt-in Codex CLI provider, and a source/diff review workbench. No background vault scan or automatic note edits. Halo Theme and Orbit are optional integrations.

## Separate components

- [Halo Theme](https://github.com/linarthurlin/obsidian-halo) — visual CSS, tokens and adapters.
- [Orbit](https://github.com/linarthurlin/obsidian-orbit) — navigation behavior and appearance controls.
- [Aster](https://github.com/linarthurlin/Obsidian-Aster) — agent workspace, knowledge modes and reviewed vault operations.

Each component has its own manifest, build, version, installer, CI and releases. There are no runtime imports or build dependencies on the other repositories. See [integration contract](docs/INTEGRATION-CONTRACT.md), [repository split](docs/REPOSITORY-SPLIT.md), [handoff](docs/HANDOFF.zh-TW.md) and [current chat scope](docs/CHAT-SCOPE.zh-TW.md).

## Install

Download `aster-plugin-VERSION.zip` from [Releases](https://github.com/linarthurlin/Obsidian-Aster/releases). Extract it into `.obsidian/plugins/knowledge-agent`. Reload Obsidian and enable Aster manually. The plugin ID and folder remain `knowledge-agent` for upgrade compatibility. Installation does not activate the plugin or modify notes, `data.json`, or the enabled-plugin list.

Open **Aster: Open Aster Chat** for independent text-only sessions with per-chat model and thinking controls, streamed responses, cancellation, Codex-reported context usage and resumable Codex sessions. Aster keeps a local transcript outside the Vault; Codex also stores its own session. Clearing Aster chats removes its transcript and link, while the Codex session remains available in Codex. Live Chat currently supports the tested Codex CLI `0.162.x` minor. See [Chat scope and storage](docs/CHAT.zh-TW.md).

Open **Aster: Open knowledge review workbench** for scoped retrieval and reviewed note proposals. Choose a corpus folder in Settings, load scoped notes, select a target and query, then inspect the exact context before asking Codex. Review the resulting diff and evidence before explicitly applying an update. See [Codex setup, privacy boundaries and usage](docs/CODEX-CLI.zh-TW.md).

CLI: `npm run aster -- search --vault /explicit/corpus --query text`. The earlier `npm run knowledge` command remains available as an alias. Apply is a separate explicit operation requiring the reviewed digest and unchanged evidence. Plans and receipts contain private note text and must stay outside public source. See [offline workflow](workflow/README.md).

## Develop

Node.js 22.12+ and npm. Run independently in this repo:

    npm ci
    npm run check
    npm run package

Installable output: `dist/plugin`. Release output: `release/current`. CI validates on Linux and Windows; matching `x.y.z` tags publish prereleases with SHA-256 checksums.

Actual Obsidian runtime verification remains pending. Synthetic CLI tests and DOM/unit tests do not replace it; see [testing](docs/TESTING.md).
