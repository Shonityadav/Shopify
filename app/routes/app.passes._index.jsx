import { Page, Card, DataTable, Button, Banner, Badge, Modal, TextField } from "@shopify/polaris";
import {
  useLoaderData,
  useNavigate,
  useSearchParams,
  Form,
} from "react-router";
import { useEffect, useState } from "react";
import { useSubmit } from "react-router";

import { authenticate } from "../shopify.server";
import { connectToDatabase } from "../mongodb.server";

import { ObjectId } from "mongodb";

// ---------------- LOADER ----------------

export async function loader({ request }) {
  const { admin, session } = await authenticate.admin(request);

  const db = await connectToDatabase();

  const passesRaw = await db
    .collection("passes")
    .find({ store: session.shop })
    .sort({ createdAt: -1 })
    .toArray();

  const shopRes = await admin.graphql(`
    {
      shop {
        metafield(namespace: "vip", key: "pass_variant_id") {
          value
        }
      }
    }
  `);

  const shopJson = await shopRes.json();
  const activeVariantId =
    shopJson?.data?.shop?.metafield?.value || null;

  const passes = passesRaw.map((pass) => ({
    ...pass,
    _id: pass._id.toString(),
    is_active: pass.shopify_variant_id === activeVariantId,
  }));

  return { passes };
}

// ---------------- ACTION ----------------

export async function action({ request }) {
  const { admin, session } = await authenticate.admin(request);

  const formData = await request.formData();

  let passId = formData.get("passId");
  const actionType = formData.get("actionType");
  const currentState = formData.get("currentState") === "true";

  passId = passId ? String(passId) : null;

  if (!passId || !ObjectId.isValid(passId)) {
    return null;
  }

  const db = await connectToDatabase();
  const passObjectId = new ObjectId(passId);

  const pass = await db.collection("passes").findOne({
    _id: passObjectId,
  });

  if (!pass) return null;

  const shopResponse = await admin.graphql(`{ shop { id } }`);
  const shopData = await shopResponse.json();
  const shopId = shopData.data.shop.id;

  // ---------------- TOGGLE ----------------

  if (actionType === "toggle") {

    if (!currentState) {
      await admin.graphql(`
        mutation {
          metafieldsSet(metafields: [{
            namespace: "vip"
            key: "pass_variant_id"
            ownerId: "${shopId}"
            type: "single_line_text_field"
            value: "${pass.shopify_variant_id}"
          }]) {
            userErrors { message }
          }
        }
      `);

      await db.collection("passes").updateMany(
        { store: session.shop },
        { $set: { is_active: false } }
      );

      await db.collection("passes").updateOne(
        { _id: passObjectId },
        { $set: { is_active: true } }
      );
    } else {
      await admin.graphql(`
        mutation {
          metafieldsSet(metafields: [{
            namespace: "vip"
            key: "pass_variant_id"
            ownerId: "${shopId}"
            type: "single_line_text_field"
            value: ""
          }]) {
            userErrors { message }
          }
        }
      `);

      await db.collection("passes").updateOne(
        { _id: passObjectId },
        { $set: { is_active: false } }
      );
    }

    return null;
  }

  // ---------------- EDIT ----------------

  if (actionType === "edit") {

    const name = formData.get("name");
    const percentage = formData.get("percentage");

    // 1️⃣ Update MongoDB
    await db.collection("passes").updateOne(
      { _id: passObjectId },
      {
        $set: {
          name,
          discount_percentage: percentage
        }
      }
    );

    // 2️⃣ Update Shopify product title
    await admin.graphql(`
      mutation {
        productUpdate(input: {
          id: "${pass.shopify_product_id}",
          title: "${name}"
        }) {
          userErrors { message }
        }
      }
    `);

    // 3️⃣ Update shop metafield (only if active)
    if (pass.is_active) {
      await admin.graphql(`
        mutation {
          metafieldsSet(metafields: [{
            namespace: "vip"
            key: "discount_percentage"
            ownerId: "${shopId}"
            type: "number_integer"
            value: "${parseInt(percentage)}"
          }]) {
            userErrors { message }
          }
        }
      `);
    }

    return null;
  }

  // ---------------- DELETE ----------------

  if (actionType === "delete") {
    if (pass.shopify_product_id) {
      await admin.graphql(`
        mutation {
          productDelete(input: {
            id: "${pass.shopify_product_id}"
          }) {
            deletedProductId
          }
        }
      `);
    }

    await db.collection("passes").deleteOne({
      _id: passObjectId,
    });

    return null;
  }

  return null;
}

