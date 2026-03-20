import { useLoaderData, useFetcher } from "react-router";
import { useState, useEffect } from "react";
import { authenticate } from "../shopify.server";
import {
  updateSellingPlanDuration,
  activateSellingPlan,
  archiveSellingPlan,
  createNewSellingPlan,
} from "../services/SubscriptionService.server";

/* =====================================================
   HELPERS
===================================================== */

// async function getAllProductIds(admin) {
//   let hasNextPage = true;
//   let cursor = null;
//   const productIds = [];

//   while (hasNextPage) {
//     const res = await admin.graphql(
//       `query ($cursor: String) {
//         products(first: 50, after: $cursor) {
//           edges {
//             cursor
//             node { id }
//           }
//           pageInfo { hasNextPage }
//         }
//       }`,
//       { variables: { cursor } }
//     );

//     const data = await res.json();
//     const edges = data.data.products.edges;

//     edges.forEach(e => productIds.push(e.node.id));

//     hasNextPage = data.data.products.pageInfo.hasNextPage;
//     cursor = edges.length ? edges[edges.length - 1].cursor : null;
//   }

//   return productIds;
// }

// async function detachSellingPlanFromProducts(admin, groupId, productIds) {
//   if (!productIds.length) return;

//   await admin.graphql(
//     `mutation ($id: ID!, $productIds: [ID!]!) {
//       sellingPlanGroupRemoveProducts(id: $id, productIds: $productIds) {
//         userErrors { field message }
//       }
//     }`,
//     { variables: { id: groupId, productIds } }
//   );

//   console.log("🧹 Detached group from products");
// }

// async function setSubscribePlanMetafield(admin, planId) {
//   const shopRes = await admin.graphql(`query { shop { id } }`);
//   const shopData = await shopRes.json();
//   const shopId = shopData.data.shop.id;

//   await admin.graphql(
//     `mutation MetafieldsSet($metafields: [MetafieldsSetInput!]!) {
//       metafieldsSet(metafields: $metafields) {
//         userErrors { field message }
//       }
//     }`,
//     {
//       variables: {
//         metafields: [{
//           namespace: "$app:vip",
//           key: "subscribe_plan_id",
//           type: "single_line_text_field",
//           value: planId,
//           ownerId: shopId
//         }]
//       }
//     }
//   );
// }

// async function deleteSubscribePlanMetafield(admin) {
//   try {
//     const res = await admin.graphql(`
//       query {
//         shop {
//           metafield(namespace: "$app:vip", key: "subscribe_plan_id") {
//             id
//           }
//         }
//       }
//     `);

//     const data = await res.json();
//     const metafieldId = data?.data?.shop?.metafield?.id;

//     if (!metafieldId) {
//       console.log("ℹ️ No metafield found to delete");
//       return;
//     }

//     const deleteRes = await admin.graphql(
//       `mutation metafieldsDelete($ids: [ID!]!) {
//         metafieldsDelete(ids: $ids) {
//           deletedIds
//           userErrors {
//             field
//             message
//           }
//         }
//       }`,
//       {
//         variables: {
//           ids: [metafieldId],
//         },
//       }
//     );

//     const deleteData = await deleteRes.json();

//     if (deleteData.errors) {
//       console.error("❌ Shopify delete error:", deleteData.errors);
//     }

//     console.log("🧹 Metafield deleted SUCCESSFULLY");
//   } catch (err) {
//     console.error("❌ Metafield delete crashed:", err);
//   }
// }

/* =====================================================
   LOADER
===================================================== */

export const loader = async ({ request }) => {
  const { admin, session } = await authenticate.admin(request);

  const response = await admin.graphql(`
    query {
      sellingPlanGroups(first: 20) {
        edges {
          node {
            id
            name
            description
            sellingPlans(first: 10) {
              edges {
                node {
                  id
                  name
                  billingPolicy {
                    ... on SellingPlanRecurringBillingPolicy {
                      interval
                      intervalCount
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  `);

  const data = await response.json();
  const groups = data.data.sellingPlanGroups.edges;

  const {
    createSellingPlanRecord,
    getSellingPlan,
  } = await import("../models/Subscription.server");

  const planStatusMap = {};

  for (const group of groups) {
    for (const plan of group.node.sellingPlans.edges) {

      let existing = await getSellingPlan(session.shop, plan.node.id);

      if (!existing) {
        await createSellingPlanRecord({
          store: session.shop,
          selling_plan_id: plan.node.id,
          selling_plan_group_id: group.node.id,
          name: plan.node.name,
          billingPolicy: plan.node.billingPolicy,
          deliveryPolicy: plan.node.billingPolicy,
          status: "ARCHIVED",
        });

        existing = await getSellingPlan(session.shop, plan.node.id);
      }

      planStatusMap[plan.node.id] = existing?.status || "ARCHIVED";
    }
  }

  return { subscriptions: groups, planStatusMap };
};

/* =====================================================
   ACTION
===================================================== */

export const action = async ({ request }) => {
  const { admin, session } = await authenticate.admin(request);
  const formData = await request.formData();
  const actionType = formData.get("action");

  try {

    if (actionType === "update_subscription") {
      await updateSellingPlanDuration(
        admin,
        session.shop,
        formData.get("sellingPlanId"),
        formData.get("intervalCount")
      );
      return { success: true };
    }

    if (actionType === "activate_plan") {
      const sellingPlanId = formData.get("sellingPlanId");

      await activateSellingPlan(admin, session.shop, sellingPlanId);

      

      return { success: true };
    }

    if (actionType === "archive_plan") {
      await archiveSellingPlan(
        admin,
        session.shop,
        formData.get("sellingPlanId")
      );
      return { success: true };
    }

    if (actionType === "create_plan") {
      await createNewSellingPlan(
        admin,
        session.shop,
        formData.get("groupId"),
        formData.get("name"),
        formData.get("intervalCount")
      );
      return { success: true };
    }

  } catch (error) {
    console.error(error);
    return { success: false };
  }

  return null;
};

