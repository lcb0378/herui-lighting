# Herui Lighting Inquiry Receiver Setup

This website is hosted on Cloudflare Pages from the connected GitHub repository. The public static site does not currently run a private mail server or inquiry database. The catalog is receiver-ready: quote cart submissions and Contact Us submissions can post complete JSON to a future receiver endpoint, while still falling back to email draft/copy/download when no endpoint is configured.

## Current Status

- Config file: `inquiry-config.js`
- Current public receiver email: `sales@heruilighting.com`
- Cloudflare Email Routing: active; destination is kept private outside the public repository
- Current endpoint: not set
- Frontend cache version for this setup: `20260902-contact-routing`

No product data, category data, or internal quote catalog pricing changed in this setup.

## What To Fill Later

If an automatic form receiver endpoint is added later, update `inquiry-config.js` while keeping the public sales address:

```js
window.HERUI_INQUIRY_CONFIG = {
  brand: "Herui Lighting",
  schemaVersion: "herui-inquiry-v1",
  source: "cloudflare-pages-catalog",
  receiverEmail: "sales@heruilighting.com",
  fallbackEmail: "sales@heruilighting.com",
  endpoint: "https://example.com/herui-inquiry-receiver"
};
```

After editing the config, update the cache string in `index.html` for `inquiry-config.js`, commit, push to `gh-pages`, and test both the quote cart and Contact Us form.

## Endpoint Contract

The receiver endpoint should accept:

- Method: `POST`
- Content-Type: `application/json`
- Success response: HTTP `200` to `299`

Every request includes:

```json
{
  "schemaVersion": "herui-inquiry-v1",
  "brand": "Herui Lighting",
  "source": "cloudflare-pages-catalog",
  "type": "quote-cart",
  "receiverEmail": "sales@heruilighting.com",
  "fallbackEmail": "sales@heruilighting.com",
  "pageUrl": "https://heruilighting.com/",
  "submittedAt": "2026-08-04T00:00:00.000Z",
  "messageText": "Human-readable inquiry text..."
}
```

For quote cart submissions, the payload also contains:

```json
{
  "submission": {
    "inquiryId": "HERUI-QUOTE-20260804-xxxxxxxx",
    "submittedAt": "2026-08-04T00:00:00.000Z",
    "buyer": {
      "contact": "buyer email, phone, or WhatsApp",
      "destination": "country / city",
      "notes": "project notes"
    },
    "items": [
      {
        "model": "HR-CH-0236",
        "category": "Chandelier",
        "quantity": 1,
        "image": "./products/catalog-1084-chandelier-siyuan-1043.jpg",
        "size": "41 x 41 x 30 cm",
        "material": "aluminum + acrylic",
        "light": "88W tri-color LED",
        "finish": "gold"
      }
    ]
  }
}
```

For Contact Us submissions, the payload also contains:

```json
{
  "inquiry": {
    "inquiryId": "HERUI-CONTACT-20260804-xxxxxxxx",
    "type": "contact-inquiry",
    "subject": "Hotel project lighting inquiry",
    "contact": "buyer email, phone, or WhatsApp",
    "message": "Buyer message",
    "submittedAt": "2026-08-04T00:00:00.000Z"
  }
}
```

## Receiver Requirements

The future receiver should:

- Forward `messageText` to the chosen receiving email.
- Preserve the full JSON payload for audit or troubleshooting.
- Include `inquiryId` in the email subject or first line.
- Support CORS for `https://heruilighting.com`, `https://www.heruilighting.com`, and the GitHub Pages fallback URL.
- Return a `2xx` status only after the message is accepted.

## Testing Checklist

1. Set a test `endpoint` in `inquiry-config.js`; keep `receiverEmail` as `sales@heruilighting.com`.
2. Open the Cloudflare Pages site at `https://heruilighting.com/` with a fresh cache query string.
3. Add at least one product to the cart.
4. Fill buyer contact, destination, and project notes.
5. Click `Submit quote list`.
6. Confirm the website shows `Inquiry sent.`
7. Confirm the receiver email gets the selected models and buyer details.
8. Open `Contact Us`, submit a message, and confirm the receiver email gets it.
9. Temporarily disable the endpoint and confirm the website falls back to an email draft.
