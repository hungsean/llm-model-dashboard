# Issue #3：Cloudflare Pages/Workers 專案骨架與部署

## 背景／為什麼

主人選定用 Cloudflare Workers/Pages。在做任何功能之前，先把可跑、可部署的最小骨架立起來，後面每張功能 Issue 才有地方長。這張只負責「腳手架 + 能部署上線」，不含任何價格功能。

## 技術選型（已定案）

- **部署目標：Cloudflare Workers**（靜態資產 static assets 模式），不走 Pages。
  - 理由：Cloudflare 現在新專案主推 Workers，Pages 已進入維護模式、新功能優先給 Workers；未來要加 API / KV / D1 也是 Workers 路線最順。
- **前端框架：Vite + React + TypeScript**，搭 `@cloudflare/vite-plugin` 做本地開發與部署。
- **套件管理：pnpm**。

> 此選型為 Planning 定案，Implement Agent 不需再二選一；若實作時發現此路線有硬阻塞，於留言板說明後退回 Planning。

## 範圍

**要做：**
- 用 pnpm 建立 Vite + React + TypeScript 專案，整合 `@cloudflare/vite-plugin`。
- 設定 Cloudflare Workers 部署（`wrangler.jsonc`，static assets 設定），`pnpm dev` 能本地跑起來。
- 放一個最小首頁（標題 + 一句話說明這是 LLM API 價格 dashboard）。
- 設定基本專案結構：lint / format / TypeScript（`pnpm lint`、type check 可通過）。
- 更新 `.gitignore`（node_modules、build 產物、`.wrangler` 等）。
- 在本 Issue 留言板記下實際部署指令（如 `pnpm run deploy` 或 `wrangler deploy`），以及部署所需的外部前置條件。

**不做：**
- 不接任何資料來源、不做價格表、不做比較功能。
- 不做 CI/CD pipeline（之後要再開 Issue）。
- 不處理自訂網域。

## 部署前置條件與 fallback

部署到線上需要這些**外部條件**（不是程式碼能解決的）：
- 已有 Cloudflare 帳號，且本機已 `wrangler login`（或設好 `CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_ACCOUNT_ID`）。
- 該帳號有建立 / 部署 Worker 專案的權限。

**情況 A — 環境具備上述條件**：完成部署，產出一個可訪問的 URL，URL 記到留言板。

**情況 B — 環境無法登入 / 無權限**：不卡住、不視為失敗。改為交付「部署就緒」狀態：
- 部署設定（`wrangler.jsonc` 等）完成且正確。
- 本地 `pnpm dev`、build、type check、`pnpm lint` 全部通過。
- 在留言板寫明：實際部署指令、目前缺少的外部條件（例如未登入 / 無 token），供主人之後手動補上即可上線。

## 驗收條件

- [ ] `pnpm install && pnpm dev` 能在本地正常啟動，瀏覽器看得到首頁。
- [ ] 首頁顯示專案標題與一句說明（LLM API 價格 dashboard）。
- [ ] `.gitignore` 已涵蓋 node_modules、build 產物、`.wrangler`。
- [ ] TypeScript / lint 設定可通過（`pnpm lint`、type check 不報錯）。
- [ ] production build 成功（`pnpm build` / `vite build` 不報錯）。
- [ ] 部署達成下列**其中一項**：
  - [ ] **A**：成功部署到 Cloudflare Workers，產出可訪問的 URL，URL 已記到留言板；或
  - [ ] **B**：環境無法登入 / 無權限時，部署設定完成、上述本地檢查全通過，且留言板已寫明實際部署指令與缺少的外部條件。

## 預估大小

**中**（多為設定檔與骨架，無業務邏輯）。

## 相依關係

- 可與 #1 **並行**，不互相阻塞。
- 是 #4、#5 的前置（功能要長在這個骨架上）。

## 留言板

### 2026-06-12 17:25 ｜ Planning Agent
- 輸出：建立 Issue #3「Cloudflare Pages/Workers 專案骨架與部署」。範圍只含可跑可部署的最小骨架＋一個首頁，明確不接資料、不做功能、不做 CI/CD。
- 相依：可與 #1 並行；為 #4、#5 的前置。
- 大小估「中」，可交給 Agent Issue Review。

### 2026-06-13 15:01 ｜ Agent Issue Review
- 輸出：Review Suggestion：需要修改。
- 問題：Issue 目標與範圍大致清楚，大小也適中；但「能透過 wrangler / Pages 成功部署，產出一個可訪問的 URL」把外部 Cloudflare 帳號、wrangler 登入狀態、專案名稱／建立權限視為已具備，Issue 沒有說明前置條件或缺少權限時如何驗收。
- 影響：Implement Agent 可能已完成骨架與部署設定，卻因沒有 Cloudflare 憑證或專案權限無法產出 URL，導致卡在不可由程式碼修改解決的狀態；也可能為了通過驗收臨時選錯 Pages/Workers 路線或留下未說明的手動步驟。
- 建議：補上部署前置條件與 fallback 驗收方式，例如明確要求 Cloudflare 帳號已登入且可建立專案；若環境無法登入，則需完成部署設定、確認本地 build/type/lint 通過，並在 Issue/留言板留下實際應執行的部署指令與缺少的外部條件。也建議在範圍中先明確選定 Pages 或 Workers，或把「二選一」的判斷標準寫成可驗收條件。
- 下一步：回到 Planning Agent。

### 2026-06-13 16:30 ｜ Planning Agent
- 輸出：依 Review 建議改寫 Issue #3。
  1. 技術選型定案（不再二選一）：**Cloudflare Workers（static assets）＋ Vite + React + TypeScript ＋ pnpm，搭 `@cloudflare/vite-plugin`**；附選擇理由（Pages 已維護模式、Workers 為未來加 API/KV/D1 的順路）。經主人確認採用。
  2. 新增「部署前置條件與 fallback」段：明列外部條件（Cloudflare 帳號、`wrangler login` 或 API token、建立/部署權限），並定義情況 A（能部署→產 URL 記留言板）與情況 B（無法登入/無權限→交付「部署就緒」：設定完成＋本地 dev/build/type/lint 全過＋留言板寫明部署指令與缺少條件）。
  3. 驗收條件改成可打勾：移除「一定要產出 URL」的硬性條件，改為「部署達成 A 或 B 其中一項」，並補上 `pnpm build` 成功一條。
- 範圍與大小不變，仍為「中」（純設定檔與骨架）。
- 下一步：交回 Agent Issue Review。

### 2026-06-13 15:06 ｜ Agent Issue Review
- 輸出：Review Suggestion：無需修改。
- 理由：Issue 目標清楚，已定案使用 Cloudflare Workers static assets + Vite + React + TypeScript + pnpm，Implement Agent 不需再做 Pages/Workers 二選一；範圍只含專案骨架、最小首頁、部署設定與基本品質檢查，不含資料來源、價格表、比較功能、CI/CD 或自訂網域，大小屬中且可一次實作；驗收條件可打勾，並已補上 Cloudflare 帳號/權限等外部前置條件，以及無法登入時的部署就緒 fallback，避免實作卡在非程式碼問題。
- 下一步：交給 Implement Agent。
