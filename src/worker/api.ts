import type { ModelPricing, PricingResponse } from "./types";

// model_pricing_current 的一列（snake_case，對應 migrations/0001_init.sql）。
interface CurrentRow {
  provider: string;
  model_id: string;
  display_name: string;
  input_price_per_mtok: number | null;
  output_price_per_mtok: number | null;
  cached_input_price_per_mtok: number | null;
  context_window: number | null;
  source_updated_at: string | null;
  fetched_at: string;
}

// 統一的 JSON response（同源服務，不需也不加 CORS header）。
function json(body: unknown, status = 200, headers?: HeadersInit): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", ...headers },
  });
}

// /api/* 路由分派。由 index.ts 的 fetch() 在判斷 /api/ 前綴後呼叫；
// 未匹配的 /api/* 一律回 JSON 404（不可 fall through 到 SPA 的 index.html）。
export async function handleApiRequest(request: Request, url: URL, env: Env): Promise<Response> {
  if (url.pathname === "/api/pricing") {
    // 唯讀端點：非 GET 回 405（呼應「不存在透過 HTTP 改動 D1 的路徑」）。
    if (request.method !== "GET") {
      return json({ error: "Method Not Allowed" }, 405, { allow: "GET" });
    }
    return getPricing(env);
  }
  return json({ error: "Not Found" }, 404);
}

// 唯讀查 model_pricing_current 全部現價，轉成固定 response 契約（docs §4.2、Issue #8）。
async function getPricing(env: Env): Promise<Response> {
  let rows: CurrentRow[];
  try {
    const result = await env.DB.prepare(
      `SELECT provider, model_id, display_name, input_price_per_mtok, output_price_per_mtok,
              cached_input_price_per_mtok, context_window, source_updated_at, fetched_at
         FROM model_pricing_current`,
    ).all<CurrentRow>();
    rows = result.results;
  } catch (err) {
    // 查詢真的 throw（非「無資料」）：回 500＋記 log，不吞錯當空資料。
    console.error("[api] query model_pricing_current failed:", err);
    return json({ error: "Internal Server Error" }, 500);
  }

  // snake_case（DB）→ camelCase（契約）；null 如實保留。
  const models: ModelPricing[] = rows.map((row) => ({
    provider: row.provider,
    modelId: row.model_id,
    displayName: row.display_name,
    inputPricePerMTok: row.input_price_per_mtok,
    outputPricePerMTok: row.output_price_per_mtok,
    cachedInputPricePerMTok: row.cached_input_price_per_mtok,
    contextWindow: row.context_window,
    updatedAt: row.source_updated_at,
  }));

  // fetchedAt 為 response 層級單一時間戳：取所有現價列 fetched_at 的最新值（ISO 8601 可字典序比較）；
  // 無資料時為 null（搭配空 models 陣列，回 200 給前端顯示空狀態）。
  const fetchedAt = rows.reduce<string | null>(
    (latest, row) => (latest === null || row.fetched_at > latest ? row.fetched_at : latest),
    null,
  );

  return json({ fetchedAt, models } satisfies PricingResponse);
}
