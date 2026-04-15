import { connectToDatabase } from "../mongodb.server";

export async function createGift(data) {
  const db = await connectToDatabase();

  return db.collection("gifts").insertOne({
    store: data.store,
    name: data.name,
    price: data.price,
    benefits: data.benefits,
    image: data.image,
    shopify_product_id: data.shopify_product_id,
    shopify_variant_id: data.shopify_variant_id,
    bundled_products: data.bundled_products || [],
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

export async function getGifts(store) {
  const db = await connectToDatabase();

  return db.collection("gifts").find({ store }).toArray();
}

export async function deleteGift(id) {
  const db = await connectToDatabase();

  return db.collection("gifts").deleteOne({ _id: id });
}