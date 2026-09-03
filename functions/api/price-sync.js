const MAX_REQUEST_BYTES = 256 * 1024;
const MAX_ROWS_PER_REQUEST = 100;
const ALLOWED_STATUSES = new Set(["matched", "manual_review", "missing"]);
const VARIANT_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

function isAuthorized(request, env) {
  const expected = String(env.PRICE_SYNC_TOKEN || "");
  const supplied = String(request.headers.get("Authorization") || "");
  return expected.length >= 32 && supplied === `Bearer ${expected}`;
}

function normalizeRow(row, generatedAt) {
  const model = String(row?.model || "").trim().slice(0, 60);
  const category = String(row?.category || "").trim().slice(0, 120);
  const sourcePriceText = String(row?.sourcePriceText || "").trim().slice(0, 5000);
  const priceStatus = String(row?.priceStatus || "").trim();
  const size = String(row?.size || "").trim().slice(0, 2000);
  const imagePath = String(row?.imagePath || "").trim().slice(0, 500);
  const sourceRow = Math.trunc(Number(row?.sourceRow));
  const sourcePriceRmb = row?.sourcePriceRmb === null || row?.sourcePriceRmb === ""
    ? null
    : Number(row?.sourcePriceRmb);

  if (!model || !/^HR-[A-Z]{2}-\d{4}$/.test(model)) return null;
  if (!ALLOWED_STATUSES.has(priceStatus)) return null;
  if (!Number.isInteger(sourceRow) || sourceRow < 2 || sourceRow > 100000) return null;
  if (sourcePriceRmb !== null && (!Number.isFinite(sourcePriceRmb) || sourcePriceRmb < 0 || sourcePriceRmb > 10000000)) return null;
  if (priceStatus === "matched" && sourcePriceRmb === null) return null;

  return {
    model,
    category,
    sourcePriceRmb,
    sourcePriceText,
    priceStatus,
    size,
    imagePath,
    sourceRow,
    generatedAt,
  };
}

function normalizeVariant(row, generatedAt) {
  const model = String(row?.model || "").trim().slice(0, 60);
  const variantId = String(row?.variantId || "").trim().slice(0, 100);
  const variantLabel = String(row?.label || row?.variantLabel || "").trim().slice(0, 500);
  const sourcePriceText = String(row?.sourcePriceText || "").trim().slice(0, 5000);
  const priceStatus = String(row?.priceStatus || "").trim();
  const quantityUnit = String(row?.quantityUnit || "piece").trim().slice(0, 100);
  const effectiveUnit = String(row?.effectiveUnit || "per piece").trim().slice(0, 120);
  const sourceFile = String(row?.sourceFile || "").trim().slice(0, 500);
  const sourceSheet = String(row?.sourceSheet || "").trim().slice(0, 200);
  const sourceRow = String(row?.sourceRow || "").trim().slice(0, 100);
  const mappingNote = String(row?.note || row?.mappingNote || "").trim().slice(0, 2000);
  const quoteCatalogRow = Math.trunc(Number(row?.quoteCatalogRow));
  const sourcePriceRmb = row?.sourcePriceRmb === null || row?.sourcePriceRmb === ""
    ? null
    : Number(row?.sourcePriceRmb);

  if (!model || !/^HR-[A-Z]{2}-\d{4}$/.test(model)) return null;
  if (!variantId || !VARIANT_ID_PATTERN.test(variantId) || !variantLabel) return null;
  if (!ALLOWED_STATUSES.has(priceStatus)) return null;
  if (!Number.isInteger(quoteCatalogRow) || quoteCatalogRow < 2 || quoteCatalogRow > 100000) return null;
  if (sourcePriceRmb !== null && (!Number.isFinite(sourcePriceRmb) || sourcePriceRmb < 0 || sourcePriceRmb > 10000000)) return null;
  if (priceStatus === "matched" && sourcePriceRmb === null) return null;

  return { model, variantId, variantLabel, sourcePriceRmb, sourcePriceText, priceStatus, quantityUnit, effectiveUnit, sourceFile, sourceSheet, sourceRow, quoteCatalogRow, mappingNote, generatedAt };
}

async function ensureVariantSchema(database) {
  await database.prepare(`CREATE TABLE IF NOT EXISTS product_variants (
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
  )`).run();
  await database.prepare("CREATE INDEX IF NOT EXISTS idx_product_variants_model ON product_variants(model)").run();
  await database.prepare("CREATE INDEX IF NOT EXISTS idx_product_variants_status ON product_variants(price_status)").run();
}

