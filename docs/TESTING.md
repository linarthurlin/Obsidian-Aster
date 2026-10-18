# Knowledge Agent testing

`npm run check` validates TypeScript, plugin build, offline CSS, manifests, review engine, installer isolation, scoped retrieval, model output boundaries and subprocess errors/cancellation/timeout/output limits. DOM tests run the actual plugin bundle with mocked Obsidian and model-process APIs; no live model is called by CI.

The workbench test checks that loading filenames does not send content, context must be previewed and explicitly approved, query changes reset approval, stale sources prevent sending, and closing the view cleans its DOM. Lifecycle checks verify no startup scan/model launch. Installer tests preserve both Agent and Companion data.json and reject junctions.

Manual live CLI tests on Windows, Codex CLI 0.162.1 with existing ChatGPT authentication, passed three synthetic cases: supported update with exact evidence and preserved content, source-instruction injection, and insufficient evidence returning no_change. The supported update was explicitly applied and rolled back only in a synthetic corpus; the model itself left notes unchanged. These are small smoke cases, not a statistical quality or adversarial robustness benchmark.

No real personal-vault content was used. Fresh actual Obsidian runtime testing, cancellation while a view closes, Theme-alone/default-theme integration, accessibility, journal history across restarts and larger corpus quality evaluation remain pending. Historical monolith screenshots are not proof of this increment.
