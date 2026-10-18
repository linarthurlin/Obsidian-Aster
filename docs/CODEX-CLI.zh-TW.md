# Codex CLI 整合

使用已安裝並登入的 Codex CLI；外掛不讀取、複製或儲存登入憑證，不要求額外 API key。已用 Windows 上的 `codex-cli 0.162.1`、既有 ChatGPT 登入完成三個合成案例。未指定 Model 時使用 CLI 內建預設，並非個人 config.toml 中的模型。

## 外掛操作

1. 在 Aster 設定選定 Vault 內一個明確資料夾，例如 `Research/Selected`；空範圍、整個 Vault、隱藏或連結資料夾不接受。
2. Open knowledge review workbench → Load scoped notes，選擇現有目標筆記及來源查詢。
3. Preview context 在本機讀取限定範圍，顯示完整目標筆記與最多六個來源摘錄。檢索是本機詞彙比對，不是向量搜尋。每次最多列舉 2000 個 Markdown，單檔 200KB、目標 32000 字元、單個摘錄 2400 字元；超出時縮小範圍。
4. 檢查完整送出內容，再勾選同意並 Ask Codex。這會傳送所顯示的內容到 CLI 使用的模型服務，使用既有帳號額度。沒有勾選時不啟動模型；查詢或目標改變時同意失效。檔案改變會要求重做預覽。
5. 本機核對回傳 schema、來源路徑、原文摘錄及檔案 hash，然後顯示 diff 和證據。模型無法指定另一個更新目標，也不直接執行寫入。
6. 閱讀差異與證據，另勾選已審核後按 Apply。僅更新該現有 Markdown。Rollback 拒絕覆蓋後續人工修改。

交易紀錄含完整 before/after，保存在使用者 home 下 `.knowledge-agent/transactions/*.private.json`（舊路徑保留以相容既有安裝資料），不在 Vault 內；請當作私密復原資料。現在的介面提供當次更新的回復按鈕，跨重啟的交易歷史 UI 尚待完成，可先用 CLI 對保存的紀錄回復。

## CLI 操作

```sh
node workflow/cli.mjs context --corpus /explicit/selected-folder --query "Bayesian prior" --target Note.md --out context.private.json
# Read the context and copy its exact digest. This approval authorizes sending that context.
node workflow/cli.mjs codex-plan --corpus /explicit/selected-folder --context context.private.json --approve-context <digest> --out plan.private.json
node workflow/cli.mjs review --plan plan.private.json
# Review the actual plan, then use the DIFFERENT plan review digest for an explicit apply.
node workflow/cli.mjs apply --vault /explicit/selected-folder --plan plan.private.json --review <plan-digest> --transaction /outside/corpus/transaction.private.json
node workflow/cli.mjs rollback --vault /explicit/selected-folder --transaction /outside/corpus/transaction.private.json
```

`codex-plan` 可另給 `--executable /absolute/codex` 與 `--model <id>`。使用 direct spawn、獨立參數與 stdin，沒有 shell 字串拼接。不支援 `.cmd/.bat/.ps1` wrapper；Windows 優先找官方 Desktop 安裝的 codex.exe，再嘗試 PATH。啟動失敗或不支援所需參數會報錯，不會退回不受限制的執行。

## 執行邊界

使用 `codex exec` 的 ephemeral、read-only、output-schema，忽略個人 config；停用 shell、plugins、apps、browser、computer、multi-agent、memory 與 web search。工作目錄是獨立暫存資料夾，無 Vault 路徑作為工作目錄或額外可寫目錄。已知 schema/result 暫存檔會移除，不遞迴清除未知內容。取消、逾時和輸出上限會停止程序；不會自動重試或自行提高權限。

這不是完整 OS 級讀取隔離，CLI 的平台／組織管理政策可能有額外行為；不能把 read-only 當成只能讀取選定資料夾的保證。模型要求使用工具時，其結果會被拒絕；prompt 防護與三個測試也不構成完整抗注入證明。CLI ephemeral 不表示模型服務零留存。精確引文只證明文字存在，不能替代人工判斷推理或公式是否正確。

官方參考：[非互動執行與 schema](https://learn.chatgpt.com/docs/non-interactive-mode)、[設定參考](https://learn.chatgpt.com/docs/config-file/config-reference)。實際參數另以本機 `codex exec --help` 和 `codex features list` 核對。

## 手動 live tests

`node scripts/smoke-codex.mjs` 和 `node scripts/eval-codex.mjs` 只會建立自己的合成語料，不接受個人 Vault 參數。會使用 CLI 帳號額度；CI 不執行它們。結果放在被忽略的 `.local/`，不包含在發布檔。
