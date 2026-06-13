# Issue #4：價格列表／表格（MVP 核心）

## 背景／為什麼

這是 dashboard 的核心價值：讓使用者一眼看到各家模型的價格。完成這張，產品就有了最小可用的樣子（MVP）。

## 範圍

**要做：**
- 從 #8 的讀取端點 **`GET /api/pricing`** 取得價格資料載入前端。回傳契約（由 #8 釘死）：`{ fetchedAt: string | null, models: ModelPricing[] }`，`models` 為 §4.2 的 camelCase 形狀，`fetchedAt` 為 response 層級單一時間戳。
- 以表格呈現各模型：至少含 `provider`、模型名稱（`displayName`）、input 價格、output 價格、context window。
- 支援**排序**（至少能依 input 價、output 價排序）。
- 支援**篩選**：依 provider 篩選（選項對齊 #1 鎖定範圍：`anthropic` / `openai` / `google`），並有一個關鍵字搜尋框（模型名稱）。
- 單位顯示清楚（例如「USD / 1M tokens」）。**資料更新時間採端點回傳的 `fetchedAt`**（response 層級、我們抓取的時間）顯示。
- `cachedInputPricePerMTok` 或任何價格為 `null` 時，表格以「—」之類的占位顯示，**不要顯示成 0 或空白**（0 會被誤讀成免費）。
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
- [ ] 價格單位明確標示，頁面顯示資料更新時間（採端點回傳的 `fetchedAt`）。
- [ ] 價格為 `null` 的欄位以占位符（如「—」）顯示，不顯示成 0 或空白。
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