export async function onRequestPost({ request, env }) {
  if (!isAuthorized(request, env)) return jsonResponse({ ok: false, error: "Unauthorized" }, 401);
  if (!env.QUOTE_DB) return jsonResponse({ ok: false, error: "Database is not configured" }, 503);
  if (!String(request.headers.get("Content-Type") || "").toLowerCase().includes("application/json")) {
    return jsonResponse({ ok: false, error: "JSON is required" }, 415);
  }
  const declaredLength = Number(request.headers.get("Content-Length") || 0);
  if (declaredLength > MAX_REQUEST_BYTES) return jsonResponse({ ok: false, error: "Request is too large" }, 413);
  const rawBody = await request.text();
  if (new TextEncoder().encode(rawBody).length > MAX_REQUEST_BYTES) return jsonResponse({ ok: false, error: "Request is too large" }, 413);

  let payload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return jsonResponse({ ok: false, error: "Invalid JSON" }, 400);
  }

  if (payload?.schemaVersion !== "herui-price-sync-v2" || !["products", "variants"].includes(payload.entity) || !Array.isArray(payload.rows)) {
    return jsonResponse({ ok: false, error: "Invalid payload" }, 400);
  }
  if (payload.rows.length < 1 || payload.rows.length > MAX_ROWS_PER_REQUEST) {
    return jsonResponse({ ok: false, error: "Invalid row count" }, 400);
  }
  const generatedAt = String(payload.generatedAt || new Date().toISOString()).trim().slice(0, 80);
  const rows = payload.rows.map((row) => payload.entity === "variants" ? normalizeVariant(row, generatedAt) : normalizeRow(row, generatedAt));
  if (rows.some((row) => !row)) return jsonResponse({ ok: false, error: "Invalid price row" }, 400);

  await ensureVariantSchema(env.QUOTE_DB);
  const statements = [];
  if (payload.replace === true && payload.entity === "products") {
    statements.push(env.QUOTE_DB.prepare("DELETE FROM product_variants"));
    statements.push(env.QUOTE_DB.prepare("DELETE FROM product_prices"));
  }
  if (payload.entity === "products") {
    for (const row of rows) {
      statements.push(env.QUOTE_DB.prepare(
        `INSERT INTO product_prices (
          model, category, source_price_rmb, source_price_text, price_status,
          size_specification, website_image_path, source_row, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(model) DO UPDATE SET
          category = excluded.category,
          source_price_rmb = excluded.source_price_rmb,
          source_price_text = excluded.source_price_text,
          price_status = excluded.price_status,
          size_specification = excluded.size_specification,
          website_image_path = excluded.website_image_path,
          source_row = excluded.source_row,
          updated_at = excluded.updated_at`,
      ).bind(row.model, row.category, row.sourcePriceRmb, row.sourcePriceText, row.priceStatus, row.size, row.imagePath, row.sourceRow, row.generatedAt));
    }
  } else {
    for (const row of rows) {
      statements.push(env.QUOTE_DB.prepare(
        `INSERT INTO product_variants (
          model, variant_id, variant_label, source_price_rmb, source_price_text, price_status,
          quantity_unit, effective_unit, source_file, source_sheet, source_row, quote_catalog_row,
          mapping_note, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(model, variant_id) DO UPDATE SET
          variant_label = excluded.variant_label,
          source_price_rmb = excluded.source_price_rmb,
          source_price_text = excluded.source_price_text,
          price_status = excluded.price_status,
          quantity_unit = excluded.quantity_unit,
          effective_unit = excluded.effective_unit,
          source_file = excluded.source_file,
          source_sheet = excluded.source_sheet,
          source_row = excluded.source_row,
          quote_catalog_row = excluded.quote_catalog_row,
          mapping_note = excluded.mapping_note,
          updated_at = excluded.updated_at`,
      ).bind(row.model, row.variantId, row.variantLabel, row.sourcePriceRmb, row.sourcePriceText, row.priceStatus, row.quantityUnit, row.effectiveUnit, row.sourceFile, row.sourceSheet, row.sourceRow, row.quoteCatalogRow, row.mappingNote, row.generatedAt));
    }
  }

  await env.QUOTE_DB.batch(statements);
  return jsonResponse({ ok: true, entity: payload.entity, imported: rows.length, replaced: payload.replace === true });
}

export async function onRequestGet({ request, env }) {
  if (!isAuthorized(request, env)) return jsonResponse({ ok: false, error: "Unauthorized" }, 401);
  if (!env.QUOTE_DB) return jsonResponse({ ok: false, error: "Database is not configured" }, 503);
  await ensureVariantSchema(env.QUOTE_DB);
  const result = await env.QUOTE_DB.prepare(
    `SELECT COUNT(*) AS productCount,
      SUM(CASE WHEN price_status = 'matched' THEN 1 ELSE 0 END) AS matchedCount,
      SUM(CASE WHEN price_status = 'manual_review' THEN 1 ELSE 0 END) AS manualReviewCount,
      SUM(CASE WHEN price_status = 'missing' THEN 1 ELSE 0 END) AS missingCount,
      MAX(updated_at) AS updatedAt
    FROM product_prices`,
  ).first();
  const variantResult = await env.QUOTE_DB.prepare(
    `SELECT COUNT(*) AS variantCount,
      SUM(CASE WHEN price_status = 'matched' THEN 1 ELSE 0 END) AS matchedVariantCount,
      SUM(CASE WHEN price_status = 'manual_review' THEN 1 ELSE 0 END) AS manualReviewVariantCount,
      SUM(CASE WHEN price_status = 'missing' THEN 1 ELSE 0 END) AS missingVariantCount,
      MAX(updated_at) AS variantsUpdatedAt
    FROM product_variants`,
  ).first();
  return jsonResponse({ ok: true, ...result, ...variantResult });
}