/* =====================================================
   UI (FULLY RESTORED)
===================================================== */

export default function Subscriptions() {

  const { subscriptions, planStatusMap } = useLoaderData();
  const fetcher = useFetcher();

  const [editingPlan, setEditingPlan] = useState(null);
  const [intervalCount, setIntervalCount] = useState(1);
  const [creatingPlan, setCreatingPlan] = useState(false);
  const [newInterval, setNewInterval] = useState(1);

  const isSubmitting =
    fetcher.state === "submitting" || fetcher.state === "loading";

  useEffect(() => {
    if (fetcher.data?.success) {
      window.location.reload();
    }
  }, [fetcher.data]);

  const openEdit = (plan) => {
    setEditingPlan(plan);
    setIntervalCount(plan.billingPolicy?.intervalCount || 1);
  };

  const updatePlan = () => {
    fetcher.submit(
      {
        action: "update_subscription",
        sellingPlanId: editingPlan.id,
        intervalCount,
      },
      { method: "POST" }
    );
    setEditingPlan(null);
  };

  const activatePlan = (id) => {
    fetcher.submit(
      { action: "activate_plan", sellingPlanId: id },
      { method: "POST" }
    );
  };

  const archivePlan = (id) => {
    fetcher.submit(
      { action: "archive_plan", sellingPlanId: id },
      { method: "POST" }
    );
  };

  const createPlan = (groupId) => {
    fetcher.submit(
      {
        action: "create_plan",
        groupId,
        name: `Deliver every ${newInterval} months`,
        intervalCount: newInterval,
      },
      { method: "POST" }
    );
    setCreatingPlan(false);
  };

  return (
    <s-page heading="Subscriptions">

      <s-section heading="Subscription Plans">

        <s-stack direction="block" gap="base">

          {subscriptions.map((group) => (

            <s-box key={group.node.id} padding="base" borderWidth="base" borderRadius="base">

              <s-stack direction="inline" align="center" gap="base">

                <s-heading>{group.node.name}</s-heading>

                <s-button
                  variant="primary"
                  size="slim"
                  disabled={isSubmitting}
                  onClick={() => setCreatingPlan(true)}
                >
                  Create Plan
                </s-button>

              </s-stack>

              <s-paragraph>
                {group.node.description || "No description"}
              </s-paragraph>

              <s-stack direction="block" gap="small">

                {group.node.sellingPlans.edges.map((sp) => {

                  const status = planStatusMap[sp.node.id];

                  return (

                    <s-box key={sp.node.id} padding="small" borderWidth="base" borderRadius="base" background="subdued">

                      <s-stack direction="inline" gap="base" align="center">

                        <s-text>
                          {sp.node.name} — Deliver every {sp.node.billingPolicy?.intervalCount} {sp.node.billingPolicy?.interval?.toLowerCase()}
                        </s-text>

                        <s-badge tone={status === "ACTIVE" ? "success" : "critical"}>
                          {status}
                        </s-badge>

                        <s-button
                          size="slim"
                          disabled={isSubmitting || status === "ARCHIVED"}
                          onClick={() => openEdit(sp.node)}
                        >
                          Edit
                        </s-button>

                        <s-button
                          size="slim"
                          disabled={isSubmitting || status === "ACTIVE"}
                          onClick={() => activatePlan(sp.node.id)}
                        >
                          Activate
                        </s-button>

                        <s-button
                          size="slim"
                          variant="secondary"
                          disabled={isSubmitting || status === "ARCHIVED"}
                          onClick={() => archivePlan(sp.node.id)}
                        >
                          Archive
                        </s-button>

                      </s-stack>

                    </s-box>

                  );
                })}

              </s-stack>

            </s-box>

          ))}

        </s-stack>

      </s-section>

      {/* EDIT */}
      {editingPlan && (
        <s-section heading="Edit Delivery Duration">
          <s-box padding="base" borderWidth="base" borderRadius="base">

            <s-text-field
              label="Deliver every (months)"
              value={intervalCount}
              onChange={(e) => setIntervalCount(e.target.value)}
            />

            <s-stack direction="inline" gap="base">
              <s-button disabled={isSubmitting} onClick={updatePlan}>
                Save
              </s-button>
              <s-button variant="secondary" onClick={() => setEditingPlan(null)}>
                Cancel
              </s-button>
            </s-stack>

          </s-box>
        </s-section>
      )}

      {/* CREATE */}
      {creatingPlan && (
        <s-section heading="Create New Plan">
          <s-box padding="base" borderWidth="base" borderRadius="base">

            <s-text-field
              label="Deliver every (months)"
              value={newInterval}
              onChange={(e) => setNewInterval(e.target.value)}
            />

            <s-stack direction="inline" gap="base">
              <s-button disabled={isSubmitting} onClick={() => createPlan(subscriptions[0].node.id)}>
                Create
              </s-button>
              <s-button variant="secondary" onClick={() => setCreatingPlan(false)}>
                Cancel
              </s-button>
            </s-stack>

          </s-box>
        </s-section>
      )}

    </s-page>
  );
}