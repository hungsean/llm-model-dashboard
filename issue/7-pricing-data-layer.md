# Issue #7：價格資料攝取層（D1 ＋ 排程 Worker）

## 背景／為什麼

#1 是研究型 Spike，只產出「決策 ＋ schema ＋ D1 資料表設計」，**沒有任何真資料、也沒有資料層程式**。它的報告 §7 明確把「建 D1 ＋ 排程 Worker」與「前端讀取層」列為**待另開的實作型 Issue**，但這張一直沒被建立。

於是 #4（價格列表）目前**沒有任何資料可載**：#3 的骨架是純靜態資產（`wrangler.jsonc` 只有 `assets`，沒有 Worker 入口、沒有 D1 binding、沒有 Cron Trigger）。

本張負責把 #1 的決策落地成「會自動更新、寫進 D1」的**資料攝取層**；對外的 `GET /api/pricing` 讀取端點依 Agent Issue Review 建議**拆到 #8**，本張只做到「D1 有資料」為止。

依據：`docs/1-pricing-data-source.md` 的 §4.2（schema）、§4.3（D1＋Cron 決策與容錯）、§4.4（供應商範圍）、§4.5（資料表設計與排程邏輯）。

## 範圍

**要做：**

- **D1 資料庫與資料表**：實作時執行 `wrangler d1 create` 建立 D1 database，把產生的 `database_id` 填進 `wrangler.jsonc` 的 D1 binding，並把 database 名稱／id 記到留言板；migration SQL 建 `model_pricing_current` 與 `model_pricing_history` 兩張表（欄位完全照 §4.5），以 `wrangler d1 migrations apply` 套用。
- **Worker 入口**：現有骨架是純 static assets，需新增一個 Worker 入口（`main`）並保留 assets binding（static assets 仍正常服務首頁），讓 Worker 能掛載 `scheduled()` handler。對外 `fetch()` 的 `/api` 路由在 **#8** 再加。
- **排程 Worker（Cron Trigger）**：設定 `triggers.crons`（建議每日一次）；`scheduled()` handler 依 §4.5 邏輯：
  1. 抓 `https://models.dev/api.json`。
  2. 用設定陣列 `['anthropic','openai','google']` 過濾 provider（做成設定，加 Grok 只改一行）。
  3. 轉成 §4.2 的 schema（價格直接用 /MTok；找不到的價格存 `NULL`，不要用 0）。
  4. `UPSERT` 進 `model_pricing_current`，更新 `fetched_at`。
  5. 跟 `history` 內 `to_date IS NULL` 那列比價，**有變動**才關舊區間（補 `to_date`）並插新區間（`from_date`＝當日）；沒變動不動 history。
- **容錯**：抓取失敗就整批跳過、**保留 D1 既有資料不覆蓋成空**，並記一筆 log（§4.3）。
- **本地手動觸發（限 dev）**：提供在本地跑一次抓取的方法——用 `wrangler dev --test-scheduled` 觸發 `scheduled()`，或一支本地一次性 script 呼叫匯入函式，確保 D1 有資料供 #8／#4 開發驗收。**不在 production 開放任何 HTTP 寫入或觸發端點**（避免新增非預期的寫入 API）；正式更新一律靠 Cron Trigger。

**不做：**

- 不做 `GET /api/pricing` 讀取端點與 API contract（拆到 **#8**）。
- 不做前端表格、排序、篩選、搜尋 UI（那是 #4）。
- 預設不抓 Grok（xAI）——只留設定接口，要加改一行（§4.4）。
- 不做 KV／Cache API 快取（§4.3 列為選用，之後視效能再另開）。
- 不回填開抓之前的歷史（§4.3 誠實提醒，補不回來）。
- 不接備援來源 genai-prices（先單一主來源 models.dev；備援之後另議）。

## 驗收條件

