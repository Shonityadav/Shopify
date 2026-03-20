<<<<<<< HEAD
import { Page, Card, DataTable } from "@shopify/polaris";
import { useLoaderData, useNavigate } from "react-router";
=======
import { Page, Card, DataTable, Button, Banner } from "@shopify/polaris";
import {
  useLoaderData,
  useNavigate,
  useSearchParams,
  Form,
} from "react-router";
import { useEffect, useState } from "react";
>>>>>>> origin/sparsh-safe

import { authenticate } from "../shopify.server";
import { connectToDatabase } from "../mongodb.server";

<<<<<<< HEAD

export async function loader({ request }) {
    await connectToDatabase();
    // Authenticate current shop
    const { session } = await authenticate.admin(request);
    
    // Connect to MongoDB

  // Fetch passes for this store only
    const db = await connectToDatabase();

    const passes = await db
    .collection("passes")
    .find({ store: session.shop })
    .toArray();

    return { passes };
    }
=======
import { ObjectId } from "mongodb";

// ---------------- LOADER ----------------

export async function loader({ request }) {
  console.log("----- LOADER START -----");

  const { session } = await authenticate.admin(request);

  console.log("Shop:", session.shop);

  const db = await connectToDatabase();

  const passesRaw = await db
    .collection("passes")
    .find({ store: session.shop })
    .sort({ createdAt: -1 })
    .toArray();

  const passes = passesRaw.map((pass) => ({
    ...pass,
    _id: pass._id.toString(), // convert ObjectId → string
  }));

  console.log("Fetched passes:", passes.length);

  return { passes };
}

// ---------------- ACTION ----------------

export async function action({ request }) {
  console.log("----- ACTION START -----");

  const { admin, session } = await authenticate.admin(request);

  console.log("Shop:", session.shop);

  const formData = await request.formData();

  console.log("Raw FormData entries:");
  for (const [key, value] of formData.entries()) {
    console.log(key, value);
  }

  let passId = formData.get("passId");
  const actionType = formData.get("actionType");

  console.log("Received passId:", passId);
  console.log("Received actionType:", actionType);

  // force to string
  passId = passId ? String(passId) : null;

  console.log("Converted passId:", passId);

  if (!passId || !ObjectId.isValid(passId)) {
    console.log("❌ Invalid passId:", passId);
    return null;
  }

  const db = await connectToDatabase();

  const passObjectId = new ObjectId(passId);

  console.log("Mongo ObjectId:", passObjectId);

  const pass = await db.collection("passes").findOne({
    _id: passObjectId,
  });

  console.log("Fetched pass from DB:", pass);

  if (!pass) {
    console.log("❌ Pass not found in database");
    return null;
  }

  // ---------------- GET SHOP ID ----------------

  console.log("Fetching Shopify shop ID...");

  const shopResponse = await admin.graphql(`
    {
      shop {
        id
      }
    }
  `);

  const shopData = await shopResponse.json();

  console.log("Shop GraphQL response:", shopData);

  const shopId = shopData.data.shop.id;

  console.log("Shop ID:", shopId);

  // ================= ACTIVATE PASS =================

  if (actionType === "activate") {
    console.log("Activating pass:", passId);

    await db
      .collection("passes")
      .updateMany({ store: session.shop }, { $set: { is_active: false } });

    console.log("All passes deactivated");

    await db
      .collection("passes")
      .updateOne({ _id: passObjectId }, { $set: { is_active: true } });

    console.log("Pass activated:", passId);

    const response = await admin.graphql(`
      mutation {
        metafieldsSet(metafields: [
          {
            namespace: "vip"
            key: "pass_variant_id"
            ownerId: "${shopId}"
            type: "single_line_text_field"
            value: "${pass.shopify_variant_id}"
          }
        ]) {
          metafields { id }
          userErrors { message }
        }
      }
    `);

    const result = await response.json();

    console.log("Metafield update response:", result);
  }

  // ================= DELETE PASS =================

  if (actionType === "delete") {
    console.log("Deleting pass:", passId);

    if (pass.shopify_product_id) {
      console.log("Deleting Shopify product:", pass.shopify_product_id);

      const response = await admin.graphql(`
        mutation {
          productDelete(input: {
            id: "${pass.shopify_product_id}"
          }) {
            deletedProductId
            userErrors {
              message
            }
          }
        }
      `);

      const result = await response.json();

      console.log("Shopify delete response:", result);
    }

    await db.collection("passes").deleteOne({
      _id: passObjectId,
    });

    console.log("Pass deleted from MongoDB");

    // activate next pass automatically
    if (pass.is_active) {
      console.log("Deleted pass was active, finding next pass...");

      const nextPass = await db.collection("passes").findOne({
        store: session.shop,
      });

      console.log("Next pass:", nextPass);

      if (nextPass) {
        await db
          .collection("passes")
          .updateOne({ _id: nextPass._id }, { $set: { is_active: true } });

        console.log("Next pass activated:", nextPass._id);

        const response = await admin.graphql(`
          mutation {
            metafieldsSet(metafields: [
              {
                namespace: "vip"
                key: "pass_variant_id"
                ownerId: "${shopId}"
                type: "single_line_text_field"
                value: "${nextPass.shopify_variant_id}"
              }
            ]) {
              metafields { id }
            }
          }
        `);

        const result = await response.json();

        console.log("Metafield updated to next pass:", result);
      } else {
        console.log("No passes left, clearing metafield");

        await admin.graphql(`
          mutation {
            metafieldsSet(metafields: [
              {
                namespace: "vip"
                key: "pass_variant_id"
                ownerId: "${shopId}"
                type: "single_line_text_field"
                value: ""
              }
            ]) {
              metafields { id }
            }
          }
        `);
      }
    }
  }

  console.log("----- ACTION END -----");

  return null;
}

