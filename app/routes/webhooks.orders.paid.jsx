import { authenticate } from "../shopify.server";
import { updateCustomer, getCustomerByShopifyId, createCustomer } from "../models/Customer.server";

export const action = async ({ request }) => {

  console.log("🔥 orders/paid webhook triggered");

  const { shop, payload, admin } = await authenticate.webhook(request);

  // ---------------- GET VIP VARIANT ID FROM METAFIELD ----------------

  let VIP_VARIANT_ID;

  try {
    const response = await admin.graphql(`
      {
        shop {
          metafield(namespace: "vip", key: "pass_variant_id") {
            value
          }
        }
      }
    `);

    const data = await response.json();
    const vipVariantGid = data.data?.shop?.metafield?.value;

    VIP_VARIANT_ID = vipVariantGid
      ? vipVariantGid.split("/").pop()
      : null;

    if (!VIP_VARIANT_ID) {
      console.log("❌ No VIP variant ID found in metafield");
      return new Response("No VIP variant configured", { status: 200 });
    }

    console.log("✅ VIP Variant ID:", VIP_VARIANT_ID);
  } catch (error) {
    console.error("❌ Error fetching VIP variant metafield:", error);
    return new Response("Error fetching VIP configuration", { status: 500 });
  }


  // ---------------- CHECK ORDER ITEMS ----------------

  const hasVipProduct = payload.line_items.some(
    (item) => item.variant_id?.toString() === VIP_VARIANT_ID.toString()
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


  // ---------------- GET MEMBERSHIP DURATION FROM METAFIELD ----------------

  let durationMonths;

  try {
    const durationResponse = await admin.graphql(`
      {
        shop {
          metafield(namespace: "vip", key: "duration_months") {
            value
          }
        }
      }
    `);

    const durationData = await durationResponse.json();
    durationMonths = parseInt(durationData.data?.shop?.metafield?.value) || 1;

    console.log("✅ Membership duration:", durationMonths, "months");
  } catch (error) {
    console.error("❌ Error fetching duration metafield:", error);
    durationMonths = 1; // Default fallback
  }

  // ---------------- MEMBERSHIP DATES ----------------

  const startDate = new Date();
  const endDate = new Date();
  endDate.setMonth(endDate.getMonth() + durationMonths);


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