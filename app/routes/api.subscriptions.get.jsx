import { authenticate } from "../shopify.server";
import {
  getCustomerSubscriptions,
  getShopSubscriptions,
  getSubscriptionAnalytics,
} from "../services/SubscriptionService.server";
import { formatSubscriptionResponse } from "../webhookUtils.server";

/**
 * API Route: /api/subscriptions/get
 * Retrieves subscription information
 *
 * Query parameters:
 * - customerId: (optional) Get subscriptions for a specific customer
 * - analytics: (boolean) Get store-wide analytics instead of subscriptions
 */
export const loader = async ({ request }) => {
  try {
    const { session } = await authenticate.admin(request);
    const url = new URL(request.url);
    const customerId = url.searchParams.get("customerId");
    const getAnalytics = url.searchParams.get("analytics") === "true";

    const shop = session.shop;

    if (getAnalytics) {
      // Return subscription analytics for the store
      const analytics = await getSubscriptionAnalytics(shop);
      return new Response(JSON.stringify({ success: true, data: analytics }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (customerId) {
      // Return subscriptions for a specific customer
      const subscriptions = await getCustomerSubscriptions(shop, customerId);
      const formatted = subscriptions.map(formatSubscriptionResponse);

      return new Response(JSON.stringify({ success: true, data: formatted }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Return all subscriptions for the store
    const subscriptions = await getShopSubscriptions(shop);
    const formatted = subscriptions.map(formatSubscriptionResponse);

    return new Response(JSON.stringify({ success: true, data: formatted }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("❌ Error retrieving subscriptions:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
};
