import { connectToDatabase } from "../mongodb.server";

export async function createCustomer(data) {
  const db = await connectToDatabase();

  return db.collection("customers").insertOne({
    store: data.store,
    shopify_customer_id: data.shopify_customer_id,
    email: data.email || null,
    first_name: data.first_name || null,
    last_name: data.last_name || null,
    is_vip: data.is_vip || false,
    membership_start_date: data.membership_start_date || null,
    membership_end_date: data.membership_end_date || null,
    coupons_remaining: data.coupons_remaining || 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

export async function getCustomers(store) {
  const db = await connectToDatabase();
  return db.collection("customers").find({ store }).toArray();
}

export async function getCustomerByShopifyId(store, shopify_customer_id) {
  const db = await connectToDatabase();
  return db.collection("customers").findOne({ store, shopify_customer_id });
}

export async function updateCustomer(store, shopify_customer_id, data) {
  const db = await connectToDatabase();

  return db.collection("customers").updateOne(
    { store, shopify_customer_id },
    {
      $set: {
        email: data.email !== undefined ? data.email : undefined,
        first_name: data.first_name !== undefined ? data.first_name : undefined,
        last_name: data.last_name !== undefined ? data.last_name : undefined,
        is_vip: data.is_vip !== undefined ? data.is_vip : undefined,
        membership_start_date: data.membership_start_date !== undefined ? data.membership_start_date : undefined,
        membership_end_date: data.membership_end_date !== undefined ? data.membership_end_date : undefined,
        coupons_remaining: data.coupons_remaining !== undefined ? data.coupons_remaining : undefined,
        updatedAt: new Date(),
      },
    }
  );
}