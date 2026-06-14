// 要抓哪些 provider（用 models.dev 的 provider key 過濾，見 docs §4.4）。
// Grok（xAI）預設不抓；要納入時把 "xai" 加進這個陣列即可，不必動其他邏輯。
export const TRACKED_PROVIDERS = ["anthropic", "openai", "google"] as const;

// 主來源：models.dev 單一 api.json（MIT，單位已是每百萬 token 美元）。
export const MODELS_DEV_API = "https://models.dev/api.json";
