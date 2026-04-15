import {
  Page,
  Card,
  DataTable,
  Button,
  Badge,
  Thumbnail,
  Modal
} from "@shopify/polaris";

import {
  useLoaderData,
  useNavigate,
  Form,
  useSubmit,
  useNavigation,
  useLocation
} from "react-router";

import { useState } from "react";

import { authenticate } from "../shopify.server";
import { connectToDatabase } from "../mongodb.server";
import { ObjectId } from "mongodb";

// ---------------- LOADER ----------------

export async function loader({ request }) {
  const { admin, session } = await authenticate.admin(request);
  const db = await connectToDatabase();

  const gifts = await db
    .collection("gifts")
    .find({ store: session.shop })
    .toArray();

  const shopRes = await admin.graphql(`
    {
      shop {
        metafield(namespace: "gift", key: "gift_variant_id") {
          value
        }
      }
    }
  `);

  const shopJson = await shopRes.json();
  const activeVariantRaw =
    shopJson?.data?.shop?.metafield?.value || null;

  const activeVariantId = activeVariantRaw
    ? activeVariantRaw.split("/").pop()
    : null;

  return {
    gifts: gifts.map((g) => {
      console.log("---- DEBUG ----");
      console.log("DB variant:", g.shopify_variant_id);
      console.log("META raw:", activeVariantRaw);
      console.log("META parsed:", activeVariantId);

      return {
        ...g,
        _id: g._id.toString(),
        is_active: String(g.shopify_variant_id) === String(activeVariantId),
      };
    }),
  };
}

// ---------------- ACTION ----------------

export async function action({ request }) {
  const { admin, session } = await authenticate.admin(request);
  const formData = await request.formData();

  const giftId = formData.get("giftId");
  const actionType = formData.get("actionType");

  const db = await connectToDatabase();

  const gift = await db.collection("gifts").findOne({
    _id: new ObjectId(giftId),
  });

  if (!gift) return null;

  const shopRes = await admin.graphql(`{ shop { id } }`);
  const shopJson = await shopRes.json();
  const shopId = shopJson.data.shop.id;

  if (actionType === "toggle") {
    const currentState = formData.get("currentState") === "true";

    if (!currentState) {
      await db.collection("gifts").updateMany(
        { store: session.shop },
        { $set: { is_active: false } }
      );

      await db.collection("gifts").updateOne(
        { _id: new ObjectId(giftId) },
        { $set: { is_active: true } }
      );

      const numericId = gift.shopify_variant_id.split('/').pop();
      console.log("[ACTIVATE] setting variant:", numericId);

      const response = await admin.graphql(`
        mutation {
          metafieldsSet(metafields: [
            {
              namespace: "gift",
              key: "gift_variant_id",
              ownerId: "${shopId}",
              type: "single_line_text_field",
              value: "${numericId}"
            }
          ]) {
            metafields {
              key
              value
            }
            userErrors {
              field
              message
            }
          }
        }
      `);

      const json = await response.json();

      console.log("[ACTIVATE RESPONSE]", JSON.stringify(json, null, 2));
    } else {
      await db.collection("gifts").updateOne(
        { _id: new ObjectId(giftId) },
        { $set: { is_active: false } }
      );

      await admin.graphql(`
        mutation {
          metafieldsDelete(
            metafields: [
              {
                ownerId: "${shopId}",
                namespace: "gift",
                key: "gift_variant_id"
              },
              {
                ownerId: "${shopId}",
                namespace: "gift",
                key: "product_handle"
              }
            ]
          ) {
            deletedMetafields {
              key
              namespace
            }
            userErrors {
              message
            }
          }
        }
      `);
    }

    return { success: true };
  }

  if (actionType === "delete") {
    if (gift.shopify_product_id) {
      await admin.graphql(`
        mutation {
          productDelete(input: {
            id: "${gift.shopify_product_id}"
          }) {
            deletedProductId
          }
        }
      `);
    }

    await db.collection("gifts").deleteOne({
      _id: new ObjectId(giftId),
    });

    return null;
  }

  return null;
}

