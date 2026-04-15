import { useLoaderData, useFetcher, useRevalidator  } from "react-router";
import { useState, useEffect } from "react";
import { authenticate } from "../shopify.server";
import {
  updateSellingPlanDuration,
  activateSellingPlan,
  archiveSellingPlan,
  createNewSellingPlan,
} from "../services/SubscriptionService.server";
import { Page, Card, DataTable, Button, Badge, Modal, TextField } from "@shopify/polaris";


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
        formData.get("intervalCount"),
        formData.get("name")
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

    if (actionType === "delete_plan") {
      const sellingPlanId = formData.get("sellingPlanId");

      const {
        deleteSellingPlanRecord,
        getSellingPlan,
        getSellingPlansByGroup,
        updateSellingPlanStatus,
      } = await import("../models/Subscription.server");

      const plan = await getSellingPlan(session.shop, sellingPlanId);
      if (!plan) return { success: false };

      const groupId = plan.selling_plan_group_id;

      // Delete from Shopify
      await admin.graphql(
        `
        mutation DeletePlan($id: ID!, $planId: ID!) {
          sellingPlanGroupUpdate(
            id: $id,
            input: {
              sellingPlansToDelete: [$planId]
            }
          ) {
            userErrors { field message }
          }
        }
        `,
        {
          variables: {
            id: groupId,
            planId: sellingPlanId,
          },
        }
      );

      // Delete from DB
      await deleteSellingPlanRecord(session.shop, sellingPlanId);

      // Handle active plan logic
      if (plan.status === "ACTIVE") {
        const remainingPlans = await getSellingPlansByGroup(
          session.shop,
          groupId
        );

        if (remainingPlans.length > 0) {
          const newActive = remainingPlans[0];

          await updateSellingPlanStatus(
            session.shop,
            newActive.selling_plan_id,
            "ACTIVE"
          );

          const shopRes = await admin.graphql(`query { shop { id } }`);
          const shopData = await shopRes.json();

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
                    value: newActive.selling_plan_id,
                    ownerId: shopData.data.shop.id,
                  },
                ],
              },
            }
          );
        } else {
          const shopRes = await admin.graphql(`query { shop { id } }`);
          const shopData = await shopRes.json();

          await admin.graphql(
            `mutation metafieldsDelete($metafields: [MetafieldIdentifierInput!]!) {
              metafieldsDelete(metafields: $metafields) {
                deletedMetafields { key }
              }
            }`,
            {
              variables: {
                metafields: [
                  {
                    ownerId: shopData.data.shop.id,
                    namespace: "$app:vip",
                    key: "subscribe_plan_id",
                  },
                ],
              },
            }
          );
        }
      }

      return { success: true };
    }
  } catch (error) {
    console.error(error);
    return { success: false };
  }

  return null;
};

/* =====================================================
   UI
===================================================== */

