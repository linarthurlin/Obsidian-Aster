# Design references and third-party notices

Implementation code and CSS in this repository are original. No paid configuration, private notes, wallpapers or Crisp source files are bundled.

- [Obsidian styling](https://docs.obsidian.md/Reference/CSS%20variables/About%20styling): official variables and theme foundations.
- [Minimal](https://github.com/kepano/obsidian-minimal) (MIT): restrained reading and optional card layouts.
- [Border](https://github.com/Akifyss/obsidian-border) (MIT): rounded interface surfaces and spacing.
- [AnuPpuccin](https://github.com/AnubisNekhet/AnuPpuccin) (GPL-3.0): reference for configurable palettes; no code copied.
- [Pseudo Mica](https://github.com/svnaxis/obsidian-pseudo-mica) (MIT): demonstrated Electron native-material feasibility. Native bridge code here is independently implemented.
- [Crisp Craft](https://github.com/letschips/crisp-craft) (MIT): optional independent plugin, not redistributed. Adapter maps its documented CSS tokens.
- [letschips](https://letschips.xyz/): visual and knowledge-workflow inspiration; no affiliation.
- [Microsoft Mica](https://learn.microsoft.com/en-us/windows/apps/design/style/mica) and [Acrylic](https://learn.microsoft.com/en-us/windows/apps/design/style/acrylic): native material distinctions.
- [Apple Liquid Glass](https://developer.apple.com/videos/play/wwdc2025/219/): hierarchy and glass navigation; this project is not an implementation of Apple's renderer.
- [Notion](https://www.notion.com/en-gb/help/keyboard-shortcuts), [Bear](https://bear.app/faq/how-to-use-markdown-in-bear/): keyboard-first editing and readable Markdown.

Build dependencies and their exact versions/licenses are recorded in package-lock.json. esbuild bundles only our plugin implementation; Obsidian and Electron remote remain host-provided externals.
