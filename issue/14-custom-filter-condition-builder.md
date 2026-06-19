# Issue #14：自訂 filter 條件建構器 + 即時套用

## 背景／為什麼

現在 #4 的表格只有「provider 單選下拉 ＋ 模型名稱關鍵字搜尋」兩個固定篩選。使用者想要更彈性的篩選：自己組合條件，例如「`provider = anthropic` 且 `modelId` 含 `haiku`」，或更進一步「(anthropic 且含 haiku) **或** (openai 且含 mini)」，把一群「輕量入門級模型」一次抓出來比較。

這張先做**條件建構器本身 ＋ 即時套用**：使用者能在畫面上組出多條條件、即時過濾表格。**命名與儲存**是下一張 **#15**，本張不碰，刻意切開讓每張 ≤ 中、可獨立審查上線。本張完成後，使用者已經可以「現場組一個自訂篩選來看」，只是還不能存起來重用。

## 範圍

**要做：**
- 在保留現有 **provider 單選下拉 ＋ 關鍵字搜尋**的前提下，新增一個「條件建構器」UI。
- **一條條件** = `{ 欄位, 運算子, 值 }`：
  - 可選欄位：`provider`、`modelId`、`displayName`、`inputPricePerMTok`、`outputPricePerMTok`、`cachedInputPricePerMTok`、`contextWindow`。
  - 運算子依欄位型別：
    - 字串欄位（`provider`／`modelId`／`displayName`）：`equals`、`contains`。
    - 數值欄位（三個價格、`contextWindow`）：`<`、`<=`、`>`、`>=`、`between`（上下限）。
- **布林結構＝OR of AND 群組（DNF，最多一層括號）**：
  - 同一**群組**內多條條件為 **AND**。
  - **群組之間**為 **OR**。
  - 對應使用者的例子 `(provider=anthropic AND modelId contains haiku) OR (provider=openai AND modelId contains mini)`。
- 可**新增／刪除條件**、**新增／刪除群組**、**清空（重設）**整個條件建構器回到不過濾。
- 套用後**即時過濾表格**；條件建構器的結果與既有的 provider 下拉、關鍵字搜尋、排序**疊加**（彼此 AND：先套條件建構器，再套 provider／關鍵字，再排序）。
- **`null` 數值處理**：某模型的數值欄位為 `null` 時，**視為不符合任何數值比較條件**（不可把 `null` 當 0 比大小，會誤選）。
- 手機寬度下條件建構器可操作、不破版。

**不做：**
- **不做命名、不做儲存／持久化**（localStorage 等都屬 **#15**）。本張的條件只存在當下元件 state，重整即消失。
- 不接後端、不寫 API。
- 不做**任意巢狀**布林邏輯（只做一層的 OR-of-AND，不支援群組再包群組）。
- 不做 `updatedAt` 的條件（日期比較留待未來，本張數值欄位不含 `updatedAt`）。
- 不動長條圖（#13）、modelId／updatedAt 顯示（#12）。

## 驗收條件

- [ ] 能新增至少一條條件（欄位＋運算子＋值），表格**即時**依條件過濾。
- [ ] 字串欄位支援 `equals`／`contains`；數值欄位支援 `<`／`<=`／`>`／`>=`／`between`。
- [ ] 同群組內多條件為 AND（例：`provider=anthropic` AND `modelId contains haiku` 只留下符合兩者的列）。
- [ ] 能新增多個群組做 OR（例：`(anthropic AND haiku) OR (openai AND mini)`），結果包含任一群組成立的列且正確。
- [ ] 數值欄位為 `null` 的模型**不會**被數值條件（如 `inputPricePerMTok < 1`）誤選。
- [ ] 條件建構器能與現有 provider 下拉、關鍵字搜尋、排序**同時運作**且結果正確（彼此 AND）。
- [ ] 能新增／刪除單一條件、新增／刪除群組、一鍵清空回到全部顯示。
- [ ] 桌面與手機寬度（390px）皆可操作、不破版。

## 預估大小

**中**（matching 引擎純函式 ＋ 條件建構器 UI ＋ 接進 `PricingTable` 的 filter 流程；預估 ~200–300 行有意義變動）。若實作中發現逼近上限，先收斂運算子集合（例如 `between` 延後），不要膨脹成大。

## 相依關係

- 長在 **#4**（價格列表，已完成）的 `PricingTable` 上。
- 與 **#12**、**#13** 邏輯上獨立但同檔，建議**依序實作**（#12 → #13 → #14）。
- 是 **#15**（命名／儲存／管理 filter）的**前置**——#15 要存的就是本張定義的條件結構，故本張需先把「條件的資料結構」定清楚（建議獨立成可序列化的型別，方便 #15 直接存）。

## 留言板

### 2026-06-19 ｜ Planning Agent
- 輸出：建立 Issue #14「自訂 filter 條件建構器 + 即時套用」。範圍：在既有 provider 下拉＋關鍵字搜尋之外，新增條件建構器（欄位＋運算子＋值），布林結構為 OR-of-AND 群組（DNF，一層括號），即時過濾、與既有篩選/排序疊加，null 數值不被數值條件誤選。明確不做命名/儲存（屬 #15）、不做任意巢狀邏輯、不做後端。
- 緣由：取代固定篩選，支援使用者例子 `(anthropic && id 含 haiku) or (openai && id 含 mini)`。先做建構器、後做儲存，切兩張保持 ≤中。
- 號碼：本地暫定 #11，GitHub 卡到 **#14**，已對齊。
- 設計提醒：把「條件的資料結構」獨立成可序列化型別，#15 直接拿去存。
- 相依：長在 #4；是 #15 前置；與 #12／#13 同檔建議依序。大小「中」，可交給 Agent Issue Review。

