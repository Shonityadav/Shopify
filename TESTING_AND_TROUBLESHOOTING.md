# Subscribe & Save Testing & Troubleshooting Guide

## Pre-Launch Checklist

### 1. Webhook Registration
```bash
# Verify webhooks are registered in your Shopify app settings
curl https://your-shop.myshopify.com/admin/api/2025-10/webhooks.json \
  -H "X-Shopify-Access-Token: your-token" | jq '.webhooks[].topic' | grep -i subscription
```

Expected output:
```
subscription_contracts/create
subscription_contracts/update
subscription_billing_attempts/success
subscription_billing_attempts/failure
```

### 2. MongoDB Collections
```bash
# Verify collections exist and have indexes
mongo "mongodb+srv://..."
use your_database
db.selling_plan_groups.find().limit(1)
db.selling_plans.find().limit(1)
db.subscription_contracts.find().limit(1)
```

### 3. API Endpoints
```bash
# Test API availability
curl http://localhost:3000/api/subscriptions/get?analytics=true
curl http://localhost:3000/api/subscriptions/attach-product

# Should return 405 Method Not Allowed or proper JSON
```

---

## Common Issues & Solutions

### Issue 1: "Subscribe & Save" Not Appearing on Product

**Symptoms:**
- Product page doesn't show subscription options
- Customers can only buy one-time

**Diagnosis Steps:**
```bash
# 1. Check if selling plan group exists
mongo "mongodb+srv://..."
db.selling_plan_groups.find({ store: "your-shop.myshopify.com" })

# 2. Check if product is attached
db.selling_plan_groups.findOne().attached_products

# 3. Verify in Shopify Admin
# Go to Products > Select Product > Variants > Selling Plans section
```

**Solutions:**
```javascript
// Manually attach product if needed
fetch('/api/subscriptions/attach-product', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    productIds: ['gid://shopify/Product/YOUR_PRODUCT_ID']
  })
})
```

---

### Issue 2: Webhooks Not Firing

**Symptoms:**
- Subscription created but database not updated
- Console logs show webhook route not being called

**Diagnosis Steps:**
```bash
# 1. Check webhook attempts in Shopify
# Developer App > Webhooks > View Webhooks > Recent Events

# 2. Verify webhook routes exist
ls app/routes/webhooks.subscription*

# 3. Check webhook secret
echo $SHOPIFY_API_SECRET
# Should be set in .env
```

**Solutions:**
```bash
# 1. Ensure environment variables are set
SHOPIFY_API_KEY=your_key
SHOPIFY_API_SECRET=your_secret

# 2. Restart the dev server
npm run dev

# 3. Manually register webhooks
# Call shopify.registerWebhooks({ session }) in your code
```

---

### Issue 3: Subscription Created But No Orders Generated

**Symptoms:**
- Subscription shows in database
- But `orders` array is empty
- Invoice never sent to customer

**Diagnosis Steps:**
```bash
# 1. Check subscription contract in Shopify
curl https://your-shop.myshopify.com/admin/api/2025-10/subscription_contracts/ID.json \
  -H "X-Shopify-Access-Token: your-token" | jq '.subscription_contract'

# 2. Check if orders exist
jq '.orders' subscription_contracts_output.json

# 3. Check billing attempts
db.subscription_contracts.findOne()._id
db.subscription_contracts.findOne().billing_attempts
```

**Solutions:**
```javascript
// Sync orders from Shopify manually
const contractId = 'gid://shopify/SubscriptionContract/123';
const details = await fetchSubscriptionContractDetails(admin, contractId);

// Orders from Shopify won't auto-sync to MongoDB
// You need to record them in the billing attempt webhook
```

---

### Issue 4: Billing Attempts Failing

**Symptoms:**
- `subscription_billing_attempts/failure` webhook fires
- Customer not charged
- Error message in database

**Common Errors:**
```
"Card declined"
"Insufficient funds"
"Expired card"
"Authentication required"
```

