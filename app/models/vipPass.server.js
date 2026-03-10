import { connectToDatabase } from "../mongodb.server";

export async function createVipPass(data) {
  const db = await connectToDatabase();

  return db.collection("passes").insertOne({
    store: data.store,
    name: data.name,
    duration_months: data.duration_months,
    discount_percentage: data.discount_percentage,
    benefits: data.benefits,
    price: data.price,
    shopify_product_id: data.shopify_product_id,
    shopify_variant_id: data.shopify_variant_id,
    is_active: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

export async function getVipPasses(store) {
  const db = await connectToDatabase();

  return db.collection("passes").find({ store }).toArray();
}