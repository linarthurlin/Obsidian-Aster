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

Tested on Obsidian 1.13.7 / Electron 43.3.0 with a separate profile and synthetic demo vault: 15 commands registered, multiline Chinese Callout insertion and undo passed, three palette tokens changed correctly, and disable/unload removed plugin attributes and inline width. The Acrylic API accepted the request; desktop transparency, multi-monitor behavior and popout-native materials remain unverified.

`node scripts/setup-demo.mjs` prepares only the repository's demo. `scripts/smoke-obsidian.mjs` expects a separately launched development instance on localhost port 9237, checks the exact vault path before any operation and refuses other vaults. It is not run by CI and should never be pointed at a daily vault.
