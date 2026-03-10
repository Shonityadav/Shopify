import { authenticate } from "../shopify.server";
import { connectToDatabase } from "../mongodb.server";
import { validateShopActive } from "../shop.server";

// Utility: Add 30 days
function add30Days(date) {
  const newDate = new Date(date);
  newDate.setDate(newDate.getDate() + 30);
  return newDate;
}

export const action = async ({ request }) => {

  console.log("🔥 ORDERS_CREATE webhook triggered");

  const { topic, shop, admin, payload } =
    await authenticate.webhook(request);

  console.log("Webhook Topic:", topic);
  console.log("Shop:", shop);
  console.log("Order ID:", payload?.id);

  await validateShopActive(shop);

  if (topic !== "ORDERS_CREATE") {
    console.log("⚠ Ignored topic:", topic);
    return new Response("ignored", { status: 200 });
  }

  try {

    const customer = payload.customer;

    if (!customer) {
      console.log("⚠ Order has no customer");
      return new Response("no_customer", { status: 200 });
    }

    console.log("Customer ID:", customer.id);

    /* ============================
       Fetch VIP variant metafield
    ============================ */

    console.log("Fetching VIP metafield");

    const metafieldResponse = await admin.graphql(`
      {
        shop {
          metafield(namespace: "vip", key: "pass_variant_id") {
            value
          }
        }
      }
    `);

    const metafieldData = await metafieldResponse.json();

    const vipVariantGid =
      metafieldData?.data?.shop?.metafield?.value;

    if (!vipVariantGid) {
      console.error("VIP metafield missing");
      return new Response("vip_metafield_missing", { status: 200 });
    }

    const VIP_VARIANT_ID = vipVariantGid.split("/").pop();

    console.log("VIP Variant ID:", VIP_VARIANT_ID);

    /* ============================
       Check if VIP purchased
    ============================ */

    const hasVIPMembership = payload.line_items?.some(
      (item) => String(item.variant_id) === String(VIP_VARIANT_ID)
    );

    console.log("VIP Membership purchased:", hasVIPMembership);

    if (!hasVIPMembership) {
      console.log("Not a VIP order");
      return new Response("not_vip_order", { status: 200 });
    }

    /* ============================
       Connect DB
    ============================ */

    const db = await connectToDatabase();

    const vipCollection = db.collection("vip_members");
    const couponsCollection = db.collection("coupons");

    console.log("MongoDB connected");

    const now = new Date();

    const existingVIP = await vipCollection.findOne({
      shop,
      shopifyCustomerId: String(customer.id),
    });

    console.log("Existing VIP:", existingVIP);

    /* ============================
       VIP membership logic
    ============================ */

    if (existingVIP) {

      if (now < new Date(existingVIP.membershipEndDate)) {
        console.log("VIP already active");
        return new Response("already_active_vip", { status: 200 });
      }

      console.log("Renewing VIP membership");

      await vipCollection.updateOne(
        { _id: existingVIP._id },
        {
          $set: {
            isVip: true,
            membershipStartDate: now,
            membershipEndDate: add30Days(now),
            couponsRemaining: 3,
            updatedAt: new Date(),
          },
        }
      );

    } else {

      console.log("Creating new VIP member");

      await vipCollection.insertOne({
        shop,
        shopifyCustomerId: String(customer.id),
        isVip: true,
        membershipStartDate: now,
        membershipEndDate: add30Days(now),
        couponsRemaining: 3,
        createdAt: new Date(),
      });

    }

    /* ============================
       Tag Customer
    ============================ */

    console.log("Tagging customer VIP");

    await admin.graphql(`
      mutation {
        customerUpdate(input: {
          id: "gid://shopify/Customer/${customer.id}",
          tags: ["VIP"]
        }) {
          customer { id }
          userErrors { message }
        }
      }
    `);

    console.log("Customer tagged");

    /* ============================
       Read coupons from order
    ============================ */

    console.log("Reading cart attributes");

    const attributes = payload.note_attributes || [];

    const couponAttr = attributes.find(
      attr => attr.name === "vip_coupons"
    );

    let coupons = [];

    if (couponAttr) {

      try {

        coupons = JSON.parse(couponAttr.value);

        console.log("Coupons from cart:", coupons);

      } catch (err) {

        console.error("Coupon parsing failed", err);

      }

    }

    if (!coupons.length) {
      console.log("No coupons found in order");
      return new Response("no_coupons", { status: 200 });
    }

    /* ============================
       Create Shopify discount codes
    ============================ */

    const PRICE_RULE_ID = process.env.VIP_COUPON_PRICE_RULE_ID;

    console.log("Creating discount codes");

    for (let i = 0; i < coupons.length; i++) {

      const code = coupons[i];

      console.log("Creating Shopify discount:", code);

      const discountResponse = await admin.graphql(`
        mutation {
          discountCodeCreate(
            priceRuleId: "${PRICE_RULE_ID}",
            discountCode: { code: "${code}" }
          ) {
            discountCode { id }
            userErrors { message }
          }
        }
      `);

      const discountData = await discountResponse.json();

      console.log("Discount API result:", discountData);

      /* Save to Mongo */

      await couponsCollection.insertOne({

        shop,
        customerId: String(customer.id),
        couponCode: code,
        value: 10,

        isUsed: i === 0,   // first coupon already used

        usedOnOrderId:
          i === 0 ? payload.id : null,

        createdAt: new Date()

      });

      console.log("Coupon stored:", code);

    }

    console.log("VIP activated + coupons saved");

    return new Response("success", { status: 200 });

  } catch (error) {

    console.error("Webhook Error:", error);

    return new Response("failed", { status: 500 });

  }
};