// ---------------- UI ----------------

export default function Gifts() {
  const { gifts } = useLoaderData();
  const navigate = useNavigate();
  const submit = useSubmit();
  const navigation = useNavigation();
  const location = useLocation();

  const [modalOpen, setModalOpen] = useState(false);
  const [selectedGiftId, setSelectedGiftId] = useState(null);

  const selectedGift = gifts.find(g => g._id === selectedGiftId);

  const rows = gifts.map((gift) => [
    <div
      key={`img-${gift._id}`}
      role="button"
      tabIndex={0}
      onClick={() => navigate(`/app/gifts/${gift._id}${location.search}`)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          navigate(`/app/gifts/${gift._id}${location.search}`);
        }
      }}
      style={{ cursor: "pointer" }}
    >
      <Thumbnail source={gift.image} alt={gift.name} />
    </div>,

    <div
      key={`name-${gift._id}`}
      role="button"
      tabIndex={0}
      onClick={() => navigate(`/app/gifts/${gift._id}${location.search}`)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          navigate(`/app/gifts/${gift._id}${location.search}`);
        }
      }}
      style={{ cursor: "pointer" }}
    >
      {gift.name}
    </div>,

    <div
      key={`price-${gift._id}`}
      role="button"
      tabIndex={0}
      onClick={() => navigate(`/app/gifts/${gift._id}${location.search}`)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          navigate(`/app/gifts/${gift._id}${location.search}`);
        }
      }}
      style={{ cursor: "pointer" }}
    >
      {gift.price}
    </div>,

    <div
      key={`status-${gift._id}`}
      role="button"
      tabIndex={0}
      onClick={() => navigate(`/app/gifts/${gift._id}${location.search}`)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          navigate(`/app/gifts/${gift._id}${location.search}`);
        }
      }}
      style={{ cursor: "pointer" }}
    >
      {gift.is_active ? (
        <Badge tone="success">Active</Badge>
      ) : (
        <Badge>Inactive</Badge>
      )}
    </div>,

    <div
      key={`actions-${gift._id}`}
      style={{ display: "flex", gap: "8px" }}
    >
      <Form method="post" onClick={(e) => e.stopPropagation()}>
        <input type="hidden" name="giftId" value={gift._id} />
        <input type="hidden" name="actionType" value="toggle" />
        <input type="hidden" name="currentState" value={gift.is_active} />

        <Button submit size="slim" variant="primary">
          {gift.is_active ? "Deactivate" : "Activate"}
        </Button>
      </Form>

      <Button
        tone="critical"
        size="slim"
        onClick={(e) => {
          e.stopPropagation();
          setSelectedGiftId(gift._id);
          setModalOpen(true);
        }}
      >
        Delete
      </Button>
    </div>,
  ]);

  return (
    <Page
      title="Bundle Product Management"
      primaryAction={{
        content: "Create Bundle Product",
        onAction: () => navigate("create"),
      }}
    >
      <Card>
        <DataTable
          columnContentTypes={["text", "text", "text", "text", "text"]}
          headings={["Image", "Name", "Price", "Status", "Action"]}
          rows={rows}
        />
      </Card>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Delete Gift"
        primaryAction={{
          content: "Delete",
          destructive: true,
          loading: navigation.state === "submitting",
          onAction: () => {
            const formData = new FormData();
            formData.append("giftId", selectedGiftId);
            formData.append("actionType", "delete");

            setModalOpen(false); // ✅ prevents UI sticking
            submit(formData, { method: "post" });
          },
        }}
        secondaryActions={[
          {
            content: "Cancel",
            onAction: () => setModalOpen(false),
          },
        ]}
      >
        <Modal.Section>
          Are you sure you want to delete{" "}
          <strong>{selectedGift?.name}</strong>?
        </Modal.Section>
      </Modal>
    </Page>
  );
}