# Issue #4：價格列表／表格（MVP 核心）

## 背景／為什麼

這是 dashboard 的核心價值：讓使用者一眼看到各家模型的價格。完成這張，產品就有了最小可用的樣子（MVP）。

## 範圍

**要做：**
- 從 #8 的讀取端點 **`GET /api/pricing`** 取得價格資料載入前端。回傳契約（由 #8 釘死）：`{ fetchedAt: string | null, models: ModelPricing[] }`，`fetchedAt` 為 response 層級單一時間戳。`models` 的欄位形狀以 **#8 已實作的契約為準**（`src/worker/types.ts` 的 `ModelPricing`）：欄位全 camelCase，且 `inputPricePerMTok` / `outputPricePerMTok` / `cachedInputPricePerMTok` / `contextWindow` 皆 `number | null`、`updatedAt` 為 `string | null`。§4.2 只是 schema 基礎，其型別寫成非 null 較寬鬆，**以 #8 契約的 nullable 邊界為準**——前端不可假設這些欄位保證有值。
- 以表格呈現各模型：至少含 `provider`、模型名稱（`displayName`）、input 價格、output 價格、context window。
- 支援**排序**（至少能依 input 價、output 價排序）。
- 支援**篩選**：依 provider 篩選（選項對齊 #1 鎖定範圍：`anthropic` / `openai` / `google`），並有一個關鍵字搜尋框（模型名稱）。
- 單位顯示清楚（例如「USD / 1M tokens」）。**資料更新時間採端點回傳的 `fetchedAt`**（response 層級、我們抓取的時間）顯示。`fetchedAt` 為 `null`（D1 尚無資料）時，不要顯示成空白或亂填，要有可讀的標示（例如「尚無資料」）。
- **占位符（適用所有 nullable 欄位，不只價格）**：`inputPricePerMTok` / `outputPricePerMTok` / `cachedInputPricePerMTok` 任一價格、以及 `contextWindow` 為 `null` 時，表格以「—」之類的占位顯示，**不要顯示成 0 或空白**（0 會被誤讀成免費；context window 空白會被誤讀成無上限）。
- **空狀態**：端點回 `200 + { fetchedAt: null, models: [] }`（尚未跑過攝取、或抓取失敗保留空）時，前端顯示空狀態（例如「目前沒有價格資料」），**不要當成錯誤或破版**。
- 基本 RWD，手機上表格可正常閱讀。

**不做：**
- 不建資料層、不抓資料、不接 D1（那是 #7）、不寫讀取端點（那是 #8）；本張只**呼叫** `GET /api/pricing`。
- 不做模型並排比較（那是 #5）。
- 不做成本試算器、不做歷史走勢圖。
- 不做使用者帳號 / 收藏 / 後端可寫入的 API。

## 驗收條件

- [ ] 頁面能從 `GET /api/pricing` 載入 `models` 並列出，每列含 provider、模型名（displayName）、input 價、output 價、context window。
- [ ] 可依 input 價與 output 價排序，點擊欄位即時生效。
- [ ] 可依 provider 篩選（anthropic / openai / google），且關鍵字搜尋能即時過濾模型名稱。
- [ ] 價格單位明確標示，頁面顯示資料更新時間（採端點回傳的 `fetchedAt`）；`fetchedAt` 為 `null` 時有可讀標示（如「尚無資料」），不顯示空白。
- [ ] 任一 nullable 欄位（input／output／cached 價格、`contextWindow`）為 `null` 時以占位符（如「—」）顯示，不顯示成 0 或空白。
- [ ] 端點回 `{ fetchedAt: null, models: [] }`（空資料）時，頁面顯示空狀態、不報錯也不破版。
- [ ] 手機寬度下表格不破版、可閱讀。

## 預估大小

**中**。

## 相依關係

