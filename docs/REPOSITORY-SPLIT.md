# Repository split

Historical monolith source before the naming migration: https://github.com/linarthurlin/obsidian-personal-glass
Public source commit: fe9cc9271e141540a9ffdc42ae0403c1bf79bf58
Last combined release: 0.2.2.

This repository retains the original Git ancestry. The split commit removes unrelated component source from its current tree; no history is rewritten and old releases stay available. Only committed public files were used. Personal vault content, local configuration, credentials, third-party plugin binaries and ignored implementation plans were excluded.

- Halo Theme: https://github.com/linarthurlin/obsidian-halo
- Orbit: https://github.com/linarthurlin/obsidian-orbit
- Aster: https://github.com/linarthurlin/Obsidian-Aster

Existing manual/BRAT Orbit users should use the Orbit repository while retaining the installed companion plugin folder/ID `personal-glass` for upgrade compatibility. Their `data.json` is not moved or overwritten. Aster keeps the existing plugin ID `knowledge-agent` for upgrade compatibility and must be installed/enabled explicitly. Nothing in this split deploys to a vault.
