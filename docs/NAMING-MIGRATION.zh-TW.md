# Aster naming migration and residual-name audit

Naming contract: `naming-v1`, task `rename-aster-001`, revision 1. Aster already uses its canonical project names, so this task updates only current cross-project references and records the compatibility boundary.

| Component | Current display name | Current package/repository |
| --- | --- | --- |
| Theme | Halo Theme | `obsidian-halo-theme` · [linarthurlin/obsidian-halo](https://github.com/linarthurlin/obsidian-halo) |
| Companion plugin | Orbit | `obsidian-orbit` · [linarthurlin/obsidian-orbit](https://github.com/linarthurlin/obsidian-orbit); existing Obsidian plugin ID/folder: `personal-glass` |
| Agent plugin | Aster | `obsidian-aster` · [linarthurlin/Obsidian-Aster](https://github.com/linarthurlin/Obsidian-Aster) |

The Aster repository, npm package, manifest display name, and release artifact were already canonical; this task leaves them in place. It updates the README, integration contract, repository split record, handoff, installation, testing, roadmap, chat-scope, and implementation-plan references to Halo and Orbit. The historical monolith source URL remains in `REPOSITORY-SPLIT.md` to identify provenance.

## Intentional residual identifiers

- `knowledge-agent` remains the Obsidian plugin ID, install folder, and component ID; `knowledge-agent-workbench` remains the Workbench view type. Changing these would make Obsidian treat an existing install as a different plugin and could lose access to existing settings.
- `.knowledge-agent/transactions` remains the private journal directory. Existing recovery records must stay discoverable across upgrades.
- `.pga-*` remains Aster's scoped CSS namespace. `.pg-*`, `--pg-*`, `data-personal-*`, and `--personal-*` remain Halo/Orbit v1 compatibility hooks already used by installed components.
- `knowledge-agent-plugin-*` and `knowledge-agent-workflow-*` remain accepted legacy release artifact prefixes in the packaging allowlist; new releases use `aster-*` names.
- The old `.obsidian/plugins/personal-glass` directory remains in the synthetic installer fixture to prove Aster preserves Orbit's existing files. Orbit's stable plugin ID and folder remain `personal-glass`; its upgrade migration is owned by Orbit.
- The old Personal Glass monolith URL, the initial pre-split `CHANGELOG.md` entry, and the historical coexistence note in `HISTORICAL-MONOLITH-TESTING.md` are provenance only. They are not current product names or install destinations and are left unchanged as history.

No plugin ID, persistent data path, settings key, data attribute, public selector, or release history was rewritten as a brand-only cleanup. Internal atomic-write temp files now use the `.aster-transaction-*` prefix; no startup or recovery logic consumes that transient prefix. The disposable runtime was not launched for this documentation and reference migration. GitHub API verification now resolves Aster (`linarthurlin/Obsidian-Aster`), Halo (`linarthurlin/obsidian-halo`), and Orbit (`linarthurlin/obsidian-orbit`) as public repositories under the expected owner. An earlier check ran before the coordinated Halo and Orbit renames completed; all three canonical repository identities are now verified.

## Residual-name audit

Current product-facing names are Halo Theme, Orbit, and Aster. Remaining `Personal Glass` / `personal-glass` strings are limited to historical provenance, compatibility paths, and the synthetic preservation fixture listed above. Remaining `knowledge-agent` strings are the intentional Aster install and recovery interfaces listed above. The audit excludes `node_modules`, generated `dist`/`release` output, and `.local` task artifacts.
