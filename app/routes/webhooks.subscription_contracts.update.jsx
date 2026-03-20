import { authenticate } from "../shopify.server";
import { updateSubscription } from "../services/SubscriptionService.server";
import {
  handleSubscriptionContractUpdated,
} from "../webhookUtils.server";

export const action = async ({ request }) => {
  console.log("🔔 [subscription_contracts/update] Webhook triggered");

  try {
    const { shop, payload } = await authenticate.webhook(request);

    console.log("📩 Webhook authenticated");
    console.log("Shop:", shop);
    console.log("Contract ID:", payload?.id);
    console.log("New Status:", payload?.status);

    // Update subscription status in our database
    await updateSubscription(shop, payload.id, payload.status);

    // Handle the webhook event
    const result = await handleSubscriptionContractUpdated(shop, payload);

    console.log("✅ Subscription contract updated webhook processed");

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("❌ Error processing subscription contract updated webhook:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
};
