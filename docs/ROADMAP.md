# Implementation roadmap

- [x] Modular standalone theme with paired light/dark palettes.
- [x] Companion appearance controls and Markdown insertion commands.
- [x] Optional native-material bridge with fallback and unload cleanup.
- [x] Build, validation, package and isolated installer tooling.
- [x] Linux/Windows CI and tag-driven development releases.
- [ ] Complete native-material visual matrix on a real Windows desktop: focus, resize, popouts, transparency disabled and different wallpapers.
- [ ] Daily-use verification with common table, canvas and cursor plugins.
- [ ] Match the most-used Live Preview components to Reading View without hiding editable syntax.
- [ ] Test optional Crisp Craft alongside theme tokens.
- [ ] Create reusable, offline SVG authoring skill with light/dark examples.
- [ ] Separate opt-in knowledge workflow: source provenance, search-before-create, dry-run diffs, reviewed updates and rollback.

Agent ingestion is a separate milestone. It must not require moving existing notes or uploading entire vaults. Start with synthetic fixtures, then a small explicitly selected corpus and measurable retrieval/edit quality. No Agent storage schema is imposed by the theme.
