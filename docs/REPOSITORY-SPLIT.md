# Repository split

Source: https://github.com/linarthurlin/obsidian-personal-glass
Public source commit: fe9cc9271e141540a9ffdc42ae0403c1bf79bf58
Last combined release: 0.2.2.

This repository retains the original Git ancestry. The split commit removes unrelated component source from its current tree; no history is rewritten and old releases stay available. Only committed public files were used. Personal vault content, local configuration, credentials, third-party plugin binaries and ignored implementation plans were excluded.

- theme: https://github.com/linarthurlin/obsidian-personal-glass
- companion: https://github.com/linarthurlin/obsidian-personal-glass-companion
- Aster: https://github.com/linarthurlin/Obsidian-Aster

The theme repository no longer publishes companion main.js assets. Existing manual/BRAT companion users must switch the repository to obsidian-personal-glass-companion while keeping plugin folder/id personal-glass. Their data.json is not moved or overwritten. Aster keeps the existing plugin ID knowledge-agent for upgrade compatibility and must be installed/enabled explicitly. Nothing in this split deploys to a vault.
