import { connectToDatabase } from "../mongodb.server";

// ---------------- CREATE ----------------
export async function createCustomer(data) {
  const db = await connectToDatabase();

  return db.collection("customers").updateOne(
    {
      store: data.store,
      shopify_customer_id: String(data.shopify_customer_id),
    },
    {
      $set: {
        email: data.email || null,
        first_name: data.first_name || null,
        last_name: data.last_name || null,
        is_vip: data.is_vip || false,
        membership_start_date: data.membership_start_date || null,
        membership_end_date: data.membership_end_date || null,
        coupons_remaining: data.coupons_remaining || 0,
        updatedAt: new Date(),
      },
      $setOnInsert: {
        createdAt: new Date(),
      },
    },
    { upsert: true }
  );
}


// ---------------- GET ALL ----------------
export async function getCustomers(store) {
  const db = await connectToDatabase();
  return db.collection("customers").find({ store }).toArray();
}


// ---------------- UPDATE ----------------
export async function updateCustomer(store, shopify_customer_id, data) {
  const db = await connectToDatabase();

  const updateFields = {};

  if (data.email !== undefined) updateFields.email = data.email;
  if (data.first_name !== undefined) updateFields.first_name = data.first_name;
  if (data.last_name !== undefined) updateFields.last_name = data.last_name;
  if (data.is_vip !== undefined) updateFields.is_vip = data.is_vip;
  if (data.membership_start_date !== undefined) updateFields.membership_start_date = data.membership_start_date;
  if (data.membership_end_date !== undefined) updateFields.membership_end_date = data.membership_end_date;
  if (data.coupons_remaining !== undefined) updateFields.coupons_remaining = data.coupons_remaining;

  updateFields.updatedAt = new Date();

  return db.collection("customers").updateOne(
    {
      store,
      shopify_customer_id: String(shopify_customer_id),
    },
    {
      $set: updateFields,
      $setOnInsert: {
        createdAt: new Date(),
      },
    },
    { upsert: true } // ✅ CRITICAL FIX
  );
}
// ---------------- GET ONE ----------------
export async function getCustomerByShopifyId(store, shopify_customer_id) {
  const db = await connectToDatabase();

  return db.collection("customers").findOne({
    store,
    shopify_customer_id: String(shopify_customer_id),
  });
}