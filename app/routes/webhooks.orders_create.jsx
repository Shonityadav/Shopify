import { authenticate } from "../shopify.server";
import { connectToDatabase } from "../mongodb.server";
import { validateShopActive } from "../shop.server";

// Utility: Add 30 days
function add30Days(date) {
  const newDate = new Date(date);
  newDate.setDate(newDate.getDate() + 30);
  return newDate;
}

// Utility: Generate random code
function generateCode() {
  return "VIP-" + Math.random().toString(36).substring(2, 10).toUpperCase();
}

export const action = async ({ request }) => {
  console.log("order create webhook triggered");
  const { topic, shop, admin, payload } =
    await authenticate.webhook(request);

  await validateShopActive(shop);

  if (topic !== "ORDERS_CREATE") {
    return new Response("ignored", { status: 200 });
  }

  try {
    const customer = payload.customer;
    if (!customer) {
      return new Response("no_customer", { status: 200 });
    }

    const VIP_PRODUCT_ID = process.env.VIP_PRODUCT_ID;

    const hasVIPMembership = payload.line_items?.some(
      (item) => String(item.product_id) === String(VIP_PRODUCT_ID)
    );

    if (!hasVIPMembership) {
      return new Response("not_vip_order", { status: 200 });
    }

    const db = await connectToDatabase();
    const vipCollection = db.collection("vip_members");
    const couponsCollection = db.collection("coupons");

    const existingVIP = await vipCollection.findOne({
      shop,
      shopifyCustomerId: String(customer.id),
    });

    const now = new Date();

    // 🔒 RENEW IF EXPIRED
    if (existingVIP) {
      if (now < new Date(existingVIP.membershipEndDate)) {
        return new Response("already_active_vip", { status: 200 });
      }

      // expired → renew
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
      // create new VIP record
      await vipCollection.insertOne({
        shop,
        shopifyCustomerId: String(customer.id),
        isVip: true,
        membershipStartDate: now,
        membershipEndDate: add30Days(now),
        couponsRemaining: 3,
        createdAt: new Date(),
      });

      console.log("🔥 ORDERS_PAID WEBHOOK TRIGGERED");
      console.log("Shop:", shop);
      console.log("Customer:", payload.customer?.id);
    }

    // 🏷 Tag Customer
    const tagResponse = await admin.graphql(`
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

    const tagData = await tagResponse.json();
    if (tagData.errors) {
      console.error("Tag error:", tagData.errors);
    }

    // 🎟 Create Price Rule
    const priceRuleResponse = await admin.graphql(`
      mutation {
        priceRuleCreate(
          priceRule: {
            title: "VIP $10 Discount"
            targetType: LINE_ITEM
            targetSelection: ALL
            allocationMethod: ACROSS
            valueType: FIXED_AMOUNT
            value: "-10.0"
            customerSelection: {
              customers: ["gid://shopify/Customer/${customer.id}"]
            }
            oncePerCustomer: true
            usageLimit: 1
          }
        ) {
          priceRule { id }
          userErrors { message }
        }
      }
    `);

    const priceRuleData = await priceRuleResponse.json();

    if (priceRuleData.errors || priceRuleData.data.priceRuleCreate.userErrors.length) {
      console.error("Price rule error:", priceRuleData);
      return new Response("price_rule_failed", { status: 200 });
    }

    const priceRuleId =
      priceRuleData.data.priceRuleCreate.priceRule.id;

    // 🎁 Generate 3 Discount Codes
    for (let i = 0; i < 3; i++) {
      const code = generateCode();

      const discountResponse = await admin.graphql(`
        mutation {
          discountCodeCreate(
            priceRuleId: "${priceRuleId}",
            discountCode: { code: "${code}" }
          ) {
            discountCode { id }
            userErrors { message }
          }
        }
      `);

      const discountData = await discountResponse.json();

      if (discountData.errors) {
        console.error("Discount error:", discountData.errors);
        continue;
      }

      await couponsCollection.insertOne({
        shop,
        couponCode: code,
        value: 10,
        isUsed: false,
        usedByCustomerId: String(customer.id),
        usedOnOrderId: null,
        createdAt: new Date(),
      });
    }

    console.log("✅ VIP activated safely");

    return new Response("success", { status: 200 });
  } catch (error) {
    console.error("Webhook Error:", error);
    return new Response("failed", { status: 500 });
  }
};