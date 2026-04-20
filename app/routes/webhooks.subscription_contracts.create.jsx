import { authenticate } from "../shopify.server";
import { recordSubscriptionContract } from "../services/SubscriptionService.server";
import {
  handleSubscriptionContractCreated,
} from "../webhookUtils.server";

export const action = async ({ request }) => {
  console.log("🔔 [subscription_contracts/create] Webhook triggered");

  try {
    const { shop, payload } = await authenticate.webhook(request);

    console.log("📩 Webhook authenticated");
    console.log("Shop:", shop);
    console.log("Contract ID:", payload?.id);

    // Record subscription contract in our database
    await recordSubscriptionContract(shop, payload);

    // Handle the webhook event
    const result = await handleSubscriptionContractCreated(shop, payload);

    console.log("✅ Subscription contract created webhook processed");

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("❌ Error processing subscription contract created webhook:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
};