- **直接依賴 #8**（`GET /api/pricing` 讀取端點與固定契約）；#8 又依賴 **#7**（D1 ＋ 排程 Worker 攝取層）。本張只負責呼叫端點、畫表格，需 #8 完成（且 #7 已讓 D1 有資料）後才開工。鏈路 **#7 → #8 → #4**。
- schema 基礎為 **#1**（`docs/1-pricing-data-source.md` §4.2）；骨架為 **#3**。兩者已完成。
- 是 **#5**（模型比較）的前置。

## 留言板

### 2026-06-12 17:25 ｜ Planning Agent
- 輸出：建立 Issue #4「價格列表／表格（MVP 核心）」。範圍含載入資料＋表格＋排序＋篩選/搜尋，明確不做比較、不做試算器、不做歷史圖、不做帳號。
- 相依：依賴 #1（schema）與 #3（骨架）。實作細節在 #1 定案後可能微調。
- 大小估「中」，可交給 Agent Issue Review。

### 2026-06-13 ｜ Planning Agent（開工前重審）
- 緣由：主人說前置已完成、請重審以求保險。重審發現一個**未滿足的相依**：#1 是研究型 Spike，只給決策＋schema，其報告 §7 把「建 D1 ＋ 排程 Worker」「前端讀取層」列為待另開的實作型 Issue，但從未建立；#3 骨架又是純 static assets（`wrangler.jsonc` 只有 `assets`，無 Worker 入口、無 D1 binding、無 Cron）。結果 #4「把價格資料載入前端」**沒有任何資料可讀**。另外 #1 在 2026-06-13 已把存放方式從靜態 JSON 改為 D1＋排程 Worker，#4 原文未反映。
- 處理（經主人確認「另開資料層 Issue 當前置」）：
  1. **新建 Issue #7「價格資料層」**（D1 ＋ 排程 Worker ＋ `GET /api/pricing`），作為 #4 前置。
  2. **改寫 #4**：資料來源由「依 #1 存放方式」改為明確「讀 #7 的 `GET /api/pricing`」；相依由 #1 改為 **#7**（#1 降為 schema 基礎）。
  3. 收斂三個歧義：資料更新時間採端點回傳的 `fetched_at`；provider 篩選選項對齊鎖定範圍（anthropic/openai/google）；價格 `null` 以「—」占位、不顯示成 0。
  4. 範圍補一條「不建資料層（那是 #7）」。
- 範圍仍是純前端表格，大小維持「中」。
- 下一步：**#4 卡在 #7**——先做 #7。#4 本身規劃已就緒，待 #7 完成、D1 有資料後再交 Agent Issue Review／開工。

### 2026-06-13 ｜ Planning Agent（前置拆分後同步）
- 緣由：#7 經 Agent Issue Review 拆成 #7（攝取層）＋ #8（讀取端點）。本張的直接前置從 #7 改為 **#8**。
- 輸出：把資料來源由「#7 的 `GET /api/pricing`」改為「**#8** 的 `GET /api/pricing`」，並對齊 #8 釘死的契約 `{ fetchedAt, models: ModelPricing[] }`（`fetchedAt` 為 response 層級單一時間戳、欄位 camelCase）；範圍「不做」補上「不寫讀取端點（那是 #8）」。
- 相依鏈路定為 **#7 → #8 → #4**。
- 下一步：#4 卡在 #8（#8 又卡 #7）。規劃就緒，待 #8 完成後再開工。

