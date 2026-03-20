# Subscribe & Save with AutoPay Implementation Guide

## Overview

This implementation provides a **complete subscription management system** for your Shopify app using **Shopify Subscriptions Contracts API and Selling Plans**. Shopify automatically handles recurring billing, payment method vaulting, and order generation.

---

## How it Works: Complete Flow

### 1. **Selling Plan Group Creation**
On app installation, the system automatically creates a "Subscribe & Save" selling plan group with three billing frequencies:
- Deliver every 1 month
- Deliver every 2 months  
- Deliver every 3 months

```
┌─────────────────────────────────────────┐
│ Store Installation (afterAuth hook)    │
└─────────────────┬───────────────────────┘
                  │
        (calls initializeSubscribeSave)
                  │
         ┌────────▼─────────┐
         │ Create Selling   │
         │ Plan Group with  │
         │ 3 billing plans  │
         └────────┬─────────┘
                  │
    Stored in MongoDB:
    - selling_plan_groups collection
    - selling_plans collection
```

### 2. **Product Attachment**
When you want to enable "Subscribe & Save" for a product:

```javascript
// Call the API endpoint
POST /api/subscriptions/attach-product
{
  "productIds": ["gid://shopify/Product/123"]
}
```

This attaches the selling plan group to the product, making subscription options visible on the product page.

### 3. **Customer Purchase Flow**
```
┌──────────────────────────────────────┐
│ Customer views product page          │
└──────────────────┬───────────────────┘
                   │
    (Storefront renders selling plan options)
                   │
      ┌────────────▼────────────┐
      │ Customer selects:       │
      │ - "One time buy"        │
      │ - "Subscribe & Save"    │
      │ - Delivery frequency    │
      └────────────┬────────────┘
                   │
         ┌─────────▼──────────┐
         │  Customer adds to  │
         │  cart & checks out │
         └─────────┬──────────┘
                   │
      ┌────────────▼───────────┐
      │ Shopify creates:       │
      │ - Initial Order        │
      │ - Subscription Contract
      │ - Vaults payment method
      └────────────┬───────────┘
                   │
         Your webhooks triggered
```

### 4. **Webhook Handling**

#### **subscription_contracts/create**
When a customer subscribes, Shopify sends this webhook:

```json
{
  "id": "gid://shopify/SubscriptionContract/1",
  "status": "ACTIVE",
  "customer": {
    "id": "gid://shopify/Customer/123"
  },
  "lines": [{
    "variantId": "gid://shopify/ProductVariant/456",
    "sellingPlanId": "gid://shopify/SellingPlan/789"
  }],
  "nextBillingDate": "2026-04-11T00:00:00Z"
}
```

Your webhook handler (`webhooks.subscription_contracts.create.jsx`):
1. Authenticates webhook with Shopify
2. Records subscription in MongoDB
3. Logs the event

#### **subscription_billing_attempts/success**
When the automatic charge succeeds:

```json
{
  "id": "gid://shopify/SubscriptionBillingAttempt/1",
  "subscriptionContractId": "gid://shopify/SubscriptionContract/1",
  "status": "SUCCESS",
  "order": {
    "id": "gid://shopify/Order/2",
    "totalPrice": {
      "amount": "42.50",
      "currencyCode": "USD"
    }
  },
  "nextBillingDate": "2026-05-11T00:00:00Z"
}
```

Your handler:
1. Records the successful charge
2. Updates next billing date
3. Creates order record
4. Tracks revenue

#### **subscription_billing_attempts/failure**
When automatic charge fails:

```json
{
  "id": "gid://shopify/SubscriptionBillingAttempt/2",
  "subscriptionContractId": "gid://shopify/SubscriptionContract/1",
  "status": "FAILURE",
  "errorMessage": "Card declined"
}
```

Your handler:
1. Records the failed charge
2. Alerts store owner
3. Customer can retry payment

#### **subscription_contracts/update**
When subscription status changes (pause/cancel/resume):

```json
{
  "id": "gid://shopify/SubscriptionContract/1",
  "status": "PAUSED"
}
```

Your handler updates the subscription status in MongoDB.

---

## Database Schema

