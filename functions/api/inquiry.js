const ACCOUNT_ID = "503a4931daf9c02a88b00ad8f5d7951d";
const SENDER_EMAIL = "website@heruilighting.com";
const MAX_REQUEST_BYTES = 128 * 1024;
const MAX_MESSAGE_LENGTH = 100000;
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
    return {
      inquiryId: String(submission.inquiryId).slice(0, 80),
      subject: `[Herui Quote] ${submission.items.length} model${submission.items.length === 1 ? "" : "s"} - ${String(submission.inquiryId).slice(0, 80)}`,
      text: String(payload.messageText),
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

  const apiToken = env.CLOUDFLARE_EMAIL_API_TOKEN;
  const recipient = env.INQUIRY_RECIPIENT;
  if (!apiToken || !recipient) {
    return jsonResponse({ ok: false, error: "Inquiry receiver is not configured." }, 503);
  }

  let emailResponse;
  try {
    emailResponse = await fetch(`https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/email/sending/send`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        to: recipient,
        from: SENDER_EMAIL,
        subject: message.subject,
        text: message.text,
      }),
    });
  } catch {
    return jsonResponse({ ok: false, error: "Email service is temporarily unavailable." }, 502);
  }

  let emailResult = null;
  try {
    emailResult = await emailResponse.json();
  } catch {
    // Keep the customer-facing response generic and never expose provider details.
  }

  if (!emailResponse.ok || emailResult?.success !== true) {
    return jsonResponse({ ok: false, error: "Email service did not accept the inquiry." }, 502);
  }

  return jsonResponse({ ok: true, inquiryId: message.inquiryId });
}

export function onRequestGet() {
  return jsonResponse({ ok: false, error: "Method not allowed." }, 405);
}