// ---------------- PAGE ----------------

export default function Passes() {
  const { passes } = useLoaderData();
  const navigate = useNavigate();
  const submit = useSubmit();

  const [searchParams] = useSearchParams();
  const createdParam = searchParams.get("created");

  const [created, setCreated] = useState(createdParam);

  const [modalOpen, setModalOpen] = useState(false);
  const [selectedPassId, setSelectedPassId] = useState(null);
  const [loading, setLoading] = useState(false);

  const [editMode, setEditMode] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDiscount, setEditDiscount] = useState("");

  useEffect(() => {
    if (createdParam) {
      const timer = setTimeout(() => setCreated(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [createdParam]);

  const selectedPass = passes.find(p => p._id === selectedPassId);

  // ✅ PREFILL EDIT DATA
  useEffect(() => {
    if (selectedPass && editMode) {
      setEditName(selectedPass.name);
      setEditDiscount(selectedPass.discount_percentage);
    }
  }, [selectedPass, editMode]);

  const rows = passes.map((pass) => [
    pass.name,

    `${pass.duration_months || 0} Months`,

    `${pass.discount_percentage || 0}%`,

    <Badge
      key={`status-${pass._id}`}
      tone={pass.is_active ? "success" : undefined}
    >
      {pass.is_active ? "Active" : "Inactive"}
    </Badge>,

    <div
      key={`actions-${pass._id}`}
      style={{ display: "flex", gap: "8px" }}
    >
      <Form method="post">
        <input type="hidden" name="passId" value={pass._id} />
        <input type="hidden" name="actionType" value="toggle" />
        <input type="hidden" name="currentState" value={pass.is_active} />

        <Button submit size="slim" variant="primary">
          {pass.is_active ? "Deactivate" : "Activate"}
        </Button>
      </Form>

      <Button
        size="slim"
        onClick={() => {
          setSelectedPassId(pass._id);
          setEditMode(true);
          setModalOpen(true);
        }}
      >
        Edit
      </Button>

      <Button
        tone="critical"
        size="slim"
        onClick={() => {
          setSelectedPassId(pass._id);
          setEditMode(false);
          setModalOpen(true);
        }}
      >
        Delete
      </Button>
    </div>,
  ]);

  return (
    <Page
      title="Membership Management"
      primaryAction={{
        content: "Create Membership",
        onAction: () => navigate("create"),
      }}
    >
      {created && (
        <Banner tone="success" title="VIP Pass Created Successfully">
          Your VIP membership pass was created.
        </Banner>
      )}

      <Card>
        <DataTable
          columnContentTypes={["text", "text", "text", "text", "text"]}
          headings={["Name", "Duration", "Discount", "Status", "Action"]}
          rows={rows}
        />
      </Card>

      <Modal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditMode(false);
        }}
        title={editMode ? "Edit Membership" : "Delete Membership"}
        primaryAction={{
          content: editMode ? "Save" : "Delete",
          destructive: !editMode,
          loading: loading,
          onAction: async () => {
            setLoading(true);

            const formData = new FormData();
            formData.append("passId", selectedPassId);

            if (editMode) {
              formData.append("actionType", "edit");
              formData.append("name", editName);
              formData.append("percentage", editDiscount);
            } else {
              formData.append("actionType", "delete");
            }

            submit(formData, { method: "post" });

            setLoading(false);
            setModalOpen(false);
            setEditMode(false);
          }
        }}
        secondaryActions={[
          {
            content: "Cancel",
            onAction: () => {
              setModalOpen(false);
              setEditMode(false);
            },
          },
        ]}
      >
        <Modal.Section>
          {editMode ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <TextField
                label="Name"
                value={editName}
                onChange={setEditName}
              />
              <TextField
                label="Discount (%)"
                type="number"
                value={editDiscount}
                onChange={setEditDiscount}
              />
            </div>
          ) : (
            <>
              Are you sure you want to delete{" "}
              <strong>{selectedPass?.name}</strong>?
            </>
          )}
        </Modal.Section>
      </Modal>
    </Page>
  );
}