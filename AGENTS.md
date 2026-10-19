# Aster scope

This repository owns only the Aster plugin (Obsidian ID knowledge-agent) and its offline review/provenance/rollback engine.
Do not implement theme-wide CSS or companion navigation/appearance features here. See docs/INTEGRATION-CONTRACT.md and docs/HANDOFF.zh-TW.md.

Never use personal vault notes as fixtures or commit credentials, local config, private plans, receipts or third-party binaries. Do not deploy or activate plugins unless the user asks. Existing vault notes must remain untouched. Run npm run check and npm run package before publishing. Do not claim runtime/visual verification from unit tests alone. Preserve the repository split and independent releases.

## Supervisor task handoff

- For an assigned Supervisor task, include its exact `task_id` and `revision` in the local result JSON under `.local/supervisor/`; keep `.local/` ignored and do not publish those artifacts.
- Preserve the existing Aster scope above. Do not modify Halo or Orbit product repos from this checkout, move product directories, deploy to a Vault, or send cross-chat messages unless the user separately authorizes it.
