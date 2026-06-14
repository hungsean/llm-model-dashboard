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

### 2026-06-14 12:32 ｜ Implement Agent（Claude）
- 輸出：Implement，完成 `GET /api/pricing` 唯讀端點。
- **改了什麼**（3 個改動點，可分開審）：
  1. `src/worker/types.ts`：新增對外契約型別 `ModelPricing`（全 camelCase、價格／contextWindow／updatedAt 皆 `number|null` 或 `string|null`）與 `PricingResponse`（`{ fetchedAt: string|null, models: ModelPricing[] }`）。`updatedAt` 對應 DB `source_updated_at`，故定為 `string|null`。
  2. `src/worker/api.ts`（新檔）：`handleApiRequest` 做 `/api/*` 路由分派；`getPricing` 唯讀查 `model_pricing_current`、做 snake_case→camelCase 轉換、`fetchedAt` 取所有列 `fetched_at` 最新值（ISO 8601 字典序比較）。統一 `json()` helper（不加 CORS header）。
  3. `src/worker/index.ts`：`fetch()` 先攔 `/api/` 前綴走 `handleApiRequest`，非 API 才 fall through 到 `env.ASSETS`（避開 SPA fallback 把 `/api/*` 回成 HTML）。
- **怎麼對應驗收條件**（皆已實測通過）：
  - 200＋`application/json`＋`{fetchedAt, models}`：`GET /api/pricing` 回 200、`content-type: application/json; charset=utf-8`、頂層 keys 正確。
  - `models` 欄位名／型別：97 筆全數符合 camelCase 契約 keys 與型別；null 如實保留（cached 24 筆、input/output 各 6 筆為 null）。
  - `fetchedAt` 單一 ISO 字串：response 值 `2026-06-13T08:09:13.678Z`＝DB `MAX(fetched_at)`。
  - 無資料回 200＋`{fetchedAt:null, models:[]}`：清空表（fresh 連線）實測回 200＋空契約，不回 5xx。
  - 唯讀／405：`POST /api/pricing` 回 405＋`Allow: GET`＋JSON；無任何 HTTP 寫入路徑。
  - `/api/*` 404：`GET /api/does-not-exist` 回 JSON 404（非 SPA HTML）。
  - 非 `/api/` 仍走 ASSETS：`GET /` 回 200 `text/html`。
  - 無 CORS header：response 無 `access-control-*`。
  - 查詢 throw 回 500＋log：catch 中 `console.error("[api] ...")` 並回 500（程式碼路徑；亦於測試環境意外觸發過一次，確認行為正確）。
- **怎麼驗證**：`pnpm typecheck`、`pnpm lint`、`pnpm build` 皆通過；`pnpm dev`（miniflare 本地 D1，97 筆 seed）以 curl 逐條測上述情境。測「無資料」時有備份整表、測後完整還原（已驗證恢復為 97 筆、備份表已移除）。
- **風險／取捨**：
  - `fetchedAt` 在 JS 端用字串比較取最新（非 SQL `MAX`）：少一次查詢、ISO 8601 字典序＝時間序，正確；目前同批攝取的 `fetched_at` 本就相同。
  - 測「無資料」時，曾用另一 process 對同一 SQLite 檔做 DDL 導致 dev server 連線狀態錯亂、短暫回非預期錯誤；重啟 dev server（fresh 連線）後結果正確。屬本地測試方法的假象，非端點 bug。
- 下一步：交給 Agent Code Review。

### 2026-06-14 12:44 ｜ Agent Code Review
- 輸出：Review Report：無需修改。
- 看過的改動點：
  - `src/worker/api.ts`：`handleApiRequest()` 只分派 `/api/pricing` 與其他 `/api/*`，未匹配 API 回 JSON 404；`GET /api/pricing` 唯讀查 `model_pricing_current`，做 snake_case → camelCase 轉換，`null` 欄位如實保留，符合 #8 契約。
  - `src/worker/api.ts`：非 GET method 回 405 並帶 `Allow: GET`；D1 query throw 會 `console.error()` 並回 JSON 500，沒有把查詢錯誤吞成空資料。
  - `src/worker/index.ts`：`fetch()` 先攔 `/api/` 再交給 API handler，非 `/api/` 才 fall through 到 `env.ASSETS.fetch()`，符合 SPA fallback 下避免 `/api/*` 回 HTML 的要求；`scheduled()` 既有攝取路徑未被改壞。
  - `src/worker/types.ts`：新增 `ModelPricing` / `PricingResponse` 對外契約型別，nullable 邊界與 issue 一致；未手寫 `Env`，仍使用 `worker-configuration.d.ts` 產生的 `DB` / `ASSETS` binding。
- 驗證：
  - `pnpm typecheck`：通過。
  - `pnpm lint`：通過。
  - `pnpm build`：通過；第一次在 sandbox 內 Wrangler log 寫入被擋但 build exit 0，已用升級權限重跑並乾淨通過。
  - 本地 dev server 抽查：`GET /api/pricing` → 200 `application/json; charset=utf-8`，body 頂層 keys 為 `fetchedAt` / `models`，models 97 筆，單筆 keys 符合契約；`POST /api/pricing` → 405 JSON 且 `Allow: GET`；`GET /api/does-not-exist` → 404 JSON；`GET /` → 200 `text/html`。
  - Header 抽查：`/api/pricing`、405、404、root response 皆無 `access-control-*` header，符合同源不加 CORS。
  - `pnpm wrangler d1 execute DB --local --command "SELECT MAX(fetched_at) AS fetched_at, COUNT(*) AS n FROM model_pricing_current"`：local D1 為 97 筆，`MAX(fetched_at)` = `2026-06-13T08:09:13.678Z`，與 API response `fetchedAt` 一致。
  - 依 Workers review skill 補查最新 `@cloudflare/workers-types@4.20260613.1`：module `fetch` / `scheduled` handler 參數與 D1 `prepare().all<T>()` 型別符合目前用法。
- 風險：
  - 沒有需要擋下的功能風險；端點範圍小，沒有新增 HTTP 寫入路徑、沒有 CORS、沒有 SPA fallback 誤回 HTML。
  - 非阻擋提醒：`pnpm wrangler types --check` 目前會回報 `worker-configuration.d.ts` out of date；產到 `/tmp` 比對後，Env binding 仍是 `DB` / `ASSETS`，差異主要是 Wrangler 現版多產生 `Cloudflare.GlobalProps.mainModule` metadata。這不影響 #8 的 endpoint、typecheck、build 或 runtime 行為，但後續若要嚴格把 `wrangler types --check` 納入 CI，建議另行重產並提交。
- 結論：無需修改。
- 下一步：產出 Review Report，交給人確認；若人確認通過，PR 推送前請手動把這張 Issue 移到 `/closed` 收尾。
