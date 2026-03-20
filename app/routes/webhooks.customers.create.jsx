import { authenticate } from "../shopify.server";
import { getCustomerByShopifyId, createCustomer, updateCustomer } from "../models/Customer.server";

export const action = async ({ request }) => {
  console.log("🔥 customers/create webhook triggered");

  const { shop, payload } = await authenticate.webhook(request);

  console.log("📩 Webhook authenticated");
  console.log("Shop:", shop);
  console.log("Customer ID:", payload?.id);

  try {
    const existingCustomer = await getCustomerByShopifyId(shop, payload.id);

    if (existingCustomer) {
      await updateCustomer(shop, payload.id, {
        email: payload.email,
        first_name: payload.first_name,
        last_name: payload.last_name,
      });
      console.log("✅ Customer updated");
    } else {
      await createCustomer({
        store: shop,
        shopify_customer_id: payload.id,
        email: payload.email,
        first_name: payload.first_name,
        last_name: payload.last_name,
        is_vip: false,
        coupons_remaining: 0,
      });
      console.log("✅ Customer created with VIP defaults");
    }
  } catch (error) {
    console.error("❌ Error in customer creation webhook:", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  return new Response("OK", { status: 200 });
};