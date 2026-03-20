import { connectToDatabase } from "../mongodb.server";

export async function createShop(data) {
  const db = await connectToDatabase();

  return db.collection("shops").insertOne({
    shop: data.shop,
    plan: data.plan || "FREE",
    isVip: data.isVip || false,
    productCount: data.productCount || 0,
    isActive: data.isActive !== undefined ? data.isActive : true,
    accessToken: data.accessToken,
    scope: data.scope,
    installedAt: data.installedAt || new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

export async function getShop(shopDomain) {
  const db = await connectToDatabase();
  return db.collection("shops").findOne({ shop: shopDomain });
}

export async function getShops() {
  const db = await connectToDatabase();
  return db.collection("shops").find({}).toArray();
}

export async function updateShop(shopDomain, data) {
  const db = await connectToDatabase();

  return db.collection("shops").updateOne(
    { shop: shopDomain },
    {
      $set: {
        plan: data.plan !== undefined ? data.plan : undefined,
        isVip: data.isVip !== undefined ? data.isVip : undefined,
        productCount: data.productCount !== undefined ? data.productCount : undefined,
        isActive: data.isActive !== undefined ? data.isActive : undefined,
        accessToken: data.accessToken !== undefined ? data.accessToken : undefined,
        scope: data.scope !== undefined ? data.scope : undefined,
        updatedAt: new Date(),
      },
    }
  );
}

export async function deleteShop(shopDomain) {
  const db = await connectToDatabase();
  return db.collection("shops").deleteOne({ shop: shopDomain });
}