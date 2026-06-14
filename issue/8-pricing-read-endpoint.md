# Issue #8：價格讀取端點 `GET /api/pricing`（穩定 API contract）

## 背景／為什麼

#7 把價格資料攝取進 D1（`model_pricing_current`），但**前端讀不到**：#3 骨架是純 static assets，沒有對外 API。本張在 #7 的 Worker 入口上加一個唯讀端點，並**把回傳契約釘死**，讓 #4 的前端有一個穩定、不會被多種解讀的資料來源。

這張從 #7 拆出來（Agent Issue Review 建議）：#7 負責「寫進 D1」，本張負責「把現價讀出來給前端」，是 #4 的**直接前置**。

依據：`docs/1-pricing-data-source.md` §4.2（`ModelPricing` schema）、§4.5（`model_pricing_current` 表）。

## 範圍

**要做：**

- 在 #7 的 Worker `fetch()` 入口加一條路由 **`GET /api/pricing`**，唯讀查 `model_pricing_current` 全部現價並回傳。
- **固定回傳契約（不可二義）**：

  ```ts
  // HTTP 200, Content-Type: application/json
  interface PricingResponse {
    fetchedAt: string | null;   // response metadata：整批資料的最新抓取時間（ISO 8601）；D1 無資料時為 null
    models: ModelPricing[];     // §4.2 形狀，欄位全 camelCase
  }

  interface ModelPricing {
    provider: string;
    modelId: string;
    displayName: string;
    inputPricePerMTok: number | null;
    outputPricePerMTok: number | null;
    cachedInputPricePerMTok: number | null;  // 無則 null
    contextWindow: number | null;
    updatedAt: string | null;   // 來源 last_updated（ISO 8601）；來源沒給則 null
  }
  ```

  - `fetchedAt` 是 **response 層級的單一時間戳**（取 `model_pricing_current.fetched_at` 的最新值），**不是每筆欄位**——避免 #4 拿到不一致的時間。
  - 欄位命名一律 **camelCase**，對齊 §4.2；DB 的 snake_case 在端點內轉換。
  - 找不到的價格如實回傳 **`null`**（不要 0、不要省略欄位）。
  - **`updatedAt` 對應 DB `source_updated_at`，該欄無 `NOT NULL`（#7 的 `PricingRecord.sourceUpdatedAt` 也是 `string | null`），故契約定為 `string | null`、如實回傳 `null`**，不要丟錯也不要塞空字串。
- D1 沒有資料時（例如尚未跑過攝取）：回 `200` ＋ `{ "fetchedAt": null, "models": [] }`（前端可顯示空狀態），不要回 500。
- **路由與 method**（本專案 `wrangler.jsonc` 設了 `not_found_handling: "single-page-application"`，未匹配路由會回 `index.html` ＋ 200，必須主動處理）：
  - `fetch()` 內**先判斷 `/api/` 前綴**，命中 API 才走端點邏輯；非 `/api/` 才 fall through 到 `env.ASSETS.fetch`（首頁照常）。
  - `GET /api/pricing` 以外的 **`/api/*` 路徑回 JSON `404`**（不可 fall through 到 SPA，否則回一坨 HTML）。
  - `/api/pricing` 的**非 GET method（POST/PUT/...）回 `405`**（method not allowed），呼應「唯讀」。
  - **同源**：前端 #4 與 API 由同一個 Worker 服務，**不需也不要加 CORS header**。
- **D1 查詢失敗**（query 真的 throw，非「無資料」）：回 `500` ＋ 記一筆 log，不要把錯誤吞掉當成空資料。

**不做：**

- 不做任何寫入／更新 API（攝取只走 #7 的 Cron）。
- 不做分頁、不做查詢參數篩選／排序（資料量小，篩選排序在 #4 前端做）。
- 不做歷史端點（`history` 表的讀取之後另議）。
- 不做前端表格 UI（那是 #4）。
- 不做 KV／Cache 快取（之後視效能再另開）。

## 驗收條件

