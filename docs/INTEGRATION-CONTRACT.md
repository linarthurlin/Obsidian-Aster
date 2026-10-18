# Personal Glass integration contract · v1

The theme owns visual styling. Plugins own behavior. All components can be installed independently; no runtime imports or build steps fetch another repository.

Theme repo: https://github.com/linarthurlin/obsidian-personal-glass
Companion repo: https://github.com/linarthurlin/obsidian-personal-glass-companion
Agent repo: https://github.com/linarthurlin/obsidian-knowledge-agent

## Stable CSS contract

Theme-provided tokens: `--pg-surface`, `--pg-text`, `--pg-muted`, `--pg-accent`, `--pg-radius`, `--pg-selection-background`.
Plugins must fall back to Obsidian variables, e.g. `var(--pg-text, var(--text-normal))`. Missing Personal Glass must never prevent a plugin from loading or functioning.

Companion v1 appearance inputs remain `data-personal-palette`, `data-personal-surface`, `data-personal-images`, `data-personal-motion`, `data-personal-native`, `--personal-content-width` and the `--pg-selection-*` inline properties emitted by its selection module. Preserve and restore previous values on unload, including popout documents. The theme defines safe defaults without a companion.

Companion view classes: `.pg-navigator`, `.pg-file`, `[aria-current='page']`. Agent root: `.pga-workbench`; its scoped classes must avoid generic global selectors. The flat selection surface belongs to the theme; companion controls supply colors and angle only.

Third-party adaptations remain isolated in the theme's CSS. Prefer documented tokens; selectors may require per-version maintenance. Canvas/iframe/rendered bitmap internals cannot be promised full theme coverage.

Changing a public token/class requires a compatible transition and cross-repository release notes. Independent versions need not match. Test theme alone, each plugin alone with the default Obsidian theme, and all three together before declaring runtime compatibility.
