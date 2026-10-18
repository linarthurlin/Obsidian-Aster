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

1. **更名與 runtime spike**：GitHub/local 名稱 Obsidian-Aster、外掛顯示 Aster；保留 ID knowledge-agent；比較 Codex exec/app-server 的 model/thinking、sessions、context meter、Windows 支援和工具權限。
2. **一般 Agent workspace**：多對話、Project/Skill、slash menu、選取文字 Quick Ask、model/thinking picker、context window meter、stream/cancel。
3. **Scoped Obsidian 工具與交易復原**：目前 note／選取／指定範圍、完整 context 預覽、跨重啟 journal、pending recovery、folder chooser、多筆提案逐筆 review。
4. **Knowledge Studio**：繁體中文與混合語言檢索、可定位引用、來源比較和 retrieval eval；不預設全庫背景索引。
5. **Research Desk 與 Vault Curator**：明確來源集、Zotero annotation 引用、確定性 health findings；AI 僅分類或提議修復。
6. **選配整合**：Tasks、Linter、Bases/唯讀 Dataview、Canvas/Excalidraw；不重做成熟外掛的任務、格式、查詢、文獻或畫布引擎。
7. **其他 providers**：等安全、capability contract、sessions 和 usage 狀態穩定後再加入。

## 驗證邊界

- [ ] 真實 Obsidian Windows 載入、取消、多 chat 與重新載入驗證。
- [ ] 繁中／英文檢索基準與引用定位品質。
- [ ] 跨重啟 transaction history 和 pending journal recovery。
- [ ] Personal Glass Theme、Companion、default theme 與無障礙整合。
- [ ] 新能力必須在合成 Vault 驗證；unit/DOM 測試不代表 runtime 完成。

不讀取個人 Vault、不自動寫入或啟用 plugin。Release 前執行 npm run check 與 npm run package。