// 轉換後、要寫進 model_pricing_current 的一筆「現價」（對應 docs §4.2）。
// 價格／context 找不到時為 null（不要用 0，0 會被誤算成免費）。
export interface PricingRecord {
  provider: string;
  modelId: string;
  displayName: string;
  inputPricePerMTok: number | null;
  outputPricePerMTok: number | null;
  cachedInputPricePerMTok: number | null;
  contextWindow: number | null;
  sourceUpdatedAt: string | null;
}

// GET /api/pricing 回傳的單筆現價（Issue #8 契約）。欄位全 camelCase，對齊 docs §4.2；
// 價格／contextWindow／updatedAt 找不到時如實回傳 null（不要 0、不要省略欄位）。
// 與 PricingRecord 的差別：updatedAt 對應 DB source_updated_at（給前端的對外名稱）。
export interface ModelPricing {
  provider: string;
  modelId: string;
  displayName: string;
  inputPricePerMTok: number | null;
  outputPricePerMTok: number | null;
  cachedInputPricePerMTok: number | null;
  contextWindow: number | null;
  updatedAt: string | null;
}

// GET /api/pricing 的固定 response 契約（Issue #8）。
// fetchedAt 是 response 層級單一時間戳（取 model_pricing_current.fetched_at 最新值），
// D1 無資料時為 null；models 無資料時為空陣列。
export interface PricingResponse {
  fetchedAt: string | null;
  models: ModelPricing[];
}

// models.dev api.json 的最小型別：只宣告我們會用到的欄位（外部 JSON，全部當選用）。
export interface ModelsDevModel {
  id?: string;
  name?: string;
  cost?: {
    input?: number;
    output?: number;
    cache_read?: number;
  };
  limit?: {
    context?: number;
  };
  last_updated?: string;
}

export interface ModelsDevProvider {
  models?: Record<string, ModelsDevModel>;
}

// 頂層是「provider key → provider」的物件。
export type ModelsDevApi = Record<string, ModelsDevProvider>;
