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
2. **一般 Agent workspace（基礎切片已實作）**：Chat 多 session、model/thinking picker、Markdown、串流、取消、provider context meter、持久 session link 和 slash prompt recipe 已接上；recipe 僅展開為可編輯文字。選取文字 Quick Ask 會建立獨立 chat，將不超過 12,000 字元的選取內容放進可編輯草稿，需使用者自行檢查並送出，不直接修改來源筆記。Projects 支援本機設定、建立／編輯／刪除、chat 分組和每個 chat 固定的指示快照；編輯 Project 只影響新 chat。自訂 Skills 以標準 `SKILL.md` 儲存在使用者本機 `.aster/skills`，slash 選取後展開為可見、可編輯的草稿；只載入文字、不載入引用檔或執行腳本。Project 和 Skill 都不附加 Vault 範圍或工具權限。Clear 等待送出與存檔收斂後再刪 transcript。尚需工具活動、真實 Obsidian 驗證與後續 Phase 2–6 功能。
3. **Scoped Obsidian 工具與交易復原**：已提供明確的「Attach active note to Aster draft」Command Palette 動作，從目前 Markdown 編輯器複製最多 24,000 字元到可見草稿；讀取後不自動送出或改寫來源。現有 Quick Ask 支援明確選取文字。下一步是讓指定 notes/folder 透過完整 context 預覽和同意後送出，再補跨重啟 journal、pending recovery、folder chooser、多筆提案逐筆 review。
4. **Knowledge Studio**：繁體中文與混合語言檢索、可定位引用、來源比較和 retrieval eval；不預設全庫背景索引。
5. **Research Desk 與 Vault Curator**：明確來源集、Zotero annotation 引用、確定性 health findings；AI 僅分類或提議修復。
6. **選配整合**：Tasks、Linter、Bases/唯讀 Dataview、Canvas/Excalidraw；不重做成熟外掛的任務、格式、查詢、文獻或畫布引擎。
7. **其他 providers**：等安全、capability contract、sessions 和 usage 狀態穩定後再加入。

## 驗證邊界

- [ ] 真實 Obsidian Windows 載入、取消、多 chat、Projects、Skills、Quick Ask 與重新載入驗證（需使用 disposable Vault；目前未啟用 plugin）。
- [ ] 繁中／英文檢索基準與引用定位品質。
- [ ] 跨重啟 transaction history 和 pending journal recovery。
- [ ] Personal Glass Theme、Companion、default theme 與無障礙整合。
- [ ] 新能力必須在合成 Vault 驗證；unit/DOM 測試不代表 runtime 完成。

不讀取個人 Vault、不自動寫入或啟用 plugin。Release 前執行 npm run check 與 npm run package。
