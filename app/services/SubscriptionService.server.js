/**
 * SubscriptionService.server.js
 * Manages Shopify selling plans, subscription contracts, and billing
 */

import {
  createSellingPlanGroupRecord,
  getSellingPlanGroups,
  createSellingPlanRecord,
  getShopSubscriptions,
  createSubscriptionContract,
  updateSubscriptionStatus,
  addBillingAttempt,
  updateSellingPlanRecord,
  getSellingPlan,
  updateSellingPlanStatus,
  getSellingPlansByGroup,
} from "../models/Subscription.server";

import {
  getCreateSellingPlanGroupMutation,
  getCreateSellingPlanMutation,
  getSubscriptionContractsQuery,
  getSingleSubscriptionContractQuery,
  getUpdateSellingPlanMutation,
} from "../graphql/subscription-mutations";

/* -------------------------------------------------------------
   METAFIELD HELPER
------------------------------------------------------------- */


export async function attachSellingPlanToProducts(admin, store, productIds) {
  try {

    console.log("Attaching selling plan group to products");

    const groups = await getSellingPlanGroups(store);

    if (!groups.length) {
      throw new Error("No selling plan group found");
    }

    const groupId = groups[0].selling_plan_group_id;

    const mutation = `
      mutation addProducts($id: ID!, $productIds: [ID!]!) {
        sellingPlanGroupAddProducts(
          id: $id
          productIds: $productIds
        ) {
          userErrors {
            field
            message
          }
        }
      }
    `;

    const response = await admin.graphql(mutation, {
      variables: {
        id: groupId,
        productIds
      }
    });

    const data = await response.json();

    if (data.errors) {
      throw new Error(JSON.stringify(data.errors));
    }

    if (data.data?.sellingPlanGroupAddProducts?.userErrors?.length) {
      console.log(data.data.sellingPlanGroupAddProducts.userErrors);
    }

    console.log("✅ Selling plan attached to products");

  } catch (error) {

    console.error("❌ Error attaching selling plan:", error);

  }
}

async function setSubscribePlanMetafield(admin, firstPlanId) {
  if (!firstPlanId) return;

  const shopIdResponse = await admin.graphql(`query { shop { id } }`);
  const shopIdData = await shopIdResponse.json();
  const shopId = shopIdData?.data?.shop?.id;

  if (!shopId) {
    throw new Error("Unable to resolve Shop ID for metafieldsSet");
  }

  const metafieldsSetResponse = await admin.graphql(
    `mutation MetafieldsSet($metafields: [MetafieldsSetInput!]!) {
      metafieldsSet(metafields: $metafields) {
        userErrors {
          field
          message
        }
      }
    }`,
    {
      variables: {
        metafields: [
          {
            namespace: "$app:vip",
            key: "subscribe_plan_id",
            type: "single_line_text_field",
            value: firstPlanId,
            ownerId: shopId,
          },
        ],
      },
    }
  );

  const metafieldsSetData = await metafieldsSetResponse.json();
  const userErrors =
    metafieldsSetData?.data?.metafieldsSet?.userErrors || [];

  if (userErrors.length > 0) {
    throw new Error(
      `metafieldsSet userErrors: ${JSON.stringify(userErrors)}`
    );
  }

  console.log("✅ Active subscription plan stored in metafield");
}

/* -------------------------------------------------------------
   INITIALIZE SUBSCRIBE & SAVE
------------------------------------------------------------- */

