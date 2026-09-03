CREATE TABLE IF NOT EXISTS product_prices (
  model TEXT PRIMARY KEY,
  category TEXT NOT NULL DEFAULT '',
  source_price_rmb REAL,
  source_price_text TEXT NOT NULL DEFAULT '',
  price_status TEXT NOT NULL CHECK (price_status IN ('matched', 'manual_review', 'missing')),
  size_specification TEXT NOT NULL DEFAULT '',
  website_image_path TEXT NOT NULL DEFAULT '',
  source_row INTEGER NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_product_prices_status
ON product_prices(price_status);
