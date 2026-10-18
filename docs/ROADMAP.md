# Knowledge Agent roadmap

- [x] 獨立 repository、manifest、build、installer、CI 與 release pipeline。
- [x] 保留來源 Git 歷史及跨 repo 交接／樣式接口。
- [x] 離線來源／提案／review／apply／rollback 工具。
- [x] 明確資料夾範圍、限定檔案數與內容預算、本機詞彙檢索。
- [x] Codex CLI provider，沿用現有登入；沒有外掛 API key 儲存。
- [x] 完整 context 預覽與逐次送出同意；查詢變更／stale files 阻擋送出。
- [x] 來源摘錄、diff、獨立人工審核與單筆套用／回復 UI。
- [x] CLI 合成實測：支援的更新、來源注入、缺少證據；更新與回復演練。
- [ ] 更完整的檢索品質評估、語意／中文斷詞索引與較大語料效能。
- [ ] 跨重啟交易歷史／復原介面、crash pending journal 操作流程。
- [ ] 正式 corpus 選擇器、搜尋導覽與多筆提案審核。
- [ ] 真實 Obsidian 載入、送出、取消、Theme 共存與無障礙驗證。

0.2.0 的 CI/DOM 測試及三個小型 CLI 案例不代表實際 Obsidian 或所有模型情境均已驗證。本次未部署到個人 Vault，也未讀取、傳送或整理個人筆記。