export async function initializeSubscribeSave(admin, store) {
  try {
    console.log("🔄 Initializing Subscribe & Save for store:", store);

    const existingGroups = await getSellingPlanGroups(store);

    if (existingGroups.length > 0) {
      console.log("✅ Already initialized");

      // OPTIONAL: sanity check
      const plans = await getSellingPlansByGroup(
        store,
        existingGroups[0].selling_plan_group_id
      );

      const hasActivePlan = plans.some(p => p.status === "ACTIVE");

      if (!hasActivePlan) {
        console.log("ℹ️ No active plan — system idle (correct state)");
      }

      return existingGroups[0];
    }

    /* -----------------------------
       CREATE SELLING PLAN GROUP
    ----------------------------- */

    const groupMutation = getCreateSellingPlanGroupMutation();

    const groupResponse = await admin.graphql(groupMutation, {
      variables: {
        name: "Subscribe & Save",
      },
    });

    const groupData = await groupResponse.json();

    const group =
      groupData.data?.sellingPlanGroupCreate?.sellingPlanGroup;

    const groupId = group?.id;

    const firstPlanId =
      group?.sellingPlans?.nodes?.[0]?.id;

    if (!groupId) {
      throw new Error("No selling plan group ID returned");
    }

    console.log("✅ Selling plan group created:", groupId);

    /* -----------------------------
       SAVE GROUP IN DATABASE
    ----------------------------- */

    await createSellingPlanGroupRecord({
      store,
      selling_plan_group_id: groupId,
      name: "Subscribe & Save",
      description:
        "Customers can subscribe to save on every delivery",
      options: ["Delivery Frequency"],
    });

    if (firstPlanId) {
      await setSubscribePlanMetafield(admin, firstPlanId);
    }

    /* -----------------------------
       CREATE DEFAULT PLANS
    ----------------------------- */

    const plans = [
      {
        name: "Deliver every 2 months",
        interval: "MONTH",
        intervalCount: 2,
      },
      {
        name: "Deliver every 3 months",
        interval: "MONTH",
        intervalCount: 3,
      },
    ];

    for (const plan of plans) {
      const planMutation = getCreateSellingPlanMutation();

      const planResponse = await admin.graphql(planMutation, {
        variables: {
          sellingPlanGroupId: groupId,
          name: plan.name,
          description: `Subscribe and get deliveries ${plan.name.toLowerCase()} with discount`,
          billingPolicy: {
            recurring: {
              interval: plan.interval,
              intervalCount: plan.intervalCount,
            },
          },
          deliveryPolicy: {
            recurring: {
              interval: plan.interval,
              intervalCount: plan.intervalCount,
            },
          },
        },
      });

      const planData = await planResponse.json();

      const planId =
        planData.data?.sellingPlanCreate?.sellingPlan?.id;

      if (planId) {
        await createSellingPlanRecord({
          store,
          selling_plan_id: planId,
          selling_plan_group_id: groupId,
          name: plan.name,
          billingPolicy: {
            recurring: {
              interval: plan.interval,
              intervalCount: plan.intervalCount,
            },
          },
          deliveryPolicy: {
            recurring: {
              interval: plan.interval,
              intervalCount: plan.intervalCount,
            },
          },
          status: "ACTIVE",
        });

        console.log(`✅ Selling plan created: ${plan.name}`);
      }
    }

    console.log("✅ Subscribe & Save initialized successfully");

    return { id: groupId, name: "Subscribe & Save" };
  } catch (error) {
    console.error("❌ Error initializing Subscribe & Save:", error);
    throw error;
  }
}

/* -------------------------------------------------------------
   CREATE NEW SELLING PLAN
------------------------------------------------------------- */