// ---------------- PAGE ----------------
>>>>>>> origin/sparsh-safe

export default function Passes() {
  const { passes } = useLoaderData();
  const navigate = useNavigate();

<<<<<<< HEAD
  const rows = passes.map((pass) => [
    pass.name,
    pass.passType,
    `${pass.discountValue}%`,
    pass.isActive ? "Active" : "Disabled",
=======
  const [searchParams] = useSearchParams();
  const createdParam = searchParams.get("created");

  const [created, setCreated] = useState(createdParam);

  useEffect(() => {
    if (createdParam) {
      const timer = setTimeout(() => {
        setCreated(null);
      }, 5000);

      return () => clearTimeout(timer);
    }
  }, [createdParam]);

  const rows = passes.map((pass) => [
    pass.name,

    `${pass.duration_months} Months`,

    `${pass.discount_percentage}%`,

    pass.is_active ? "Active" : "Disabled",

    <div key={pass._id} style={{ display: "flex", gap: "8px" }}>
      {!pass.is_active && (
        <Form method="post">
          <input type="hidden" name="passId" value={pass._id} />
          <input type="hidden" name="actionType" value="activate" />
          <Button submit size="slim">
            Activate
          </Button>
        </Form>
      )}

      <Form method="post">
        <input type="hidden" name="passId" value={pass._id} />
        <input type="hidden" name="actionType" value="delete" />
        <Button tone="critical" submit size="slim">
          Delete
        </Button>
      </Form>
    </div>,
>>>>>>> origin/sparsh-safe
  ]);

  return (
    <Page
      title="Pass Management"
      primaryAction={{
        content: "Create Pass",
        onAction: () => navigate("create"),
      }}
    >
<<<<<<< HEAD
      <Card>
        <DataTable
          columnContentTypes={["text", "text", "text", "text"]}
          headings={["Name", "Type", "Discount", "Status"]}
=======
      {created && (
        <Banner tone="success" title="VIP Pass Created Successfully">
          Your VIP membership pass was created.
        </Banner>
      )}

      <Card>
        <DataTable
          columnContentTypes={["text", "text", "text", "text", "text"]}
          headings={["Name", "Duration", "Discount", "Status", "Action"]}
>>>>>>> origin/sparsh-safe
          rows={rows}
        />
      </Card>
    </Page>
  );
<<<<<<< HEAD
}
=======
}
>>>>>>> origin/sparsh-safe
