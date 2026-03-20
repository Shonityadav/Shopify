import { authenticate } from "../shopify.server";
import { recordBillingAttempt } from "../services/SubscriptionService.server";
import {
  handleBillingAttemptFailure,
} from "../webhookUtils.server";

export const action = async ({ request }) => {
  console.log("🔔 [subscription_billing_attempts/failure] Webhook triggered");

  try {
    const { shop, payload } = await authenticate.webhook(request);

    console.log("📩 Webhook authenticated");
    console.log("Shop:", shop);
    console.log("Billing Attempt ID:", payload?.id);
    console.log("Subscription Contract ID:", payload?.subscriptionContractId);
    console.log("Error Message:", payload?.errorMessage);

    // Record failed billing attempt in our database
    if (payload?.subscriptionContractId) {
      await recordBillingAttempt(shop, payload.subscriptionContractId, payload);
    }

    // Handle the webhook event
    const result = await handleBillingAttemptFailure(shop, payload);

    console.log("✅ Billing attempt failure webhook processed");

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("❌ Error processing billing attempt failure webhook:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
};