- [ ] D1 database 以 `wrangler d1 create` 建立、`database_id` 已填入 `wrangler.jsonc` binding，database 名稱／id 記在留言板。
- [ ] `wrangler.jsonc` 有 D1 binding 與 `triggers.crons`；Worker 入口（`main`）掛上 `scheduled()` handler，static assets 仍正常服務首頁。
- [ ] migration 以 `wrangler d1 migrations apply` 套用成功，建出 `model_pricing_current`、`model_pricing_history` 兩張表，欄位與主鍵符合 §4.5。
- [ ] 排程邏輯：能抓 `models.dev/api.json`、過濾三家、轉成 schema、UPSERT 進 `current`；可在本地手動觸發一次成功寫入。
- [ ] 歷史 diff：價格有變動時 `history` 會關舊區間並插新區間；無變動時 `history` 不新增列（可用兩次不同價格的測試資料驗證）。
- [ ] 容錯：模擬抓取失敗時，`current` 既有資料**不被清空**，並有 log。
- [ ] 本地可用 `wrangler dev --test-scheduled`（或一次性 script）觸發一次抓取並寫入 D1；**production 未新增任何 HTTP 寫入／觸發端點**。
- [ ] 「要抓哪些 provider」是一個設定陣列，加 Grok 只需改一行、不動邏輯。

## 預估大小

**中**。拆掉讀取端點後，本張聚焦「攝取 ＋ 寫進 D1」單一目標，多為設定（wrangler、D1 migration）與一支排程邏輯。核心難度在「歷史 diff」。

## 相依關係

- **依賴 #1**（`docs/1-pricing-data-source.md` 的 schema 與 §4.5 資料表設計）與 **#3**（骨架，要在其上加 Worker 入口與 binding）。兩者皆已完成。
- **是 #8 的前置**：#8 的 `GET /api/pricing` 要讀本張寫進 D1 的資料。整體鏈路為 **#7 → #8 → #4**。

## 留言板

### 2026-06-13 ｜ Planning Agent
- 緣由：重審 #4 時發現，#1 研究報告 §7 把「建 D1 ＋ 排程 Worker」與「前端讀取層」列為待另開的實作型 Issue，但從未建立；#3 骨架又是純 static assets，導致 #4「把價格資料載入前端」沒有任何資料可讀。經主人確認，採「另開資料層 Issue 當前置」方案。
- 輸出：建立 Issue #7「價格資料層」。範圍含 D1 兩張表 ＋ Cron 排程抓取/過濾/轉換/UPSERT ＋ 歷史 diff ＋ 容錯 ＋ `GET /api/pricing` 讀取端點；明確不做前端 UI、預設不抓 Grok、不做 KV 快取、不回填歷史、不接備援來源。依據 `docs/1-pricing-data-source.md` §4.2–§4.5。
- 相依：依賴 #1（schema/資料表）與 #3（骨架）；為 #4 的前置。同步把 #4 改成讀本張端點。
- 大小估「中（偏大）」，已標註若過大可把讀取端點切出。可交給 Agent Issue Review。

### 2026-06-13 15:45 ｜ Agent Issue Review
- 輸出：Review Suggestion：需要修改。
- 問題：
  - Issue 同時包含 Worker 入口改造、D1 database/binding/migration、Cron 抓取與轉換、`current` UPSERT、`history` diff、抓取失敗容錯、`GET /api/pricing` 端點、以及本地或部署後手動 seed/觸發方式。這已經是多個可獨立驗收的目標，依大小尺規偏大，實作與 review 很可能超過一張中型 Issue。
  - 「建立 D1 database」與「一次手動觸發 / seed 方式」的邊界不夠清楚：需要 Planning Agent 明確說這張是只提交 migration/config/instructions，還是要實作可重複使用的手動匯入端點、指令或 scheduled 呼叫路徑。若包含部署後可呼叫的觸發端點，也要說明是否需要保護，避免新增非預期寫入 API。
  - `GET /api/pricing` 的回傳形狀同時寫「對齊 §4.2」與「帶上 `fetched_at`」，驗收條件又允許「整體或每筆的 `fetched_at`」。這會讓 #4 的前端契約不穩，Implement Agent 可能做出不同但都算符合文字的 API。
