# 研究報告 #1：LLM 價格資料來源與存放策略

> 對應 Issue：[#1 pricing-data-source-spike](../issue/1-pricing-data-source-spike.md)
> 角色：Research Agent ｜ 日期：2026-06-12
> 交付物：本報告即為交付物（研究型 Issue，不接著寫程式）

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
- **simonw/llm-prices**：**無授權檔，法律上不能安心直接採用**，故排除為資料來源；但其「逐 vendor + from_date/to_date 歷史價」結構，是日後若要做歷史價時值得借鏡的設計（缺 context window）。

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

### 4.3 存放方式：**建置期打包成靜態 JSON**（隨 Pages/Worker 部署）

決策：先用**靜態 JSON**，不用 KV、不用 D1。

理由：
- 資料量小（數千筆）、**讀多寫少**、本 Issue 範圍**不存歷史**；靜態 JSON 隨邊緣快取，查詢成本為零、無 runtime binding 複雜度。
- KV/D1 的價值在「不重新部署就能更新」或「查詢/歷史」，目前都用不到。
- **不利取捨**：靜態 JSON 要更新就得重新部署、無法即時。可接受，因為價格變動頻率低（天/週級）。

**何時改變決策**：
- 要「不重新部署就更新價格」→ 改放 **KV**。
- 要「存歷史價、做時間序列查詢」→ 改用 **D1**（可借鏡 simonw 的 from_date/to_date 結構）。

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

- 正式匯入完整資料集、寫抓取/轉換程式 → 另開實作型 Issue（依賴本 schema）。
- 若決定做歷史價或免重部署更新 → 重新評估 KV/D1（見 4.3）。
