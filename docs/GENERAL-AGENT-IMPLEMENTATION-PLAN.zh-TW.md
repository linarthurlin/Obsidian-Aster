# Aster 通用 AI Agent Plugin — Implementation Plan

> 研究修訂版：2026-10-18。產品名稱已定為 Aster；本文件更新規劃與品牌，不代表後續功能已實作。Theme、Companion、Aster 維持三個獨立 repo 與獨立發布。

## 產品定位與關鍵取捨

Aster 是 Obsidian 裡的 Codex 優先 Agent 工作台：提供多對話、model/thinking 控制、context window 用量、可重用的 Projects/Skills 與明確授權的 Obsidian 工具；特色是把知識操作做成可查來源、可預覽差異、可逐筆核准、可復原的工作流程。

社群競品已把多對話、CLI Agent、Vault search、Skills、slash commands、Projects、model controls 和 tool activity 做得完整。Aster 仍須具備一般 Chat 體驗，但不應以「功能更多」或「provider 更多」作為主策略。競爭重點應是每個答案顯示來源與範圍、模型操作不越權、修改有完整審核／回復、能對繁體中文知識庫做可衡量的檢索品質管理。

實作原則：

- Markdown 與 Obsidian Vault 是唯一 canonical source of truth；衍生索引都能刪除並重建。
- 不預設掃描整個 Vault，不自動把對話存成筆記，也不默默寫入檔案。
- 每次送出都顯示 provider、model、thinking、附加內容與傳輸目的地；使用者能檢查實際 context。
- Agent 可建議讀寫操作，路徑解析、範圍檢查和寫入由 Aster 工具層控制。
- 專業模式共用 Chat、provider 與權限引擎；Modes 是工作流程設定，不是平行 Agent runtime。
- CODE 是可選流程，PARA 是可選資料夾 recipe；不要求使用者重排 Vault。
- 與成熟外掛整合，避免自建任務引擎、文獻管理器、格式化器、語意搜尋或畫布。

## 現況基線

目前 0.2.1 已有明確資料夾範圍、本機有限制詞彙檢索、完整 context 預覽、Codex CLI 單次唯讀提案、來源摘錄／路徑核對、逐筆 diff 審核、單一既有 Markdown 的明確套用、外部 transaction journal 與保守 rollback，也有離線 search/propose/review/apply/rollback CLI。

目前一般 Chat 使用 Codex 持久 thread 以支援重新開啟與跨重啟恢復；每個 thread 使用 read-only sandbox，停用 shell/web/plugins，並沿用 Codex 自己的登入。Aster 與 Codex 各保存一份對話紀錄；清除 Aster chat 只會清除 Aster transcript 和 session link，Codex session 需在 Codex 端管理。外掛不讀取或保存憑證。知識操作的 provider/tool 權限仍須逐項做 runtime 對照測試，不因競品能力而放寬。

ROADMAP 未完成項目仍有效：繁中／混合語言檢索品質、跨重啟交易歷史、crash journal 復原、搜尋導覽/backlinks/open note、多筆提案審核、真實 Obsidian 執行、取消流程、主題共存與無障礙。Corpus folder chooser 和受限 folder context 已完成基礎切片，詳見以下進度。

## 本次實作進度（2026-10-18）