export async function createNewSellingPlan(
  admin,
  store,
  groupId,
  name,
  intervalCount
) {
  try {

    /* -----------------------------
       ARCHIVE ALL EXISTING PLANS
    ----------------------------- */

    const existingPlans = await getSellingPlansByGroup(store, groupId);

    for (const plan of existingPlans) {
      await updateSellingPlanStatus(
        store,
        plan.selling_plan_id,
        "ARCHIVED"
      );
    }

    console.log("📦 Existing plans archived");


    /* -----------------------------
       CREATE PLAN IN SHOPIFY
    ----------------------------- */

    const mutation = `
      mutation CreateSellingPlan($id: ID!, $input: SellingPlanGroupInput!) {
        sellingPlanGroupUpdate(id: $id, input: $input) {
          sellingPlanGroup {
            id
            sellingPlans(first: 20) {
              nodes {
                id
                name
              }
            }
          }
          userErrors {
            field
            message
          }
        }
      }
    `;

    const response = await admin.graphql(mutation, {
      variables: {
        id: groupId,
        input: {
          sellingPlansToCreate: [
            {
              name,
              category: "SUBSCRIPTION",
              options: [name],
              billingPolicy: {
                recurring: {
                  interval: "MONTH",
                  intervalCount: parseInt(intervalCount)
                }
              },
              deliveryPolicy: {
                recurring: {
                  interval: "MONTH",
                  intervalCount: parseInt(intervalCount)
                }
              }
            }
          ]
        }
      }
    });

    const data = await response.json();

    if (data.errors) {
      throw new Error(JSON.stringify(data.errors));
    }

    if (data.data?.sellingPlanGroupUpdate?.userErrors?.length) {
      throw new Error(
        JSON.stringify(data.data.sellingPlanGroupUpdate.userErrors)
      );
    }

    const plans =
      data.data.sellingPlanGroupUpdate.sellingPlanGroup.sellingPlans.nodes;

    const newPlan = plans[plans.length - 1];

    console.log("✅ Shopify plan created:", newPlan.id);


    /* -----------------------------
       SAVE PLAN IN DATABASE
    ----------------------------- */

    await createSellingPlanRecord({
      store,
      selling_plan_id: newPlan.id,
      selling_plan_group_id: groupId,
      name,
      status: "ACTIVE",
      billingPolicy: {
        recurring: {
          interval: "MONTH",
          intervalCount: parseInt(intervalCount)
        }
      },
      deliveryPolicy: {
        recurring: {
          interval: "MONTH",
          intervalCount: parseInt(intervalCount)
        }
      }
    });

    console.log("✅ Selling plan saved in DB");


    /* -----------------------------
       UPDATE METAFIELD
    ----------------------------- */

    const shopIdResponse = await admin.graphql(`query { shop { id } }`);
    const shopIdData = await shopIdResponse.json();
    const shopId = shopIdData.data.shop.id;

    await admin.graphql(
      `
      mutation MetafieldsSet($metafields:[MetafieldsSetInput!]!){
        metafieldsSet(metafields:$metafields){
          userErrors{ field message }
        }
      }
      `,
      {
        variables: {
          metafields: [
            {
              namespace: "$app:vip",
              key: "subscribe_plan_id",
              type: "single_line_text_field",
              value: newPlan.id,
              ownerId: shopId,
            },
          ],
        },
      }
    );

    console.log("✅ Metafield updated to new active plan");

    return newPlan;

  } catch (error) {

    console.error("❌ Error creating selling plan:", error);

    throw error;

  }
}
/* -------------------------------------------------------------
   ACTIVATE PLAN
------------------------------------------------------------- */

export async function activateSellingPlan(
  admin,
  store,
  sellingPlanId
) {
  try {

    const plan = await getSellingPlan(store, sellingPlanId);

    if (!plan) {
      throw new Error("Selling plan not found");
    }

    /* -----------------------------
       ARCHIVE ALL OTHER PLANS
    ----------------------------- */

    const allPlans = await getSellingPlansByGroup(
      store,
      plan.selling_plan_group_id
    );

    for (const p of allPlans) {

      const newStatus =
        p.selling_plan_id === sellingPlanId
          ? "ACTIVE"
          : "ARCHIVED";

      await updateSellingPlanStatus(
        store,
        p.selling_plan_id,
        newStatus
      );

    }

    const productIds = await getAllProductIds(admin);

    await attachSellingPlanToProducts(admin, store, productIds);

    console.log("✅ Products attached to active plan");

    /* -----------------------------
       UPDATE METAFIELD
    ----------------------------- */

    const shopIdResponse = await admin.graphql(`query { shop { id } }`);
    const shopIdData = await shopIdResponse.json();
    const shopId = shopIdData.data.shop.id;

    await admin.graphql(
      `
      mutation MetafieldsSet($metafields:[MetafieldsSetInput!]!){
        metafieldsSet(metafields:$metafields){
          userErrors{ field message }
        }
      }
      `,
      {
        variables: {
          metafields: [
            {
              namespace: "$app:vip",
              key: "subscribe_plan_id",
              type: "single_line_text_field",
              value: sellingPlanId,
              ownerId: shopId,
            },
          ],
        },
      }
    );

    console.log("✅ Plan activated and all others archived");

    return true;

  } catch (error) {

    console.error("❌ Error activating plan:", error);

    throw error;

  }
}
/* -------------------------------------------------------------
   ARCHIVE PLAN
------------------------------------------------------------- */