- 建議：
  - 拆成至少兩張 Issue：第一張做 Worker 入口、D1 binding、migration、Cron 匯入、UPSERT、history diff、容錯與本地手動觸發；第二張做 `GET /api/pricing` 讀取端點與穩定 API contract，作為 #4 的直接前置。若希望 #4 能很快開工，也可以把讀取端點獨立成小 Issue，但要依賴第一張已有 seed 資料。
  - 在資料層 Issue 補清楚 D1 database 建立的交付邊界，例如「提交 migration 與 wrangler binding placeholder，實際 database id 由部署者填入」或「實作時要執行 wrangler 建庫並更新 binding」。
  - 明確指定手動觸發方式的安全邊界：偏好本地/dev 指令或內部函式呼叫；若要部署後 HTTP 觸發，需另寫權限/secret 驗收條件，否則本張不應新增寫入 API。
  - 固定 `/api/pricing` 回傳契約，例如 `fetchedAt` 是每筆欄位或 response metadata 二選一，欄位命名也需與 §4.2 camelCase 一致，避免前端後續重工。
- 下一步：回到 Planning Agent。

### 2026-06-13 ｜ Planning Agent（依 Review 修改）
- 輸出：依 Agent Issue Review 三點建議改寫，本張 #7 收斂為「資料攝取層」。
  1. **拆分**：把 `GET /api/pricing` 讀取端點與 API contract 切出去**另開 #8**（直接前置 #4）。#7 只保留 Worker 入口（掛 `scheduled()`）＋ D1 建庫/binding/migration ＋ Cron 抓取/過濾/轉換 ＋ `current` UPSERT ＋ `history` diff ＋ 容錯 ＋ 本地手動觸發。鏈路改為 **#7 → #8 → #4**。
  2. **D1 交付邊界寫清楚**：實作時 `wrangler d1 create` 建庫、`database_id` 填入 binding、migration 用 `wrangler d1 migrations apply` 套用，database 名稱/id 記留言板（已寫進範圍與驗收）。
  3. **手動觸發安全邊界**：限本地 dev（`wrangler dev --test-scheduled` 或一次性 script 呼叫匯入函式），**production 不開任何 HTTP 寫入/觸發端點**；正式更新只靠 Cron Trigger（已寫進範圍、不做、驗收）。
  - 另：`/api/pricing` 回傳契約的定案放在 #8——`{ fetchedAt, models: ModelPricing[] }`，`fetchedAt` 採 response metadata 單一時間戳、欄位全 camelCase 對齊 §4.2。
- 大小由「中（偏大）」降為「**中**」（單一目標）。
- 下一步：#7 交回 Agent Issue Review；同步建立 #8、改 #4 相依為 #8。

### 2026-06-13 15:54 ｜ Agent Issue Review
- 輸出：Review Suggestion：無需修改。
- 理由：
  - Issue 已依前次 Review 收斂為「價格資料攝取層」單一目標，`GET /api/pricing` 讀取端點已拆到 #8，整體鏈路 #7 → #8 → #4 清楚。
  - 範圍邊界清楚：#7 做 D1 建庫/binding/migration、Worker `scheduled()`、Cron 攝取、`current` UPSERT、`history` diff、容錯與本地手動觸發；明確不做 production HTTP 寫入/觸發端點、不做讀取 API、不做前端。
  - D1 database 建立與手動觸發的交付邊界已補明：實作時用 `wrangler d1 create`、填入 `database_id`、套 migration，並把 database 名稱/id 留在留言板；手動觸發限 dev，避免非預期寫入 API。
  - 驗收條件可判斷，涵蓋 migration、Cron 設定、成功寫入、history diff、抓取失敗不清空資料、provider 設定陣列與 production 不開寫入端點。
- 下一步：交給 Implement Agent。

### 2026-06-13 ｜ Implement Agent
- 輸出：Implement，完成價格資料攝取層並在本地全程驗證通過。

