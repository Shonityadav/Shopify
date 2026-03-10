import { connectToDatabase } from "../mongodb.server";

export async function createVipMember(data) {
  const db = await connectToDatabase();

  return db.collection("vip_members").insertOne({
    store: data.store,
    shopify_customer_id: data.shopify_customer_id,
    is_vip: data.is_vip || false,
    membership_start_date: data.membership_start_date || null,
    membership_end_date: data.membership_end_date || null,
    coupons_remaining: data.coupons_remaining || 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

export async function getVipMembers(store) {
  const db = await connectToDatabase();
  return db.collection("vip_members").find({ store }).toArray();
}

export async function getVipMemberByShopifyId(store, shopify_customer_id) {
  const db = await connectToDatabase();
  return db.collection("vip_members").findOne({ store, shopify_customer_id });
}

export async function updateVipMember(store, shopify_customer_id, data) {
  const db = await connectToDatabase();

  return db.collection("vip_members").updateOne(
    { store, shopify_customer_id },
    {
      $set: {
        is_vip: data.is_vip !== undefined ? data.is_vip : undefined,
        membership_start_date: data.membership_start_date !== undefined ? data.membership_start_date : undefined,
        membership_end_date: data.membership_end_date !== undefined ? data.membership_end_date : undefined,
        coupons_remaining: data.coupons_remaining !== undefined ? data.coupons_remaining : undefined,
        updatedAt: new Date(),
      },
    }
  );
}