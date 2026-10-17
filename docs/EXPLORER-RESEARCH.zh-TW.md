# Personal Glass 檔案導覽研究

實作更新：研究之後已在 0.2.0 整合原創唯讀導覽器與 Notebook Navigator tokens，並用獨立合成測試庫驗證。下文保留研究當時的證據範圍；最新功能與測試見 [導覽器說明](NAVIGATOR.zh-TW.md)及 [測試紀錄](TESTING.md)。

研究日期：2026-10-17。範圍：Windows Obsidian、鍵盤導覽、中文／英文混合筆記與 Personal Glass 視覺整合。這輪僅研究與記錄，未安裝外掛、修改產品程式、搬動筆記或變更 vault 設定。

## 1. 結論與決策

建議把左側設計成「知識導覽器」：保留實體資料夾，又提供最近、收藏、標籤與查詢等虛擬入口。視覺上採安靜的玻璃底板與清楚的選取列，筆記預覽以精簡清單為主。狹窄側欄在樹狀／清單之間切換；寬度足夠才顯示並排的來源與筆記清單。動效軌道、小球、音效與全庫縮圖屬後續選配，不能取代基本導覽。優先以 Notebook Navigator 作功能基準與適配實驗，再決定是否有必要自製 ItemView。這是依照本案需求的產品判斷，不是跨產品效能評測或使用者訪談結果。

最有價值的改善是減少「找一份筆記需要多少次展開、捲動、切換與返回」，而不是增加更多可點的裝飾。

## 2. 來源與證據強度

本次閱讀官方文件、外掛 README、授權、主題 API／整合 API、FAQ 與公開問題紀錄；另在 in-app browser 檢視 Notebook Navigator 官網的實際產品展示圖。未安裝或操作第三方外掛，也沒有對其目前版本做本機效能測試。

