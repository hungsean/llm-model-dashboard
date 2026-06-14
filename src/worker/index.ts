import { handleApiRequest } from "./api";
import { ingestPricing } from "./ingest";

// Worker 入口：
// - fetch：先攔 /api/ 前綴走 API（GET /api/pricing 唯讀現價，其餘 /api/* 回 JSON 404）；
//   非 /api/ 才 fall through 到靜態資產（首頁、SPA fallback 照常服務）。
// - scheduled：Cron Trigger 觸發時跑一次價格抓取（見 wrangler.jsonc triggers.crons）。
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    // wrangler.jsonc 設 not_found_handling: "single-page-application"，未匹配路由會回 index.html＋200，
    // 所以 /api/* 必須在這裡主動攔下，不能讓它 fall through 成一坨 HTML。
    if (url.pathname.startsWith("/api/")) {
      return handleApiRequest(request, url, env);
    }
    return env.ASSETS.fetch(request);
  },

  async scheduled(
    _controller: ScheduledController,
    env: Env,
    ctx: ExecutionContext,
  ): Promise<void> {
    ctx.waitUntil(ingestPricing(env));
  },
} satisfies ExportedHandler<Env>;
