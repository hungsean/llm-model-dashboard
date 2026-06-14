-- Issue #7：價格資料攝取層 — D1 資料表（依 docs/1-pricing-data-source.md §4.5）

-- 現價：每個模型最新狀態，前端（#8 的 /api/pricing）主要讀這張
CREATE TABLE model_pricing_current (
  provider                    TEXT    NOT NULL,
  model_id                    TEXT    NOT NULL,
  display_name                TEXT    NOT NULL,
  input_price_per_mtok        REAL,            -- 找不到價格用 NULL，不要用 0
  output_price_per_mtok       REAL,
  cached_input_price_per_mtok REAL,
  context_window              INTEGER,
  source_updated_at           TEXT,            -- models.dev 的 last_updated（ISO 8601）
  fetched_at                  TEXT    NOT NULL, -- 我們這次抓取的時間（ISO 8601）
  PRIMARY KEY (provider, model_id)
);

-- 歷史：價格每變一次累積一列；本專案開始抓之後才有資料
CREATE TABLE model_pricing_history (
  provider                    TEXT    NOT NULL,
  model_id                    TEXT    NOT NULL,
  input_price_per_mtok        REAL,
  output_price_per_mtok       REAL,
  cached_input_price_per_mtok REAL,
  from_date                   TEXT    NOT NULL, -- 此價格生效起日（ISO 8601）
  to_date                     TEXT,             -- 失效日；仍生效中則 NULL
  PRIMARY KEY (provider, model_id, from_date)
);