**改了什麼（主要改動點）**
1. **D1 建庫**：`wrangler d1 create llm-model-dashboard-pricing`（region APAC）。**database_id：`91547166-7b5e-44de-9522-b7782304100d`**、name：`llm-model-dashboard-pricing`。
2. **migration**：`migrations/0001_init.sql`，建 `model_pricing_current`、`model_pricing_history`（欄位/主鍵完全照 §4.5）。
3. **wrangler.jsonc**：加 `main`（Worker 入口）、`assets.binding=ASSETS`（保留 SPA not_found_handling）、`triggers.crons=["0 6 * * *"]`（每日 06:00 UTC）、`d1_databases`（binding `DB`）。
4. **Worker 程式（`src/worker/`）**：
   - `index.ts`：`fetch` 一律轉 `env.ASSETS.fetch`（#7 還沒有 /api，#8 再加）；`scheduled` 用 `ctx.waitUntil(ingestPricing(env))`。
   - `config.ts`：`TRACKED_PROVIDERS = ['anthropic','openai','google']`（加 Grok 只改這一行）＋ 來源 URL。
   - `models-dev.ts`：抓 api.json（非 2xx 丟錯）＋ 過濾三家 ＋ 轉 §4.2 schema（缺值 `null`）。
   - `ingest.ts`：讀 `history` 開放區間建索引 → 對每個模型 UPSERT `current` ＋ history diff，最後一次 `DB.batch()`；抓取/解析失敗或過濾後 0 筆則早退、不動 DB、記 log。
   - `types.ts`：`PricingRecord` 與 models.dev 最小型別。
5. **型別/設定**：`tsconfig.worker.json`（Worker 專用、無 DOM、含 `worker-configuration.d.ts`）＋ 根 tsconfig 加 reference ＋ `tsconfig.app.json` 排除 `src/worker`；`worker-configuration.d.ts`（`wrangler types` 產生，已提交，讓乾淨環境 typecheck/build 可過）；`eslint.config.js` 忽略產生檔。

**怎麼對應驗收條件**（全部 ✅，本地）
- D1 建庫＋id 填入 binding＋記留言板：✅（見上）。
- wrangler 有 D1 binding 與 crons、Worker 掛 `scheduled()`、首頁仍服務：✅（`curl /` → HTTP 200、`<title>LLM API 價格 Dashboard</title>`）。
- migration apply 成功、兩表符合 §4.5：✅（`wrangler d1 migrations apply --local`，3 commands ok）。
- 抓取/過濾/轉換/UPSERT、本地手動觸發：✅ 觸發一次寫入 **97 筆**（anthropic 25＋openai 50＋google 22，與 §4.4 實抓數一致）。
- history diff：✅ 同日再跑無變動 → 不新增（97/97）；**跨日變價** → 關舊區間（to_date=今天）＋開新區間（98/97）；**同日再變價** → 就地覆蓋、不撞主鍵（修了一個 PK 衝突 bug，見風險）。
- 容錯：✅ 把來源指到 404 觸發 → `current` 維持 97 筆不清空，並記 `[ingest] ... failed, keeping existing data` log。
- production 未新增 HTTP 寫入/觸發端點：✅（`fetch` 只讀 ASSETS；攝取只走 `scheduled`）。
- provider 設定陣列、加 Grok 一行：✅（`config.ts`）。

**怎麼驗證**：`pnpm typecheck`、`pnpm lint`、`pnpm build` 全 exit 0；`wrangler dev` ＋ `curl /cdn-cgi/handler/scheduled` 觸發 `scheduled()`，用 `wrangler d1 execute --local` 查表驗證上述每條。

