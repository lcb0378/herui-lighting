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

CREATE TABLE IF NOT EXISTS product_variants (
  model TEXT NOT NULL,
  variant_id TEXT NOT NULL,
  variant_label TEXT NOT NULL,
  source_price_rmb REAL,
  source_price_text TEXT NOT NULL DEFAULT '',
  price_status TEXT NOT NULL CHECK (price_status IN ('matched', 'manual_review', 'missing')),
  quantity_unit TEXT NOT NULL DEFAULT 'piece',
  effective_unit TEXT NOT NULL DEFAULT 'per piece',
  source_file TEXT NOT NULL DEFAULT '',
  source_sheet TEXT NOT NULL DEFAULT '',
  source_row TEXT NOT NULL DEFAULT '',
  quote_catalog_row INTEGER NOT NULL,
  mapping_note TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL,
  PRIMARY KEY (model, variant_id)
);

CREATE INDEX IF NOT EXISTS idx_product_variants_model
ON product_variants(model);

CREATE INDEX IF NOT EXISTS idx_product_variants_status
ON product_variants(price_status);
