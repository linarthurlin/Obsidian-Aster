# Halo Theme, Orbit, and Aster integration contract · v1

The theme owns visual styling. Plugins own behavior. All components can be installed independently; no runtime imports or build steps fetch another repository.

Halo Theme repo: https://github.com/linarthurlin/obsidian-halo
Orbit repo: https://github.com/linarthurlin/obsidian-orbit
Aster repo: https://github.com/linarthurlin/Obsidian-Aster

Orbit is the current product name for the existing companion plugin. Its Obsidian plugin ID and install folder remain `personal-glass` for upgrade compatibility; its settings and stored data remain Orbit-owned. Aster installers must preserve that directory and data.

## Stable CSS contract

Halo's v1 compatibility tokens remain `--pg-surface`, `--pg-text`, `--pg-muted`, `--pg-accent`, `--pg-radius`, and `--pg-selection-background`. The `pg` prefix is a retained legacy interface. Plugins must fall back to Obsidian variables, e.g. `var(--pg-text, var(--text-normal))`; missing Halo or Orbit must never prevent Aster from loading or functioning.

Orbit v1 appearance inputs retain the `data-personal-palette`, `data-personal-surface`, `data-personal-images`, `data-personal-motion`, `data-personal-native`, `--personal-content-width`, and `--pg-selection-*` names. These prefixes are stable compatibility hooks. Preserve and restore previous values on unload, including popout documents. Halo defines safe defaults without Orbit.

Orbit view classes: `.pg-navigator`, `.pg-file`, `[aria-current='page']`; the `pg` selectors remain for compatibility. Aster roots are `.pga-workbench` and `.pga-chat`; their scoped classes must avoid generic global selectors. The flat selection surface belongs to Halo; Orbit controls supply colors and angle only.

Third-party adaptations remain isolated in the theme's CSS. Prefer documented tokens; selectors may require per-version maintenance. Canvas/iframe/rendered bitmap internals cannot be promised full theme coverage.

Changing a public token/class requires a compatible transition and cross-repository release notes. Independent versions need not match. Test Halo alone, each plugin alone with the default Obsidian theme, and all three together before declaring runtime compatibility.
