/**
 * INTEGRATION GUIDE: Subscribe & Save with Your Purchase Options UI
 * 
 * This file shows how to integrate the subscription feature with your
 * vip-purchase-options.liquid block to enable AutoPay subscriptions.
 */

/** ============================================================
 * STEP 1: Update vip-purchase-options.liquid
 * ============================================================
 * 
 * Modify the existing purchase options block to include:
 * 1. Store selling plan information on Shopify
 * 2. Pass selling plan ID to the purchase handler
 * 3. Show subscription pricing
 * 
 * Add this data attribute to your form:
 */

// Current structure in vip-purchase-options.liquid:
// <form id="vip-form">
//   <!-- Purchase type radio buttons -->
//   <input type="radio" name="purchase_type" value="regular">
//   <input type="radio" name="purchase_type" value="vip">
//   
//   <!-- Subscription checkbox -->
//   <input type="checkbox" name="purchase_option" value="subscribe">
//   
//   <!-- ADD THESE HIDDEN INPUTS: -->
//   <input type="hidden" id="selling_plan_id" name="selling_plan">
//   <input type="hidden" id="is_subscription" name="subscription">
// </form>

/** ============================================================
 * STEP 2: Enhanced JavaScript for Purchase Options
 * ============================================================
 */

const SubscriptionIntegration = {
  /**
   * Initialize subscription UI
   * Call this after DOM loads
   */
  init: async function() {
    console.log("🔄 Initializing subscription integration...");
    
    // Fetch available selling plans
    const plans = await this.fetchSellingPlans();
    
    if (!plans || plans.length === 0) {
      console.log("⚠️ No selling plans available");
      return;
    }
    
    // Store subscription data on form
    this.setupSubscriptionData(plans);
    
    // Handle subscription selection
    this.setupEventListeners();
    
    console.log("✅ Subscription integration ready");
  },

  /**
   * Fetch available selling plans from server
   */
  fetchSellingPlans: async function() {
    try {
      // Query Shopify store for selling plans
      // This would be implemented server-side in your app
      const response = await fetch('/api/selling-plans');
      
      if (!response.ok) {
        throw new Error('Failed to fetch selling plans');
      }
      
      const { plans } = await response.json();
      return plans;
    } catch (error) {
      console.error('❌ Error fetching selling plans:', error);
      return null;
    }
  },

  /**
   * Setup subscription data on form
   */
  setupSubscriptionData: function(plans) {
    const form = document.getElementById('vip-form');
    if (!form) return;

    // Add subscription frequency options
    const subscriptionOption = form.querySelector('.subscribe-option');
    if (subscriptionOption && plans.length > 0) {
      // Store default plan ID (first plan)
      const defaultPlan = plans[0];
      const planIdInput = form.querySelector('#selling_plan_id');
      if (planIdInput) {
        planIdInput.value = defaultPlan.id;
        planIdInput.dataset.defaultLabel = defaultPlan.name;
      }

      // Add frequency selector
      this.addFrequencySelector(subscriptionOption, plans);
    }
  },

  /**
   * Add frequency selector dropdown
   */
  addFrequencySelector: function(container, plans) {
    const selector = document.createElement('select');
    selector.id = 'subscription-frequency';
    selector.name = 'subscription_frequency';
    selector.className = 'subscription-frequency-select';
    selector.style.marginTop = '12px';

    const label = document.createElement('label');
    label.textContent = 'Select delivery frequency:';
    label.style.display = 'block';
    label.style.marginBottom = '8px';
    label.style.fontSize = '13px';
    label.style.color = '#666';

    plans.forEach((plan) => {
      const option = document.createElement('option');
      option.value = plan.id;
      option.text = plan.name;
      selector.appendChild(option);
    });

    selector.addEventListener('change', (e) => {
      const selectedPlan = plans.find(p => p.id === e.target.value);
      const planIdInput = document.getElementById('selling_plan_id');
      if (planIdInput) {
        planIdInput.value = selectedPlan.id;
      }
      console.log('✅ Selling plan selected:', selectedPlan.name);
    });

    container.appendChild(label);
    container.appendChild(selector);
  },

  /**
   * Setup event listeners for form submission
   */
  setupEventListeners: function() {
    const form = document.getElementById('vip-form');
    if (!form) return;

    form.addEventListener('submit', (e) => {
      const subscriptionCheckbox = form.querySelector('input[name="purchase_option"]');
      const isSubscription = subscriptionCheckbox?.checked || false;

      if (isSubscription) {
        e.preventDefault();
        this.handleSubscriptionPurchase(form);
      }
    });

    // Update form data when subscription is toggled
    const subscriptionCheckbox = form.querySelector('input[name="purchase_option"]');
    if (subscriptionCheckbox) {
      subscriptionCheckbox.addEventListener('change', (e) => {
        const subscriptionInput = form.querySelector('#is_subscription');
        if (subscriptionInput) {
          subscriptionInput.value = e.target.checked ? 'true' : 'false';
        }
      });
    }
  },

  /**
   * Handle subscription purchase
   * This adds the product with selling plan to cart
   */
  handleSubscriptionPurchase: async function(form) {
    try {
      console.log("🛒 Processing subscription purchase...");

      // Get form data
      const formData = new FormData(form);
      const variantId = formData.get('variant_id'); // You need to add this to your form
      const sellingPlanId = formData.get('selling_plan');
      const quantity = parseInt(formData.get('quantity') || 1);

      if (!variantId || !sellingPlanId) {
        throw new Error('Missing required purchase information');
      }

      console.log("📦 Adding to cart:");
      console.log("   Variant:", variantId);
      console.log("   Selling Plan:", sellingPlanId);
      console.log("   Quantity:", quantity);

      // Add to cart with selling plan
      const response = await fetch('/cart/add.js', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest'
        },
        body: JSON.stringify({
          items: [
            {
              id: variantId,
              quantity: quantity,
              selling_plan: sellingPlanId  // Shopify handles subscription
            }
          ]
        })
      });

      if (!response.ok) {
        throw new Error('Failed to add to cart');
      }

      const cart = await response.json();
      console.log("✅ Added to cart with subscription");

      // Redirect to checkout
      window.location.href = '/checkout';

    } catch (error) {
      console.error("❌ Error processing subscription:", error);
      alert('Error adding subscription to cart. Please try again.');
    }
  }
};

