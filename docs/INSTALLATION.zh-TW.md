# 安裝與回復

主題與 companion plugin 可以分開使用。第一版為開發預覽，先在測試 vault 啟用。

## 安裝

1. 從 GitHub Release 下載 theme / plugin ZIP。
2. Theme 解壓至 `.obsidian/themes/Personal Glass/`，內有 `theme.css` 與 `manifest.json`。
3. Plugin 解壓至 `.obsidian/plugins/personal-glass/`，內有 `main.js`、`manifest.json`、`styles.css`。
4. 在 Obsidian 外觀設定選主題，在社群外掛啟用 plugin。
5. Plugin 預設使用 Portable、Warm、關閉原生材質。淺深模式由 Obsidian 原生外觀設定切換。

`/` 使用 Obsidian 核心 Slash commands；搜尋 Personal Glass、heading、callout、表格等命令。不是另一套區塊資料格式。

## Windows 材質

先選 Glass surface，再選 Acrylic 或 Mica。Mica 主要呈現桌布色彩，Acrylic 更接近桌面透視。需要 Windows 11 22H2+、相容 Electron、Hidden / Obsidian window frame；本專案不自行改變視窗 frame 設定。

切回 material `none` 會釋放此 plugin 的原生材質；停用 plugin 會清理外觀 attributes 與寬度設定。Electron 沒有對應材質 getter，因此原生材質回復到 `auto`，不保證恢復其他 plugin 曾設定的材質。請勿同時啟用兩個原生材質外掛。

當 Windows 關閉透明效果、失焦、高對比或低效能環境回退時，不應強制繞過系統。Portable 不使用原生材質。

## 回復

1. 在外觀設定切回之前的 theme。
2. 停用 Personal Glass companion plugin。
3. 若要移除，刪除上述兩個 Personal Glass 目錄；不要刪除其他 theme / plugin。
4. CLI installer 替換的檔案備份在開發專案 `.local/backups/<stamp>/`。只複製需回復的 theme/plugin 檔案，不覆蓋 vault 全部設定。

Installer 不修改筆記、外觀選擇、啟用清單、同步設定或其他 plugin 資料。切換主題及啟用仍由使用者操作。
