import { connectToDatabase } from "../mongodb.server";

/**
 * Create a subscription contract record in MongoDB
 */
export async function createSubscriptionContract(data) {
  const db = await connectToDatabase();

  return db.collection("subscription_contracts").insertOne({
    store: data.store,
    subscription_contract_id: data.subscription_contract_id,
    customer_id: data.customer_id,
    product_id: data.product_id,
    variant_id: data.variant_id,
    selling_plan_id: data.selling_plan_id,
    billing_policy: data.billing_policy || null,
    delivery_policy: data.delivery_policy || null,
    customer_price: data.customer_price,
    status: data.status || "ACTIVE", // ACTIVE, PAUSED, CANCELLED, PENDING
    billing_attempts: [],
    next_billing_date: data.next_billing_date,
    original_order_id: data.original_order_id,
    orders: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

/**
 * Get subscription contract by ID
 */
export async function getSubscriptionContract(store, subscription_contract_id) {
  const db = await connectToDatabase();
  return db.collection("subscription_contracts").findOne({
    store,
    subscription_contract_id,
  });
}

/**
 * Get all subscription contracts for a customer
 */
export async function getCustomerSubscriptions(store, customer_id) {
  const db = await connectToDatabase();
  return db
    .collection("subscription_contracts")
    .find({ store, customer_id })
    .toArray();
}

/**
 * Get all subscription contracts for a shop
 */
export async function getShopSubscriptions(store) {
  const db = await connectToDatabase();
  return db.collection("subscription_contracts").find({ store }).toArray();
}

/**
 * Update subscription contract status
 */
export async function updateSubscriptionStatus(
  store,
  subscription_contract_id,
  status
) {
  const db = await connectToDatabase();

  return db.collection("subscription_contracts").updateOne(
    { store, subscription_contract_id },
    {
      $set: {
        status,
        updatedAt: new Date(),
      },
    }
  );
}

/**
 * Add billing attempt record to subscription
 */
export async function addBillingAttempt(
  store,
  subscription_contract_id,
  attempt
) {
  const db = await connectToDatabase();

  return db.collection("subscription_contracts").updateOne(
    { store, subscription_contract_id },
    {
      $push: {
        billing_attempts: {
          attempt_id: attempt.attempt_id,
          order_id: attempt.order_id,
          status: attempt.status,
          error_message: attempt.error_message || null,
          amount: attempt.amount,
          currency: attempt.currency,
          timestamp: new Date(attempt.timestamp),
        },
      },
      $set: {
        updatedAt: new Date(),
        ...(attempt.status === "SUCCESS" && {
          next_billing_date: attempt.next_billing_date,
        }),
      },
    }
  );
}

/**
 * Add order to subscription's orders array
 */
export async function addOrderToSubscription(
  store,
  subscription_contract_id,
  order_id
) {
  const db = await connectToDatabase();

  return db.collection("subscription_contracts").updateOne(
    { store, subscription_contract_id },
    {
      $push: {
        orders: order_id,
      },
      $set: {
        updatedAt: new Date(),
      },
    }
  );
}

/**
 * Create selling plan group record
 */
export async function createSellingPlanGroupRecord(data) {
  const db = await connectToDatabase();

  return db.collection("selling_plan_groups").insertOne({
    store: data.store,
    selling_plan_group_id: data.selling_plan_group_id,
    name: data.name,
    description: data.description || null,
    options: data.options || [],
    selling_plans: data.selling_plans || [],
    attached_products: data.attached_products || [],
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

/**
 * Get selling plan group by ID
 */
export async function getSellingPlanGroup(store, selling_plan_group_id) {
  const db = await connectToDatabase();

  return db.collection("selling_plan_groups").findOne({
    store,
    selling_plan_group_id,
  });
}

/**
 * Get all selling plan groups for a shop
 */
export async function getSellingPlanGroups(store) {
  const db = await connectToDatabase();
  return db.collection("selling_plan_groups").find({ store }).toArray();
}

/**
 * Update selling plan group - add product
 */
export async function addProductToSellingPlanGroup(
  store,
  selling_plan_group_id,
  product_id
) {
  const db = await connectToDatabase();

  return db.collection("selling_plan_groups").updateOne(
    { store, selling_plan_group_id },
    {
      $addToSet: {
        attached_products: product_id,
      },
      $set: {
        updatedAt: new Date(),
      },
    }
  );
}

/**
 * Add selling plan to group
 */
export async function addSellingPlanToGroup(
  store,
  selling_plan_group_id,
  selling_plan_id
) {
  const db = await connectToDatabase();

  return db.collection("selling_plan_groups").updateOne(
    { store, selling_plan_group_id },
    {
      $addToSet: {
        selling_plans: selling_plan_id,
      },
      $set: {
        updatedAt: new Date(),
      },
    }
  );
}

/**
 * Create selling plan record
 */
export async function createSellingPlanRecord(data) {
  const db = await connectToDatabase();

  /* -----------------------------
     INSERT PLAN
  ----------------------------- */

  await db.collection("selling_plans").insertOne({
    store: data.store,
    selling_plan_id: data.selling_plan_id,
    selling_plan_group_id: data.selling_plan_group_id,
    name: data.name,
    description: data.description || null,
    billingPolicy: data.billingPolicy,
    deliveryPolicy: data.deliveryPolicy,
    status: data.status || "ACTIVE",
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  /* -----------------------------
     ADD PLAN TO GROUP
  ----------------------------- */

  await db.collection("selling_plan_groups").updateOne(
    {
      store: data.store,
      selling_plan_group_id: data.selling_plan_group_id,
    },
    {
      $addToSet: {
        selling_plans: data.selling_plan_id,
      },
      $set: {
        updatedAt: new Date(),
      },
    }
  );

  return true;
}
/**
 * Get selling plan by ID
 */
export async function getSellingPlan(store, selling_plan_id) {
  const db = await connectToDatabase();

  return db.collection("selling_plans").findOne({
    store,
    selling_plan_id,
  });
}

/**
 * Get selling plans by group
 */
export async function getSellingPlansByGroup(store, selling_plan_group_id) {
  const db = await connectToDatabase();

  return db
    .collection("selling_plans")
    .find({ store, selling_plan_group_id })
    .toArray();
}

/**
 * Get ACTIVE selling plans by group
 */
export async function getActiveSellingPlansByGroup(
  store,
  selling_plan_group_id
) {
  const db = await connectToDatabase();

  return db
    .collection("selling_plans")
    .find({
      store,
      selling_plan_group_id,
      status: "ACTIVE",
    })
    .toArray();
}

/**
 * Update selling plan interval
 */
export async function updateSellingPlanRecord(
  store,
  selling_plan_id,
  intervalCount
) {
  const db = await connectToDatabase();

  return db.collection("selling_plans").updateOne(
    {
      store,
      selling_plan_id,
      status: { $ne: "ARCHIVED" },
    },
    {
      $set: {
        "billingPolicy.recurring.intervalCount": parseInt(intervalCount),
        "deliveryPolicy.recurring.intervalCount": parseInt(intervalCount),
        updatedAt: new Date(),
      },
    }
  );
}

/**
 * Update selling plan status
 */
export async function updateSellingPlanStatus(
  store,
  selling_plan_id,
  status
) {
  const db = await connectToDatabase();

  return db.collection("selling_plans").updateOne(
    { store, selling_plan_id },
    {
      $set: {
        status,
        updatedAt: new Date(),
      },
    }
  );
}

/**
 * Archive selling plan
 */
export async function archiveSellingPlan(store, selling_plan_id) {
  return updateSellingPlanStatus(store, selling_plan_id, "ARCHIVED");
}

/**
 * Activate selling plan
 */
export async function activateSellingPlan(store, selling_plan_id) {
  return updateSellingPlanStatus(store, selling_plan_id, "ACTIVE");
}