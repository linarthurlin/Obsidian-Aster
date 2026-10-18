# Knowledge Agent testing

Run npm ci, npm run check and npm run package independently in this repository. CI repeats checks on Linux and Windows. Installer tests use temporary synthetic vaults and reject linked directories. Only three files for this plugin may be installed; notes, existing data.json and activation lists are preserved.

Offline workflow tests preserve the proposal/review/source/stale-edit/rollback boundary. The plugin lifecycle test verifies an inert load without accessing a vault or provider. No model or automatic ingestion is implemented.

Fresh Obsidian runtime testing of the three split components, plugin-alone/default-theme fallback, unload/popouts and joint visual integration remains pending. Do not infer it from historical monolith screenshots. See HISTORICAL-MONOLITH-TESTING.md.
