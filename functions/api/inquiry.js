import { buildQuoteWorkbook } from "../../cloudflare-worker/quote-workbook.js";

const MAX_REQUEST_BYTES = 128 * 1024;
const MAX_MESSAGE_LENGTH = 100000;
const MAX_EMBEDDED_IMAGES = 40;
const MAX_SINGLE_IMAGE_BYTES = 220 * 1024;
const MAX_TOTAL_IMAGE_BYTES = 2200 * 1024;
const ALLOWED_ORIGINS = new Set([
  "https://heruilighting.com",
  "https://www.heruilighting.com",
  "https://herui-lighting.pages.dev",
]);

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

function isAllowedOrigin(request) {
  const origin = request.headers.get("Origin");
  if (!origin) return false;
  if (ALLOWED_ORIGINS.has(origin)) return true;
  try {
    const hostname = new URL(origin).hostname;
    return hostname.endsWith(".herui-lighting.pages.dev");
  } catch {
    return false;
  }
}

function cleanSubject(value, fallback) {
  const cleaned = String(value || "")
    .replace(/[\r\n\t]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
  return cleaned || fallback;
}

function base64Bytes(bytes) {
  let binary = "";
  for (let index = 0; index < bytes.length; index += 8192) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 8192));
  }
  return btoa(binary);
}

function safeFilename(value) {
  return String(value || "quote")
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "quote";
}

async function findPriceRecords(database, models) {
  if (!database) return [];
  const uniqueModels = [...new Set(models)];
  const records = [];
  for (let offset = 0; offset < uniqueModels.length; offset += 50) {
    const chunk = uniqueModels.slice(offset, offset + 50);
    const placeholders = chunk.map(() => "?").join(",");
    const result = await database.prepare(
      `SELECT model, source_price_rmb AS sourcePriceRmb, source_price_text AS sourcePriceText, price_status AS priceStatus, source_row AS sourceRow FROM product_prices WHERE model IN (${placeholders})`,
    ).bind(...chunk).all();
    records.push(...(result.results || []));
  }
  return records;
}

function allowedImageUrl(image) {
  try {
    const url = new URL(image, "https://heruilighting.com/");
    if (!new Set(["heruilighting.com", "www.heruilighting.com", "herui-lighting.pages.dev"]).has(url.hostname)) return null;
    if (!/^\/products\/[a-zA-Z0-9._-]+\.jpg$/i.test(url.pathname)) return null;
    return url;
  } catch {
    return null;
  }
}

async function fetchProductImages(items) {
  const assets = [];
  let totalBytes = 0;
  for (let start = 0; start < Math.min(items.length, MAX_EMBEDDED_IMAGES); start += 6) {
    const batch = items.slice(start, start + 6);
    const fetched = await Promise.all(batch.map(async (item, batchIndex) => {
      const url = allowedImageUrl(item.image);
      if (!url) return null;
      try {
        const response = await fetch(url.toString(), { cf: { cacheEverything: true, cacheTtl: 86400 } });
        if (!response.ok || !String(response.headers.get("Content-Type") || "").toLowerCase().includes("image/jpeg")) return null;
        const declaredSize = Number(response.headers.get("Content-Length") || 0);
        if (declaredSize > MAX_SINGLE_IMAGE_BYTES) return null;
        const bytes = new Uint8Array(await response.arrayBuffer());
        if (!bytes.length || bytes.length > MAX_SINGLE_IMAGE_BYTES) return null;
        return { itemIndex: start + batchIndex, bytes };
      } catch {
        return null;
      }
    }));
    for (const asset of fetched) {
      if (!asset || totalBytes + asset.bytes.length > MAX_TOTAL_IMAGE_BYTES) continue;
      assets.push(asset);
      totalBytes += asset.bytes.length;
    }
    if (totalBytes >= MAX_TOTAL_IMAGE_BYTES) break;
  }
  return assets;
}

