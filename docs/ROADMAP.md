# Aster roadmap

## 已完成（v0.2.1 基線）

- [x] 獨立 repository、manifest、build、installer、CI 與 release pipeline。
- [x] 保留 Git ancestry 與 Halo Theme/Orbit 整合契約。
- [x] 離線來源／提案／review／apply／rollback 工具。
- [x] 明確 folder scope、檔案數與內容預算、本機詞彙檢索。
- [x] Codex CLI provider，沿用現有登入，不儲存外掛 API key。
- [x] 完整 context 預覽／同意、來源摘錄、diff、逐筆核准及 rollback。
- [x] 小型合成 CLI 案例：支援更新、來源注入、證據不足。

## 下一步

1. **更名與 runtime spike（基礎完成，持續驗證）**：名稱和 repo 已完成；Codex 0.162.1 model catalog、app-server 串流與 thinking 控制已接上。Chat 使用標記為 `aster` 的持久 thread，保存 ID 並透過 `thread/resume` 延續對話；clear 只清 Aster 本機 transcript/link，Project 設定與 Codex session 保留。ephemeral 的串流、usage、工具邊界和取消 gate，以及持久 thread 跨 app-server process 恢復均已通過合成 CLI gate；compaction 和真實 Obsidian runtime 仍待驗證。
2. **一般 Agent workspace（核心切片已實作）**：Chat 多 session、model/thinking picker、Markdown、串流、取消、provider context meter、持久 session link 和 slash prompt recipe 已接上；recipe 僅展開為可編輯文字。選取文字 Quick Ask 會建立獨立 chat，將不超過 12,000 字元的選取內容放進可編輯草稿，需使用者自行檢查並送出，不直接修改來源筆記。Projects 支援本機設定、建立／編輯／刪除、chat 分組和每個 chat 固定的指示快照；編輯 Project 只影響新 chat。自訂 Skills 以標準 `SKILL.md` 儲存在使用者本機 `.aster/skills`，slash 選取後展開為可見、可編輯的草稿；只載入文字、不載入引用檔或執行腳本。Project 和 Skill 不提升工具權限。Clear 會等待進行中的送出，序列化同一 chat 的 transcript 存檔／刪除，清除後拒絕遲到存檔；確定性測試分別卡住 transcript rename 和 Corpus preflight，驗證刪除等待、preflight 返回後不再建立轉錄或啟動 Codex。Chat 工具列新增逐 session 選擇加入的唯讀 Corpus 搜尋／單篇讀取，工具活動顯示於狀態列；新 thread 才可開啟，範圍變更會拒絕傳回內容，工具不具寫入 API。此切片依賴 Codex App Server under-development dynamic tools protocol；真實 Obsidian Windows runtime、protocol drift 與後續 Phase 2–6 功能仍待驗證。
3. **Scoped Obsidian 工具與交易復原**：Aster 設定現在可用 Obsidian folder picker 選取 Corpus，也保留相對路徑輸入；picker 僅使用可見資料夾中繼資料，選取後由既有 scope validator 檢查，不讀筆記內容。一般 Chat 的兩個實驗性唯讀工具在上一階段說明。已提供明確的「Attach active note to Aster draft」Command Palette 動作，從目前 Markdown 編輯器複製最多 24,000 字元到可見草稿；讀取後不自動送出或改寫來源。Quick Ask 支援明確選取文字。Corpus 中的單筆筆記或資料夾可用 fuzzy picker 選取；路徑清單只掃描設定範圍，選取後才讀取內容。Chat folder context 最多 6 篇、24,000 字元；Workbench 可 Ctrl-click 選取 2–4 篇目標，目標合計最多 48,000 字元並共用最多 6 段來源摘錄。兩者超限都整批拒絕不截斷，完整資料先預覽。Workbench 的模型輸出只能指向選取目標及核准摘錄；每篇 diff 各自勾選、套用，且以單筆私密 journal 獨立 rollback。合成端到端測試證明只套用被勾選的目標，其餘筆記保持原文。Corpus 搜尋只在使用者明確執行後讀取已設定範圍、最多 20MB 的 Markdown，顯示最多 20 筆短摘錄，可重新驗證路徑後在 Obsidian 新分頁開啟；搜尋不呼叫模型也不加入 chat。搜尋結果可顯示 Obsidian link index 中的 direct backlinks，但只呈現來源也屬於 Corpus 的筆記；來源可用新分頁開啟，不讀來源正文。Workflow CLI 已可檢視及復原 pending journal，Rollback 會將終態寫回 journal。Workbench 現可列出所選 Corpus 的既有私密 journal，使用者開啟單筆紀錄才載入 diff 與目標雜湊狀態；Rollback/Recover 必須先勾選明確同意。多目標逐筆審核已有 synthetic UI/transaction 測試，真實 Obsidian recovery 驗證仍待完成。
4. **Knowledge Studio**：繁體中文與混合語言檢索、可定位引用、來源比較和 retrieval eval；不預設全庫背景索引。產品端保留既有 substring 排序與原文摘錄，只在使用者明確搜尋後建立單一 scope 的記憶體快取；最多讀取 2,000 篇、20 MB，快取不落盤、不送模型，scope 切換、Vault create/modify/delete/rename、外掛卸載會立即清除，並每 15 秒以路徑、大小、mtime、ctime 核對一次中繼資料。Vault 監聽器於 Obsidian layout ready 後註冊，避免啟動時既有檔案觸發大量 create 事件，且由 Plugin.registerEvent 管理卸載：[Vault API](https://docs.obsidian.md/Reference/TypeScript%2BAPI/App/vault)、[Lifecycle management](https://docs.obsidian.md/plugins/guides/lifecycle-management)、[Plugin load time](https://docs.obsidian.md/plugins/guides/load-time)。

   檢索實驗以 316 篇／508 KB 合成語料和 30 個人工判斷查詢進行：17 lexical、3 paraphrase、10 個刻意與負例共享詞彙的 hard-negative；同時保留相關文件的明確判斷，分組報告 Precision@3、Recall@3、MRR@5、nDCG@5。設計參考 BEIR 的多任務評估原則與 TREC 的 query／relevance judgment 工件；此小型本機開發集不是外部泛化或產品品質證明：[BEIR paper](https://arxiv.org/abs/2104.08663)、[TREC evaluation guidance](https://trec.nist.gov/howto.html)。

   目前 substring ranker 的整體 Recall@3/MRR/nDCG 為 0.80/0.76/0.77；lexical 為 0.82/0.82/0.83。實驗性 Intl.Segmenter + BM25 候選的整體為 0.93/0.87/0.87，lexical 為 1.00/0.94/0.95；hard-negative 的 Precision@3 同為 0.33、Recall@3 同為 1.00，MRR/nDCG 只有小幅變化，仍不足以支持替換產品 ranker。三個 paraphrase 中 substring 全漏、候選找回一個，另外兩個仍漏失。

   額外凍結 20 篇合成筆記、36 個與 development query 字串及檔案路徑分離的 held-out 查詢（8 lexical、13 paraphrase、15 hard-negative），由維護者撰寫 closed-world relevance judgments。整體 substring Recall@3/MRR@5/nDCG@5 為 0.917/0.825/0.855，BM25 候選為 0.889/0.875/0.879；substring 的 paraphrase Recall@3 較高（0.846 對 0.692），BM25 hard-negative Recall@3 較高（1.000 對 0.933）。結果混合，沒有調參或替換產品 ranker。這只是合成內部 held-out check，不是獨立 assessor study 或個人 Vault 品質證據；詳見 [RETRIEVAL-HELDOUT.md](RETRIEVAL-HELDOUT.md)。

   Windows Node 22.16 合成語料量測：316 篇／508 KB 冷建索引約 436 ms、heap 增量約 1.1 MB、暖搜尋 p50/p95 約 0.73/2.02 ms；1,838 篇／18.99 MB 冷建約 2.05 秒、heap 增量約 38.8 MB、暖搜尋 p50/p95 約 10.8/38.9 ms，快取命中時不重讀筆記正文。near-limit 的 BM25 候選建置約 3.46 秒、序列化 token payload 約 21.84 MB，query p50/p95 約 0.80/1.29 ms，但建置成本和記憶體仍需在實際 Obsidian Windows runtime 驗證。所有資料均由評估器暫存產生，沒有讀取使用者 Vault；下一步擴大自然改寫與 hard-negative judgments，再驗證真實 runtime 記憶體及事件行為。Unicode 對中文 word boundary 的說明指出，可靠切詞需要語言專用處理；MiniSearch 的設計文件可作為 BM25／欄位長度排序參考，目前沒有引入第三方執行期相依：[Unicode UAX #29](https://www.unicode.org/reports/tr29/)、[Intl.Segmenter](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/Segmenter)、[MiniSearch design](https://github.com/lucaong/minisearch/blob/master/DESIGN_DOCUMENT.md)。
5. **Research Desk 與 Vault Curator（Curator 四個唯讀候選檢查、Research Desk Markdown/Zotero/PDF 首片已合成驗證）**：Workbench 可按需產生 Corpus 中繼資料報告，只查詢選定 Corpus 對應的 Obsidian `MetadataCache` link index；另以 Corpus 內 Markdown 相對路徑偵測 NFKC／大小寫正規化後的重複標題，只用 `TFile.stat.size` 標示零位元組筆記，並使用 Obsidian 已快取的 frontmatter alias 資料找重複 alias 與 alias／檔名交叉候選。每項最多檢查 2,000 個 Corpus Markdown 路徑；alias 檢查每篇最多 64 個 alias、總掃描字元最多 200,000，缺漏或超限就拒絕產生部分報告。Curator 報告不讀 note bodies、不呼叫模型、不寫入；未解析連結、沒有 Corpus 內入向連結、同名筆記、零位元組檔及重複 alias 都標示為候選，不宣稱必定損壞、孤立、歧義或應刪除，導覽前會重新驗證 scope。設計參考 Obsidian `MetadataCache.getFileCache()` 的唯讀中繼資料 API，以及 Community 的 Alias Management 對跨檔 alias／檔名重複清單的呈現；Aster 將其限制為按需 Corpus 報告，不即時監看或編輯 YAML。Obsidian Linter 繼續負責格式與 YAML lint，Aster 不重做。

   Research Desk 支援明確選取 1–6 篇 Corpus Markdown／PDF，包括 Zotero Integration 匯出的 annotation note；Markdown 每篇最多 200 KB，PDF 每篇最多 12 MB／120 個指定頁面，整個 source set 最多 240 個選取頁面、120 個 evidence blocks／24,000 字元。PDF 頁面範圍可輸入 `1-3, 8`；空白代表在上限內選取全篇。掃描頁不做 OCR，需改用 Zotero annotations 或外部 OCR 後的文字來源。PDF 使用 Obsidian host 的 `loadPdfJs()` 與 `PDFPageProxy.getTextContent()`，不把另一份 PDF.js 或 worker 打進 Aster 套件；此 host helper 在目前開發型別中存在，但公開相容性承諾較弱，因此以 runtime capability check 保護，真實 Obsidian Windows runtime 尚未驗證。Community 的 Library Search 也使用 Obsidian bundled PDF.js，支持沿用 host library 的作法；PDF.js page API 提供文字擷取。[Library Search](https://community.obsidian.md/plugins/library-search)、[Obsidian `loadPdfJs()` API reference](https://marcusolsson.github.io/obsidian-plugin-docs/reference/typescript/functions/loadPdfJs)、[PDF.js `getTextContent()`](https://mozilla.github.io/pdf.js/api/draft/module-pdfjsLib-PDFPageProxy.html)。

   前置 YAML 不作為模型證據，Markdown 程式碼區塊會排除；每段保留來源相對路徑、SHA-256、heading、行號、PDF page number／label，以及可辨識的 Zotero item key／頁碼。Workbench 顯示完整的引用式 synthesis 草稿；交給 Chat 前重查 Corpus 範圍和來源雜湊，並建立一個帶有允許 evidence ID 清單的新 chat。草稿可編輯、未送出；回覆的 citation audit 只檢查引用 ID 是否存在於該清單，不宣稱驗證主張。PDF 只在明確選取後由 `Vault.readBinary()` 讀取，並以 byte、page、extracted-text、evidence 和 abort limits 控制工作量。待實作：獨立 bibliography preview/export、引用段落與主張的驗證、只分類或提出修復建議的 AI 流程。Zotero Integration 模板提供 annotatedText、comment、page 等 annotation 欄位。[Obsidian Vault API](https://docs.obsidian.md/Reference/TypeScript%2BAPI/App/vault)、[Zotero Integration templating](https://github.com/community-archive/obsidian-zotero-integration/blob/main/docs/Templating.md)、[Obsidian MetadataCache API](https://docs.obsidian.md/Reference/TypeScript%20API/MetadataCache/getFileCache)、[Alias Management](https://community.obsidian.md/plugins/alias-management)
6. **選配整合**：Tasks、Linter、Bases/唯讀 Dataview、Canvas/Excalidraw；不重做成熟外掛的任務、格式、查詢、文獻或畫布引擎。
7. **其他 providers**：等安全、capability contract、sessions 和 usage 狀態穩定後再加入。

## 驗證邊界

- [ ] 真實 Obsidian Windows 載入、取消、多 chat、Projects、Skills、Quick Ask 與重新載入驗證（需使用 disposable Vault；目前未啟用 plugin）。
- [ ] 真實 Obsidian PDF.js host helper／PDF 頁碼擷取與取消驗證（目前只有合成 PDF.js/UI 測試，沒有宣稱實際 PDF parser/runtime 已通過）。
- [x] Codex App Server dynamic tools live smoke：CLI 0.162.1、ephemeral thread、合成 Corpus 摘錄，真實 model-to-tool-call-to-result loop 完成；未讀取 Vault。
- [x] 合成檢索評估與按需快取：自動測試有 12 個 lexical 和 3 個 paraphrase 合成案例；手動 eval runner 有 17 個 lexical、3 個 paraphrase、10 個 hard-negative 判斷，包含摘錄定位與冷／暖快取效能。
- [x] 建立與 development query 字串／Corpus 路徑分離的 held-out synthetic 集：20 篇筆記、36 題（8 lexical、13 paraphrase、15 hard-negative），以固定 qrels 對照 substring 與研究型 BM25，不從該集調參。
- [ ] 在真實 Obsidian Windows runtime 驗證 cache event、實際記憶體與搜尋行為；現有 synthetic benchmark 不代表個人 Vault 品質。
- [x] 跨重啟 transaction history UI 與 pending journal recovery CLI；synthetic plugin reload 與 hash-conflict gate 已測試。
- [ ] Halo Theme、Orbit、default theme 與無障礙整合。
- [ ] 新能力必須在合成 Vault 驗證；unit/DOM 測試不代表 runtime 完成。

不讀取個人 Vault、不自動寫入或啟用 plugin。Release 前執行 npm run check 與 npm run package。
