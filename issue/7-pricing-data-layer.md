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
