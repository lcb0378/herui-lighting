const MAX_REQUEST_BYTES = 256 * 1024;
const MAX_ROWS_PER_REQUEST = 100;
const ALLOWED_STATUSES = new Set(["matched", "manual_review", "missing"]);

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

  if (payload?.schemaVersion !== "herui-price-sync-v1" || !Array.isArray(payload.rows)) {
    return jsonResponse({ ok: false, error: "Invalid payload" }, 400);
  }
  if (payload.rows.length < 1 || payload.rows.length > MAX_ROWS_PER_REQUEST) {
    return jsonResponse({ ok: false, error: "Invalid row count" }, 400);
  }
  const generatedAt = String(payload.generatedAt || new Date().toISOString()).trim().slice(0, 80);
  const rows = payload.rows.map((row) => normalizeRow(row, generatedAt));
  if (rows.some((row) => !row)) return jsonResponse({ ok: false, error: "Invalid price row" }, 400);

  const statements = [];
  if (payload.replace === true) statements.push(env.QUOTE_DB.prepare("DELETE FROM product_prices"));
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
    ).bind(
      row.model,
      row.category,
      row.sourcePriceRmb,
      row.sourcePriceText,
      row.priceStatus,
      row.size,
      row.imagePath,
      row.sourceRow,
      row.generatedAt,
    ));
  }

  await env.QUOTE_DB.batch(statements);
  return jsonResponse({ ok: true, imported: rows.length, replaced: payload.replace === true });
}

export async function onRequestGet({ request, env }) {
  if (!isAuthorized(request, env)) return jsonResponse({ ok: false, error: "Unauthorized" }, 401);
  if (!env.QUOTE_DB) return jsonResponse({ ok: false, error: "Database is not configured" }, 503);
  const result = await env.QUOTE_DB.prepare(
    `SELECT COUNT(*) AS productCount,
      SUM(CASE WHEN price_status = 'matched' THEN 1 ELSE 0 END) AS matchedCount,
      SUM(CASE WHEN price_status = 'manual_review' THEN 1 ELSE 0 END) AS manualReviewCount,
      SUM(CASE WHEN price_status = 'missing' THEN 1 ELSE 0 END) AS missingCount,
      MAX(updated_at) AS updatedAt
    FROM product_prices`,
  ).first();
  return jsonResponse({ ok: true, ...result });
}
