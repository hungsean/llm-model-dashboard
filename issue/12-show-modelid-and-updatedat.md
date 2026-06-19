# Issue #12：表格補上 modelId（灰字）與 updatedAt 顯示

## 背景／為什麼

#4 的價格表目前「模型」欄只顯示 `displayName`；`modelId` 已在 API 契約裡、但只用於搜尋沒呈現出來，使用者看不到精確的模型代號（例如分不清同名不同版本）。另外每個模型的 `updatedAt`（來源資料更新時間，`ModelPricing.updatedAt`，對應 DB `source_updated_at`）也在契約裡，但頁面完全沒顯示——目前只顯示 response 層級的 `fetchedAt`（我們抓取的時間），看不出「各模型」資料的新鮮度。

這張把兩個「已經有資料、但沒呈現」的欄位補上，讓使用者一眼看到精確模型代號與各模型資料新鮮度。純前端顯示，不動資料層。

## 範圍

**要做：**
- 在「模型」cell，於 `displayName` 下方以**灰色、較小字級**顯示 `modelId`。
- 顯示每個模型（每一列）的 `updatedAt`，沿用現有 `formatDate` 格式；`updatedAt` 為 `null` 時以「—」占位。
  - 放法：**新增一欄「更新時間」**呈現每列 `updatedAt`，與表頭上方既有的「資料更新（`fetchedAt`）」清楚區隔（一個是各模型來源時間、一個是整批抓取時間）。
- 維持現有 RWD：手機（<600px）卡片式 `data-label` layout 下兩個新資訊都正常可讀、不破版。

**不做：**
- 不改資料層、不改 `/api/pricing` 契約（`modelId`、`updatedAt` 都已存在）。
- 不動排序邏輯：`updatedAt` 本張**不要求可排序**。
- 不做長條圖（#13）、不做 filter（#14／#15）。
- 不改既有 provider 篩選、關鍵字搜尋的行為。

## 驗收條件

- [ ] 每一列模型在 `displayName` 下方顯示 `modelId`，視覺為灰色、字級小於 `displayName`。
- [ ] 每一列顯示該模型 `updatedAt`；`updatedAt` 為 `null` 時顯示「—」，不顯示空白或 0。
- [ ] 表頭上方既有的「資料更新（`fetchedAt`）」維持不變，與每列「更新時間」不混淆。
- [ ] 桌面與手機寬度（390px）皆不破版、可讀。
- [ ] 不影響現有排序、provider 篩選、關鍵字搜尋。

## 預估大小

**小**（單一檔群 `PricingTable.tsx` ＋ `PricingTable.css`，預估 < 60 行有意義變動）。

## 相依關係

- 長在 **#4**（價格列表，已完成）的 `PricingTable` 上。
- 與 **#13**、**#14** 邏輯上互相獨立，但三張都會改 `PricingTable.tsx`／`PricingTable.css`，建議**依序實作**（#12 → #13 → #14）以避免合併衝突。

## 留言板

### 2026-06-19 ｜ Planning Agent
- 輸出：建立 Issue #12「表格補上 modelId（灰字）與 updatedAt 顯示」。範圍：modelId 顯示在 displayName 下方灰色小字、新增一欄顯示每列 updatedAt（null 占位「—」）；明確不動資料層、不動排序、不做長條圖／filter。
- 緣由：兩個欄位都已在 `ModelPricing` 契約裡（`modelId`／`updatedAt`），只是 #4 沒呈現出來。
- 號碼：本地暫定 #9，GitHub 卡到 **#12**（PR 佔用號碼），已對齊為 #12。
- 相依：長在 #4；與 #13／#14 同檔，建議依序做。大小「小」，可交給 Agent Issue Review。

### 2026-06-19 11:30 ｜ Agent Issue Review
- 輸出：Review Suggestion：無需修改。Issue 目標清楚，範圍限於 `PricingTable.tsx`／`PricingTable.css` 的前端呈現；`modelId` 與 `updatedAt` 已在 `ModelPricing` 契約中，不需要改資料層或 API。大小屬小，驗收條件可判斷（含 `updatedAt` null 占位、fetchedAt 區隔、390px 手機寬度與既有排序／篩選／搜尋不受影響）。未見明顯安全、資料一致性或相容性風險。下一步：交給 Implement Agent。