**風險／取捨**
1. **PK 衝突修正（同日多次變價）**：§4.5 精簡邏輯「關舊列＋插 from_date=今天 新列」在「開放區間就是今天才開的」時會撞主鍵（PK 含 from_date）。測試時實際觸發了 `SQLITE_CONSTRAINT_PRIMARYKEY` 500。已改為：同日變價 → **就地覆蓋今天這段**；只有 from_date 早於今天才關舊開新。歷史粒度因此是「天」（一天最多一段、記當天最後價格），對天/週級的價格變動足夠。
2. **本地觸發路徑**：`wrangler dev --test-scheduled` 的 `/__scheduled` 會被我們的 `fetch` 攔成靜態資產；實際要用 Miniflare 的 **`/cdn-cgi/handler/scheduled`** 才會跑 `scheduled()`。已記於此供 #8/驗收參考。
3. **尚未上 production**：本張只做到「本地 D1 有資料、全綠」。要正式啟用 Cron，需 `wrangler d1 migrations apply --remote` ＋ `pnpm run deploy`（會讓線上 Worker 多一個每日 cron 打 models.dev）——屬對外/改動 production 的動作，**留待主人確認後再執行**，未自行部署。
4. **`worker-configuration.d.ts` 已提交**（非 gitignore）：換取乾淨環境免先手動 `cf-typegen` 即可 typecheck/build；改 `wrangler.jsonc` binding 後需 `pnpm cf-typegen` 重新產生。

- 下一步：交給 Agent Code Review。

### 2026-06-13 16:46 ｜ Agent Code Review
- 輸出：Review Report：無需修改。
- 看過的改動點：
  - `wrangler.jsonc`：已加入 Worker `main`、assets binding、每日 Cron Trigger、D1 binding/database id/migrations_dir；符合 #7 的 Worker 入口、D1 binding 與排程需求。
  - `migrations/0001_init.sql`：`model_pricing_current` 與 `model_pricing_history` 欄位、NULL 邊界與主鍵符合 `docs/1-pricing-data-source.md` §4.5。
  - `src/worker/index.ts`：`fetch` 只轉交 static assets，沒有新增 production HTTP 寫入/觸發端點；`scheduled()` 透過 `ctx.waitUntil(ingestPricing(env))` 執行攝取，符合 #7 邊界，讀取 API 留給 #8。
  - `src/worker/config.ts`：provider 設定集中在 `TRACKED_PROVIDERS = ['anthropic','openai','google']`，加 Grok 只需改設定陣列。
  - `src/worker/models-dev.ts`：抓取 `models.dev/api.json`、非 2xx 丟錯、過濾三家並轉成本專案 schema；缺價格/context 轉 `null`，沒有把缺值寫成 0。
  - `src/worker/ingest.ts`：抓取/解析失敗或過濾後 0 筆會早退並保留既有 D1；成功時 UPSERT `current` 並依價格差異維護 `history`，同日變價採覆蓋當日區間以避免 `(provider, model_id, from_date)` 主鍵衝突，這個取捨合理且已在 Implement 留言說明。
  - TypeScript 設定與 `worker-configuration.d.ts`：Worker 型別納入根 typecheck，前端 tsconfig 排除 Worker，乾淨環境可直接 typecheck/build。
- 驗證：
  - `pnpm typecheck`：通過。
  - `pnpm lint`：通過。
  - `pnpm build`：通過；第一次在 sandbox 內 Wrangler log 寫入被擋但 build exit 0，已用升級權限重跑並乾淨通過。
  - `pnpm wrangler d1 migrations list DB --local`：通過，顯示 local 無待套用 migration。
  - `pnpm wrangler d1 execute DB --local --command "SELECT COUNT(*) AS n FROM model_pricing_current"`：local current 為 97 筆。
  - `pnpm wrangler d1 execute DB --local --command "SELECT COUNT(*) AS n FROM model_pricing_history"`：local history 為 97 筆。
  - `PRAGMA table_info(model_pricing_current)` 與 `PRAGMA table_info(model_pricing_history)`：local schema 與 migration 相符。
- 風險：
  - 沒有需要擋下的風險。尚未 remote migration/deploy 是 Implement 留言中明確保留給主人確認的 production 動作，符合本張不自行部署的取捨。
- 結論：無需修改。
- 下一步：產出 Review Report，交給人確認；若人確認通過，PR 推送前請手動把這張 Issue 移到 `/closed` 收尾。
