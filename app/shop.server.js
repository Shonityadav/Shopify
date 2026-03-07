import { connectToDatabase } from "./mongodb.server.js";

export async function getShopsCollection() {
  const db = await connectToDatabase();
  return db.collection("shops");
}

export async function upsertShop(session) {
  const shops = await getShopsCollection();

  await shops.updateOne(
    { shop: session.shop },
    {
      $set: {
        shop: session.shop,
        accessToken: session.accessToken,
        scope: session.scope,
        isActive: true,
        installedAt: new Date(),
        updatedAt: new Date(),
      },
    },
    { upsert: true }
  );

  console.log("✅ Shop stored:", session.shop);
}

export async function deactivateShop(shop) {
  const shops = await getShopsCollection();

  await shops.updateOne(
    { shop },
    {
      $set: {
        isActive: false,
        uninstalledAt: new Date(),
      },
    }
  );

  console.log("❌ Shop deactivated:", shop);
}

export async function validateShopActive(shop) {
  const shops = await getShopsCollection();
  const record = await shops.findOne({ shop });

  if (!record || !record.isActive) {
    throw new Response("Shop not active", { status: 403 });
  }

  return record;
}