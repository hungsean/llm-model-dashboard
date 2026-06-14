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