export async function archiveSellingPlan(admin, store, sellingPlanId) {
  try {

    /* -----------------------------
       ARCHIVE PLAN IN DB
    ----------------------------- */

    await updateSellingPlanStatus(store, sellingPlanId, "ARCHIVED");

    console.log("📦 Selling plan archived");

    /* -----------------------------
       GET GROUP + CHECK ACTIVE PLANS
    ----------------------------- */

    const plan = await getSellingPlan(store, sellingPlanId);

    const groupId = plan?.selling_plan_group_id;

    if (!groupId) return true;

    const plans = await getSellingPlansByGroup(store, groupId);

    const activePlan = plans.find(p => p.status === "ACTIVE");

    /* -----------------------------
       GET METAFIELD ID
    ----------------------------- */

    const metafieldQuery = await admin.graphql(`
      query {
        shop {
          metafield(namespace: "$app:vip", key: "subscribe_plan_id") {
            id
          }
        }
      }
    `);

    const metafieldData = await metafieldQuery.json();

    const metafieldId = metafieldData?.data?.shop?.metafield?.id;

    /* -----------------------------
       CASE 1: NO ACTIVE PLAN → DELETE METAFIELD
    ----------------------------- */

    if (!activePlan && metafieldId) {

      const shopRes = await admin.graphql(`query { shop { id } }`);
      const shopData = await shopRes.json();
      const shopId = shopData.data.shop.id;

      const productIds = await getAllProductIds(admin);

      await detachSellingPlanFromProducts(admin, groupId, productIds);

      await admin.graphql(
        `mutation metafieldsDelete($metafields: [MetafieldIdentifierInput!]!) {
          metafieldsDelete(metafields: $metafields) {
            deletedMetafields {
              key
              namespace
              ownerId
            }
            userErrors {
              field
              message
            }
          }
        }`,
        {
          variables: {
            metafields: [
              {
                ownerId: shopId,
                namespace: "$app:vip",
                key: "subscribe_plan_id",
              },
            ],
          },
        }
      );

      console.log("🧹 Metafield deleted (no active plans)");

    }

    /* -----------------------------
       CASE 2: HAS ACTIVE PLAN → UPDATE METAFIELD
    ----------------------------- */

    if (activePlan) {

      const shopRes = await admin.graphql(`query { shop { id } }`);
      const shopData = await shopRes.json();

      await admin.graphql(
        `mutation MetafieldsSet($metafields: [MetafieldsSetInput!]!) {
          metafieldsSet(metafields: $metafields) {
            userErrors { field message }
          }
        }`,
        {
          variables: {
            metafields: [{
              namespace: "$app:vip",
              key: "subscribe_plan_id",
              type: "single_line_text_field",
              value: activePlan.selling_plan_id,
              ownerId: shopData.data.shop.id
            }]
          }
        }
      );

      console.log("🔄 Metafield switched to active plan");

    }

    return true;

  } catch (error) {

    console.error("❌ Error archiving selling plan:", error);

    throw error;

  }
}

async function getAllProductIds(admin) {
  let hasNextPage = true;
  let cursor = null;
  const productIds = [];

  while (hasNextPage) {
    const res = await admin.graphql(
      `query ($cursor: String) {
        products(first: 50, after: $cursor) {
          edges {
            cursor
            node { id }
          }
          pageInfo { hasNextPage }
        }
      }`,
      { variables: { cursor } }
    );

    const data = await res.json();
    const edges = data.data.products.edges;

    edges.forEach(e => productIds.push(e.node.id));

    hasNextPage = data.data.products.pageInfo.hasNextPage;
    cursor = edges.length ? edges[edges.length - 1].cursor : null;
  }

  return productIds;
}

async function detachSellingPlanFromProducts(admin, groupId, productIds) {
  if (!productIds.length) return;

  await admin.graphql(
    `mutation ($id: ID!, $productIds: [ID!]!) {
      sellingPlanGroupRemoveProducts(id: $id, productIds: $productIds) {
        userErrors { field message }
      }
    }`,
    { variables: { id: groupId, productIds } }
  );

  console.log("🧹 Detached group from products");
}

/* -------------------------------------------------------------
   UPDATE PLAN INTERVAL
------------------------------------------------------------- */

export async function updateSellingPlanDuration(
  admin,
  store,
  sellingPlanId,
  intervalCount
) {
  try {
    const plan = await getSellingPlan(store, sellingPlanId);

    if (!plan) throw new Error("Selling plan not found");

    if (plan.status === "ARCHIVED") {
      throw new Error("Archived plans cannot be modified");
    }

    const mutation = getUpdateSellingPlanMutation();

    const response = await admin.graphql(mutation, {
      variables: {
        id: plan.selling_plan_group_id,
        input: {
          sellingPlansToUpdate: [
            {
              id: sellingPlanId,
              billingPolicy: {
                recurring: {
                  interval: "MONTH",
                  intervalCount: parseInt(intervalCount),
                },
              },
              deliveryPolicy: {
                recurring: {
                  interval: "MONTH",
                  intervalCount: parseInt(intervalCount),
                },
              },
            },
          ],
        },
      },
    });

    const data = await response.json();

    if (data.errors) {
      throw new Error(JSON.stringify(data.errors));
    }

    await updateSellingPlanRecord(
      store,
      sellingPlanId,
      intervalCount
    );

    console.log("✅ Selling plan updated");

    return true;
  } catch (error) {
    console.error("❌ Error updating selling plan:", error);
    throw error;
  }
}

