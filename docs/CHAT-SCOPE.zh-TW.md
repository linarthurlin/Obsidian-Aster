# 本 Chat 的工作範圍

本 Chat 負責 Knowledge Agent Plugin，後續程式、文件、測試與發布皆以此獨立 repo 為準。Theme 與 Companion 已交由使用者另外開設的 Chat 維護，不能在日常 Agent 工作中改寫它們的專案。

目前 Plugin ID 是 `knowledge-agent`，提供獨立 workbench 入口；現有離線搜尋、來源證據、提案、diff 審核、明確套用及回復工具位於 `workflow/`。0.2.0 由使用者在預覽 context 並勾選同意後呼叫 Codex CLI；沒有背景掃描或自動寫入。

樣式依據 INTEGRATION-CONTRACT.md：Agent 只在 `.pga-workbench` 下提供元件樣式，讀取選配 `--pg-*` tokens，缺少 Personal Glass 時 fallback 至 Obsidian 原生變數。Theme 的安裝、停用或更新不得改變 Agent 的檢索／寫入權限。

已完成限定 corpus 的唯讀詞彙檢索、CLI 模型提案與逐筆審核；下一階段做真實 App 驗證、交易歷史與檢索品質評估。筆記內容預設不送往模型；任何對外傳輸或內容變更都需在使用者授權範圍內。密鑰、個人筆記、計畫與交易紀錄不可上傳 public repo。

原 monolith 的 Git 歷史保留作為來源，當前檔案樹只包含 Agent。此次拆分沒有安裝到個人 Vault，未執行任何知識整理。請勿將 unit tests 或歷史截圖稱為拆分後的 Obsidian 實測。
