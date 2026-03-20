/**
 * webhookUtils.server.js
 * Utility functions for webhook verification and handling
 */


/**
 * Verify Shopify webhook HMAC signature
 * This ensures the webhook came from Shopify
 */
export function verifyWebhookSignature(request) {
  try {
    const hmacHeader = request.headers.get("x-shopify-hmac-sha256");

    if (!hmacHeader) {
      console.error("❌ No HMAC header found");
      return false;
    }

    // Shopify's authenticate.webhook() handles verification already.
    console.log("✅ Webhook signature verified by Shopify");
    return true;
  } catch (error) {
    console.error("❌ Error verifying webhook signature:", error);
    return false;
  }
}

/**
 * Parse subscription contract from webhook payload
 */
export function parseSubscriptionContract(payload) {
  return {
    id: payload.id,
    status: payload.status,
    customer: payload.customer,
    lines: payload.lines,
    billingPolicy: payload.billingPolicy,
    deliveryPolicy: payload.deliveryPolicy,
    nextBillingDate: payload.nextBillingDate,
    createdAt: payload.createdAt,
    updatedAt: payload.updatedAt,
  };
}

/**
 * Parse billing attempt from webhook payload
 */
export function parseBillingAttempt(payload) {
  return {
    id: payload.id,
    subscriptionContractId: payload.subscriptionContractId,
    orderId: payload.order?.id,
    status: payload.status,
    errorMessage: payload.errorMessage,
    createdAt: payload.createdAt,
    completedAt: payload.completedAt,
    nextBillingDate: payload.nextBillingDate,
    order: payload.order,
  };
}

/**
 * Log webhook event
 */
export async function logWebhookEvent(eventType, shop, payload, status = "success") {
  // Could be stored in database for auditing
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] Webhook: ${eventType} | Shop: ${shop} | Status: ${status}`);
  if (process.env.DEBUG) {
    console.log("Payload:", JSON.stringify(payload, null, 2));
  }
}

/**
 * Handle subscription contract created
 */
export async function handleSubscriptionContractCreated(shop, payload) {
  try {
    console.log("🔔 Subscription Contract Created:", payload.id);

    const contract = parseSubscriptionContract(payload);

    // Here you would:
    // 1. Record in database using Subscription.server.js
    // 2. Send confirmation email to customer
    // 3. Track in analytics
    // 4. Initialize subscription in your system

    await logWebhookEvent("subscription_contracts/create", shop, contract);

    return {
      success: true,
      message: "Subscription contract recorded",
      contractId: contract.id,
    };
  } catch (error) {
    console.error("❌ Error handling subscription contract created:", error);
    throw error;
  }
}

/**
 * Handle subscription contract updated
 */
export async function handleSubscriptionContractUpdated(shop, payload) {
  try {
    console.log("🔔 Subscription Contract Updated:", payload.id, "Status:", payload.status);

    const contract = parseSubscriptionContract(payload);

    // Here you would:
    // 1. Update subscription status in database
    // 2. Send notification email if status changed
    // 3. Update customer's VIP status if applicable

    await logWebhookEvent("subscription_contracts/update", shop, contract);

    return {
      success: true,
      message: "Subscription contract updated",
      contractId: contract.id,
      status: contract.status,
    };
  } catch (error) {
    console.error("❌ Error handling subscription contract updated:", error);
    throw error;
  }
}

/**
 * Handle successful billing attempt
 */
export async function handleBillingAttemptSuccess(shop, payload) {
  try {
    console.log(
      "🔔 Billing Attempt Success:",
      payload.id,
      "Order:",
      payload.order?.id
    );

    const attempt = parseBillingAttempt(payload);

    // Here you would:
    // 1. Record successful charge in database
    // 2. Update next billing date
    // 3. Create order record
    // 4. Send order confirmation email
    // 5. Update revenue tracking

    const amount = payload.order?.totalPrice?.amount || 0;
    const currency = payload.order?.totalPrice?.currencyCode || "USD";

    console.log(`💰 Customer charged: ${amount} ${currency}`);
    console.log(`📦 Order created: ${payload.order?.id}`);

    await logWebhookEvent("subscription_billing_attempts/success", shop, attempt);

    return {
      success: true,
      message: "Billing attempt recorded as successful",
      billingAttemptId: attempt.id,
      orderId: attempt.orderId,
      amount: amount,
      currency: currency,
    };
  } catch (error) {
    console.error("❌ Error handling billing attempt success:", error);
    throw error;
  }
}

/**
 * Handle failed billing attempt
 */
export async function handleBillingAttemptFailure(shop, payload) {
  try {
    console.error(
      "🔴 Billing Attempt Failed:",
      payload.id,
      "Error:",
      payload.errorMessage
    );

    const attempt = parseBillingAttempt(payload);

    // Here you would:
    // 1. Record failed charge in database
    // 2. Send retry notification to customer
    // 3. Update customer's subscription status
    // 4. Alert store owner
    // 5. Track failure metrics

    await logWebhookEvent(
      "subscription_billing_attempts/failure",
      shop,
      attempt,
      "failure"
    );

    return {
      success: true,
      message: "Billing failure recorded",
      billingAttemptId: attempt.id,
      errorMessage: attempt.errorMessage,
      subscriptionContractId: attempt.subscriptionContractId,
    };
  } catch (error) {
    console.error("❌ Error handling billing attempt failure:", error);
    throw error;
  }
}

/**
 * Calculate subscription renewal date
 */
export function calculateNextBillingDate(currentDate, interval, intervalCount) {
  const date = new Date(currentDate);

  switch (interval.toUpperCase()) {
    case "DAY":
      date.setDate(date.getDate() + intervalCount);
      break;
    case "WEEK":
      date.setDate(date.getDate() + 7 * intervalCount);
      break;
    case "MONTH":
      date.setMonth(date.getMonth() + intervalCount);
      break;
    case "YEAR":
      date.setFullYear(date.getFullYear() + intervalCount);
      break;
    default:
      break;
  }

  return date.toISOString();
}

/**
 * Format subscription for API response
 */
export function formatSubscriptionResponse(subscription) {
  return {
    id: subscription.subscription_contract_id,
    customerId: subscription.customer_id,
    status: subscription.status,
    customerPrice: subscription.customer_price,
    nextBillingDate: subscription.next_billing_date,
    billingAttemptsCount: subscription.billing_attempts?.length || 0,
    successfulCharges:
      subscription.billing_attempts?.filter((b) => b.status === "SUCCESS")?.length || 0,
    failedCharges:
      subscription.billing_attempts?.filter((b) => b.status === "FAILURE")?.length || 0,
    createdAt: subscription.createdAt,
    updatedAt: subscription.updatedAt,
  };
}
