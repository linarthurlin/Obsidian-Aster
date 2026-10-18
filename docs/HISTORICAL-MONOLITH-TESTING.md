# Historical monolith evidence

These results predate the repository split and do not verify the split components.

# Testing

`npm run check` builds and checks TypeScript, settings normalization, multiline Markdown insertions, native-material failure/unload behavior, installation boundaries, CSS parsing, offline assets and synchronized manifests.

Installer tests use temporary synthetic vaults. They verify preservation of notes, appearance settings, plugin activation lists and existing plugin data, including repeated installations and junction rejection.

## Manual application matrix

Use the included demo note and image in an isolated Obsidian vault:

- Warm / Mineral / Rose × light / dark.
- Focus / Glass / Portable; native material none / Mica / Acrylic.
- Reading / Live Preview / Source.
- Chinese IME, undo/redo, multiline selection and slash search.
- Wide tables, math, code, images, folded Callouts and Markdown embeds.
- Main / split / popout windows, 100% / 125% / 150% scaling.
- Reduced motion, high contrast, transparency disabled, print.
- Disable plugin: attributes and width removed; native request returned to auto; notes unchanged.

Native API success means the API accepted the request, not proof that Windows rendered transparency. Record OS, Obsidian and Electron versions and compare against visible content behind the app. Browser preview only demonstrates CSS, never OS material support.

## Development smoke result

0.2.0 tested on Obsidian application 1.14.4 (desktop shell user-agent 1.13.7) / Electron 43.3.0 on Windows, using a separate profile and synthetic demo vault. All 26 unit/integration tests pass locally; no personal notes are used as test fixtures.

- 17 commands registered; multiline Chinese Callout insertion, undo and disable/unload cleanup passed.
- Navigator alias + hierarchical tag search, focus without opening, pins and opt-in previews passed. Pure tests cover scope boundaries, natural ordering and renamed references.
- Notebook Navigator 3.4.3, Crisp Craft 0.1.5, Tables 1.5.0, Advanced Canvas 6.5.0 and Ninja Cursor 0.0.14 loaded alongside Personal Glass. Reading View, Live Preview and a two-node Canvas rendered; six fixture note hashes stayed unchanged. This is coexistence smoke coverage, not exhaustive editing or daily-use certification.
- SVG light/dark examples passed XML/offline checks and actual rendered inspection. Intrinsic dimensions prevent collapsed embeds; conservative line wrapping keeps labels within cards.
- All 24 palette/mode/material combinations accepted their expected API requests. A real popout used a separate document, received appearance attributes and accepted Acrylic. Two emulated viewport sizes had no body overflow.
- Emulated reduced motion, reduced transparency and forced colors applied the expected CSS fallbacks. A specificity regression in reduced transparency was fixed.
- Offline proposal/apply/rollback tests cover exact evidence, review digests, stale sources/targets, multi-note preflight, subsequent human edits, duplicate targets, history reuse, path traversal and junction boundaries.

Native API acceptance is **not** proof of desktop blur. Focus, physical resizing, wallpaper differences, OS transparency settings, DPI/multi-monitor behavior, screen readers and long-term editing remain manual checks. No personal-vault knowledge updates were performed.

`node scripts/setup-demo.mjs` prepares only the repository's demo. `scripts/smoke-obsidian.mjs` expects a separately launched development instance on localhost port 9237, checks the exact vault path before any operation and refuses other vaults. It is not run by CI and should never be pointed at a daily vault.

`scripts/setup-integrations.mjs` accepts optional locally obtained plugin release assets under ignored `.local/third-party/`; `--installed-from` copies only named plugin code files, never personal `data.json`. Third-party binaries are neither committed nor redistributed. Run `scripts/smoke-integrations.mjs` and `scripts/smoke-materials.mjs` sequentially, with the isolated demo window visible so Obsidian's paint-dependent renderer can run. The integration test closes other synthetic note/Canvas tabs for repeatable captures. Save results under ignored `output/obsidian` and inspect the screenshots.
