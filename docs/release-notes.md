Personal Glass 0.2.1 development prerelease.

- Adds configurable Champagne × Sage selection glass: independent light/dark endpoint colors and opacity, background blur, highlight/shadow strength, gradient angle, live settings preview and reset.
- Keeps the current file visibly filled, replaces the single side indicator, avoids stale selected rows, adapts foreground text for custom colors, and restores inline appearance variables on unload.
- Applies the shared selection surface to the built-in Navigator, native File explorer and optional Notebook Navigator.

The new selection controls have TypeScript, settings and CSS validation coverage. Real application rendering of this increment still needs visual verification; the previous 0.2.0 app smoke results do not establish pixel fidelity to the selected concept image.

Previous 0.2.0 features:

- Integrates an original read-only Navigator: adaptive folder/list panes, aliases and #tags, recent files, pins, natural sorting, keyboard navigation and optional local previews.
- Adds independent Notebook Navigator theme tokens and an optional open command.
- Aligns common Live Preview components with Reading View tokens and checks Crisp Craft/table/canvas/cursor coexistence in a synthetic vault.
- Ships a reusable offline SVG authoring skill, three light/dark examples, intrinsic dimensions and conservative label wrapping.
- Ships a separate offline knowledge proposal/review CLI with source excerpts, diffs, digest checks, stale-file preflight, journaled updates and rollback protection for later human edits. No model, automatic ingestion or background organization.
- Fixes reduced-transparency CSS being overridden by surface selection and keeps main-window material status independent of popouts.
- Includes theme, plugin and offline-tools ZIPs, manual/BRAT plugin assets and SHA-256 checksums.

Installations copy only the project's five theme/plugin distribution files and preserve notes, activation lists, appearance settings and plugin data. Reload the plugin manually; the Navigator is available from its ribbon icon and command palette.

Native material API acceptance is not proof of OS blur. Real desktop focus/wallpaper/DPI/multi-monitor behavior and long-term plugin editing remain manual checks. The offline CLI has been exercised only on synthetic fixtures; no personal-vault content was reorganized.