- 已新增獨立 Aster Chat view、session 清單、建立／清除、按標題搜尋／重新命名、多 session 歷史、Markdown 顯示、即時串流與取消。
- 每個 session 可指定 model/thinking；model catalog 由本機 Codex app-server model/list 載入。查詢 catalog 不會送出 prompt；catalog 不代表帳戶權限保證。
- 已加入可鍵盤操作的 slash prompt recipe 選單（摘要、解釋、發想、綱要、改寫、繁中翻譯）；選取後展開為可見且可編輯的普通 composer 文字，不授予 Agent 額外能力。
- Chat 改用 Codex app-server `0.162.x` minor-gated persistent threads，將 `threadSource` 標記為 `aster`，保存 provider thread ID 並以 `thread/resume` 恢復。工具類別和 MCP 關閉、Codex 自動載入的 project documents 上限為零、thread cwd 位於系統暫存目錄、read-only sandbox、turn network 關閉；任何未知 tool item/server request 都 fail closed。Aster 只把使用者明確設定的 Project 指示快照傳入 thread base instructions，限制 6,000 字元並保留原有 text-only 邊界。Aster transcript 保存在 `.aster/chats/`；Codex 也會保存自己的 session。
- Windows Codex CLI 0.162.1 合成 gate：ephemeral thread 多回合串流及 usage 成功；canary 工具邊界測試未讀出檔案且未觀察到工具 item；取消收到 ACK 並以 `interrupted` 結束，但沒有 final usage notification。持久 thread 跨 app-server process resume 成功，恢復相同 `threadSource=aster` session 並取回合成記憶句，兩回合都回報 usage；probe session 已封存。Context meter 使用 `last.totalTokens` 和每回合最新 `modelContextWindow`，依官方 TUI baseline 計算；取消／compaction／模型變更時標示舊值可能過期。同一 thread 的 window 會依 provider 回報更新，不假設固定窗口。
- Fake app-server 測試已覆蓋多 chat 交錯、Aster transcript restore、持久 thread resume、未支援 CLI minor 啟動前拒絕、未知 command item 中止、取消、meter，以及 Project 指示在 start/resume 兩條路徑保持相同且不超過 6,000 字元；jsdom Chat view 測試覆蓋串流輸出、保存 transcript、60% provider meter、view 關閉重開後恢復同一 Codex thread、Clear 在暫停中的 atomic rename 完成後才刪除 transcript 的確定性競態、Quick Ask 草稿，以及 Project 建立／編輯後新舊 chat 指示快照隔離。沒有讀取或修改個人 Vault；真實 Obsidian UI 載入仍待驗證。
- 已加入 Quick Ask: selected text 命令：只讀取當前 Markdown 編輯器的明確選取（上限 12,000 字元），建立獨立對話，將來源路徑與選取內容放入可見、可編輯草稿；使用者按 Send 前不送出，也不替換原文。
- Projects 可在 Aster 設定中建立、編輯與刪除，並把新 chat 指派至全域或所選 Project。Project instructions 顯示在 chat 中並以 JSON context 傳給 Codex，限制 6,000 字元；每個 chat 固定建立時的名稱與指示快照，修改後只套用於新 chat。Project 不會附加 Vault 檔案或資料夾；Clear chats 保留 Project 設定。
- 「Attach active note to Aster draft」命令只讀取目前 Markdown 編輯器 buffer（包含尚未存檔的編輯），限制 24,000 字元，將路徑與完整內容放入目前 Chat 的可見 composer；若沒有 Chat 則建立一個。草稿明確標示筆記是未受信任的來源內容，由使用者檢查後自行送出；不呼叫 Vault-wide API、不掃描、不隱藏附加、不改寫筆記。超過限制時拒絕且不截斷。真實 Obsidian buffer/runtime 尚待 disposable Vault 驗證。
- Chat 可在設定 Corpus 中以 Obsidian fuzzy picker 選擇單篇 Markdown note，或選擇 Corpus 子資料夾作為 context；path-only 清單不讀筆記內容，選取後才讀單一筆記或至多 6 篇資料夾筆記。Folder context 總量上限 24,000 字元，超限不截斷、不建立部分預覽；完整來源快照先顯示，加入 composer 後仍須自行按 Send。Aster 設定的 Corpus folder chooser 使用官方 `Vault.getAllFolders(false)`／`TFolder` 取得可見資料夾中繼資料，以 `visiblePath` 過濾、以既有 `resolveScope` 驗證並保存；文字路徑輸入仍可用。此設計採「API metadata + Obsidian fuzzy picker + Aster path validator」，比只輸入路徑更容易選對資料夾，又避免讀取 note bodies。[Obsidian Vault API](https://docs.obsidian.md/Reference/TypeScript%2BAPI/App/vault)；Copilot 的設定仍採 folder path 欄位加明確 Apply/validation，可作為保留文字輸入的參照：[Copilot BasicSettings](https://github.com/logancyang/obsidian-copilot/blob/master/src/settings/v2/components/BasicSettings.tsx)。
- Skills MVP 已實作：遵循 Agent Skills `SKILL.md` 的 name/description/frontmatter 慣例，存在使用者 profile 的 `.aster/skills`，最多 40 個；支援建立、編輯、刪除和 slash menu 呼叫。只讀取單一 `SKILL.md`，不解析其引用檔、不執行 scripts、不授予工具或 Vault 權限；呼叫時完整展開成可見、可編輯的 user message，並保留在本機 transcript。`allowed-tools` 不予採用，因為 Aster 權限由 Aster 自己的 Tool Router 管理。
- 尚未實作工具活動與核准後 Obsidian 操作、任意多筆筆記 context 組合、搜尋導覽/backlinks/open note、跨重啟交易 journal recovery、多筆提案逐筆審核、Knowledge Studio 整合、Research Desk 或 Vault Curator。Folder chooser、單筆 note preview 和受限 folder context 已有合成 DOM 測試；真實 Obsidian runtime 仍待驗證。

## ANKS 與 Building a Second Brain

ANKS 沒有公認且唯一的公開定義；此計畫沿用先前討論的工作定義：Agent-native Knowledge System，指 Agent 在明確授權下協助維護、尋回、連結和運用知識，同時保留來源軌跡與人的最終決定權。若你原本的 ANKS 代表另一種架構，只需更換術語與流程，不必推翻權限設計。

| 面向 | Building a Second Brain（BASB） | Aster 的 ANKS 工作定義 |
|---|---|---|
| 目標 | 讓人捕捉、組織、提煉和輸出資訊 | 人與 Agent 共同完成上述工作，並能驗證 Agent 使用的來源 |
| 方法 | CODE 是流程；PARA 按專案、領域、資源、封存組織 | CODE/PARA 作為選用 recipe；核心按明確範圍、來源、連結與屬性執行 |
| 整理者 | 人負責主要分類與提煉 | 人定目標並核准；Agent 搜尋、摘錄、比較、草擬、檢查 |
| 品質控制 | 使用者整理習慣和回顧流程 | 額外加入來源定位、引文核對、scope 預覽、diff、交易紀錄及復原 |
| 關係 | 個人的知識管理方法 | Agent 與知識庫的系統架構，可採用 BASB 或其他方法 |

建議流程：Capture 保留來源 → Extract 產生摘要、主張和定位引文 → Connect 提出概念／連結 → Retrieve 回傳範圍內證據 → Distill/Express 草擬筆記或輸出 → Review 由人核准後才套用。對話歷史與永久知識分開；只有使用者選取並確認的摘要可進入 Vault。[BASB 官方介紹](https://fortelabs.com/blog/12-steps-to-build-a-second-brain/)

## 社群 Plugin 盤點與設計影響

盤點 Obsidian Community Plugin Directory 的公開功能頁，查閱日為 2026-10-18。功能與下載量會變動，僅作方向參考；借鑑功能模式，不複製外掛程式碼。Copilot 前端採 AGPL-3.0，任何程式碼重用須另行核對授權。

| 外掛／類別 | 社群已提供的能力 | 對 Aster 的決策 |
|---|---|---|
| Copilot | Codex、Claude Code、OpenCode；多對話；Projects；共用 Skills；slash commands；Quick Ask；Vault 搜尋；多步工具和權限 | 多對話、model/provider、Projects、Skills、/ 命令和選取文字 Quick Ask 屬基本體驗。Aster 差異放在 evidence ledger、精準 scope、逐筆 diff 與 rollback。[Copilot](https://community.obsidian.md/plugins/copilot) |
| Grimoire | 多 CLI Agent；Codex App Server；thread 歷史／恢復；能力表、thinking、plan、圖片、MCP、工具活動及用量資訊 | Codex CLI 為首發 provider，但先做對照表；provider capabilities 抽象化，不追十幾個 CLI。安全審核優先於通用工具呼叫。[Grimoire](https://community.obsidian.md/plugins/grimoire) |
| Smart Connections、Smart Lookup | 目前筆記導向的相關內容；自然語言問題導向語意查詢；本機 embedding 與候選預覽 | Aster 專注引用式合成、來源比較與審核，不重做 embedding。先改善詞彙檢索的中文表現；評估證明有缺口後再加本機混合索引或 adapter。[Smart Connections](https://community.obsidian.md/plugins/smart-connections) [Smart Lookup](https://community.obsidian.md/plugins/smart-lookup) |
| Tasks | 任務語法、到期日、重複任務、跨筆記查詢與直接完成 | Project Assistant 產出 Tasks 相容提案或使用公開命令；不維護第二套 task database/scheduler。[Tasks](https://community.obsidian.md/plugins/obsidian-tasks-plugin) |
| Zotero Integration | Zotero citation、bibliography、item note、PDF annotation 匯入 | Research Desk 保留來源 ID、頁碼、annotation 和 citation link；不做第二套文獻庫。[Zotero Integration](https://community.obsidian.md/plugins/obsidian-zotero-desktop-connector) |
| Linter | 可配置 Markdown、YAML、tag、標題與空白規則 | Curator 先產生 findings；格式檢查／修正優先沿用 Linter 或使用者既有規則，不做無人審核的全庫 cleanup。[Linter](https://community.obsidian.md/plugins/obsidian-linter) |
| Dataview | Frontmatter／inline fields 查詢與儀表板，含 DataviewJS | Dashboard 優先輸出標準 Markdown、Bases 或選配 Dataview query。不可執行模型生成的 DataviewJS；若讀取查詢結果，限定唯讀範圍。[Dataview](https://community.obsidian.md/plugins/dataview) |
| Excalidraw、Canvas | 高成熟度的關聯式畫布、可嵌入圖形、視覺思考；Excalidraw 公布 CLI／Agent skill | Visual Synthesizer 產生可審核 SVG／Canvas／Excalidraw 輸出並交接，不自建畫布或圖形編輯器。[Excalidraw](https://community.obsidian.md/plugins/obsidian-excalidraw-plugin) [Canvas](https://obsidian.md/canvas) |

### 修訂後的功能優先級

**核心基本能力**：Chat、多個獨立 sessions、model/thinking、每 session context window 使用率、串流／取消、Project workspace、可重用 Skill 和 slash command、選取文字 Quick Ask、附加目前筆記／選取內容／指定文件、context 預覽、工具活動與權限提示。這些是社群基線，不是 Aster 的獨家賣點。

**特色模式一：Knowledge Studio**（原 Knowledge Base Agent）。範圍內問答、精確來源引用、跨筆記比較、矛盾／未知標示、摘要／永久筆記／連結建議、改動預覽和 rollback。承接 ANKS，是 Aster 的核心差異。

**特色模式二：Research Desk**。從選定的 Markdown、PDF、網頁摘錄或 Zotero annotation 建立 source set；主張保留來源、頁碼／段落定位和 citation；提供跨來源比較、研究缺口與 bibliography 草案。第一版只處理明確選取來源，不背景爬網或同步整個 Zotero。

**特色模式三：Vault Curator**。確定性掃描可選範圍的 broken links、orphan notes、重複候選、frontmatter/tag 規則問題及過期欄位；AI 分類或提議修復。先出報告和批次預覽；逐筆核准後才套用，必要時交由 Linter。

**內建 recipes，而非獨立 Agent**：Writing Studio 提供選取文字改寫、縮寫、擴寫、翻譯、摘要、結構檢查和引用整理；使用者可用 slash command 或 Quick Ask 啟動。

**後續可選模式／連接器**：Project Assistant 讀取明確專案範圍、Tasks 和 Bases／Dataview metadata，整理決策、待辦與阻塞；Visual Synthesizer 以 SVG skill 產生可編輯圖表並交接 Canvas／Excalidraw。MVP 不做，避免重做外掛已有領域模型。

## 核心 UX 與設定

- Chat 列表或多 tab，支援新對話、搜尋／重新命名／封存、草稿、thread 恢復和分叉（provider 支援時）。
- 每 session 獨立保存 mode、project、model、thinking、來源、草稿、provider thread ID、狀態和 usage meter。
- 模型目錄和 thinking options 來自 provider；不支援就隱藏或顯示 provider default，不可靜默切換。
- Context meter 用 provider 回報的 active context tokens / model window，顯示百分比及 tokens/window；missing/stale 顯示未知和更新時間。不可用字數猜測，也不可稱為訂閱 quota。
- 送出前顯示 provider、model、thinking、Project/Skill、附件範圍、外傳內容與目的地；回答附引用 path/heading/locator。
- slash menu 支援 Skills、命令和小型工作流程；Skill 不授予權限，讀寫由 Tool Router 控制。
- 選取文字可 Quick Ask；支援續談、複製或建立待審核 patch，不直接替換原文。
- Theme token 是漸進外觀適配；缺少 Personal Glass 時 fallback 到 Obsidian 原生 CSS variables。

## 架構與安全設計

Workbench 管對話、composer、meter、工具活動和 approvals；Thread Registry 隔離 sessions；Project/Skill/Mode Registry 管 prompt、context builder、schema、tools 和權限；Provider Adapter 對接 Codex CLI；Tool Router 將請求映射成固定 Obsidian API；Evidence Store 保存 source locators；Journal 管提案、交易和復原。索引是可重建快取，不是第二個知識主庫。

Codex App Server 官方協定提供 model/list、thread start/resume、事件串流、approvals、token usage。Model list 不保證帳戶實際有權使用。Grimoire 已採 Codex App Server；Aster 使用標記為 `aster` 的持久 thread，以保留 app-server 端的對話狀態並在重啟後恢復。使用者可在 Aster 清除本機 transcript 和連結，但 Codex session 需在 Codex 端管理。此生命週期已用 Windows `0.162.1` 完成跨 process synthetic gate；未測 minor 在載入 model catalog／Chat 前拒絕。[App Server](https://developers.openai.com/codex/app-server) [Model list](https://developers.openai.com/codex/app-server#list-models)

Per-session meter 使用 Codex usage update 的 `last.totalTokens`（active context）與 `modelContextWindow`，採 Codex TUI 的 12,000-token baseline。window 依 provider 每回合更新；缺資料顯示 unknown，取消未收到通知時保留最後值並標 stale。真實 compaction 和 Windows Obsidian UI 仍需 runtime 驗證。[Usage schema](https://github.com/openai/codex/blob/main/codex-rs/app-server-protocol/schema/json/v2/ThreadTokenUsageUpdatedNotification.json) [Codex TUI calculation](https://github.com/openai/codex/blob/main/codex-rs/tui/src/token_usage.rs)

讀寫透過 Obsidian Vault API 的明確介面；套用前重比對來源和目標，遇到人工修改就停止。[Vault API](https://docs.obsidian.md/Plugins/Vault)

安全規則：

- Ask/Read-only 只能讀目前附加來源或選定範圍；Plan 產生 proposal，不直接改檔。
- Review & Apply 顯示每檔 before/after、來源、理由及範圍；人逐筆確認後才寫入。
- 首版禁止 Agent 刪除、移動、改名檔案。
- Note、PDF、Skill、MCP 回覆都是不可信資料，不能授權工具或改變 scope。
- 保留 path traversal、hidden path、symlink/junction、檔案大小上限、stale source、journal-before-write、digest 和 rollback 不覆蓋後續人工編輯等防護。
- CLI read-only sandbox 不代表完整 OS 讀取隔離；provider approvals 也不取代 Aster 的 scope 與 diff review。
- Web/MCP/外部 Skill registry 均 opt-in；送出前披露傳輸範圍與目的地。
- Transcript 先只保存恢復所需的 ID/UI metadata。說明 CLI session 儲存位置、保留方式和清除方法，不額外把全文複製至 Vault。

## Implementation phases

### Phase 0 — Aster 更名與 runtime 對照 spike

同步 GitHub/local 名稱、manifest display name、文件、package/artifact 品牌；保留 plugin ID knowledge-agent 與安裝資料夾，確保更新不建立第二個 plugin、不丟設定。以 synthetic corpus 比較 Codex exec/app-server：model/thinking、二至三個 sessions、resume/stream/cancel、meter/compaction、Windows 重啟、工具權限和 session 資料位置。

**Gate：** 選定 runtime；sessions 不串線；model/thinking 資訊正確；meter 與同版 Codex 相符；可證明工具只能經 Aster Tool Router；0.2.1 review/apply/rollback 不回歸。未過前保留單次 read-only proposal，先交付持久化 Chat UI。

### Phase 1 — 一般 Agent workspace

實作 thread registry、多對話、model/thinking picker、context meter、stream/cancel、Project、Skills、slash menu、Quick Ask 和工具活動。首發 Codex 單一 provider，包含 capability flags 和 graceful fallback。一般 Chat 不自動附加 Vault。

### Phase 2 — Scoped Obsidian 工具與交易復原

加入選取文字／目前 note／指定 notes/folder、搜尋、backlinks 和 open note；送出前預覽完整 context。Corpus folder chooser、單筆 note preview 與最多 6 篇／24,000 字元的 folder context 已完成基礎切片。擴展任意 multi-note context 與 proposal transaction；補跨重啟歷史、pending journal recovery、搜尋導覽、多筆逐一審核及 keyboard/accessibility。

### Phase 3 — Knowledge Studio 與中英檢索評估

將 Workbench 升格為任一 session 可選的 Knowledge Studio。保留詞彙 baseline，加入繁中斷詞或 char n-gram、中英混合排序、heading/path boost、Wikilink graph expansion 與引用。用合成語料評估 Recall@k、MRR/nDCG、locator validity、context budget 和 latency。先證明 lexical baseline 不足，再評估本機 embedding/reranker；不預設全 Vault 背景索引。

### Phase 4 — Research Desk 與 Vault Curator

Research Desk 支援明確選定的 Markdown/PDF/Zotero annotation，保留 citation key、頁碼／heading locator、source hash 和摘錄，輸出引用式 synthesis/bibliography proposal。Curator 由 deterministic rules 產生 findings，AI 只解釋或提議修復；格式規則沿用 Linter，不做無人審核批次整理。

### Phase 5 — Tasks/Dataview/Canvas/Excalidraw adapters

依使用者已安裝的工具和公開 API 提供選配 integration。Project Assistant 輸出 Tasks-compatible proposal；dashboard 優先 Markdown/Bases，Dataview 唯讀且不執行模型生成的 JS；Visual Synthesizer 預覽後匯出 SVG/Canvas/Excalidraw。無對應外掛時退回 Markdown 或 SVG。

### Phase 6 — Provider 擴充

安全、capability contract、session restore、usage UI 與 retrieval eval 穩定後，才評估 ACP／其他 providers。逐個建立 model/reasoning/session/tool/usage capability matrix 和 synthetic test。沒有可靠 API 就標示 unsupported，不偽造 meter 或靜默 fallback。

## 驗收標準

- Provider：model/thinking 動態選項、未知資料、非 ASCII stream、斷線、timeout、cancel、resume、compaction 後 meter 同步。
- Multi-chat：至少三個 session 交錯串流；model/mode/context 隔離；獨立取消與重啟恢復。
- Privacy：明示來源、provider 和目的地；無資料就不估算；未附加 note 的一般 Chat 不送 Vault 內容。
- Vault boundary：空 scope、整 Vault 拒絕、traversal、hidden path、junction/symlink、超大檔、stale source、人工併發修改、prompt injection、錯誤 locator。
- Recovery：pending journal、部分失敗、人工修改阻止套用／rollback、逐筆核准。
- Retrieval eval：繁中、英文、中英混合、改寫、同名檔、長筆記、相似干擾項；引用可回到原檔和 heading/page。
- Integrations：選配外掛缺席時安全降級；Tasks/Zotero/Linter/Dataview/Excalidraw 按各自 API 測，不讀 private data.json。
- Runtime：disposable synthetic vault 的 Windows Obsidian 實測、取消、重新載入、多 chat、原生／Personal Glass theme 共存、鍵盤和 reduced motion。
- Release：Windows/Linux CI、typecheck/build/test/validate/package；package 不含私人 note、token、context/proposal/receipt、transcript 或 CLI config。

Desktop-only 是本機 Codex CLI 的合理首發限制；其他平台要說明 provider 不支援，不偷偷切換雲端 API。

## Aster Repo／Obsidian ID 更名決策

GitHub repository 與 local workspace 使用 Obsidian-Aster；外掛顯示名稱為 Aster；npm package 與 release artifact 使用 Aster。manifest/plugin ID 和安裝資料夾保留 knowledge-agent，避免 Obsidian 將現有安裝當作另一個外掛並造成重複安裝或設定遺失。若未來需要新 ID，另立遷移設計並測試資料／路徑相容。既有 .knowledge-agent transaction journal 路徑也保留，不移動、不刪除。

Theme 與 Companion repo 不隨本次更名；Aster 繼續遵循 integration contract，並能獨立運作。

## 參考資料

- [Community Plugin — Copilot](https://community.obsidian.md/plugins/copilot)
- [Copilot Project workspaces](https://github.com/logancyang/obsidian-copilot/blob/master/docs/projects.md)
- [Copilot Skills and tool behavior](https://github.com/logancyang/obsidian-copilot/blob/master/docs/agent-mode-and-tools.md)
- [Agent Skills format specification](https://github.com/agentskills/agentskills/blob/main/docs/specification.mdx)
- [Codex Skills documentation](https://developers.openai.com/codex/skills/)
- [Copilot Chat context attachments](https://github.com/logancyang/obsidian-copilot/blob/master/docs/chat-interface.md)
- [Obsidian Vault read API](https://docs.obsidian.md/Plugins/Vault)
- [Community Plugin — Grimoire](https://community.obsidian.md/plugins/grimoire)
- [Community Plugin — Tasks](https://community.obsidian.md/plugins/obsidian-tasks-plugin)
- [Community Plugin — Zotero Integration](https://community.obsidian.md/plugins/obsidian-zotero-desktop-connector)
- [Community Plugin — Linter](https://community.obsidian.md/plugins/obsidian-linter)
- [Community Plugin — Dataview](https://community.obsidian.md/plugins/dataview)
- [Community Plugin — Smart Connections](https://community.obsidian.md/plugins/smart-connections)
- [Community Plugin — Smart Lookup](https://community.obsidian.md/plugins/smart-lookup)
- [Community Plugin — Excalidraw](https://community.obsidian.md/plugins/obsidian-excalidraw-plugin)
- [Codex App Server](https://developers.openai.com/codex/app-server)
- [Codex usage schema](https://github.com/openai/codex/blob/main/codex-rs/app-server-protocol/schema/json/v2/ThreadTokenUsageUpdatedNotification.json)
- [Codex TUI context calculation](https://github.com/openai/codex/blob/main/codex-rs/tui/src/token_usage.rs)
- [Obsidian Vault API](https://docs.obsidian.md/Plugins/Vault)
- [BASB official guide](https://fortelabs.com/blog/12-steps-to-build-a-second-brain/)
