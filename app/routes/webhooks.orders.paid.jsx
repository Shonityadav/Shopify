import { authenticate } from "../shopify.server";
import { updateCustomer, getCustomerByShopifyId, createCustomer } from "../models/Customer.server";
import { getVipPasses } from "../models/VipPass.server";

export const action = async ({ request }) => {

  console.log("🔥 orders/paid webhook triggered");

  const { shop, payload } = await authenticate.webhook(request);

  // ---------------- GET VIP PASS FROM DB ----------------

  const vipPasses = await getVipPasses(shop);
  const vipPass = vipPasses.find((pass) => pass.is_active === true);

  if (!vipPass) {
    console.log("❌ No VIP pass configured");
    return new Response("No VIP pass", { status: 200 });
  }


  const vipProductId = parseInt(
    vipPass.shopify_product_id.replace("gid://shopify/Product/", "")
  );


  // ---------------- CHECK ORDER ITEMS ----------------

  const hasVipProduct = payload.line_items.some(
    (item) => item.product_id === vipProductId
  );

  if (!hasVipProduct) {
    console.log("❌ VIP product not found in this order");
    return new Response("No VIP product", { status: 200 });
  }

  console.log("✅ VIP product detected in order");


  // ---------------- GET CUSTOMER ----------------

  const customerId = payload.customer?.id;

  if (!customerId) {
    console.log("❌ No customer attached to order");
    return new Response("No customer", { status: 200 });
  }


  // ---------------- MEMBERSHIP DATES ----------------

  const startDate = new Date();
  const endDate = new Date();

  endDate.setMonth(endDate.getMonth() + vipPass.duration_months);


  // ---------------- UPDATE CUSTOMER ----------------

  try {
    const existingCustomer = await getCustomerByShopifyId(shop, customerId);
    
    if (existingCustomer) {
      await updateCustomer(shop, customerId, {
        is_vip: true,
        membership_start_date: startDate,
        membership_end_date: endDate,
      });
    } else {
      await createCustomer({
        store: shop,
        shopify_customer_id: customerId,
        is_vip: true,
        membership_start_date: startDate,
        membership_end_date: endDate,
      });
    }
    console.log("🎉 VIP Activated for customer:", customerId);
  } catch (error) {
    console.error("❌ Error activating VIP:", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  return new Response("VIP activated", { status: 200 });

};