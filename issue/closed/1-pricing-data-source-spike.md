# Issue #1：LLM 價格資料來源調研與決策（研究型 Spike）

## 背景／為什麼

整個 dashboard 的根基是「價格資料從哪來」。主人目前沒有定案，而資料來源會直接決定後面的資料層怎麼設計、要不要存歷史、更新頻率怎麼定。這個決策連人都還不確定該選哪個，硬塞進實作型 Issue 只會讓 Implement Agent 邊做邊猜，所以先用一張**研究型 Issue** 把來源敲定、把資料格式（schema）定下來，後面的實作才不會做白工。

這張的交付物是「一份研究報告（決策結論 ＋ 資料 schema）」，**不是功能程式碼**。

## 要回答的決策

核心決策只有一個：**這個專案的「價格資料策略」該怎麼定**。它由三個彼此耦合的子問題組成（來源決定更新頻率與欄位，更新頻率決定存放方式，schema 取決於來源欄位），因此放在同一張研究型 Issue 一起回答：

1. **選哪個主來源？**（必要時加一個備援）
2. **統一的資料 schema 長怎樣？**（欄位、型別、單位）
3. **資料在 Cloudflare 上怎麼放？**（打包成靜態 JSON / KV / D1）

## 範圍

**要查：**
- 評估以下候選來源，至少比較：資料涵蓋範圍、更新頻率、授權條款、取得方式（API / 靜態 JSON / 需自建）、是否含 input/output/cached 價格與 context window：
  - models.dev（`api.models.dev`，2600+ 模型 JSON）
  - LiteLLM `model_prices_and_context_window.json`（BerriAI/litellm）
  - simonw/llm-prices（per-vendor JSON，含歷史）
  - OpenRouter `/api/v1/models`
  - pydantic/genai-prices
- 各來源的授權／使用條款，確認能否合法使用。
- 統一資料 schema 的設計：欄位、型別、單位，例如：`provider`、`modelId`、`displayName`、`inputPricePerMTok`、`outputPricePerMTok`、`cachedInputPricePerMTok`、`contextWindow`、`updatedAt`。單位要寫死（建議統一成「每百萬 token 美元」）。
- Cloudflare 上的存放方式（靜態 JSON / KV / D1）各自的取捨。

**不查（不做）：**
- 不寫抓取程式、不接 API、不建 KV/D1（為驗證 schema 做的小實驗例外，但要在報告裡標明）。
- 不做任何前端畫面。
- 不實際匯入完整資料集（最多放一小段範例驗證 schema）。

## 驗收條件（研究有沒有回答到）

- [ ] **來源比較**：五個候選來源都查過涵蓋範圍、更新頻率、授權、取得方式、是否含 input/output/cached 價格與 context window，整理成一張比較表。
- [ ] **主來源決策**：選出一個主來源（必要時一個備援），寫出選它的理由與取捨，並附上對所選方案**不利的證據**。
- [ ] **授權確認**：對所選來源的授權／使用條款查證過，明確註明可否合法使用，並附佐證連結。
- [ ] **schema 決策**：定義統一資料 schema，每個欄位都有型別與單位說明（單位寫死）。
- [ ] **存放決策**：對「靜態 JSON / KV / D1」下了明確決策並說明理由。
- [ ] **範例資料**：附一段符合 schema 的範例資料（3~5 個模型），可被 `JSON.parse` 正常解析。
- [ ] **結論可行動**：報告給出明確、可以據以開實作型 Issue 的方向；若某點還無法定論，說明缺什麼、下一步怎麼補。
- [ ] 研究結果寫進 `docs/1-pricing-data-source.md`（檔名帶 Issue 編號）。

## 預估大小

**研究型 Issue 不看程式行數，看回答幾個核心決策。** 本張只回答**一個核心決策**（價格資料策略），其下三個子問題彼此高度耦合、屬同一目標，因此維持一張、不再拆分。大小合適。

## 留言板

### 2026-06-12 17:25 ｜ Planning Agent
- 輸出：建立 Issue #1「價格資料來源調研與決策」。這是整個想法的第一棒、其餘 Issue 的前置依賴。範圍只含調研＋下決策＋定 schema，明確不寫抓取程式、不接 API、不做畫面。產物是 `docs/data-source-decision.md`。
- 相依：#4、#5 依賴本張的 schema 結論；#3 可與本張並行。（編號註：原為 #2/#3/#4，因 GitHub issue/PR 共用編號、#2 被 PR 佔用，整體 +1 對齊 GitHub）
- 大小估「中」，可交給 Agent Issue Review。

### 2026-06-13 ｜ Research Agent（依主人回覆補做）
- 緣由：主人看過研究報告後給兩點回覆，回到 Research Agent 補做。
- 輸出（更新 `docs/1-pricing-data-source.md`）：
  1. **存放決策改寫**（§4.3、§4.5）：新需求「不重部署更新 ＋ 自動更新 ＋ 順便存歷史」同時踩中原 §4.3 兩個觸發條件 → 從靜態 JSON 改為 **D1 ＋ 排程 Worker（Cron Trigger）**。給了 `current`/`history` 兩張 D1 表設計與更新邏輯。**誠實提醒**：可商用來源都只有現價、沒有歷史價（有歷史的 simonw 無授權不能用），歷史只能由排程 Worker 從現在往後累積，開抓前的補不回來。
  2. **供應商範圍縮小**（§4.4）：只抓 Anthropic / OpenAI / Google 三家，Grok（xAI）做成設定接口、預設不抓。已用 `curl models.dev/api.json` 實抓驗證四家 provider key 都在（anthropic 25、openai 50、google 22、xai 8 個模型）。
- 主來源仍是 models.dev（單一 `api.json` 最適合排程 Worker 拉取）；schema 主體不變。
- 下一步：交給**人**看過補充是否足夠 → 足夠就收尾、開實作型 Issue（建 D1 ＋ 排程 Worker）；不足留在 Research Agent 續補。

### 2026-06-12 ｜ Planning Agent（重新規劃）
- 緣由：工作流新增 Research Agent（`05-research-agent.md`），正式區分實作型／研究型 Issue。本張屬研究型，依新規範重新規劃。
- 更正前一筆：研究型 Issue **不走 Agent Issue Review**，改為「Planning Agent 寫好 → 人為確認 → 交給 Research Agent」。
- 調整內容：(1) 新增「要回答的決策」段落，點明核心決策為「價格資料策略」，含來源／schema／存放三個耦合子問題；(2) 驗收條件改寫成「研究有沒有回答到」的可勾選問題，不再寫成程式行為；(3) 預估大小改用研究型標準（看回答幾個決策，本張一個核心決策，維持一張）；(4) 交付物檔名統一為 `docs/1-pricing-data-source.md`（帶 Issue 編號）。
- 下一步：交給**人為確認**研究型 Issue 沒問題；確認後交給 Research Agent。
