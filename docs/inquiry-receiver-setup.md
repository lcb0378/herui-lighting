# Herui Lighting Inquiry Receiver Setup

This website is hosted on Cloudflare Pages from the connected GitHub repository. Contact Us and quote cart submissions are handled by a Cloudflare Pages Function. It passes validated messages through a private service binding to the `herui-inquiry-mailer` Worker, whose restricted Send Email binding can deliver only to the verified Herui receiving inbox. If automatic sending is unavailable, the website falls back to a prepared email draft.

## Current Status

- Config file: `inquiry-config.js`
- Current public receiver email: `sales@heruilighting.com`
- Cloudflare Email Routing: active; destination is kept private outside the public repository
- Current endpoint: `/api/inquiry`
- Backend function: `functions/api/inquiry.js`
- Mail Worker source copy: `cloudflare-worker/inquiry-mailer.js`
- Cloudflare Pages production service binding: `INQUIRY_MAILER` -> `herui-inquiry-mailer`
- Mail Worker binding: `SEND_EMAIL`, restricted to the verified destination
- Mail Worker secret: `INQUIRY_RECIPIENT`
- Frontend cache version for this setup: `20260902-automatic-inquiries`

No product data, category data, or internal quote catalog pricing changed in this setup.

The private destination address must never be committed to GitHub. Cloudflare stores it encrypted in the dedicated Worker. The Pages Function cannot choose or see a destination address; the Send Email binding is also restricted to the same verified inbox.

## Public Configuration

The public config keeps the sales address and uses a same-origin endpoint:

```js
window.HERUI_INQUIRY_CONFIG = {
  brand: "Herui Lighting",
  schemaVersion: "herui-inquiry-v1",
  source: "cloudflare-pages-catalog",
  receiverEmail: "sales@heruilighting.com",
  fallbackEmail: "sales@heruilighting.com",
  endpoint: "/api/inquiry"
};
```

After changes to the frontend receiver logic, update the cache strings in `index.html`, commit, push to `gh-pages`, and test both the quote cart and Contact Us form.

## Endpoint Contract

The receiver endpoint should accept:

- Method: `POST`
- Content-Type: `application/json`
- Success response: HTTP `200` with `{ "ok": true, "inquiryId": "..." }`

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

The receiver:

- Passes `messageText` through a private Cloudflare service binding to the mail Worker.
- Ignores any receiver address supplied by the browser, so the endpoint cannot be used to send mail to arbitrary recipients.
- Includes the inquiry ID in the message and quote email subject.
- Accepts production and Cloudflare Pages origins only.
- Validates the inquiry type, required fields, item count, content type, and request size.
- Uses a hidden honeypot field for basic bot filtering.
- Returns success only after Cloudflare Email Service accepts the message.
- Does not log or store the customer's inquiry content in the public repository.

## Testing Checklist

1. Confirm the Pages `INQUIRY_MAILER` service binding and Worker `SEND_EMAIL` binding are present.
2. Open `https://heruilighting.com/` after the production deployment completes.
3. Add at least one product to the cart.
4. Fill buyer contact, destination, and project notes.
5. Click `Submit quote list`.
6. Confirm the website shows `Quote request received.`
7. Confirm the receiver email gets the selected models and buyer details.
8. Open `Contact Us`, submit a message, and confirm the receiver email gets it.
9. Confirm failed automatic sends do not display a false success message and instead fall back to a prepared email draft.