### 2026-06-14 ｜ Planning Agent（#7/#8 完成後開工前重審）
- 緣由：#7、#8 皆已實作、Code Review 通過並 merge（D1 有 97 筆 seed、`GET /api/pricing` 上線）。開工前回頭比對 #4 規劃與 #7/#8 實際交付，收斂落差。
- 比對結論：**主體規劃對得準**——資料來源／契約／provider 篩選選項（`anthropic`/`openai`/`google`，與 `src/worker/config.ts` 的 `TRACKED_PROVIDERS` 一致，實測 D1 即此三家共 97 筆）／無分頁排序參數（前端做）／價格 null 占位皆相符。發現 **3 個 null 邊界**需補（#8 實際契約比 §4.2 更嚴格）：
  1. **`contextWindow` 也是 `number | null`**（`src/worker/types.ts` 確認），但原占位規則只寫「價格」。→ 占位規則放寬到「所有 nullable 欄位（含 `contextWindow`）」，並同步驗收條件。
  2. **`fetchedAt` 可為 `null`、`models` 可為空**（#8 對空資料回 `200 + {fetchedAt:null, models:[]}`，cron 首跑前／抓取失敗保留空都會遇到）。→ 補「空狀態」範圍與 `fetchedAt=null` 的可讀標示，並加兩條驗收條件。
  3. **nullability 依據從 §4.2 改指向 #8 契約**：§4.2 把 input/output/contextWindow/updatedAt 寫成非 null 較寬鬆，真正權威是 #8 已實作的 `ModelPricing`。→ 範圍首條改為「以 #8 契約的 nullable 邊界為準」，§4.2 降為 schema 基礎。
- 範圍仍是純前端表格、核心驗收不變，大小維持「中」。
- 下一步：#4 前置（#7→#8）已完成，規劃就緒 → 交給 **Agent Issue Review**。

### 2026-06-14 ｜ Implement Agent
- 輸出：建立 `src/components/PricingTable.tsx` 與 `PricingTable.css`，更新 `App.tsx` 引入元件。
- 改了什麼：
  1. `PricingTable.tsx`：React 元件，fetch `/api/pricing`，`useMemo` 做篩選（provider / 關鍵字）與排序（input / output 價，點欄位切換升降冪），含 loading / error / 空資料三種狀態。null 欄位以「—」占位，`fetchedAt=null` 顯示「尚無資料」。
  2. `PricingTable.css`：桌面用水平捲動表格，手機（<600px）改卡片式 `data-label` layout，不破版。
  3. `App.tsx`：引入 `<PricingTable />`。
  4. `App.css`：max-width 從 768px 放寬至 1100px，讓表格有足夠空間。
- 怎麼驗證：`pnpm typecheck` 通過（無型別錯誤）；Playwright WebKit 桌面截圖確認表格資料正確顯示、排序 ▲/▼ 標示正確；Playwright 手機寬度（390px）截圖確認卡片式 RWD 正常。
- 取捨：排序目前是前端 in-memory sort（資料筆數 ~97 筆，效能無疑慮）；`null` price 在排序時排到最後（直覺符合「資料不全」語意）。
- 下一步：交給 **Agent Code Review**。

### 2026-06-14 12:58 ｜ Agent Issue Review
- 輸出：Review Suggestion：無需修改。
- 理由：
  - Issue 目標清楚：只做前端價格列表頁，從 #8 已固定的 `GET /api/pricing` 契約載入資料並呈現表格、排序、provider 篩選與模型名稱搜尋。
  - 範圍大小適中：以目前前端仍是 placeholder 的狀態來看，主要會集中在 `App` 與樣式層，屬中型單一目標；沒有混入資料層、讀取端點、比較器、試算器、歷史圖或帳號功能。
  - 邊界與相依關係清楚：明確依賴已完成的 #8（而 #8 依賴 #7），並把 #7/#8/#4 的責任切分寫清楚，Implement Agent 不需要猜資料來源或 API contract。
  - 驗收條件可判斷：列資料、input/output 排序、provider 篩選、關鍵字搜尋、單位與 `fetchedAt`、nullable 欄位占位、空資料狀態與手機寬度可讀性都能逐項驗證。
  - 明顯風險已被擋住：已要求 nullable 價格與 `contextWindow` 不顯示成 0 或空白、`fetchedAt=null` 有可讀標示、空資料 `200 + { fetchedAt:null, models:[] }` 不當錯誤處理，避免前端誤導使用者或破版。
- 下一步：交給 Implement Agent。
