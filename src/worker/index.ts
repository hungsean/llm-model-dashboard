import { ingestPricing } from "./ingest";

// Worker 入口：
// - fetch：本張（#7）還沒有 /api 路由，一律交給靜態資產（首頁照常服務）；
//   對外的 GET /api/pricing 由 #8 在這裡加。
// - scheduled：Cron Trigger 觸發時跑一次價格抓取（見 wrangler.jsonc triggers.crons）。
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
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
