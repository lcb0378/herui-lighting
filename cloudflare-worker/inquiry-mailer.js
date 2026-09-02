import { EmailMessage } from "cloudflare:email";

const SENDER_EMAIL = "website@heruilighting.com";
const MAX_REQUEST_BYTES = 110 * 1024;

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

function base64Utf8(value) {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  for (let index = 0; index < bytes.length; index += 8192) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 8192));
  }
  return btoa(binary);
}

function wrapBase64(value) {
  return value.match(/.{1,76}/g)?.join("\r\n") || "";
}

function buildRawMessage(recipient, subject, text) {
  const encodedSubject = base64Utf8(subject);
  const encodedBody = wrapBase64(base64Utf8(text));
  const messageId = `<${crypto.randomUUID()}@heruilighting.com>`;

  return [
    `Date: ${new Date().toUTCString()}`,
    `Message-ID: ${messageId}`,
    `From: Herui Lighting Website <${SENDER_EMAIL}>`,
    `To: Herui Lighting Sales <${recipient}>`,
    `Subject: =?UTF-8?B?${encodedSubject}?=`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
    "",
    encodedBody,
  ].join("\r\n");
}

export default {
  async fetch(request, env) {
    if (request.method !== "POST") return jsonResponse({ ok: false }, 405);

    const rawBody = await request.text();
    if (new TextEncoder().encode(rawBody).length > MAX_REQUEST_BYTES) {
      return jsonResponse({ ok: false }, 413);
    }

    let payload;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return jsonResponse({ ok: false }, 400);
    }

    const subject = String(payload.subject || "").replace(/[\r\n\t]+/g, " ").trim().slice(0, 180);
    const text = String(payload.text || "").trim();
    const recipient = env.INQUIRY_RECIPIENT;
    if (!subject || !text || text.length > 100000 || !recipient || !env.SEND_EMAIL) {
      return jsonResponse({ ok: false }, 400);
    }

    try {
      const message = new EmailMessage(
        SENDER_EMAIL,
        recipient,
        buildRawMessage(recipient, subject, text),
      );
      await env.SEND_EMAIL.send(message);
      return jsonResponse({ ok: true });
    } catch {
      return jsonResponse({ ok: false }, 502);
    }
  },
};
