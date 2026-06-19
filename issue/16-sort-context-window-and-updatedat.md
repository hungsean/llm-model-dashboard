# Issue #16：Context Window 與「更新時間」兩欄加上排序

## 背景／為什麼

`PricingTable` 目前只有 **Input 價格**、**Output 價格**兩欄可點表頭排序（`SortKey = "inputPricePerMTok" | "outputPricePerMTok"`，點一下 asc、再點 desc，有 ▲▼ 與 `aria-sort`）。

而 **Context Window** 欄（#4 就有）與 **更新時間**（`updatedAt`，#12 新增）這兩欄雖然已經顯示出來，表頭卻是純 `<th>`、**不能排序**——#12 還特別寫明「`updatedAt` 本張不要求可排序」，把排序留給後續。使用者想「找最大 context 的模型」「看哪些資料最新／最舊」時，只能用眼睛掃，沒辦法排序。

這張把這兩欄補上排序，沿用現有那套點表頭排序的機制即可。純前端，不動資料層。

## 範圍

**要做：**
- 擴充 `SortKey`，加入 `"contextWindow"` 與 `"updatedAt"`。
- 讓「Context Window」「更新時間」兩個表頭沿用既有 `pt-sortable` 機制：可點、會切 asc/desc、顯示 ▲▼（`sortLabel`）、設定 `aria-sort`，與既有兩欄行為一致。
- 比較器要能處理兩種型別：
  - `contextWindow`：數字，沿用現有 `av - bv`。
  - `updatedAt`：ISO 日期字串，改用日期／字串比較（asc＝舊到新、desc＝新到舊）。
- `null` 值維持現有規則：**永遠排在最後**（不論 asc/desc），與既有價格排序一致。
- 切換到別欄排序時 reset 成 asc（沿用現有 `handleSort` 行為）。

**不做：**
- 不改資料層、不改 `/api/pricing` 契約（`contextWindow`、`updatedAt` 都已存在）。
- 不改預設排序（仍是 `inputPricePerMTok` asc）。
- 不做多欄複合排序，一次只依一欄排。
- 不讓 Provider／模型 欄可排序（不在這張範圍）。
- 不做長條圖（#13）、不做 filter（#14／#15）；不改 provider 篩選與關鍵字搜尋行為。

## 驗收條件

- [ ] 點「Context Window」表頭：依 `contextWindow` 排序，第一下 asc、第二下 desc，表頭顯示 ▲／▼。
- [ ] 點「更新時間」表頭：依 `updatedAt` 時間排序，asc＝最舊在前、desc＝最新在前，表頭顯示 ▲／▼。
- [ ] `contextWindow` 或 `updatedAt` 為 `null` 的列，永遠排在最後（asc/desc 皆是），與現有價格排序的 null 處理一致。
- [ ] 從某欄切換到另一欄排序時，方向 reset 為 asc。
- [ ] 兩個新可排序表頭都正確設定 `aria-sort`（被選中時 ascending／descending，否則 none）。
- [ ] 既有 Input／Output 價格排序、provider 篩選、關鍵字搜尋行為不受影響。
- [ ] 桌面與手機寬度（390px）皆不破版、可讀。

## 預估大小

**小**（單一檔 `PricingTable.tsx`，預估 < 40 行有意義變動；`pt-sortable` 樣式已存在，`PricingTable.css` 預期不需改）。

## 相依關係

- **依賴 #12**：「更新時間」欄（`updatedAt`）由 #12 新增，本張要等 #12 併入後才有欄位可排序。Context Window 欄則自 #4 起就存在。
- 與 **#13**（長條圖）、**#14／#15**（filter）同樣會動 `PricingTable.tsx`，彼此邏輯獨立但**會碰同一檔**，建議排在 #12 之後實作、並與 #13／#14 協調合併順序以避免衝突。

## 留言板

### 2026-06-19 ｜ Planning Agent
- 輸出：建立 Issue #16「Context Window 與『更新時間』兩欄加上排序」。範圍：擴充 `SortKey` 加入 `contextWindow`／`updatedAt`，兩欄沿用既有 `pt-sortable` 點表頭排序機制；比較器分數字（contextWindow）與日期字串（updatedAt）兩種型別，null 永遠墊底；明確不動資料層、不改預設排序、不做多欄排序、不做長條圖／filter。
- 緣由：兩欄已顯示但不可排序；#12 特別把 `updatedAt` 排序留給後續，這張接上。`contextWindow`／`updatedAt` 皆已在 `ModelPricing` 契約中，純前端。
- 號碼：本地暫定 #16，GitHub 卡到 **#16**（已對齊）。
- 相依：依賴 #12（updatedAt 欄）；與 #13／#14 同檔，建議 #12 之後做。大小「小」，可交給 Agent Issue Review。