### **subscription_contracts** Collection
```javascript
{
  _id: ObjectId,
  store: "shop.myshopify.com",
  subscription_contract_id: "gid://shopify/SubscriptionContract/1",
  customer_id: "gid://shopify/Customer/123",
  product_id: "gid://shopify/Product/456",
  variant_id: "gid://shopify/ProductVariant/456",
  selling_plan_id: "gid://shopify/SellingPlan/789",
  customer_price: "42.50",
  status: "ACTIVE", // ACTIVE, PAUSED, CANCELLED, PENDING
  billing_attempts: [
    {
      attempt_id: "gid://shopify/SubscriptionBillingAttempt/1",
      order_id: "gid://shopify/Order/2",
      status: "SUCCESS",
      amount: "42.50",
      currency: "USD",
      timestamp: "2026-04-11T00:00:00Z"
    }
  ],
  next_billing_date: "2026-05-11T00:00:00Z",
  original_order_id: "gid://shopify/Order/1",
  orders: ["gid://shopify/Order/2", "gid://shopify/Order/3"], // All orders from subscription
  createdAt: "2026-03-11T00:00:00Z",
  updatedAt: "2026-04-11T00:00:00Z"
}
```

### **selling_plan_groups** Collection
```javascript
{
  _id: ObjectId,
  store: "shop.myshopify.com",
  selling_plan_group_id: "gid://shopify/SellingPlanGroup/1",
  name: "Subscribe & Save",
  description: "Customers can subscribe to save on every delivery",
  options: ["Delivery Frequency"],
  selling_plans: ["gid://shopify/SellingPlan/789"],
  attached_products: ["gid://shopify/Product/456"],
  createdAt: "2026-03-11T00:00:00Z",
  updatedAt: "2026-03-11T00:00:00Z"
}
```

### **selling_plans** Collection
```javascript
{
  _id: ObjectId,
  store: "shop.myshopify.com",
  selling_plan_id: "gid://shopify/SellingPlan/789",
  selling_plan_group_id: "gid://shopify/SellingPlanGroup/1",
  name: "Deliver every month",
  billingPolicy: {
    recurring: {
      interval: "MONTH",
      intervalCount: 1
    }
  },
  deliveryPolicy: {
    recurring: {
      interval: "MONTH",
      intervalCount: 1
    }
  },
  createdAt: "2026-03-11T00:00:00Z",
  updatedAt: "2026-03-11T00:00:00Z"
}
```

---

## AutoPay Magic: How Shopify Handles It

### **Payment Method Vaulting**
1. Customer enters payment info at checkout (first time only)
2. Shopify securely vaults the payment method
3. Customer never enters payment details again

### **Automatic Billing**
1. On billing date, Shopify attempts to charge the vaulted payment method
2. If successful → creates a new order, sends webhook
3. If failed → retries (configurable), sends webhook

### **Order Generation**
- Shopify creates a new order for each successful renewal
- Order appears in your dashboard automatically
- Can be fulfilled like normal orders

---

## Implementation Files

### Service Layer
- **`app/services/SubscriptionService.server.js`** - Main service handling all subscription operations
- **`app/models/Subscription.server.js`** - MongoDB models for subscriptions
- **`app/graphql/subscription-mutations.js`** - GraphQL operations

### Webhook Handlers
- **`app/routes/webhooks.subscription_contracts.create.jsx`** - When subscription starts
- **`app/routes/webhooks.subscription_contracts.update.jsx`** - When subscription status changes
- **`app/routes/webhooks.subscription_billing_attempts.success.jsx`** - When charge succeeds
- **`app/routes/webhooks.subscription_billing_attempts.failure.jsx`** - When charge fails

### API Routes
- **`app/routes/api.subscriptions.attach-product.jsx`** - Attach selling plan to products
- **`app/routes/api.subscriptions.get.jsx`** - Retrieve subscription data & analytics

### Utilities
- **`app/webhookUtils.server.js`** - Webhook processing utilities

---

## Usage Examples

### Initialize Subscribe & Save (Automatic on Install)
```javascript
import { initializeSubscribeSave } from "./services/SubscriptionService.server";

// Automatically called in afterAuth hook
await initializeSubscribeSave(admin, shop);
// Creates selling plan group and 3 default plans
```

