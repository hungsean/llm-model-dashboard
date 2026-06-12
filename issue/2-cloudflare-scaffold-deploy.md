# Issue #2：Cloudflare Pages/Workers 專案骨架與部署

## 背景／為什麼

主人選定用 Cloudflare Workers/Pages。在做任何功能之前，先把可跑、可部署的最小骨架立起來，後面每張功能 Issue 才有地方長。這張只負責「腳手架 + 能部署上線」，不含任何價格功能。

## 範圍

**要做：**
- 用 pnpm 建立前端專案（建議 Vite + React 或 Next.js，於 Issue 實作時依 Cloudflare 部署友善度二選一並說明）。
- 設定 Cloudflare 部署（`wrangler.jsonc` / Pages 設定），能 `pnpm dev` 本地跑、能部署出一個可訪問的 URL。
- 放一個最小首頁（標題 + 一句話說明這是 LLM API 價格 dashboard），確認部署成功。
- 設定基本專案結構：lint / format / TypeScript（若採用）。
- 更新 `.gitignore`（node_modules、build 產物、`.wrangler` 等）。

**不做：**
- 不接任何資料來源、不做價格表、不做比較功能。
- 不做 CI/CD pipeline（之後要再開 Issue）。
- 不處理自訂網域。

## 驗收條件

- [ ] `pnpm install && pnpm dev` 能在本地正常啟動，瀏覽器看得到首頁。
- [ ] 能透過 wrangler / Pages 成功部署，產出一個可訪問的 URL。
- [ ] 首頁顯示專案標題與一句說明。
- [ ] `.gitignore` 已涵蓋 node_modules、build 產物、`.wrangler`。
- [ ] TypeScript / lint 設定可通過（`pnpm lint`、type check 不報錯）。

## 預估大小

**中**（多為設定檔與骨架，無業務邏輯）。

## 相依關係

- 可與 #1 **並行**，不互相阻塞。
- 是 #3、#4 的前置（功能要長在這個骨架上）。

## 留言板

### 2026-06-12 17:25 ｜ Planning Agent
- 輸出：建立 Issue #2「Cloudflare Pages/Workers 專案骨架與部署」。範圍只含可跑可部署的最小骨架＋一個首頁，明確不接資料、不做功能、不做 CI/CD。
- 相依：可與 #1 並行；為 #3、#4 的前置。
- 大小估「中」，可交給 Agent Issue Review。
