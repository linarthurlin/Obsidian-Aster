# Aster Chat

Aster Chat 提供多個獨立對話、逐 session model/thinking、Codex model catalog、即時串流、取消、Markdown 顯示、標題搜尋／重新命名、清除紀錄，以及可鍵盤操作的 `/` prompt recipe 和 Skill 選單。Recipe 和 Skill 都會展開成可編輯文字；Skill 指引在送出前可檢查，不會取得額外工具權限。

Chat 使用本機 Codex CLI 的 app-server，Aster 目前只接受已驗證的 `0.162.x` CLI minor；此次 Windows 合成 runtime 使用 `0.162.1`。啟動時先檢查 CLI 版本，未測版本不會載入 Chat model catalog 或啟動 Chat。Codex CLI 管理自己的登入；Aster 不讀取或保存憑證。Model catalog 僅表示 CLI 公布的選項，不保證帳戶能使用每個 model。

每個 Aster session 對應一個 Codex 持久 thread。Aster 將 Codex thread ID 存在 plugin session metadata，重新開啟時以 `thread/resume` 恢復同一對話；Codex 也會在自己的 session store 保存對話。Aster 另外把聊天文字以 JSON 保存在 Windows `%USERPROFILE%\.aster\chats\<session-id>.json`（其他平台為 `~/.aster/chats/`），不寫入 Vault，也不放在 plugin data。Clear chats 會刪除 Aster 本機 transcript 與 session link；Codex session 會留在 Codex，可在 Codex 端管理。這些純文字檔是私人資料。

一般 Chat 只傳送使用者輸入與該 session 對話，不會自動附加目前筆記或 Vault 範圍，也不提供 Obsidian 檔案工具。若設定了 Aster Corpus 資料夾，可用「Add note context」搜尋並選一篇 Markdown，或用「Add folder context」選 Corpus 根目錄／子資料夾。picker 只讀設定範圍內的路徑中繼資料；選取後才讀單篇筆記或資料夾內筆記。資料夾預覽最多包含 6 篇、合計 24,000 字元；超限時整批拒絕，不截斷。Aster 顯示完整快照與來源路徑，使用者明確按「Add context to draft」後，內容才進入可編輯 composer，仍須自行檢查並按 Send。預覽、加入草稿或捨棄預覽都不會呼叫模型。Codex 的 shell、plugins、apps、browser、computer、multi-agent、memories 和 web search 都停用；MCP 清空，project instruction 載入上限設為零，thread 使用暫存工作目錄、read-only sandbox，turn 的 network access 關閉。任何未預期的 Codex 工具 item 或 server-initiated tool／approval request 都會被拒絕並中斷該 turn。這些限制降低能力，但不宣稱是完整 OS 隔離。

自訂 Skills 以 Agent Skills 相容的 `SKILL.md` 存在 Windows `%USERPROFILE%\.aster\skills\<name>\SKILL.md`（其他平台為 `~/.aster/skills/`），最多 40 個。從 slash 選單選用後，Skill 指示會展開在 composer 中，使用者可先檢查、編輯再送出；展開後的內容會作為普通 user message 保存在對話記錄。Aster 只讀 `SKILL.md` 的文字，不載入相對參考檔、不執行 scripts，也不把 `allowed-tools` 當成授權。刪除 Skill 只刪 `SKILL.md`；若資料夾另有使用者資源則保留。這些 Skill 檔與 Vault 分開，不會被 Clear chats 刪除。

「Attach active note to Aster draft」Command Palette 命令讀取目前 Markdown 編輯器 buffer（包含未存檔內容），最多 24,000 字元，並將來源路徑與全文複製到目前 Chat 的可見 composer。若沒有 Chat，Aster 會先建立新 chat。草稿會提醒模型把筆記當成來源資料，使用者可先檢查、修改或刪除，再自行送出；超過上限時不截斷、不加入。此命令不掃描 Vault、不改寫原筆記。

Context meter 只使用 Codex 回報的 `last.totalTokens`（目前有效 context）與 `modelContextWindow`，依 Codex TUI 使用的 12,000-token baseline 計算百分比；缺值時顯示 unavailable，不以字數估算。模型變更、context compaction 或取消後會保留最後數字並標示可能過期。合成測試中同一 thread 的相鄰回合曾回報不同 window（258,400 與 475,000），所以 Aster 採每回合最新 provider 數值，不假設 window 固定。Codex 官方 TUI 對 `last.totalTokens` 的定義與 baseline 算法可在 [usage source](https://github.com/openai/codex/blob/main/codex-rs/tui/src/token_usage.rs) 查閱。

已完成的合成驗證（Codex CLI `0.162.1`、僅用系統暫存目錄與 synthetic canary）：ephemeral thread 多回合串流成功並收到 usage；要求讀取 canary 的對抗性請求沒有回傳 canary，且未觀察到工具 item；取消收到 interrupt ACK 並以 `interrupted` 結束。取消後沒有 final usage notification，因此 meter 會標示舊值可能過期。另以持久 thread 跨 app-server process 驗證 resume：恢復同一個 `threadSource=aster` thread、跨重啟取回合成記憶句，兩回合都完成並回報 usage；測試 session 已封存。Fake app-server 測試另覆蓋多 session 交錯、thread resume、版本 gate、工具 item fail-closed 和 UI context meter。測試不代表已在真實 Obsidian runtime 載入。

每個 session 最多 80 則訊息、單則最多 40,000 字元、單份紀錄最多 120 KB，最多 24 個 session。超出限制時顯示錯誤，不自動丟棄或縮減對話內容。

仍未完成：工具活動、經核准的 Obsidian 操作工具、Knowledge Studio、Research Desk、Vault Curator、backlinks、真實 Obsidian Windows runtime 驗證，以及 slash recipe 自訂。Corpus 搜尋與新分頁導覽已有合成 UI 測試，但不代表真實 Obsidian runtime 已驗證；Projects、Skills、Quick Ask、Corpus note/folder picker 和 Clear race 亦同。完整進度以 [roadmap](ROADMAP.md) 為準。
