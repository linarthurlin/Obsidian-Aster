# 本 Chat 的工作範圍

本 Chat 負責 Aster Agent Plugin；程式、文件、測試和發布以 Obsidian-Aster 獨立 repo 為準。Personal Glass Theme 和 Companion 維持各自 repo，由使用者另外開設的 Chat 維護；不要在 Aster repo 修改它們。

Obsidian plugin ID 仍是 knowledge-agent，既有安裝目錄、Settings 與外部交易 journal 路徑保持相容。現有能力包含限定範圍的離線搜尋、來源證據、提案、diff 審核、明確套用及回復；新規劃見 GENERAL-AGENT-IMPLEMENTATION-PLAN.zh-TW.md 和 ROADMAP.md。

Aster 的 CSS 限定於 .pga-workbench，優先讀取選配 --pg-* tokens，缺少 Personal Glass 時 fallback 到 Obsidian 原生變數。Theme 的安裝、停用或更新不得改變 Agent 的檢索／寫入權限。

不讀取或整理個人 Vault，不保存登入憑證，不把私人筆記、context、計畫、收據或交易紀錄上傳 public repo。Aster 不預設背景掃描或自動寫入；每次模型傳送需由使用者檢查範圍，任何 Vault 變更需明確核准。CI/DOM 測試和歷史截圖不代表真實 Obsidian runtime 驗證。