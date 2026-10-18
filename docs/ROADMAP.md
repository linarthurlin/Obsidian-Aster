# Aster roadmap

## 已完成（v0.2.1 基線）

- [x] 獨立 repository、manifest、build、installer、CI 與 release pipeline。
- [x] 保留 Git ancestry 與 Theme/Companion 整合契約。
- [x] 離線來源／提案／review／apply／rollback 工具。
- [x] 明確 folder scope、檔案數與內容預算、本機詞彙檢索。
- [x] Codex CLI provider，沿用現有登入，不儲存外掛 API key。
- [x] 完整 context 預覽／同意、來源摘錄、diff、逐筆核准及 rollback。
- [x] 小型合成 CLI 案例：支援更新、來源注入、證據不足。

## 下一步

1. **更名與 runtime spike（基礎完成，持續驗證）**：名稱和 repo 已完成；Codex 0.162.1 model catalog、app-server 串流與 thinking 控制已接上。Chat 使用標記為 `aster` 的持久 thread，保存 ID 並透過 `thread/resume` 延續對話；clear 只清 Aster 本機 transcript/link，Project 設定與 Codex session 保留。ephemeral 的串流、usage、工具邊界和取消 gate，以及持久 thread 跨 app-server process 恢復均已通過合成 CLI gate；compaction 和真實 Obsidian runtime 仍待驗證。
2. **一般 Agent workspace（基礎切片已實作）**：Chat 多 session、model/thinking picker、Markdown、串流、取消、provider context meter、持久 session link 和 slash prompt recipe 已接上；recipe 僅展開為可編輯文字。選取文字 Quick Ask 會建立獨立 chat，將不超過 12,000 字元的選取內容放進可編輯草稿，需使用者自行檢查並送出，不直接修改來源筆記。Projects 支援本機設定、建立／編輯／刪除、chat 分組和每個 chat 固定的指示快照；編輯 Project 只影響新 chat。自訂 Skills 以標準 `SKILL.md` 儲存在使用者本機 `.aster/skills`，slash 選取後展開為可見、可編輯的草稿；只載入文字、不載入引用檔或執行腳本。Project 和 Skill 都不附加 Vault 範圍或工具權限。Clear 會序列化同一 chat 的 transcript 存檔／刪除，且清除後拒絕舊 pane 的遲到存檔；確定性 rename 閘門測試覆蓋重現的競態。尚需工具活動、真實 Obsidian 驗證與後續 Phase 2–6 功能。
3. **Scoped Obsidian 工具與交易復原**：Aster 設定現在可用 Obsidian folder picker 選取 Corpus，也保留相對路徑輸入；picker 僅使用可見資料夾中繼資料，選取後由既有 scope validator 檢查，不讀筆記內容。已提供明確的「Attach active note to Aster draft」Command Palette 動作，從目前 Markdown 編輯器複製最多 24,000 字元到可見草稿；讀取後不自動送出或改寫來源。Quick Ask 支援明確選取文字。Corpus 中的單筆筆記或資料夾可用 fuzzy picker 選取；路徑清單只掃描設定範圍，選取後才讀取內容。Chat folder context 最多 6 篇、24,000 字元；Workbench 可 Ctrl-click 選取 2–4 篇目標，目標合計最多 48,000 字元並共用最多 6 段來源摘錄。兩者超限都整批拒絕不截斷，完整資料先預覽。Workbench 的模型輸出只能指向選取目標及核准摘錄；每篇 diff 各自勾選、套用，且以單筆私密 journal 獨立 rollback。合成端到端測試證明只套用被勾選的目標，其餘筆記保持原文。Corpus 搜尋只在使用者明確執行後讀取已設定範圍、最多 20MB 的 Markdown，顯示最多 20 筆短摘錄，可重新驗證路徑後在 Obsidian 新分頁開啟；搜尋不呼叫模型也不加入 chat。搜尋結果可顯示 Obsidian link index 中的 direct backlinks，但只呈現來源也屬於 Corpus 的筆記；來源可用新分頁開啟，不讀來源正文。Workflow CLI 已可檢視及復原 pending journal，Rollback 會將終態寫回 journal。Workbench 現可列出所選 Corpus 的既有私密 journal，使用者開啟單筆紀錄才載入 diff 與目標雜湊狀態；Rollback/Recover 必須先勾選明確同意。多目標逐筆審核已有 synthetic UI/transaction 測試，真實 Obsidian recovery 驗證仍待完成。
4. **Knowledge Studio**：繁體中文與混合語言檢索、可定位引用、來源比較和 retrieval eval；不預設全庫背景索引。合成 lexical baseline 已擴充至 12 個 zh/en/mixed 查詢，涵蓋 CJK 詞組／拆分、正文命中、同名與近似干擾及長筆記 locator；Recall@3=1、MRR/nDCG ≥0.9，excerpt locator 通過。另有 3 個人工標記的改寫查詢，Recall@3=1/3；「brain rewiring」和「神經重塑」未命中。此結果只代表小型合成 regression fixture，不代表一般中文檢索或自然改寫品質達標。BM25／CJK segmentation 可改善詞項切分和排序，但不會補足無共同詞彙的語意缺口；下一步擴大自然 query set，量測 precision、context budget 和 latency，再決定是否加入本機 tokenizer/ranker 或其他方案。
5. **Research Desk 與 Vault Curator（兩個唯讀候選規則已實作）**：Workbench 可按需產生 Corpus link-health 報告，只查詢選定 Corpus 對應的 Obsidian `MetadataCache` link index；另以 Corpus 內 Markdown 相對路徑偵測 NFKC／大小寫正規化後的重複標題。兩條規則都不讀 note bodies、不呼叫模型、不寫入；未解析連結、沒有 Corpus 內入向連結及同名筆記一律標示為候選，不宣稱必定損壞、孤立或衝突，導覽前會重新驗證 scope。設計參考 Vault Inspector 的 read-only findings/evidence；Obsidian Linter 繼續負責格式與 YAML lint，Aster 不重做。待實作：有明確資料來源／讀取預算的更多 deterministic rules、Research Desk 的 Markdown/PDF/Zotero annotation 引用，以及只分類或提出修復建議的 AI 流程。
6. **選配整合**：Tasks、Linter、Bases/唯讀 Dataview、Canvas/Excalidraw；不重做成熟外掛的任務、格式、查詢、文獻或畫布引擎。
7. **其他 providers**：等安全、capability contract、sessions 和 usage 狀態穩定後再加入。

## 驗證邊界

- [ ] 真實 Obsidian Windows 載入、取消、多 chat、Projects、Skills、Quick Ask 與重新載入驗證（需使用 disposable Vault；目前未啟用 plugin）。
- [ ] 擴大繁中／英文檢索基準與引用定位品質；`tests/retrieval-eval.test.ts` 和 `tests/retrieval-extended-eval.test.ts` 現有 12 個 lexical、3 個 paraphrase 合成案例，含同名／近似干擾與長筆記定位。尚未測量足夠的自然改寫、大型 Corpus、precision、latency 與 context budget。
- [x] 跨重啟 transaction history UI 與 pending journal recovery CLI；synthetic plugin reload 與 hash-conflict gate 已測試。
- [ ] Personal Glass Theme、Companion、default theme 與無障礙整合。
- [ ] 新能力必須在合成 Vault 驗證；unit/DOM 測試不代表 runtime 完成。

不讀取個人 Vault、不自動寫入或啟用 plugin。Release 前執行 npm run check 與 npm run package。