**Solution:**
```javascript
// 1. Log failure details
db.subscription_contracts.findOne(
  { subscription_contract_id: "gid://shopify/SubscriptionContract/123" },
  { billing_attempts: { $slice: -1 } }
)

// 2. Check payment method
// Shopify automatically vaults, but payment method might expire
// Customer needs to update payment method in subscription management portal

// 3. Retry logic (Shopify handles this automatically, but you can notify)
// Send email to customer: "Payment failed, please update your card"
```

---

## Testing Checklist

### Test Case 1: Basic Subscription Creation
```
Steps:
1. Go to product page (with subscription enabled)
2. Select "Subscribe & Save" checkbox
3. Select delivery frequency (e.g., "Every month")
4. Add to cart and complete purchase

Expected Results:
✅ Webhook: subscription_contracts/create fires
✅ MongoDB: subscription_contracts collection has new record
✅ Status: "ACTIVE" or "PENDING"
✅ Customer receives order confirmation
```

### Test Case 2: Subscription Status Change
```
Steps:
1. In Shopify Admin, find the customer
2. View their subscriptions
3. Click "Pause" or "Cancel"
4. Save changes

Expected Results:
✅ Webhook: subscription_contracts/update fires
✅ MongoDB: status changes to "PAUSED" or "CANCELLED"
✅ Console: logs the status change
```

### Test Case 3: Automatic Billing
```
Steps (Development Store):
1. Create subscription
2. Wait for next billing date (or manually trigger in dev tools)
3. Shopify processes billing

Expected Results:
✅ Webhook: subscription_billing_attempts/success fires
✅ MongoDB: billing_attempts array updated with latest charge
✅ New order created in Orders section
✅ Customer receives order notification email
```

### Test Case 4: Failed Billing with Retry
```
Steps:
1. Create subscription with test card: "4000002500003155"
2. Wait for billing date
3. Provider will decline payment

Expected Results:
✅ Webhook: subscription_billing_attempts/failure fires
✅ MongoDB: billing_attempts shows failed status
✅ Error message logged
✅ Shopify retries automatically
```

### Test Case 5: Analytics Query
```
Steps:
1. Create 3-5 subscriptions
2. Success at least 1 billing attempt
3. Call analytics endpoint

Expected Results:
✅ GET /api/subscriptions/get?analytics=true returns:
  - total_subscriptions: count
  - active: count
  - successful_charges: total
  - failed_charges: count
  - failed_charge_rate: percentage
```

---

## Database Query Recipes

### Get All Active Subscriptions
```javascript
db.subscription_contracts.find({ 
  store: "your-shop.myshopify.com",
  status: "ACTIVE" 
}).pretty()
```

### Get Subscriptions by Customer
```javascript
db.subscription_contracts.find({
  store: "your-shop.myshopify.com",
  customer_id: "gid://shopify/Customer/123"
}).pretty()
```

### Get Failed Billing Attempts Last 7 Days
```javascript
const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

db.subscription_contracts.find({
  store: "your-shop.myshopify.com",
  "billing_attempts": {
    $elemMatch: {
      "status": "FAILURE",
      "timestamp": { $gte: sevenDaysAgo }
    }
  }
}).pretty()
```

### Get Revenue by Month
```javascript
db.subscription_contracts.aggregate([
  { $match: { store: "your-shop.myshopify.com" } },
  { $unwind: "$billing_attempts" },
  { $match: { "billing_attempts.status": "SUCCESS" } },
  {
    $group: {
      _id: {
        $dateToString: { 
          format: "%Y-%m", 
          date: "$billing_attempts.timestamp" 
        }
      },
      revenue: { $sum: { $toDouble: "$billing_attempts.amount" } },
      charges: { $sum: 1 }
    }
  },
  { $sort: { _id: -1 } }
]).pretty()
```

