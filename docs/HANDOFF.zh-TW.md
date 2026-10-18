# Knowledge Agent 交接（0.2.0）

此 repo 已加入限定語料、Codex CLI provider、context 預覽／同意、證據／diff 審核與單筆套用／回復 UI。只使用明確資料夾，外掛不做背景索引或自動整理。現有 CLI 登入由 Codex 自己管理，外掛不儲存 key。

先讀 CODEX-CLI.zh-TW.md、ROADMAP.md 與 TESTING.md。下一步優先完成真實 Obsidian 整合測試、跨重啟復原介面及可衡量的檢索評估，而非擴大自動寫入權限。任何個人筆記送出皆需當次 context 同意。

工作區根節點使用 .pga-workbench，CSS 使用共用 --pg-* tokens 並 fallback 到 Obsidian 原生變數；換 Theme 不得影響 Agent 功能。

## 共同規則

先讀 AGENTS.md、README.md、INTEGRATION-CONTRACT.md 與 REPOSITORY-SPLIT.md。各 repo 各自 npm ci / npm run check / npm run package、獨立版號與 Release。不要把拆開的元件重新綁在同一個 build 或安裝器。個人 Vault、密鑰、筆記、設定、計畫與交易紀錄不可上傳。此次拆分沒有寫入 Vault；新 Chat 不代表已授權部署或整理筆記。