- [ ] `GET /api/pricing` 回 HTTP 200、`application/json`，body 結構為 `{ fetchedAt, models: [...] }`。
- [ ] `models` 每筆欄位名與型別符合上方 `ModelPricing`（camelCase；價格、`contextWindow`、`updatedAt` 可為 `null` 並如實回傳 `null`）。
- [ ] `fetchedAt` 是 response 層級單一 ISO 8601 字串，取自 `model_pricing_current.fetched_at` 最新值。
- [ ] D1 無資料時回 `200` ＋ `{ "fetchedAt": null, "models": [] }`，不回 5xx。
- [ ] 端點唯讀：不存在任何透過 HTTP 改動 D1 的路徑；`/api/pricing` 的非 GET method 回 `405`。
- [ ] `GET /api/pricing` 以外的 `/api/*` 路徑回 JSON `404`（不會 fall through 成 SPA 的 `index.html`）。
- [ ] 非 `/api/` 路徑（首頁、static assets）仍由 `env.ASSETS` 正常服務，與 `/api/pricing` 互不影響。
- [ ] response 不含 CORS header（同源，不需要）。
- [ ] D1 查詢失敗（throw）時回 `500` 並記 log，不會被當成空資料回 200。

## 預估大小

**小**。單一唯讀端點 ＋ 一段 DB→契約的欄位轉換，無業務邏輯。

## 相依關係

- **依賴 #7**（要有 Worker 入口、D1 binding、`model_pricing_current` 與 seed 資料才能讀）。
- **是 #4 的直接前置**：#4 的價格表讀本端點。鏈路為 **#7 → #8 → #4**。

## 留言板

### 2026-06-13 ｜ Planning Agent
- 緣由：#7 經 Agent Issue Review 判定偏大且 `/api/pricing` 契約有二義，建議把讀取端點切出獨立成小 Issue、並釘死回傳契約。
- 輸出：建立 Issue #8「價格讀取端點 `GET /api/pricing`」。定案契約 `{ fetchedAt, models: ModelPricing[] }`：`fetchedAt` 為 response 層級單一時間戳（取 `current.fetched_at` 最新值）、欄位全 camelCase 對齊 §4.2、`null` 價格如實回傳、無資料回 200＋空陣列。明確唯讀、不做寫入/分頁/篩選/歷史/UI/快取。
- 相依：依賴 #7（D1 ＋ Worker 入口 ＋ seed 資料）；為 #4 直接前置。鏈路 #7 → #8 → #4。
- 大小估「小」。可交給 Agent Issue Review。

### 2026-06-14 ｜ Planning Agent（進 Review 前補強）
- 緣由：交給 Agent Issue Review 前，對齊 #7 已 merge 的實作（`src/worker/index.ts`、`types.ts`、`migrations/0001_init.sql`、`wrangler.jsonc`），補掉契約與邊界的漏洞。
- 修正：
  1. **`updatedAt` 型別硬傷**：原契約 `string`，但 DB `source_updated_at` 無 `NOT NULL`、#7 `PricingRecord.sourceUpdatedAt` 為 `string | null`，改為 `updatedAt: string | null` 並如實回傳 null。
  2. **SPA fallback 路由陷阱**：`wrangler.jsonc` 設 `not_found_handling: "single-page-application"`，未匹配路由會回 `index.html`＋200，故明定 `fetch()` 先攔 `/api/` 前綴、非 API 才 fall through 到 `ASSETS`；其他 `/api/*` 回 JSON 404。
  3. **method 限制**：`/api/pricing` 非 GET 回 405，呼應「唯讀」。
  4. **同源**：與前端 #4 同一 Worker，明定不加 CORS header。
  5. **錯誤情境**：D1 查詢 throw 時回 500＋log，不吞錯當空資料。
- 對應驗收條件已同步新增（405、/api/* 404、ASSETS 並存、無 CORS、查詢失敗 500）。
- 大小仍估「小」，皆為單一端點內的路由與轉換細節，無新增模組。可交給 Agent Issue Review。

### 2026-06-14 12:24 ｜ Agent Issue Review
- 輸出：Review Suggestion：無需修改。
- 理由：
  - Issue 目標清楚且單一：只在既有 Worker `fetch()` 補 `GET /api/pricing` 唯讀端點，讀 `model_pricing_current` 並轉成固定 response contract，不混入攝取、歷史、前端或快取。
  - 範圍大小適中：依大小尺規屬小型變更，主要是 API 路由判斷、D1 查詢與 snake_case → camelCase 欄位轉換。
  - 契約已足夠明確：`fetchedAt` 是 response 層級單一時間戳、`models` 欄位與 nullable 邊界明列，空資料回 200＋空陣列，D1 throw 回 500＋log。
  - 邊界與風險已補齊：明確處理 SPA fallback 下的 `/api/*` JSON 404、`/api/pricing` 非 GET 405、非 `/api/` 仍走 ASSETS、同源不加 CORS，且不新增任何 HTTP 寫入路徑。
  - 相依關係清楚：依賴已完成的 #7，並作為 #4 的直接前置，鏈路 #7 → #8 → #4 可執行。
- 下一步：交給 Implement Agent。
