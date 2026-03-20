import { authenticate } from "../shopify.server";
import { connectToDatabase } from "../mongodb.server";
import { validateShopActive } from "../shop.server";

export const action = async ({ request }) => {

  console.log("🔄 ORDERS_UPDATED webhook triggered");

  const { topic, shop, payload } = await authenticate.webhook(request);

  console.log("Webhook Topic:", topic);
  console.log("Shop:", shop);
  console.log("Order ID:", payload?.id);

  await validateShopActive(shop);

  if (topic !== "ORDERS_UPDATED") {
    console.log("⚠ Ignored webhook topic:", topic);
    return new Response("ignored", { status: 200 });
  }

  try {

    const financialStatus = payload.financial_status;

    console.log("Financial Status:", financialStatus);

    /* ============================
       Only process paid orders
    ============================ */

    if (financialStatus !== "paid") {
      console.log("⚠ Order not paid yet. Skipping.");
      return new Response("not_paid", { status: 200 });
    }

    const customer = payload.customer;

    if (!customer) {
      console.log("⚠ Order has no customer");
      return new Response("no_customer", { status: 200 });
    }

    console.log("Customer ID:", customer.id);

    const discountCodes = payload.discount_codes || [];

    console.log("Discount codes used:", discountCodes);

    if (!discountCodes.length) {
      console.log("⚠ No discount code used in this order");
      return new Response("no_coupon", { status: 200 });
    }

    /* ============================
       Connect to MongoDB
    ============================ */

    const db = await connectToDatabase();

    console.log("✅ Connected to MongoDB");

    const couponsCollection = db.collection("coupons");
    const vipCollection = db.collection("vip_members");

    for (const discount of discountCodes) {

      const code = discount.code;

      console.log("Checking coupon:", code);

      /* ============================
         Only process VIP coupons
      ============================ */

      if (!code.startsWith("VIP-")) {
        console.log("⚠ Not a VIP coupon:", code);
        continue;
      }

      const coupon = await couponsCollection.findOne({
        couponCode: code,
        shop
      });

      if (!coupon) {
        console.log("⚠ Coupon not found in DB:", code);
        continue;
      }

      console.log("Coupon found:", coupon);

      /* ============================
         Prevent double processing
      ============================ */

      if (coupon.isUsed) {
        console.log("⚠ Coupon already used:", code);
        continue;
      }

      /* ============================
         Mark coupon as used
      ============================ */

      await couponsCollection.updateOne(
        { _id: coupon._id },
        {
          $set: {
            isUsed: true,
            usedOnOrderId: payload.id,
            usedAt: new Date()
          }
        }
      );

      console.log("✅ Coupon marked as used:", code);

      /* ============================
         Decrease remaining coupons
      ============================ */

      const vipUpdate = await vipCollection.updateOne(
        {
          shop,
          shopifyCustomerId: String(customer.id),
          couponsRemaining: { $gt: 0 }
        },
        {
          $inc: { couponsRemaining: -1 }
        }
      );

      console.log("VIP update result:", vipUpdate);

      console.log("⬇ couponsRemaining decreased for:", customer.id);

    }

    console.log("🎉 ORDERS_UPDATED webhook completed successfully");

    return new Response("success", { status: 200 });

  } catch (error) {

    console.error("❌ ORDERS_UPDATED webhook error:", error);

    return new Response("failed", { status: 500 });

  }

};