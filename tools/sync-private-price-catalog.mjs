import fs from "node:fs/promises";

const inputPath = process.argv[2];
const endpoint = process.argv[3] || "https://heruilighting.com/api/price-sync";
const token = process.env.HERUI_PRICE_SYNC_TOKEN;
const chunkSize = 90;

if (!inputPath) throw new Error("Usage: HERUI_PRICE_SYNC_TOKEN=... node tools/sync-private-price-catalog.mjs <private-price-catalog.json> [endpoint]");
if (!token || token.length < 32) throw new Error("HERUI_PRICE_SYNC_TOKEN is required.");

const payload = JSON.parse(await fs.readFile(inputPath, "utf8"));
if (!Array.isArray(payload.products) || !payload.products.length) throw new Error("No products found in private price catalog.");
if (!Array.isArray(payload.variants)) throw new Error("Variant records are required for price sync v2.");

async function syncRows(entity, rows, replace = false) {
  let imported = 0;
  for (let offset = 0; offset < rows.length; offset += chunkSize) {
    const chunk = rows.slice(offset, offset + chunkSize);
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        schemaVersion: "herui-price-sync-v2",
        entity,
        generatedAt: payload.generatedAt,
        replace: replace && offset === 0,
        rows: chunk,
      }),
    });
    const result = await response.json().catch(() => null);
    if (!response.ok || !result?.ok) {
      throw new Error(`${entity} sync failed at row ${offset + 1}: ${response.status} ${JSON.stringify(result)}`);
    }
    imported += result.imported;
    console.log(`Imported ${entity} ${imported}/${rows.length}`);
  }
  return imported;
}

await syncRows("products", payload.products, true);
if (payload.variants.length) await syncRows("variants", payload.variants);

const verifyResponse = await fetch(endpoint, {
  headers: { "Authorization": `Bearer ${token}` },
});
const verification = await verifyResponse.json().catch(() => null);
if (!verifyResponse.ok || !verification?.ok) throw new Error(`Price sync verification failed: ${verifyResponse.status}`);
console.log(JSON.stringify(verification));