/** ============================================================
 * STEP 3: Initialize on Page Load
 * ============================================================
 */

document.addEventListener('DOMContentLoaded', () => {
  SubscriptionIntegration.init();
});

/** ============================================================
 * STEP 4: Data Attributes to Add to vip-purchase-options.liquid
 * ============================================================
 * 
 * Add these to your purchase option inputs:
 * 
 * <form id="vip-form" data-store="{{ shop.url }}">
 *   <!-- Hidden inputs for subscription data -->
 *   <input type="hidden" id="variant_id" name="variant_id" value="{{ product.selected_or_first_available_variant.id }}">
 *   <input type="hidden" id="selling_plan_id" name="selling_plan" value="">
 *   <input type="hidden" id="is_subscription" name="subscription" value="false">
 *   <input type="hidden" id="quantity" name="quantity" value="1">
 * </form>
 */

/** ============================================================
 * STEP 5: GraphQL Mutation for Attaching to Product
 * ============================================================
 * 
 * When you want to enable Subscribe & Save for a product:
 * 
 * fetch('/api/subscriptions/attach-product', {
 *   method: 'POST',
 *   headers: { 'Content-Type': 'application/json' },
 *   body: JSON.stringify({
 *     productIds: [
 *       'gid://shopify/Product/123',
 *       'gid://shopify/Product/456'
 *     ]
 *   })
 * })
 * .then(r => r.json())
 * .then(data => {
 *   console.log(`✅ Selling plan attached to ${data.productsAttached} products`);
 * });
 */

/** ============================================================
 * STEP 6: Flow Diagram
 * ============================================================
 * 
 * Customer Journey:
 * 
 * 1. Customer views product page
 *    └─> vip-purchase-options.liquid rendered
 * 
 * 2. SubscriptionIntegration.init() called
 *    └─> Fetches available selling plans
 *    └─> Displays subscription frequency options
 * 
 * 3. Customer selects:
 *    ├─ "One time buy" (radio) OR "VIP membership" (radio)
 *    └─ Optionally checks "Subscribe & Save" (checkbox)
 * 
 * 4. Customer clicks "Add to Cart"
 * 
 * 5. If subscription selected:
 *    ├─ Collect selling plan ID
 *    ├─ Add to cart with selling_plan parameter
 *    └─ Redirect to checkout
 * 
 * 6. At checkout, Shopify:
 *    ├─ Shows subscription details
 *    ├─ Collects payment method (automatically vaulted)
 *    └─ Creates subscription contract
 * 
 * 7. Webhooks trigger:
 *    ├─ subscription_contracts/create
 *    ├─ orders/create (for initial order)
 *    └─> Your app records subscription
 * 
 * 8. Future billing cycles:
 *    ├─ Shopify automatically charges vaulted payment method
 *    ├─ Creates renewal order automatically
 *    └─> subscription_billing_attempts/success webhook
 */

/** ============================================================
 * STEP 7: Testing in Development
 * ============================================================
 * 
 * 1. Install app on development store
 *    └─> afterAuth hook creates selling plan group
 *    └─> Verify in MongoDB: db.selling_plan_groups.find()
 * 
 * 2. Attach product to selling plan:
 *    curl -X POST http://localhost:3000/api/subscriptions/attach-product \
 *      -H "Content-Type: application/json" \
 *      -d '{"productIds":["gid://shopify/Product/123"]}'
 * 
 * 3. View product on Shopify store
 *    └─> Should see subscription options
 * 
 * 4. Complete test purchase with subscription
 *    └─> Webhook received
 *    └─> subscription_contracts/create logged
 *    └─> Record in MongoDB
 * 
 * 5. Mock billing cycle (dev store):
 *    └─> Check MongoDB for billing_attempts
 *    └─> Verify order was created
 */

export { SubscriptionIntegration };
