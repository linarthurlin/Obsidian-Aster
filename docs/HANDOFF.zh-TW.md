# Aster 交接（目前基線 0.2.1）

Aster 目前提供限定 corpus、本機檢索、Codex CLI proposal、context 預覽、來源／diff 審核與逐筆套用／回復 UI。外掛不做背景索引或自動整理；CLI 登入由 Codex 管理，外掛不保存 key。

先讀 AGENTS.md、README.md、INTEGRATION-CONTRACT.md、GENERAL-AGENT-IMPLEMENTATION-PLAN.zh-TW.md、ROADMAP.md、CHAT.zh-TW.md、CODEX-CLI.zh-TW.md 與 TESTING.md。Chat 已切至經 synthetic gate 的 Codex app-server `0.162.x`，持久 thread 可跨 app-server process 恢復；一般 Chat 的 per-session 唯讀 Corpus dynamic tools 已接入，仍需對照 experimental protocol 與真實 Obsidian Windows runtime。接續優先驗證真實 Obsidian 載入、取消、工具狀態、重啟和 compaction，然後按 roadmap 完成 Knowledge Studio、Research Desk、Vault Curator 和選配 adapters；不可讀取個人 Vault 或啟用 plugin。

工作區根節點使用 .pga-workbench，CSS 使用共用 --pg-* tokens 並 fallback 到 Obsidian 原生變數；切換 Theme 不得影響 Agent 功能。Theme 和 Companion 各自獨立發布，勿重綁它們的 build 或 installer。

不得讀取個人 Vault、密鑰、設定、計畫或交易紀錄。不得部署或啟用 plugin，除非使用者明確要求。個人筆記、prompt context、proposal、receipt、transcript 與 CLI local config 不得上傳。
