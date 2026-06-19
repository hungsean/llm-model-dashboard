# Issue #13：input／output 價格 cell 背景長條圖（表內視覺比較）

## 背景／為什麼

使用者想比較各模型價格高低。原本 #5 規劃「另開並排比較視圖」做這件事；改用更輕量的做法取代——直接在 #4 價格表的 input／output 價格 cell **背景畫一條長條**，長度依價格比例正規化。使用者不必離開表格、不必勾選模型，就能用長條長度直覺比較各模型 input／output 價格高低。這張是取代 #5 核心價值的關鍵一張。

## 範圍

**要做：**
- 在 **input 價格** 與 **output 價格** 兩欄的 cell，各畫一條**背景長條**，長度 = `該模型該欄價格 / 該欄（當前可見列）最大值`。
- **正規化基準採「當前過濾後可見列」的該欄最大值**：隨 provider 篩選／關鍵字搜尋變動而重算，讓比較聚焦在當前清單（而非被一個極端貴的離群值壓扁）。
- 長條為**視覺輔助、在數字底層**：價格數字維持清楚可讀（沿用 #4 的 `formatPrice`，精度不變）。
- `null` 價格的 cell **不畫長條**，仍顯示「—」。
- input／output 兩欄長條用**可區分但不刺眼**的顏色；維持現有 RWD（手機卡片式 layout 下長條仍正常、不破版）。

**不做：**
- **不引入任何圖表函式庫**（用 CSS 背景／漸層即可，避免新增重相依）。
- 不做 context window 的長條（本張只做 input／output 價格兩欄）。
- 不做 tooltip／hover 互動，長條純視覺。
- 不動排序、provider 篩選、關鍵字搜尋、`fetchedAt` 顯示等既有邏輯。
- 不做跨模型「最佳值高亮」這類標示（那是 #5 的範圍，已取消；本張只做比例長條）。

## 驗收條件

- [ ] input、output 價格 cell 各有一條依價格比例的背景長條。
- [ ] 長條長度依**當前可見資料**的該欄最大值正規化；改變 provider 篩選／搜尋使可見清單變動時，長條比例會正確重算。
- [ ] 價格數字仍清楚可讀，精度與 #4 一致（例如 `0.075` 不被截成 `0.07`）。
- [ ] `null` 價格的 cell 不畫長條、仍顯示「—」。
- [ ] 桌面與手機寬度（390px）皆不破版。
- [ ] 沒有新增任何圖表相依套件（`package.json` 無新增繪圖類依賴）。

## 預估大小

**小**（偏中；主要在 `PricingTable.tsx` 算正規化 ＋ `PricingTable.css` 畫背景長條，預估 < 120 行有意義變動）。

## 相依關係

- 長在 **#4**（價格列表，已完成）的 `PricingTable` 上。
- 與 **#12**、**#14** 邏輯上獨立，但同改 `PricingTable.tsx`／`PricingTable.css`，建議**依序實作**（#12 → #13 → #14）避免合併衝突。
- 取代已取消的 **#5**（模型比較）核心價值的一部分。

## 留言板

### 2026-06-19 ｜ Planning Agent
- 輸出：建立 Issue #13「input／output 價格 cell 背景長條圖」。範圍：兩個價格欄 cell 背景依比例畫長條、用當前可見列最大值正規化、null 不畫條、不引圖表庫；明確不做 context window 長條、不做最佳值高亮（屬已取消的 #5）。
- 緣由：用表內長條取代 #5 的另開比較視圖，更輕量。
- 號碼：本地暫定 #10，GitHub 卡到 **#13**，已對齊。
- 相依：長在 #4；與 #12／#14 同檔，建議依序做。大小「小（偏中）」，可交給 Agent Issue Review。

### 2026-06-19 15:05 ｜ Agent Issue Review
- 輸出：Review Suggestion：無需修改。
- 理由：Issue 目標清楚，限定在 input／output 價格 cell 的背景比例長條；範圍邊界明確，排除圖表庫、context window、tooltip、排序／篩選邏輯改動與最佳值高亮；驗收條件可判斷，涵蓋當前可見資料正規化、null 價格、桌面／390px 手機寬度與 package 相依檢查。
- 大小判斷：小（偏中）合理，主要落在 `PricingTable.tsx` 與 `PricingTable.css`，屬同一目標且未跨多模組。
- 實作提醒：現有資料契約中 `0` 是有效價格、`null` 才是未知；Implement Agent 計算最大值時需避免可見列最大值為 `0` 時產生 `NaN`／無效 CSS，這是局部防呆，不影響本 Issue 通過。
- 下一步：交給 Implement Agent。

### 2026-06-19 15:30 ｜ Implement Agent
- 輸出：Implement 完成。
- 改了什麼：
  - `PricingTable.tsx`：在 `sorted` memo 後新增 `maxInputPrice`／`maxOutputPrice` 兩個 useMemo，取當前可見列排除 null 後的最大值；input／output 價格 `<td>` 改用 CSS custom property `--bar-pct` 傳入比例百分比。
  - `PricingTable.css`：新增 `.pt-price-cell`、`.pt-price-input`（indigo 0.18 透明度）、`.pt-price-output`（emerald 0.18 透明度）三個 class，用 `linear-gradient` 依 `--bar-pct` 畫背景長條。
- 怎麼對應驗收條件：
  - 兩欄各有背景長條 ✓；依可見列最大值正規化，filter/search 觸發 useMemo 重算 ✓；formatPrice 精度不變 ✓；null → style undefined → CSS fallback 0% → 無長條 ✓；手機卡片式 layout 截圖確認不破版 ✓；僅改 .tsx/.css 兩檔，package.json 無變動 ✓。
- 風險取捨：maxInputPrice = 0（全部 null 或全部 0 價格）時不畫長條，此邊界情況已在 `maxInputPrice > 0` 條件中處理，符合 Issue Review 的實作提醒。
- 下一步：交給 Agent Code Review。
