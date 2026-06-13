# Issue #7：價格資料層（D1 ＋ 排程 Worker ＋ 讀取端點）

## 背景／為什麼

#1 是研究型 Spike，只產出「決策 ＋ schema ＋ D1 資料表設計」，**沒有任何真資料、也沒有資料層程式**。它的報告 §7 明確把「建 D1 ＋ 排程 Worker」與「前端讀取層」列為**待另開的實作型 Issue**，但這張一直沒被建立。

於是 #4（價格列表）目前**沒有任何資料可載**：#3 的骨架是純靜態資產（`wrangler.jsonc` 只有 `assets`，沒有 Worker 入口、沒有 D1 binding、沒有 Cron Trigger）。本張就是補上這個缺口——把 #1 的決策落地成可運作的資料層，給 #4 一個能讀的端點。

依據：`docs/1-pricing-data-source.md` 的 §4.2（schema）、§4.3（D1＋Cron 決策與容錯）、§4.4（供應商範圍）、§4.5（資料表設計與排程邏輯）。

## 範圍

**要做：**

- **D1 資料庫與資料表**：建立 D1 database，加入 migration SQL，建 `model_pricing_current` 與 `model_pricing_history` 兩張表（欄位完全照 §4.5）。在 `wrangler.jsonc` 加上 D1 binding。
- **Worker 入口**：現有骨架是純 static assets，需新增一個 Worker 入口（`main`）並保留 assets binding，讓同一個 Worker 同時服務靜態前端與 `/api` 端點。
- **排程 Worker（Cron Trigger）**：設定 `triggers.crons`（建議每日一次）；`scheduled()` handler 依 §4.5 邏輯：
  1. 抓 `https://models.dev/api.json`。
  2. 用設定陣列 `['anthropic','openai','google']` 過濾 provider（做成設定，加 Grok 只改一行）。
  3. 轉成 §4.2 的 schema（價格直接用 /MTok；找不到的價格存 `NULL`，不要用 0）。
  4. `UPSERT` 進 `model_pricing_current`，更新 `fetched_at`。
  5. 跟 `history` 內 `to_date IS NULL` 那列比價，**有變動**才關舊區間（補 `to_date`）並插新區間（`from_date`＝當日）；沒變動不動 history。
- **容錯**：抓取失敗就整批跳過、**保留 D1 既有資料不覆蓋成空**，並記一筆 log（§4.3）。
- **讀取端點**：`GET /api/pricing`，回傳 `model_pricing_current` 全部現價，形狀對齊 §4.2 的 `ModelPricing[]`，並帶上 `fetched_at`（給前端顯示「資料更新時間」）。唯讀，無寫入 API。
- **一次手動觸發 / seed 方式**：提供能在本地或部署後手動跑一次抓取的方法（例如可手動呼叫 scheduled 或一個一次性指令），確保 D1 有資料、`/api/pricing` 回得出東西，供 #4 開發與驗收。

**不做：**

- 不做前端表格、排序、篩選、搜尋 UI（那是 #4）。
- 預設不抓 Grok（xAI）——只留設定接口，要加改一行（§4.4）。
- 不做 KV／Cache API 快取（§4.3 列為選用，之後視效能再另開）。
- 不回填開抓之前的歷史（§4.3 誠實提醒，補不回來）。
- 不接備援來源 genai-prices（先單一主來源 models.dev；備援之後另議）。

## 驗收條件

- [ ] `wrangler.jsonc` 有 D1 binding 與 `triggers.crons`；Worker 入口（`main`）能同時服務靜態前端與 `/api`。
- [ ] migration 能建出 `model_pricing_current`、`model_pricing_history` 兩張表，欄位與主鍵符合 §4.5。
- [ ] 排程邏輯：能抓 `models.dev/api.json`、過濾三家、轉成 schema、UPSERT 進 `current`；可在本地手動觸發一次成功寫入。
- [ ] 歷史 diff：價格有變動時 `history` 會關舊區間並插新區間；無變動時 `history` 不新增列（可用兩次不同價格的測試資料驗證）。
- [ ] 容錯：模擬抓取失敗時，`current` 既有資料**不被清空**，並有 log。
- [ ] `GET /api/pricing` 回傳 JSON 陣列，每筆含 provider、modelId、displayName、input/output/cachedInput 價、contextWindow、updatedAt，並含整體或每筆的 `fetched_at`；`null` 價格如實以 `null` 回傳。
- [ ] 「要抓哪些 provider」是一個設定陣列，加 Grok 只需改一行、不動邏輯。

## 預估大小

**中**（偏大）。多數是設定（wrangler、D1 migration）與一支排程邏輯；行數估在中段。核心難度在「歷史 diff」與「Worker 同時服務 assets ＋ API」。

> 若 Implement Agent 動工後發現過大（例如歷史 diff ＋ 讀取端點合起來超過「中」），可把「`GET /api/pricing` 讀取端點」切出去另開一張小 Issue，先讓排程把資料寫進 D1，再補讀取端點——於留言板說明後退回 Planning。

## 相依關係

- **依賴 #1**（`docs/1-pricing-data-source.md` 的 schema 與 §4.5 資料表設計）與 **#3**（骨架，要在其上加 Worker 入口與 binding）。兩者皆已完成。
- **是 #4 的前置**：#4 的價格表要讀本張的 `GET /api/pricing`。本張完成、D1 有資料後 #4 才開工。

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
