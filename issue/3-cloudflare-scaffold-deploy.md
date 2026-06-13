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

### 2026-06-13 ｜ Implement Agent

- 輸出：Implement，完成 Cloudflare Workers 骨架並成功部署（達成情況 A）。

**改了什麼（主要改動點）**

1. 專案初始化：新增 `package.json`（pnpm，scripts：`dev` / `build` / `preview` / `deploy` / `lint` / `format` / `typecheck` / `cf-typegen`），安裝 Vite 8 + React 19 + TypeScript 6 + `@cloudflare/vite-plugin` + `wrangler`。
2. 建置設定：`vite.config.ts`（`react()` + `cloudflare()` plugin）；`tsconfig.json` + `tsconfig.app.json` + `tsconfig.node.json`（project references，strict 模式）。
3. Cloudflare 部署設定：`wrangler.jsonc`，static assets 模式、`not_found_handling: single-page-application`（SPA 路由）。
4. 最小首頁：`index.html` + `src/main.tsx` + `src/App.tsx` + `src/index.css` + `src/App.css`，顯示標題「LLM API 價格 Dashboard」與一句說明。
5. 品質工具：`eslint.config.js`（flat config，js + typescript-eslint + react-hooks + react-refresh）、`.prettierrc.json`。
6. `.gitignore`：補上 `node_modules`、`dist`、`.wrangler`、`.dev.vars`、log 等。

**怎麼對應驗收條件**

- `pnpm install && pnpm dev` 本地啟動、看得到首頁：✅（dev server `http://localhost:5173/`，curl 取到 `<title>LLM API 價格 Dashboard</title>`）。
- 首頁顯示標題與一句說明：✅（`src/App.tsx`）。
- `.gitignore` 涵蓋 node_modules / build 產物 / `.wrangler`：✅。
- TypeScript / lint 通過：✅（`pnpm typecheck`、`pnpm lint` 皆 exit 0）。
- `pnpm build` 成功：✅（`tsc -b && vite build` 產出 `dist/`）。
- 部署 A 或 B：✅ **達成 A**——成功部署到 Cloudflare Workers，可訪問 URL（HTTP 200）：
  **https://llm-model-dashboard.hungsean0419.workers.dev**

**部署指令與前置條件（供日後參考）**

- 部署指令：`pnpm run deploy`（= `pnpm build && wrangler deploy`），或先 `pnpm build` 再 `npx wrangler deploy`。
- 外部前置條件：Cloudflare 帳號已 `wrangler login`（本機目前已登入 `hungsean0419@gmail.com`，Account ID `ef5ef57b22bccb04a8cfea348ad84232`），且帳號具 Workers 部署權限。CI 環境改用 `CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_ACCOUNT_ID`。

**風險／取捨**

- ESLint：初次安裝解析到 v10，與 `eslint-plugin-react-hooks` 7.x 的 flat config 不相容（plugins 仍是陣列格式），已將 ESLint 釘在 `^9`（Vite React 模板的標準版本）解決；另 react-hooks 的 flat config 要用 `configs.flat["recommended-latest"]` 而非 `configs["recommended-latest"]`。
- Worker 名稱用預設 `llm-model-dashboard`，部署在 `*.workers.dev` 子網域；自訂網域不在本 Issue 範圍。

**怎麼驗證**：`pnpm typecheck`、`pnpm lint`、`pnpm build` 全 exit 0；本地 `pnpm dev` 與線上 URL 皆 curl 到正確標題、HTTP 200。

- 下一步：交給 Agent Code Review。

### 2026-06-13 15:23 ｜ Agent Code Review

- 輸出：Review Report。

結論：無需修改

看過的改動點：
- 專案初始化與 scripts：符合 Issue 要求，`dev` / `build` / `deploy` / `lint` / `typecheck` 都有定義，使用 pnpm、Vite + React + TypeScript、`@cloudflare/vite-plugin` 與 Wrangler。
- Cloudflare Workers 設定：`wrangler.jsonc` 使用 Workers static assets，`not_found_handling: single-page-application` 合理；`pnpm exec wrangler deploy --dry-run` 會被 Vite plugin 轉向 `dist/wrangler.json`，可讀到 build 後 assets。
- 最小首頁：`src/App.tsx` 顯示「LLM API 價格 Dashboard」與一句價格 dashboard 說明，沒有混入資料來源、價格表或比較功能。
- `.gitignore` 與品質工具：已涵蓋 `node_modules`、`dist`、`.wrangler`、`.dev.vars` 等；ESLint/TypeScript 設定可用。

驗證：
- `pnpm typecheck`：通過。
- `pnpm lint`：通過。
- `pnpm build`：通過。
- `pnpm exec wrangler deploy --dry-run`：部署設定通過；沙盒內 Wrangler 寫使用者層級 log 檔被 EPERM 擋住，但 dry-run 本身完成並 exit 0。
- `pnpm dev --host 127.0.0.1`：沙盒內因 inspector port `9229` listen 權限失敗；升權重跑可啟動，`http://127.0.0.1:5173/` 可取到正確 title。
- 線上 URL `https://llm-model-dashboard.hungsean0419.workers.dev`：HTTP 200，HTML title 符合。

風險：
- 沒有需要擋下的風險。唯一注意點是本機沙盒環境會限制 Wrangler log 寫入與 dev server port listen，已確認這不是專案設定問題。

下一步：Review Report 通過，交給人確認；確認後可進入 PR 推送，並提醒人手動把這張 Issue 移到 `/closed` 收尾。