| 來源 | 能支持的判斷 | 邊界 |
| --- | --- | --- |
| [Obsidian File explorer](https://obsidian.md/help/plugins/file-explorer) | 原生排序與定位目前文件等基本能力 | 不代表所有第三方右鍵操作可在替代導覽器中使用 |
| [Obsidian Bookmarks](https://obsidian.md/help/plugins/bookmarks) | 收藏可以指向檔案、資料夾、搜尋、標題與區塊 | 核心 UI 有此能力，不表示有完整公開程式 API 可直接整合 |
| [Notebook Navigator](https://github.com/johansan/notebook-navigator) | 雙欄、預覽、標籤／properties、鍵盤與查詢能力 | README 的大型 vault 規模主張未在本機重現 |
| [NN FAQ](https://github.com/johansan/notebook-navigator/blob/main/FAQ.md) | 替代右鍵選單的相容性、設定同步差異 | 實際使用的其他外掛仍需逐一測試 |
| [Crisp File Explorer](https://github.com/letschips/crisp-file-explorer) | 原生樹旁的軌道互動、可選雙欄與窄側欄處理 | 是商業專有軟體；本次只看公開說明，不使用其程式或素材 |
| [Alternative Explorer](https://github.com/sunwookwak-polisci/Alternative-Explorer) | 精簡樹狀／清單切換、智慧資料夾方向 | 未實際驗證本機相容性 |
| [Column Explorer](https://github.com/n23eos/column_explorer) | Miller columns 保持階層路徑可見 | 消耗橫向空間，對長時間寫作未必適合 |
| [Bear workspace](https://bear.app/faq/how-to-set-tag-as-workspace/) | 以標籤縮小整個導覽與搜尋範圍 | 借鏡概念，不把 Bear 的語意直接套在 Obsidian |
| [Apple Notes Smart Folders](https://support.apple.com/en-au/102288) | 以規則集合跨資料夾找筆記 | 虛擬集合和實體資料夾要清楚區別 |
| [Notion Library](https://www.notion.com/help/manage-your-library) | 最近、收藏與可客製的入口層級 | 非團隊需求的區塊不需要照搬 |
| [WAI Tree View](https://www.w3.org/WAI/ARIA/apg/patterns/treeview/) | 焦點、選取與鍵盤導覽的互動語意 | ARIA 不能取代實際鍵盤與讀屏測試 |

公開問題的頻率資料不足，不能宣稱下面的問題是「大多數使用者都遇到」。產品需求、官方承認的整合限制與單一歷史 bug 分別標記。

## 3. 候選方案比較

| 方案 | 值得參考 | 本案取捨 |
| --- | --- | --- |
| 原生 Explorer＋Personal Glass | 原生操作與既有外掛相容性；維護最少 | 能改善行高、圖示、縮排、選取與密度，無法只靠 CSS 產生完整筆記摘要或虛擬集合 |
| Notebook Navigator＋theme adapter | 功能完整的來源／筆記雙欄，現成主題 tokens 與擴充 API | 最適合作為第一個比較基準；先關閉非必要功能，不預設整包設定都適合本案 |
| Alternative Explorer | 在同一側欄切換樹狀與筆記清單，避免固定占用兩欄 | 與本案窄側欄方向吻合；仍需驗證長中文標題、拖曳與快取行為 |
| File Tree Alternative | 清楚分離資料夾與檔案清單 | 可參考基本結構；本次未核實當前維護狀態，不直接判定過時或推薦當主要依賴 |
| Column Explorer | 保留逐層路徑、適合深資料夾與檔案整理 | 適合獨立「整理」視圖，非日常編輯左側預設 |
| 自製 Navigator | 完全控制無寫入導覽、玻璃層次、物件模型與未來 Agent 入口 | 需自行維護選取、鍵盤、快取、改名與刪除後的狀態；避免第一版變成完整檔案管理器 |

授權：NN 為 GPL-3.0，Alternative Explorer 與 Column Explorer 的 repository 標示 MIT。獨立安裝 NN、撰寫原創 theme adapter，與將 NN 程式碼併入本專案是不同方案；本案不複製 NN 程式碼。Crisp File Explorer 的[目前授權](https://github.com/letschips/crisp-file-explorer/blob/main/LICENSE)是專有商業授權，不能按開源套件複用；這也修正早期研究中可能受舊 GitHub 標示影響的印象。

## 4. 最值得解決的五個問題

優先級是本案設計評估，並非產品缺陷統計。

| 優先級／問題 | 使用者目標與發生位置 | 證據與頻率訊號 | 建議 |
| --- | --- | --- | --- |
| P1 知道內容、忘記路徑 | 從左側找到曾讀過的筆記 | 多個產品提供最近、收藏、標籤與智慧集合，顯示此導覽模式成熟；未量測本案實際找檔失敗率。信心：中高 | 路徑樹之外增加最近／收藏／查詢入口 |
| P1 側欄變寬壓縮正文 | 邊寫邊找筆記 | 公開產品展示可見雙欄消耗寬度；Crisp 明列窄側欄的上下布局。沒有跨裝置使用頻率資料。信心：高 | 寬度自適應，不強制固定三欄 |
| P1 只看檔名難辨識內容 | 在相似名稱的筆記列中挑對檔案 | NN／Apple Notes 的摘要與圖片提供可參考做法；效益需以實際找檔任務驗證。信心：中 | 兩行清單、局部摘要與相對路徑；縮圖 opt-in |
| P1 選取與目前文件混淆 | 鍵盤上下移動、批次選取時保留編輯脈絡 | WAI 明確區分 focus 與 selected；不是特指某外掛有 bug。信心：高 | 開啟、選取、焦點分開顯示，上下鍵不立即開每份文件 |
| P2 功能越多效能與整合越難預期 | 長時間使用、大量修改後仍順暢 | NN FAQ 記載原生右鍵選單整合限制；歷史 issue #1179 回報預覽／縮圖等組合的資源問題，已關閉，非目前版本缺陷證明。頻率未知。信心：限制高、現行效能風險中 | 延遲預覽、限制快取、測右鍵擴充、事件增量更新 |

歷史效能案例：[Notebook Navigator #1179](https://github.com/johansan/notebook-navigator/issues/1179)。只作為驗收情境，不據此否定現在版本。

## 5. 導覽物件模型

「物件」不應全部畫成同一種 folder。

| 物件 | 顯示內容 | 操作／資料意義 | 首版 |
| --- | --- | --- | --- |
| 實體資料夾 | folder icon、名稱、可選筆記數 | 對應真實路徑，展開或縮小範圍 | 必要 |
| Markdown 筆記 | 類型 icon、名稱、可選摘要／日期 | 開啟原始 `.md`；顯示名稱不等於改名 | 必要 |
| Canvas／Base | 個別類型 icon 與名稱 | 交回 Obsidian 對應 view | 必要 |
| 附件 | PDF／圖片／音訊等類型、名稱 | 放在可展開的附件分組；保留顯示全部入口 | 必要 |
| 收藏／最近 | 捷徑標記、名稱；同名時顯示路徑 | 指向既有檔案，不建立副本；最近開啟不等於最近修改 | 必要 |
| 標籤／property 值 | tag 或 filter icon、條件與筆記數 | 虛擬集合，可跨資料夾 | 第二階段 |
| 儲存查詢 | filter icon、名稱、作用範圍 | 讀取符合條件的內容，不搬動文件 | 第二階段 |
| Folder note | 與 folder 分開的文件標記 | 點擊標記開既有文件；箭頭只展開，避免操作歧義 | 選配，不自動建立 |
| Agent 待確認 | 數量、異動類型、具體來源 | 只對接真實 job／diff；不能用裝飾 badge 假裝已審核 | 後續，現階段不顯示 |

筆記列不預設顯示所有資訊。建議預設「名稱＋一行輔助資訊」，最多一個狀態 badge；沒有可信的現有 metadata 就不顯示知識成熟度。名稱先用 filename；若使用者已有 `title` 可選擇只讀顯示，不批次補寫 properties。

## 6. Layout 建議

### 6.1 日常模式

- 導覽頂部：搜尋、目前範圍、返回與定位目前文件。
- 常用入口：收藏、最近；可折疊，避免清單太長。
- 內容區：樹狀／筆記清單切換。選資料夾後可進入清單，以 breadcrumb 返回。
- 底部：輕量結果數與篩選摘要，不放長駐儀表板。

側欄約 280–360px 時優先此模式。數值是設計起點，需依中文字級、系統縮放與實際 pane 寬度調整。

### 6.2 寬螢幕模式

當導覽 pane 本身有約 500–620px，且正文仍保有合理寬度時：來源區約 160–200px、筆記清單約 280–360px。兩者可調整分隔，保留使用者選擇。

不是依整個視窗寬度就強制切雙欄；分割視窗、右側 Agent 與系統縮放都可能讓正文空間不足。首版可先明確手動切換，待互動測試後再加入自動模式。

### 6.3 整理模式

附件 Gallery 或 Miller columns 作獨立 main pane／按需展開的視圖，用於找圖、比較 PDF 或整理深層目錄。不要讓日常寫作固定承擔圖片牆與多欄寬度。

## 7. 功能優先順序

### 必做：改善找檔而不改筆記

1. 名稱／alias 搜尋、結果顯示路徑、清楚的當前資料夾／全庫切換。
2. 最近開啟與收藏入口；收藏整合優先看原生能力與可用 API，不直接依賴私有格式。
3. Reveal current file 按鈕；自動跟隨預設關閉，避免閱讀時突然捲走。
4. 自然排序：2 在 10 前，保留既有數字前綴，不為排序改檔名。
5. 檔案類型辨識、附件分組、可恢復的篩選與空結果畫面。
6. 鍵盤導覽、可見 focus、Enter 開啟、Ctrl+Enter 新 tab；多選與破壞性操作另階段。

搜尋不要一開始自製完整 query language。先有可點的 scope／type 篩選，全文需求交給原生 Search 或已安裝的檢索外掛，再決定進階語法。

### 第二階段：降低辨識成本

可選的本地摘要、局部縮圖、標籤與 property 篩選、跨資料夾智慧集合、每個視圖獨立排序。保留摘要／縮圖關閉的 Compact 密度。

### 最後：檔案操作與個性化

批次開啟、明確的搬移入口、改名／垃圾桶、手動排序、軌道提示與可選動效。UI 順序只存在 plugin 設定，不為了排序改 filename 或 frontmatter；拖曳排序和實體搬移必須有不同目的與明確預覽。

現階段維持研究與無資料變更。日後要實作寫入操作，使用 Obsidian FileManager／Vault API，並測試同名衝突、WikiLinks、相對附件、同步改名與恢復；不能假設單純檔案系統 rename 就安全。

## 8. Personal Glass 視覺規格草案

- 背景：一層側欄玻璃，清單本身保持較穩定的對比；不每列再做 blur。
- 導覽列高：Compact 28–32px、Comfortable 34–40px；摘要列 56–72px。這是桌面設計起點，不替代觸控目標驗證。
- 行圓角：8–10px；側欄大容器 14–18px。密集檔案列不適合全部做成大氣泡。
- 縮排：每級約 12–16px；長中文檔名有截斷與完整名稱 tooltip，結果列可顯示父路徑。
- 圖示：使用一致的 Lucide 系列；Markdown／Canvas／PDF 有明確類型差異。可指定少量資料夾 accent，不預設彩虹漸層。
- 狀態：目前開啟用小型側邊標記；選取用淡底色；鍵盤 focus 用輪廓。Hover 不能蓋掉後兩者。
- 工具：低頻按鈕在 hover 或 focus-within 顯示，鍵盤與右鍵仍可到達；不只靠滑鼠懸停。
- Motion：hover 約 80–100ms，展開／折疊約 140–180ms，無持續漂浮、無預設音效，尊重 reduced motion。
- 淺深色各自驗證正文、次要文字、selected、inactive selected 與 focus；不能只反轉背景。

軌道若後續加入，先做「目前項目定位＋今天看過的淡標記」；不直接複製 Crisp 的特定素材、程式與交互設計。

## 9. 實作路線與責任分工

**推薦先做適配實驗，而非立即重寫檔案管理器。** NN 有公開的[主題 tokens](https://github.com/johansan/notebook-navigator/blob/main/docs/theming-guide.md)與[API](https://github.com/johansan/notebook-navigator/blob/main/docs/api-reference.md)，可以把 Personal Glass 的 surface、radius、text、selection 與 focus 對齊。

實驗只在合成 demo vault：固定三套配色，測窄／寬 pane，先關閉日曆、外部圖片下載、任務掃描與手動寫入排序。NN 有些功能會寫 frontmatter，不因其「本地 Markdown」定位就假定全功能都是唯讀。

NN 使用自己的 context menus，其他外掛加在原生 file-menu 的選項不會自動出現；需使用其公開 Menus API 做適配。這是決定是否採用的重要驗收點，而不是靠 CSS 可以修好的問題。[FAQ](https://github.com/johansan/notebook-navigator/blob/main/FAQ.md)

若適配後仍無法滿足窄側欄、唯讀模式或操作語意，再自製 Navigator ItemView：

- Theme：視覺 tokens、密度、淺深模式與降級。
- View：渲染、焦點／選取／開啟狀態、scope、空狀態。
- Model：TFile／TFolder、MetadataCache、既有 tag/property 與事件增量更新。
- Services：最近紀錄、虛擬集合、延遲預覽；不自動重寫 note。
- File actions：第二階段才加入，獨立隔離並測試。

避免對原生樹大量注入節點、逐列掛 listener、全域 MutationObserver 或繞過 renderer 做排序 patch。若不得不用私有介面，應縮小範圍、記錄版本限制並提供原生回退。

## 10. 驗收與下一步

合成資料集至少覆蓋：長中文名、同名不同路徑、數字序列、空資料夾、深層資料夾、附件、多標籤、刪除／改名與不存在的收藏。

| 任務 | 驗證目標 |
| --- | --- |
| 忘記路徑，只記得主題或 alias | 搜尋能命中，結果能辨識來源位置 |
| 開始閱讀後定位目前文件 | 一次操作可定位，平常不自動捲走 |
| 從父資料夾瀏覽其子內容 | 明確顯示「本層／含子層」，不讓附件淹沒筆記 |
| 上下鍵瀏覽，最後開一份筆記 | 焦點不等於開啟，不產生一串無意義閱讀歷史 |
| 全庫與目前範圍切換 | scope 常駐可見，零結果有清除篩選入口 |
| 窄 pane 與高縮放 | 主要名稱可辨識，正文仍有空間 |
| 大量文件修改後繼續操作 | 增量更新、可見列預覽、有限快取；量測後才宣稱流暢 |
| 停用 Navigator | 回到原生 Explorer，既有筆記、metadata 與附件不變 |

這週可做：Notebook Navigator／精簡 Explorer 的合成資料比較與 Personal Glass theme adapter。這一階段的重點是布局、scope、鍵盤與唯讀約束。之後再考慮縮圖、智慧集合與安全的檔案操作。需要更深入研究的是使用者對「樹狀直接開檔」與「先選範圍再選筆記」的偏好，以及大型 vault 的本機效能。