export default function Subscriptions() {
  const { subscriptions, planStatusMap } = useLoaderData();
  const fetcher = useFetcher();

  const [editingPlan, setEditingPlan] = useState(null);
  const [intervalCount, setIntervalCount] = useState(1);
  const [creatingPlan, setCreatingPlan] = useState(false);
  const [newInterval, setNewInterval] = useState(1);
  const [planName, setPlanName] = useState("");
  const [editPlanName, setEditPlanName] = useState("");

  const isSubmitting =
    fetcher.state === "submitting" || fetcher.state === "loading";

  

  const revalidator = useRevalidator();

  const [hasRevalidated, setHasRevalidated] = useState(false);

  useEffect(() => {
    if (fetcher.data?.success && !hasRevalidated) {
      setHasRevalidated(true);
      revalidator.revalidate();
      setEditingPlan(null);
    }
  }, [fetcher.data, revalidator, hasRevalidated]);

  const openEdit = (plan) => {
    setEditingPlan(plan);
    setIntervalCount(plan.billingPolicy?.intervalCount || 1);
    setEditPlanName(plan.name || "");
  };

  const updatePlan = () => {
    fetcher.submit(
      {
        action: "update_subscription",
        sellingPlanId: editingPlan.id,
        intervalCount: Number(intervalCount),
        name: editPlanName,
      },
      { method: "POST" }
    );
    setEditingPlan(null);
  };

  const togglePlan = (id, isActive) => {
    fetcher.submit(
      {
        action: isActive ? "archive_plan" : "activate_plan",
        sellingPlanId: id,
      },
      { method: "POST" }
    );
  };

  const deletePlan = (id) => {
    if (!confirm("Are you sure you want to delete this plan?")) return;

    fetcher.submit(
      {
        action: "delete_plan",
        sellingPlanId: id,
      },
      { method: "POST" }
    );
  };

  const createPlan = (groupId) => {
    fetcher.submit(
      {
        action: "create_plan",
        groupId,
        name: planName || `Deliver every ${newInterval} months`,
        intervalCount: Number(newInterval),
      },
      { method: "POST" }
    );
    setCreatingPlan(false);
  };

  return (
    <Page
      title="Subscriptions"
      primaryAction={{
        content: "Create Plan",
        onAction: () => setCreatingPlan(true),
      }}
    >
      <Card>
        <DataTable
          columnContentTypes={["text", "text", "text", "text", "text"]}
          headings={[
            "Group",
            "Plan Name",
            "Billing",
            "Status",
            "Actions",
          ]}
          rows={
            subscriptions.flatMap((group) =>
              group.node.sellingPlans.edges.map((sp) => {
                const status = planStatusMap[sp.node.id];

                return [
                  group.node.name,
                  sp.node.name,
                  `Every ${sp.node.billingPolicy?.intervalCount} ${sp.node.billingPolicy?.interval?.toLowerCase()}`,

                  <Badge key={`status-${sp.node.id}`} tone={status === "ACTIVE" ? "success" : "critical"}>
                    {status}
                  </Badge>,

                  <div key={`actions-${sp.node.id}`} style={{ display: "flex", gap: "8px" }}>
                    <Button
                      size="slim"
                      disabled={isSubmitting || status === "ARCHIVED"}
                      onClick={() => openEdit(sp.node)}
                    >
                      Edit
                    </Button>

                    <Button
                      size="slim"
                      tone={status === "ACTIVE" ? "critical" : "success"}
                      disabled={isSubmitting}
                      onClick={() => togglePlan(sp.node.id, status === "ACTIVE")}
                    >
                      {status === "ACTIVE" ? "Deactivate" : "Activate"}
                    </Button>

                    <Button
                      size="slim"
                      tone="critical"
                      disabled={isSubmitting}
                      onClick={() => deletePlan(sp.node.id)}
                    >
                      Delete
                    </Button>
                  </div>,
                ];
              })
            )
          }
        />
      </Card>

      {editingPlan && (
        <Modal
          open={true}
          onClose={() => setEditingPlan(null)}
          title="Edit Plan"
          primaryAction={{
            content: "Save",
            onAction: updatePlan,
            loading: isSubmitting,
          }}
          secondaryActions={[
            {
              content: "Cancel",
              onAction: () => setEditingPlan(null),
            },
          ]}
        >
          <Modal.Section>
            <TextField
              label="Plan Name"
              value={editPlanName}
              onChange={(value) => setEditPlanName(value)}
            />

            <TextField
              label="Deliver every (months)"
              type="number"
              value={intervalCount}
              onChange={(value) => setIntervalCount(value)}
            />
          </Modal.Section>
        </Modal>
      )}

      {creatingPlan && (
        <Modal
          open={true}
          onClose={() => setCreatingPlan(false)}
          title="Create Plan"
          primaryAction={{
            content: "Create",
            onAction: () => createPlan(subscriptions?.[0]?.node?.id),
            loading: isSubmitting,
          }}
          secondaryActions={[
            {
              content: "Cancel",
              onAction: () => setCreatingPlan(false),
            },
          ]}
        >
          <Modal.Section>
            <TextField
              label="Plan Name"
              value={planName}
              onChange={(value) => setPlanName(value)}
            />

            <TextField
              label="Deliver every (months)"
              type="number"
              value={newInterval}
              onChange={(value) => setNewInterval(value)}
            />
          </Modal.Section>
        </Modal>
      )}
    </Page>
  );
}