### Identify Problem Subscriptions
```javascript
db.subscription_contracts.find({
  store: "your-shop.myshopify.com",
  "billing_attempts": {
    $elemMatch: {
      "status": "FAILURE"
    }
  }
}).projection({
  subscription_contract_id: 1,
  customer_id: 1,
  status: 1,
  "billing_attempts": {
    $filter: {
      input: "$billing_attempts",
      as: "attempt",
      cond: { $eq: ["$$attempt.status", "FAILURE"] }
    }
  }
}).pretty()
```

---

## Webhook Debugging

### Enable Debug Logging
```bash
# Set in .env
DEBUG=true

# Now all webhook payloads are logged to console
```

### Expected Webhook Payloads

**subscription_contracts/create:**
```json
{
  "id": "gid://shopify/SubscriptionContract/1",
  "status": "ACTIVE",
  "customer": { "id": "gid://shopify/Customer/123" },
  "nextBillingDate": "2026-04-11T00:00:00Z"
}
```

**subscription_billing_attempts/success:**
```json
{
  "id": "gid://shopify/SubscriptionBillingAttempt/1",
  "subscriptionContractId": "gid://shopify/SubscriptionContract/1",
  "status": "SUCCESS",
  "order": {
    "id": "gid://shopify/Order/456",
    "totalPrice": {
      "amount": "42.50",
      "currencyCode": "USD"
    }
  }
}
```

---

## Performance Tuning

### Add MongoDB Indexes
```javascript
// Speed up lookups
db.subscription_contracts.createIndex({ store: 1, status: 1 })
db.subscription_contracts.createIndex({ customer_id: 1 })
db.subscription_contracts.createIndex({ subscription_contract_id: 1 })
db.selling_plan_groups.createIndex({ store: 1 })

// Check indexes
db.subscription_contracts.getIndexes()
```

### Cache Selling Plans (Optional)
```javascript
// Instead of querying DB every time, cache in memory
const SELLING_PLANS_CACHE = new Map();

export async function getCachedSellingPlans(shop, ttl = 3600000) {
  if (SELLING_PLANS_CACHE.has(shop)) {
    const cached = SELLING_PLANS_CACHE.get(shop);
    if (Date.now() - cached.timestamp < ttl) {
      return cached.plans;
    }
  }
  
  const plans = await getSellingPlansByGroup(shop);
  SELLING_PLANS_CACHE.set(shop, { plans, timestamp: Date.now() });
  return plans;
}
```

---

## Production Deployment Checklist

- [ ] Environment variables set: `SHOPIFY_API_KEY`, `SHOPIFY_API_SECRET`
- [ ] MongoDB connection string configured
- [ ] Webhooks registered and tested
- [ ] SSL certificate is valid
- [ ] Error monitoring configured (Sentry, etc.)
- [ ] Database backups enabled
- [ ] Rate limiting configured
- [ ] CORS headers properly set
- [ ] Logging service configured
- [ ] Customer support team trained
- [ ] Rollback plan documented

---

## Monitoring & Alerts

### Metrics to Monitor
1. **Subscription Creation Rate**: New subscriptions per day
2. **Active Subscription Count**: Total active subscriptions
3. **Successful Billing Rate**: % of successful charges
4. **Average Subscription Value**: Revenue per subscription
5. **Webhook Latency**: Time to process webhooks
6. **Database Query Performance**: Slow query log

### Alert Conditions
1. More than 10% billing failures in an hour
2. Webhook queue backup (>1000 pending)
3. Database response time > 500ms
4. API error rate > 1%
5. Zero new subscriptions in 24 hours

---

## Support Resources

- [Shopify Subscriptions API Docs](https://shopify.dev/api/admin-rest/2025-10/resources/subscriptioncontract)
- [Selling Plans API](https://shopify.dev/api/admin-graphql/2025-10/objects/SellingPlanGroup)
- [Webhook Reference](https://shopify.dev/api/admin-rest/2025-10/resources/webhook)

---

## Next Steps

1. ✅ Test all webhook scenarios
2. ✅ Verify database indexing
3. ✅ Configure error monitoring
4. ✅ Set up analytics dashboard
5. ✅ Create customer support documentation
6. ✅ Deploy to production
