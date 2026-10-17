# Implementation roadmap

- [x] Modular standalone theme with paired light/dark palettes.
- [x] Companion appearance controls and Markdown insertion commands.
- [x] Optional native-material bridge with fallback and unload cleanup.
- [x] Build, validation, package and isolated installer tooling.
- [x] Linux/Windows CI and tag-driven development releases.
- [x] Original read-only Navigator: adaptive folder/list layout, recent files, pins, alias/tag search, keyboard navigation and opt-in bounded previews.
- [x] Optional Notebook Navigator token adapter and open command; no copied third-party implementation.
- [x] Native API matrix: three palettes × two modes × none/Mica/Acrylic/Mica Alt, popout document, viewport resize and emulated reduced motion/transparency/high contrast.
- [ ] Complete native-material visual matrix on a real Windows desktop: focus, physical resize, OS transparency disabled, wallpapers, DPI and multi-monitor behavior. API acceptance and browser emulation do not establish these results.
- [x] Initial coexistence check with table, canvas and cursor plugins; synthetic Canvas and Live Preview smoke tests.
- [ ] Daily-use verification with common table, canvas and cursor plugins, including editing, IME, undo, plugin upgrades and large-vault performance over time.
- [x] Match common Live Preview typography/code/quotes/images/callouts/tables to Reading View tokens without hiding editable syntax; verify Chinese multiline insertion/undo.
- [ ] Complete manual IME, selections, wide-table editing, printing and screen-reader checks. Crisp Craft Reading View decorations need not be pixel-identical to the editor.
- [x] Test optional Crisp Craft alongside theme tokens and real image embeds; correct SVG intrinsic dimensions and label wrapping.
- [x] Reusable offline SVG authoring skill with three paired light/dark examples, XML checks and rendered inspection.
- [x] Separate opt-in knowledge workflow: source provenance, related-note search, dry-run diffs, exact review digest, stale-file checks, journaled updates and rollback.
- [ ] Agent ingestion and retrieval-quality evaluation on an explicitly selected corpus. The shipped workflow is an offline review engine, not an AI model or background organizer.

Updated for 0.2.0. Completed means implemented and checked against synthetic fixtures; it does not imply long-term daily-vault validation.

Agent ingestion must not require moving existing notes or uploading entire vaults. Start with synthetic fixtures, then a small explicitly selected corpus and measurable retrieval/edit quality. No Agent storage schema is imposed by the theme. No knowledge-workflow updates have been applied to the personal vault.

See [Navigator usage](NAVIGATOR.zh-TW.md), [testing evidence and limits](TESTING.md), [offline workflow](../workflow/README.md), and [SVG skill](../skills/personal-glass-svg/SKILL.md).