### 2026-06-19 ｜ Implement Agent
- 輸出：實作完成，新增 4 個檔案、修改 1 個檔案。
- 改了什麼：
  1. `src/components/filterTypes.ts` — 可序列化條件型別（StringCondition、NumberCondition、FilterGroup、FilterState），含欄位／運算子清單與 labels，#15 直接拿去用。
  2. `src/components/filterMatcher.ts` — 純函式 `matchesFilter(model, filterState)` 實作 OR-of-AND 邏輯；null 數值不符合任何數值條件；空值／NaN 條件自動 pass-through（部分輸入不阻斷）。
  3. `src/components/FilterBuilder.tsx` — 條件建構器 UI：可折疊 header、群組卡片（OR 分隔）、AND badge、欄位／運算子下拉、`between` 雙值輸入、新增／刪除條件、新增／刪除群組、清空；active 條件數 badge。
  4. `src/components/FilterBuilder.css` — RWD 樣式（桌面 + 390px 手機）。
  5. `src/components/PricingTable.tsx` — 引入 FilterBuilder 與 matchesFilter，在 `sorted` useMemo 中套用：條件建構器 → provider 下拉 → 關鍵字搜尋 → 排序。
- 驗證結果（Playwright E2E）：
  - 97 筆初始 → provider=anthropic AND modelId contains haiku → 5 筆（全是 haiku）✅
  - OR 群組（openai AND mini）→ 14 筆，全部符合任一群組 ✅
  - 清空 → 恢復 97 筆 ✅
  - inputPricePerMTok < 1 → 28 筆，null 價格模型不出現 ✅
  - between 1 and 5 → 47 筆 ✅
  - builder + provider 下拉 + 關鍵字搜尋同時 AND 疊加 ✅
  - 390px 手機不破版 ✅
- 取捨：空值條件（value=""）視為 pass-through 而非阻斷，避免使用者打字一半就全篩光。
- 下一步：交給 Agent Code Review。

### 2026-06-19 16:18 ｜ Agent Issue Review
- 輸出：Review Suggestion：無需修改。
- 理由：Issue 目標清楚，聚焦在「條件建構器 UI + 即時套用」同一件事；布林模型限定為一層 OR-of-AND，邊界明確，沒有落入任意巢狀條件或 #15 的命名／儲存範圍。欄位、運算子、null 數值處理、與既有 provider／搜尋／排序的疊加規則都有寫清楚，驗收條件可以逐項判斷。
- 大小判斷：中，仍可接受。主要會落在 `PricingTable.tsx`／`PricingTable.css` 加上可序列化條件型別與 matching 純函式，雖然比 #12／#13 大，但仍是同一個目標、未跨後端或資料層。
- 實作提醒：`between` 已列入範圍與驗收條件，Implement Agent 不應在未退回 Planning Agent 的情況下自行省略；若實作時發現行數或 UI 複雜度逼近「大」，應回到 Planning Agent 拆分或重新收斂驗收條件。
- 下一步：交給 Implement Agent。

### 2026-06-19 16:39 ｜ Agent Code Review
- 輸出：Review Report：需要修改。
- 問題：
  - `src/components/filterMatcher.ts`：未完成條件（空字串或 malformed number）在 `matchesCondition` 內回傳 `true`，但 `matchesFilter` 仍把只含未完成條件的群組當成有效 OR 群組。結果是使用者已經有一組有效條件時，只要新增第二個尚未填值的 OR 群組，整個條件建構器就會暫時放行全部資料。
- 原因：
  - Issue 要求群組之間為 OR、同群組內為 AND，且條件建構器要即時正確過濾。現在「新增群組」的預設空條件會形成永遠成立的 OR 分支，讓已套用的第一組條件失效；這會破壞多群組 OR 的操作流程與即時套用結果。
- 驗證：
  - `git diff --check origin/main...HEAD` 通過。
  - `pnpm lint` 通過。
  - `pnpm typecheck` 通過。
  - `pnpm build` exit code 0；build 過程有既有 Wrangler sandbox 外 log 寫入 `EPERM` 訊息，但 Vite 產物完成。
  - 用暫存編譯後的 `matchesFilter` 做最小重現：`provider=anthropic` 單一群組只回傳 anthropic；加入第二個空白 OR 群組後，同一批資料回傳 anthropic 與 openai，確認 bug 存在。
- 建議：
  - 區分「未完成條件」與「已完成且符合」兩種狀態；在 OR 層級應忽略沒有任何 completed condition 的群組，而不是讓它 match all。
  - 保留單一群組內「填寫中條件不阻斷已完成 AND 條件」的體驗可以，但空白／未完成的 OR 群組不應讓其他已完成群組失效。
- 下一步：回到 Implement Agent。

### 2026-06-19 ｜ Implement Agent（修正）
- 問題修正：`filterMatcher.ts` 新增 `isCompleted(condition)` 函式，只有 value 非空且合法（between 時 value2 也要非空）才算已完成條件。`matchesFilter` 改為只把「至少一個已完成條件的群組」視為有效 OR 分支，完全空白的 OR 群組直接忽略。
- 驗證（Playwright）：provider=anthropic 篩到 25 筆 → 新增空白 OR 群組 → 仍 25 筆（bug 已修）→ 填入 openai → 75 筆 → 加 AND modelId contains mini → 34 筆，全部符合任一群組。
- 下一步：交給 Agent Code Review。