async function buildQuoteAttachment(submission, database) {
  const [priceRecords, imageAssets] = await Promise.all([
    findPriceRecords(database, submission.items.map((item) => item.model)),
    fetchProductImages(submission.items),
  ]);
  const workbook = buildQuoteWorkbook({ submission, priceRecords, imageAssets });
  return {
    filename: `Herui-Quote-${safeFilename(submission.inquiryId)}.xlsx`,
    contentType: workbook.contentType,
    base64: base64Bytes(workbook.bytes),
  };
}

function validatePayload(payload) {
  if (!payload || payload.schemaVersion !== "herui-inquiry-v1") return null;
  if (payload.brand !== "Herui Lighting") return null;
  if (!String(payload.messageText || "").trim()) return null;
  if (payload.messageText.length > MAX_MESSAGE_LENGTH) return null;

  if (payload.type === "contact-inquiry") {
    const inquiry = payload.inquiry;
    if (!inquiry?.inquiryId || !inquiry.subject || !inquiry.contact || !inquiry.message) return null;
    return {
      inquiryId: String(inquiry.inquiryId).slice(0, 80),
      subject: `[Herui Contact] ${cleanSubject(inquiry.subject, "Website inquiry")}`,
      text: String(payload.messageText),
    };
  }

  if (payload.type === "quote-cart") {
    const submission = payload.submission;
    if (!submission?.inquiryId || !Array.isArray(submission.items)) return null;
    if (submission.items.length < 1 || submission.items.length > 200) return null;
    const buyerContact = String(submission.buyer?.contact || "").trim();
    if (!buyerContact || buyerContact.length > 300) return null;
    return {
      inquiryId: String(submission.inquiryId).slice(0, 80),
      subject: `[Herui Quote] ${submission.items.length} model${submission.items.length === 1 ? "" : "s"} - ${String(submission.inquiryId).slice(0, 80)}`,
      text: String(payload.messageText),
      quote: submission,
    };
  }

  return null;
}

export async function onRequestPost({ request, env }) {
  if (!isAllowedOrigin(request)) return jsonResponse({ ok: false, error: "Request origin is not allowed." }, 403);

  const contentType = request.headers.get("Content-Type") || "";
  if (!contentType.toLowerCase().includes("application/json")) {
    return jsonResponse({ ok: false, error: "JSON is required." }, 415);
  }

  const declaredLength = Number(request.headers.get("Content-Length") || 0);
  if (declaredLength > MAX_REQUEST_BYTES) return jsonResponse({ ok: false, error: "Request is too large." }, 413);

  const rawBody = await request.text();
  if (new TextEncoder().encode(rawBody).length > MAX_REQUEST_BYTES) {
    return jsonResponse({ ok: false, error: "Request is too large." }, 413);
  }

  let payload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return jsonResponse({ ok: false, error: "Invalid JSON." }, 400);
  }

  if (String(payload.website || "").trim()) {
    return jsonResponse({ ok: true, inquiryId: "accepted" });
  }

  const message = validatePayload(payload);
  if (!message) return jsonResponse({ ok: false, error: "Invalid inquiry." }, 400);

  if (!env.INQUIRY_MAILER) {
    return jsonResponse({ ok: false, error: "Inquiry receiver is not configured." }, 503);
  }

  let emailResponse;
  try {
    let attachment = null;
    let deliveryText = message.text;
    if (message.quote) {
      try {
        attachment = await buildQuoteAttachment(message.quote, env.QUOTE_DB);
      } catch {
        deliveryText += "\n\n[Internal system note: The Excel attachment could not be generated. The inquiry details above are complete.]";
      }
    }
    emailResponse = await env.INQUIRY_MAILER.fetch("https://herui-internal/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        subject: message.subject,
        text: deliveryText,
        attachment,
      }),
    });
  } catch {
    return jsonResponse({ ok: false, error: "Email service is temporarily unavailable." }, 502);
  }

  if (!emailResponse.ok) {
    return jsonResponse({ ok: false, error: "Email service did not accept the inquiry." }, 502);
  }

  return jsonResponse({ ok: true, inquiryId: message.inquiryId });
}

export function onRequestGet() {
  return jsonResponse({ ok: false, error: "Method not allowed." }, 405);
}
