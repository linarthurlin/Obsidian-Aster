# Knowledge Agent 交接

此 repo 接收原本 workflow/knowledge.mjs、CLI 與完整證據／審核／回復測試，新增獨立 manifest id=knowledge-agent 的可載入 workbench 骨架。它目前不連線模型、不索引或修改 Vault，UI 只如實顯示狀態。

下一步：先決定明確 corpus、provider 與憑證儲存方式；建立搜尋／來源／diff 審核介面，再做檢索品質評估。預設不可掃描全庫或自動寫入；延續現有來源驗證、stale-file preflight、review digest、回復保護。模型信心分數不是正確率。

工作區根節點使用 .pga-workbench，CSS 使用共用 --pg-* tokens 並 fallback 到 Obsidian 原生變數；換 Theme 不得影響 Agent 功能。

## 共同規則

先讀 AGENTS.md、README.md、INTEGRATION-CONTRACT.md 與 REPOSITORY-SPLIT.md。各 repo 各自 npm ci / npm run check / npm run package、獨立版號與 Release。不要把拆開的元件重新綁在同一個 build 或安裝器。個人 Vault、密鑰、筆記、設定、計畫與交易紀錄不可上傳。此次拆分沒有寫入 Vault；新 Chat 不代表已授權部署或整理筆記。
