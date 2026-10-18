# Personal Glass Navigator

0.2.0 以獨立 ItemView 整合導覽器，原生 File explorer 仍可使用。它只開啟檔案、讀取中繼資料，並將最近與釘選路徑存在本外掛的 `data.json`；沒有改名、搬動、刪除或自動整理筆記的操作。

## 開啟與使用

重新載入 Personal Glass 後，使用左側 **Personal Glass Navigator** 圖示，或命令 **Personal Glass: Open read-only Navigator / 檔案導覽**。

- 搜尋檔名、路徑、frontmatter `aliases`；`#robotics` 同時符合 `#robotics/estimation`。多個關鍵字取交集。
- 資料夾按鈕切換來源／結果，包含 All notes、Recently opened、Pinned。資料夾逐層瀏覽，Parent folder 返回上一層。
- Notes 包含 Markdown、Canvas 與 Bases；可切換附件／全部檔案、名稱自然排序／修改時間、是否包含子資料夾。
- 上下鍵、Home、End 移動焦點；Enter 開啟；Ctrl/Cmd+Enter 或 Ctrl/Cmd+點擊開新分頁。Escape 回搜尋，搜尋框 Escape 清除文字。
- 右鍵可釘選／取消釘選、開新分頁。定位按鈕顯示目前文件；鍵盤焦點與目前文件指示分開。
- 窄側欄在來源與結果間切換；內容寬度至少 480px 時自適應並排。Compact 固定單欄；Dual pane 在空間足夠時並排，狹窄時仍切換以保留可讀性。

設定中的 **Local note previews** 預設關閉。開啟後只讀取目前已列出的 Markdown，跳過超過 200KB 的檔案，快取最多 120 筆；每次先列出 80 個結果，可按 Show next 繼續。搜尋使用 Obsidian 中繼資料快取，不建立全庫內容索引、不載入遠端縮圖。檔案很多時中繼資料篩選仍有全庫遍歷成本，尚未宣稱大型 Vault 效能達標。

## 選取玻璃設定（0.2.1）

Settings → Personal Glass → **Selection glass / 文件選取玻璃** 可即時控制：淺色與深色各兩個漸層顏色、各自的色彩不透明度（10–100%）、背景模糊（0–24px）、玻璃程度（高光與陰影，0–100）及漸層方向（0–360°）。預設為 Champagne × Sage；Reset 只回復選取設定。

目前文件使用持續的整列漸層背景，移除原有的單條側邊指示線。色彩相同時可作為單色選取。玻璃程度 0 會停用高光、陰影與背景模糊，保留填色。模糊只作用在後方內容，純色背景的變化可能不明顯；不是 Windows 原生材質開關。減少透明度及高對比設定仍優先。

文字會依兩端顏色與明暗模式估算可讀的深／淺色；強烈對比的漸層或複雜背景仍需人工確認。設定套用於 Personal Glass Navigator、原生 File explorer 與選配 Notebook Navigator；不修改任何文件內容。

## Notebook Navigator 選配

可自行安裝 [Notebook Navigator](https://github.com/johansan/notebook-navigator)，再使用 **Open Notebook Navigator integration**。未安裝時會開啟內建導覽器。Theme 只提供原創顏色與圓角 tokens；不包含或複製 GPL 外掛程式碼，也不修改它的設定。Notebook Navigator 本身具有寫入與檔案管理功能，不受內建導覽器的唯讀操作範圍限制。

內建導覽器沒有原生 Explorer 的完整第三方右鍵擴充、拖放與多選管理；需要這些操作時使用原生 Explorer 或自行選用 Notebook Navigator。
