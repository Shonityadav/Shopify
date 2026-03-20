import { authenticate } from "../shopify.server";
import { upsertShop } from "../shop.server";
import { registerWebhooks } from "../shopify.server";

export const action = async ({ request }) => {
  try {
    const { session } = await authenticate.admin(request);

    console.log("🔥 API webhook registration triggered");
    console.log("🔥 Session shop:", session?.shop);

    await upsertShop(session);
    console.log("✅ Shop upserted via API");

    await registerWebhooks({ session });
    console.log("✅ Webhooks registered via API");

    return new Response(JSON.stringify({
      success: true,
      message: "Webhooks registered successfully!",
      shop: session.shop
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });

  } catch (error) {
    console.error("❌ API webhook registration failed:", error);
    return new Response(JSON.stringify({
      error: true,
      message: "Failed to register webhooks: " + error.message
    }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
};