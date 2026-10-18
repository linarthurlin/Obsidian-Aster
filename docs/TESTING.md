# Aster testing

npm run check validates TypeScript, plugin build, offline CSS, manifests, review engine, installer isolation, scoped retrieval, model-output boundaries and subprocess errors/cancellation/timeouts/output limits. DOM tests run the bundled plugin with mocked Obsidian and process APIs; CI does not call a live model.

The workbench test checks that loading filenames does not send note content, context must be previewed and explicitly approved, query changes reset approval, stale sources prevent sending, and closing the view cleans its DOM. Lifecycle checks verify no startup scan/model launch. Installer tests preserve existing plugin data and reject junctions.

Codex CLI 0.162.1 passed three small synthetic live cases: a supported update with evidence, source-instruction injection, and insufficient evidence. The update was applied and rolled back only in the synthetic corpus. These smoke cases do not establish statistical retrieval quality or adversarial robustness.

Real Obsidian runtime testing, close-during-cancel behavior, default-theme/Personal Glass integration, accessibility, transaction history across restarts and larger retrieval evaluations remain pending. Historical monolith screenshots do not prove the current plugin runtime.