### Attach Selling Plan to Products
```javascript
// Frontend: Call the API
const response = await fetch('/api/subscriptions/attach-product', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    productIds: ['gid://shopify/Product/123']
  })
});

const result = await response.json();
// Now product has "Subscribe & Save" option visible
```

### Get Subscription Analytics
```javascript
// Get store-wide analytics
const response = await fetch('/api/subscriptions/get?analytics=true');
const { data } = await response.json();

console.log(data);
// {
//   total_subscriptions: 15,
//   active: 12,
//   paused: 2,
//   cancelled: 1,
//   total_revenue: 1200.50,
//   successful_charges: 45,
//   failed_charges: 2,
//   failed_charge_rate: "4.26%"
// }
```

### Get Customer Subscriptions
```javascript
const customerId = 'gid://shopify/Customer/123';
const response = await fetch(`/api/subscriptions/get?customerId=${customerId}`);
const { data: subscriptions } = await response.json();

subscriptions.forEach(sub => {
  console.log(`${sub.id}`);
  console.log(`Status: ${sub.status}`);
  console.log(`Next Billing: ${sub.nextBillingDate}`);
  console.log(`Total Revenue: $${sub.totalRevenue}`);
});
```

---

## UI Integration

Update your `vip-purchase-options.liquid` to handle subscriptions:

```liquid
{% if customer %}
  <!-- Save selected selling plan to cart -->
  <form id="subscription-form">
    {% if purchase_type == "subscribe" %}
      <input type="hidden" name="selling_plan" value="{{ selling_plan_id }}">
    {% endif %}
  </form>
{% endif %}
```

JavaScript to pass selling plan ID to checkout:

```javascript
const sellingPlanId = 'gid://shopify/SellingPlan/789';
// Pass to Shopify's cart API
fetch('/cart/add.js', {
  method: 'POST',
  body: JSON.stringify({
    items: [{
      id: variantId,
      quantity: 1,
      selling_plan: sellingPlanId  // Shopify will handle subscription
    }]
  })
});
```

---

## Webhook Registration

Already set up in `app/shopify.server.js`:

```javascript
webhooks: {
  SUBSCRIPTION_CONTRACTS_CREATE: {
    deliveryMethod: "http",
    callbackUrl: "/webhooks/subscription_contracts/create",
  },
  SUBSCRIPTION_CONTRACTS_UPDATE: {
    deliveryMethod: "http",
    callbackUrl: "/webhooks/subscription_contracts/update",
  },
  SUBSCRIPTION_BILLING_ATTEMPTS_SUCCESS: {
    deliveryMethod: "http",
    callbackUrl: "/webhooks/subscription_billing_attempts/success",
  },
  SUBSCRIPTION_BILLING_ATTEMPTS_FAILURE: {
    deliveryMethod: "http",
    callbackUrl: "/webhooks/subscription_billing_attempts/failure",
  },
}
```

---

## Key Security & Best Practices

1. **HMAC Verification**: Shopify's `authenticate.webhook()` verifies that webhooks are from Shopify
2. **Idempotent Webhooks**: Each webhook includes an ID - use it to prevent duplicate processing
3. **Error Handling**: Failed webhooks should return 5xx to trigger Shopify retry
4. **Logging**: All webhook events are logged with timestamps for debugging
5. **Database Indexes**: Add indexes on `subscription_contract_id` and `customer_id` for performance

---

## Troubleshooting

### Subscriptions not showing on product
1. Check if `SUBSCRIPTION_CONTRACTS_CREATE` webhook is registered
2. Verify selling plan group ID matches in database
3. Check product is attached to plan group

### Charges not billing
1. Check `SUBSCRIPTION_BILLING_ATTEMPTS_*` webhooks
2. Verify customer's payment method is vaulted
3. Check MongoDB for billing attempt records

### Missing orders
1. Check `subscription_billing_attempts/success` webhook is firing
2. Verify order creation in webhook response
3. Check MongoDB `orders` array in subscription contract

---

## Next Steps

1. Test on development store
2. Add email notifications for subscription events
3. Create customer portal for managing subscriptions
4. Set up analytics dashboard
5. Add cancellation/pause UI for customers
