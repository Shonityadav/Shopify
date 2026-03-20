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

  return db
    .collection("customers")
    .find({ store })
    .sort({ createdAt: -1 })
    .toArray();
}


export async function getCustomerByShopifyId(store, shopify_customer_id) {
  const db = await connectToDatabase();

  return db.collection("customers").findOne({
    store,
    shopify_customer_id: Number(shopify_customer_id),
  });
}


export async function updateCustomer(store, shopify_customer_id, data) {
  const db = await connectToDatabase();

  // 🔧 IMPORTANT FIX
  const customerId = Number(shopify_customer_id);

  console.log("Updating customer in MongoDB:", {
    store,
    shopify_customer_id: customerId,
    data,
  });

  const updateFields = {};

  if (data.email !== undefined) updateFields.email = data.email;
  if (data.first_name !== undefined) updateFields.first_name = data.first_name;
  if (data.last_name !== undefined) updateFields.last_name = data.last_name;
  if (data.is_vip !== undefined) updateFields.is_vip = data.is_vip;
  if (data.membership_start_date !== undefined)
    updateFields.membership_start_date = data.membership_start_date;
  if (data.membership_end_date !== undefined)
    updateFields.membership_end_date = data.membership_end_date;
  if (data.coupons_remaining !== undefined)
    updateFields.coupons_remaining = data.coupons_remaining;

  updateFields.updatedAt = new Date();

  const result = await db.collection("customers").updateOne(
    {
      store,
      shopify_customer_id: customerId,
    },
    {
      $set: updateFields,
    },
    {
      upsert: true,
    }
  );

  console.log("MongoDB update result:", result);

  return result;
}