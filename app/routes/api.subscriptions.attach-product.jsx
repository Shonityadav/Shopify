import { authenticate } from "../shopify.server";
import {
  attachSellingPlanToProducts,
  hasSubscribeAndSave,
  initializeSubscribeSave,
} from "../services/SubscriptionService.server";

/**
 * API Route: /api/subscriptions/attach-product
 * Attaches selling plan group to a product
 *
 * POST body:
 * {
 *   "productIds": ["gid://shopify/Product/123", ...]
 * }
 */
export const action = async ({ request }) => {
  if (request.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const { admin, session } = await authenticate.admin(request);
    const { productIds } = await request.json();

    if (!productIds || !Array.isArray(productIds) || productIds.length === 0) {
      return new Response(
        JSON.stringify({ error: "Invalid productIds provided" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const shop = session.shop;

    console.log("🔄 Attaching selling plan to products:", productIds);

    // Ensure Subscribe & Save is initialized
    const hasSubscriptions = await hasSubscribeAndSave(shop);
    if (!hasSubscriptions) {
      console.log("🔄 Subscribe & Save not initialized, initializing now...");
      await initializeSubscribeSave(admin, shop);
    }

    // Attach products to selling plan group
    await attachSellingPlanToProducts(admin, shop, productIds);

    return new Response(
      JSON.stringify({
        success: true,
        message: "Selling plan attached to products",
        productsAttached: productIds.length,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("❌ Error attaching selling plan to product:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
};