/* -------------------------------------------------------------
   FETCH PLANS FOR DASHBOARD
------------------------------------------------------------- */

export async function getPlansForDashboard(store) {
  const groups = await getSellingPlanGroups(store);

  if (!groups.length) return [];

  const groupId = groups[0].selling_plan_group_id;

  const plans = await getSellingPlansByGroup(store, groupId);

  return plans.map((p) => ({
    ...p,
    isActive: p.status === "ACTIVE",
  }));
}

/* -------------------------------------------------------------
   SUBSCRIPTION CONTRACT OPERATIONS
------------------------------------------------------------- */

export async function fetchSubscriptionContracts(
  admin,
  store,
  variables = {}
) {
  const query = getSubscriptionContractsQuery();

  const response = await admin.graphql(query, {
    variables: {
      first: variables.first || 10,
      after: variables.after || null,
      status: variables.status || null,
      customerId: variables.customerId || null,
    },
  });

  const data = await response.json();

  return data.data?.subscriptionContracts;
}

export async function fetchSubscriptionContractDetails(
  admin,
  contractId
) {
  const query = getSingleSubscriptionContractQuery();

  const response = await admin.graphql(query, {
    variables: { id: contractId },
  });

  const data = await response.json();

  return data.data?.subscriptionContract;
}

export async function recordSubscriptionContract(
  store,
  webhookData
) {
  const contractData = {
    store,
    subscription_contract_id: webhookData.id,
    customer_id: webhookData.customer?.id,
    product_id: webhookData.lines?.[0]?.variantId || null,
    variant_id: webhookData.lines?.[0]?.variantId || null,
    selling_plan_id: webhookData.lines?.[0]?.sellingPlanId || null,
    customer_price:
      webhookData.lines?.[0]?.currentPrice?.amount || 0,
    billing_policy: webhookData.billingPolicy || null,
    delivery_policy: webhookData.deliveryPolicy || null,
    status: webhookData.status || "PENDING",
    next_billing_date: webhookData.nextBillingDate,
    original_order_id:
      webhookData.originalContract?.orderLineItem?.id || null,
  };

  return createSubscriptionContract(contractData);
}

export async function updateSubscription(
  store,
  subscription_contract_id,
  status
) {
  return updateSubscriptionStatus(
    store,
    subscription_contract_id,
    status
  );
}

export async function recordBillingAttempt(
  store,
  subscription_contract_id,
  attemptData
) {
  const attempt = {
    attempt_id: attemptData.id,
    order_id: attemptData.order?.id || null,
    status: attemptData.status || "SUCCESS",
    error_message: attemptData.errorMessage || null,
    amount: attemptData.order?.totalPrice?.amount || 0,
    currency:
      attemptData.order?.totalPrice?.currencyCode || "USD",
    timestamp: attemptData.createdAt || new Date(),
  };

  return addBillingAttempt(
    store,
    subscription_contract_id,
    attempt
  );
}

/* -------------------------------------------------------------
   ANALYTICS
------------------------------------------------------------- */

export async function getSubscriptionAnalytics(store) {
  const subscriptions = await getShopSubscriptions(store);

  const active = subscriptions.filter(
    (s) => s.status === "ACTIVE"
  ).length;

  const paused = subscriptions.filter(
    (s) => s.status === "PAUSED"
  ).length;

  const cancelled = subscriptions.filter(
    (s) => s.status === "CANCELLED"
  ).length;

  let revenue = 0;

  subscriptions.forEach((sub) => {
    (sub.billing_attempts || []).forEach((attempt) => {
      if (attempt.status === "SUCCESS") {
        revenue += parseFloat(attempt.amount || 0);
      }
    });
  });

  return {
    total_subscriptions: subscriptions.length,
    active,
    paused,
    cancelled,
    total_revenue: revenue,
  };
}

/* -----------------------------
   ATTACH TO PRODUCTS
----------------------------- */

