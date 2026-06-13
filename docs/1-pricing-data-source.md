# 研究報告 #1：LLM 價格資料來源與存放策略

> 對應 Issue：[#1 pricing-data-source-spike](../issue/closed/1-pricing-data-source-spike.md)
> 角色：Research Agent ｜ 日期：2026-06-12
> 交付物：本報告即為交付物（研究型 Issue，不接著寫程式）

> **更新紀錄（2026-06-13，依主人回覆補做）**：
> 1. 新需求「不重新部署就能更新 ＋ 自動更新 ＋ 順便存歷史」→ 存放方式從靜態 JSON 改為 **D1 ＋ 排程 Worker（Cron Trigger）**，見 §4.3、§4.5。
> 2. 範圍縮小到只抓 **Anthropic / OpenAI / Google** 三家（Grok＝xAI 選用），見 §4.4。

---

## 1. 研究問題

定下這個專案的「價格資料策略」，由三個彼此耦合的子問題組成：

1. **選哪個主來源**（必要時加備援）？
2. **統一資料 schema 長怎樣**（欄位、型別、單位）？
3. **資料在 Cloudflare 上怎麼放**（靜態 JSON / KV / D1）？

---

## 2. 調查過程

對五個候選來源逐一查證：涵蓋範圍、更新方式與頻率、授權、取得方式，以及是否含 input / output / cached 價格與 context window。授權以 GitHub 的 SPDX 偵測（`gh api repos/<r> --jq .license.spdx_id`）為準，價格欄位以實際抓取 API/JSON 結構驗證。

---

## 3. 發現

### 3.1 候選來源比較表

| 來源 | 涵蓋範圍 | 更新方式／頻率 | 授權 | 取得方式 | input/output | cached | context window | 價格單位 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **models.dev** | 廣（多 provider，宣稱 2600+ 模型） | 社群 PR；含 `last_updated` 欄位 | **MIT** ✓ | 靜態 JSON：`https://models.dev/api.json`（另有 `models.json`、`catalog.json`） | ✓ | ✓（`cache_read`） | ✓（`limit.context`） | **每百萬 token 美元** |
| **pydantic/genai-prices** | 中（33 providers、1100+ 模型） | 活躍；v0.0.66（2026-06-09） | **MIT** ✓ | 靜態 JSON（`data.json`/`data_slim.json`，附 JSON schema）＋ JS/TS 與 Python 套件；API「coming soon」 | ✓ | ✓ | ✓ | 每百萬 token 美元 |
| **BerriAI/litellm** JSON | 廣（含大量 provider） | 隨 litellm 發版更新 | 根目錄 **MIT**（`enterprise/` 另計；SPDX 顯示 NOASSERTION） | 靜態 JSON：`model_prices_and_context_window.json` | ✓ | ✓（`cache_read_input_token_cost`、`cache_creation_input_token_cost`） | ✓（`max_input_tokens`/`max_output_tokens`） | **每 token 美元**（需 ×1e6 換算） |
| **OpenRouter** `/api/v1/models` | 廣（OpenRouter 平台上架模型） | 即時 API | API 服務，受 ToS 約束（資料非開源授權） | REST：`GET https://openrouter.ai/api/v1/models`（公開、免 auth） | ✓（`prompt`/`completion`） | ✓（`input_cache_read`/`input_cache_write`） | ✓（`context_length`） | **每 token 美元**（字串） |
| **simonw/llm-prices** | 窄～中（Amazon/Anthropic/OpenAI 等，逐 vendor JSON，**含歷史價**） | 手動編輯 + `build.py` 產生 | **無授權檔**（SPDX：偵測不到 → 預設保留所有權利） | 靜態 JSON：`current-v1.json`、`historical-v1.json` | ✓ | ✓（部分） | ✗（未提供 context window） | 每百萬 token 美元 |

### 3.2 各來源關鍵取捨（含對推薦方案不利的證據）

- **models.dev（推薦主來源）**
  - 優點：MIT 可商用；涵蓋最廣；**價格單位本來就是「每百萬 token 美元」**，與本專案目標單位一致，免換算；純靜態 JSON、單一 endpoint，最適合在 Cloudflare 邊緣打包/快取；欄位完整（input/output/cache_read/context）。
  - **不利證據**：更新靠社群 PR，**無官方 SLA**，冷門或剛發布的模型價格可能延遲或缺漏；需自行信任社群維護品質。
- **pydantic/genai-prices（推薦備援）**
  - 優點：MIT；**有官方 JS/TS 套件**，未來若要在 Worker 內動態算成本很方便；附 JSON schema 可驗證；維護活躍。
  - **不利證據**：模型數（1100+）少於 models.dev；維護者明言「價格不會 100% 準確，建議對帳單核對」；官方 API 仍 coming soon。
- **BerriAI/litellm**：欄位豐富但偏 litellm 內部用途（無 displayName 概念、context 拆成 max_input/output_tokens），單位是每 token 需換算；可作第三方交叉驗證來源。
- **OpenRouter**：即時、免 auth 好取得，但價格是 **OpenRouter 平台轉售價**，未必等於各家原廠定價；資料受 ToS 約束，不適合當「重新散布」的主來源，較適合即時交叉比對。
- **simonw/llm-prices**：**無授權檔，法律上不能安心直接採用**，故排除為資料來源；但其「逐 vendor + from_date/to_date 歷史價」結構，正是本專案要做歷史價時借鏡的設計（見 §4.5），缺 context window 不影響借鏡。⚠️ 注意：能借鏡的是**結構**，不是它的**歷史資料**——歷史價要靠我們自己從現在累積（見 §4.3）。

---

## 4. 結論／建議

### 4.1 主來源：`models.dev`（MIT），備援：`pydantic/genai-prices`（MIT）

理由：兩者皆 MIT 可合法商用；models.dev 涵蓋最廣、單位天生對齊、純靜態 JSON 最契合 Cloudflare；genai-prices 有 TS 套件與 JSON schema，作備援與交叉驗證最省力。OpenRouter 留作「即時交叉比對」的選用工具，不納入散布。simonw/llm-prices 因無授權**排除**。

### 4.2 統一資料 schema

單位一律寫死為 **USD per 1,000,000 tokens（每百萬 token 美元）**；金額型別用 `number`，找不到的價格用 `null`（不要用 0，0 會被誤算成免費）。

```ts
interface ModelPricing {
  provider: string;                      // 供應商，例：'anthropic'
  modelId: string;                       // 來源穩定 ID，例：'claude-opus-4-8'
  displayName: string;                   // 顯示名稱，例：'Claude Opus 4.8'
  inputPricePerMTok: number;             // 輸入價，USD / 1M tokens
  outputPricePerMTok: number;            // 輸出價，USD / 1M tokens
  cachedInputPricePerMTok: number | null;// 快取讀取輸入價，USD / 1M tokens；無則 null
  contextWindow: number;                 // context 長度（tokens）
  updatedAt: string;                     // 來源更新日，ISO 8601，例：'2026-06-09'
}
```

| 欄位 | 型別 | 單位／格式 | 說明 |
| --- | --- | --- | --- |
| `provider` | string | — | 供應商代號，小寫 kebab/單字 |
| `modelId` | string | — | 來源的穩定模型 ID，作為主鍵 |
| `displayName` | string | — | 給人看的名稱 |
| `inputPricePerMTok` | number | USD / 1M tok | 輸入 token 單價 |
| `outputPricePerMTok` | number | USD / 1M tok | 輸出 token 單價 |
| `cachedInputPricePerMTok` | number \| null | USD / 1M tok | 快取讀取單價，無則 `null` |
| `contextWindow` | number | tokens | 最大 context 長度 |
| `updatedAt` | string | ISO 8601 日期 | 來源標示的更新日 |

**來源欄位對應（匯入時換算規則）**：

| 本 schema 欄位 | models.dev（主） | genai-prices（備援） |
| --- | --- | --- |
| `inputPricePerMTok` | `cost.input`（已是 /MTok，直接用） | input 價（已是 /MTok） |
| `outputPricePerMTok` | `cost.output` | output 價 |
| `cachedInputPricePerMTok` | `cost.cache_read` | cached 價 |
| `contextWindow` | `limit.context` | context window |
| `updatedAt` | `last_updated` | release/更新日 |

> 若日後改用 per-token 來源（LiteLLM / OpenRouter），匯入時一律 `value × 1_000_000` 換算成 /MTok 再存。

### 4.3 存放方式：**D1 ＋ 排程 Worker（Cron Trigger）自動更新，並保留歷史**

> **決策已更新（2026-06-13）**：主人確認要「不重新部署就能更新 ＋ 自動更新 ＋ 順便存歷史」。這三點正好同時踩中原本此節列的兩個「何時改變決策」觸發條件，因此**從靜態 JSON 改為 D1 ＋ 排程 Worker**。原本的靜態 JSON 在此情境不適用（要更新就得重部署、也存不了時間序列）。

決策：用 **D1** 當主要資料層，由一支 **Cron Trigger 排程 Worker** 定期（建議每日一次）抓 `models.dev/api.json`、過濾出鎖定的幾家（見 §4.4）、轉成本 schema 寫進 D1；前端 Worker 直接讀 D1。如需更快的邊緣讀取，可再用 **KV／Cache API** 快取「現價」這份小資料。

為什麼是 D1 而不是 KV（逐條對需求）：
- **不重新部署就更新**：D1、KV 都做得到（資料在 runtime store，不綁進 bundle），這點兩者平手。
- **自動更新**：靠 **Cron Trigger** 排程 Worker 觸發，跟選哪個 store 無關，兩者都行。
- **歷史／時間序列**：這點決定勝負。歷史價要能回答「某模型一段時間的價格變化」，需要 SQL 的範圍查詢與排序；KV 只能 key-value，存歷史得把快照硬塞成 blob、很難查。**D1（SQLite）原生支援，最契合**，也正好對上 simonw 的 `from_date`/`to_date` 結構（見 §4.5）。
- **折衷**：KV 仍可當「現價」唯讀快取（前端高頻讀很省），但歷史與主資料一律放 D1。

**重要的誠實提醒（歷史資料從哪來）**：
- models.dev（及其他可商用來源）只給**現價 ＋ `last_updated`**，**沒有歷史價**。唯一有現成歷史價的是 simonw/llm-prices，但它**無授權、不能用**（見 §3.2）。
- 所以歷史是**我們自己從現在開始累積**：排程 Worker 每次抓到價格，跟 D1 內該模型最新一筆比對，**有變動才**關掉舊區間（補上 `to_date`）並插入新區間（`from_date` = 當日）。
- 結論：**開始抓之前的歷史補不回來**，只能往後累積。可接受——價格變動頻率低（天/週級），累積幾週後就有可用的時間序列。

**成本與限制（要記得）**：
- Cron Trigger 與 D1 都在 Cloudflare 免費額度內可跑這種小資料量（單來源、單一 JSON、數十～數百筆模型）。
- 排程 Worker 要對 `models.dev/api.json` 取得失敗有容錯：抓不到就**保留 D1 既有資料、不要覆蓋成空**，並記一筆 log。

### 4.4 鎖定的供應商範圍

主人定案：目前**只抓三家**，Grok 選用。匯入時用 models.dev 的 provider key 過濾：

| 供應商 | 口語名 | models.dev provider key | 是否納入 | 現有模型數（2026-06-13 抓取） |
| --- | --- | --- | --- | --- |
| Anthropic | Claude | `anthropic` | ✅ 納入 | 25 |
| OpenAI | ChatGPT | `openai` | ✅ 納入 | 50 |
| Google | Gemini | `google` | ✅ 納入 | 22 |
| xAI | Grok | `xai` | 🔶 選用（先留接口，預設先不抓） | 8 |

- 上表 provider key 與模型數，皆以 `curl https://models.dev/api.json` 實抓驗證過（145 個 provider 中這四個都在）。
- 實作上把「要抓哪些 provider」做成一個**設定陣列**（例如 `['anthropic','openai','google']`），要不要加 Grok 改一行設定即可，不必動邏輯。
- Google 另有 `google-vertex`（Vertex AI 託管）這個 key；本專案要的是原廠 Gemini 定價，**用 `google` 即可**，先不碰 `google-vertex`。

### 4.5 D1 資料表設計（現價 ＋ 歷史）

兩張表：`current` 給前端讀現價（每個模型一列）、`history` 累積每次價格變動（借鏡 simonw 的 `from_date`/`to_date`）。

```sql
-- 現價：每個模型最新狀態，前端主要讀這張
CREATE TABLE model_pricing_current (
  provider                    TEXT    NOT NULL,
  model_id                    TEXT    NOT NULL,
  display_name                TEXT    NOT NULL,
  input_price_per_mtok        REAL,            -- 找不到價格用 NULL，不要用 0
  output_price_per_mtok       REAL,
  cached_input_price_per_mtok REAL,
  context_window              INTEGER,
  source_updated_at           TEXT,            -- models.dev 的 last_updated（ISO 8601）
  fetched_at                  TEXT    NOT NULL, -- 我們這次抓取的時間（ISO 8601）
  PRIMARY KEY (provider, model_id)
);

-- 歷史：價格每變一次累積一列；本專案開始抓之後才有資料
CREATE TABLE model_pricing_history (
  provider                    TEXT    NOT NULL,
  model_id                    TEXT    NOT NULL,
  input_price_per_mtok        REAL,
  output_price_per_mtok       REAL,
  cached_input_price_per_mtok REAL,
  from_date                   TEXT    NOT NULL, -- 此價格生效起日（ISO 8601）
  to_date                     TEXT,             -- 失效日；仍生效中則 NULL
  PRIMARY KEY (provider, model_id, from_date)
);
```

排程 Worker 每次跑的邏輯（精簡版）：

1. 抓 `models.dev/api.json`，過濾 §4.4 的 provider，轉成本 schema。
2. 對每個模型：`UPSERT` 進 `model_pricing_current`（更新現價與 `fetched_at`）。
3. 跟 `history` 內該模型「`to_date` 為 NULL」那一列的價格比對：**有變動**才把舊列補上 `to_date = 今天`，再插入一列新的（`from_date = 今天`）；沒變動就不動 history。
4. 抓取失敗則整批跳過、保留舊資料、記 log（見 §4.3 容錯）。

> §4.2 的 `ModelPricing` interface 對應的是 `model_pricing_current` 一列的「現價」形狀；歷史多了 `from_date`/`to_date` 兩欄，如上表。

---

## 5. 範例資料（符合 schema，可 `JSON.parse`）

> `claude-opus-4-8` 一筆取自 OpenRouter live endpoint 換算驗證（prompt 0.000005 → 5 USD/MTok 等）；其餘為依公開定價填入的**示意值**，正式匯入時一律以 models.dev `api.json` 為準。

```json
[
  {
    "provider": "anthropic",
    "modelId": "claude-opus-4-8",
    "displayName": "Claude Opus 4.8",
    "inputPricePerMTok": 5.0,
    "outputPricePerMTok": 25.0,
    "cachedInputPricePerMTok": 0.5,
    "contextWindow": 1000000,
    "updatedAt": "2026-06-12"
  },
  {
    "provider": "anthropic",
    "modelId": "claude-haiku-4-5",
    "displayName": "Claude Haiku 4.5",
    "inputPricePerMTok": 1.0,
    "outputPricePerMTok": 5.0,
    "cachedInputPricePerMTok": 0.1,
    "contextWindow": 200000,
    "updatedAt": "2026-06-12"
  },
  {
    "provider": "openai",
    "modelId": "gpt-4o",
    "displayName": "GPT-4o",
    "inputPricePerMTok": 2.5,
    "outputPricePerMTok": 10.0,
    "cachedInputPricePerMTok": 1.25,
    "contextWindow": 128000,
    "updatedAt": "2026-06-12"
  },
  {
    "provider": "google",
    "modelId": "gemini-2.5-pro",
    "displayName": "Gemini 2.5 Pro",
    "inputPricePerMTok": 1.25,
    "outputPricePerMTok": 10.0,
    "cachedInputPricePerMTok": null,
    "contextWindow": 1048576,
    "updatedAt": "2026-06-12"
  }
]
```

---

## 6. 佐證

- models.dev API：`https://models.dev/api.json`、`https://models.dev/models.json`、`https://models.dev/catalog.json`；GitHub：`https://github.com/sst/models.dev`（SPDX：MIT）
- pydantic/genai-prices：`https://github.com/pydantic/genai-prices`（SPDX：MIT；最新 v0.0.66，2026-06-09）
- BerriAI/litellm 價格表：`https://raw.githubusercontent.com/BerriAI/litellm/main/model_prices_and_context_window.json`（根目錄 MIT）
- OpenRouter：`https://openrouter.ai/api/v1/models`（live，pricing 為每 token USD 字串、含 `input_cache_read`/`input_cache_write`、`context_length`）
- simonw/llm-prices：`https://github.com/simonw/llm-prices`（SPDX 偵測不到授權檔 → 排除）
- 授權查證指令：`gh api repos/<owner>/<repo> --jq '.license.spdx_id'`

---

## 7. 待補／後續（不在本 Issue 範圍）

- **建 D1 ＋ 排程 Worker（Cron Trigger）**：寫抓取/過濾/轉換 ＋ 寫入 `current`/`history` 的邏輯（見 §4.3、§4.5）→ 另開實作型 Issue（依賴本 schema 與資料表設計）。
- **前端讀取層**：前端 Worker 讀 D1（必要時加 KV/Cache 快取現價）→ 視情況併入或另開實作型 Issue。
- **歷史只能往後累積**：開始抓之前的歷史補不回來（見 §4.3）；若日後真的要回填，得另尋有授權的歷史來源。
- **Grok（xAI）**：先留設定接口、預設不抓；要納入時改一行 provider 設定即可（見 §4.4）。
