import { connectToDatabase } from "../mongodb.server";

export async function createVipProduct(data) {
  const db = await connectToDatabase();

  return db.collection("vip_products").insertOne({
    store: data.store,
    shopify_product_id: data.shopify_product_id,
    vip_price: data.vip_price || null,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

export async function getVipProducts(store) {
  const db = await connectToDatabase();
  return db.collection("vip_products").find({ store }).toArray();
}

export async function getVipProductByShopifyId(store, shopify_product_id) {
  const db = await connectToDatabase();
  return db.collection("vip_products").findOne({ store, shopify_product_id });
}

export async function updateVipProduct(store, shopify_product_id, data) {
  const db = await connectToDatabase();

  return db.collection("vip_products").updateOne(
    { store, shopify_product_id },
    {
      $set: {
        vip_price: data.vip_price !== undefined ? data.vip_price : undefined,
        updatedAt: new Date(),
      },
    }
  );
}