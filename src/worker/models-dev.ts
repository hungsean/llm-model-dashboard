import { MODELS_DEV_API, TRACKED_PROVIDERS } from "./config";
import type { ModelsDevApi, PricingRecord } from "./types";

// 抓 models.dev/api.json。非 2xx 或網路錯誤直接丟出，由 ingest 的容錯接住。
export async function fetchModelsDev(): Promise<ModelsDevApi> {
  const res = await fetch(MODELS_DEV_API, {
    headers: { "user-agent": "llm-model-dashboard (cron ingest)" },
  });
  if (!res.ok) {
    throw new Error(`models.dev responded ${res.status}`);
  }
  return (await res.json()) as ModelsDevApi;
}

// models.dev 的價格本來就是「每百萬 token 美元」，直接用；缺值回 null。
function num(value: number | undefined): number | null {
  return typeof value === "number" ? value : null;
}

// 只取 TRACKED_PROVIDERS 的模型，轉成本專案 schema（docs §4.2）。
export function toPricingRecords(api: ModelsDevApi): PricingRecord[] {
  const records: PricingRecord[] = [];
  for (const provider of TRACKED_PROVIDERS) {
    const models = api[provider]?.models;
    if (!models) continue;
    for (const [modelId, model] of Object.entries(models)) {
      records.push({
        provider,
        modelId,
        displayName: model.name ?? modelId,
        inputPricePerMTok: num(model.cost?.input),
        outputPricePerMTok: num(model.cost?.output),
        cachedInputPricePerMTok: num(model.cost?.cache_read),
        contextWindow: num(model.limit?.context),
        sourceUpdatedAt: model.last_updated ?? null,
      });
    }
  }
  return records;
}
