import { authenticate } from "../shopify.server";
import { recordBillingAttempt } from "../services/SubscriptionService.server";
import {
  handleBillingAttemptSuccess,
} from "../webhookUtils.server";

export const action = async ({ request }) => {
  console.log("🔔 [subscription_billing_attempts/success] Webhook triggered");

  try {
    const { shop, payload } = await authenticate.webhook(request);

    console.log("📩 Webhook authenticated");
    console.log("Shop:", shop);
    console.log("Billing Attempt ID:", payload?.id);
    console.log("Subscription Contract ID:", payload?.subscriptionContractId);
    console.log("Order ID:", payload?.order?.id);

    // Record billing attempt in our database
    if (payload?.subscriptionContractId) {
      await recordBillingAttempt(shop, payload.subscriptionContractId, payload);
    }

    // Handle the webhook event
    const result = await handleBillingAttemptSuccess(shop, payload);

    console.log("✅ Billing attempt success webhook processed");

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("❌ Error processing billing attempt success webhook:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
};
