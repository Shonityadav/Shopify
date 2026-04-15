import {
  Page,
  Card,
  FormLayout,
  TextField,
  Button,
  Banner,
  
} from "@shopify/polaris";
import { XIcon } from "@shopify/polaris-icons";

import { useState } from "react";
import { Form, useActionData, useNavigate, redirect } from "react-router";

import { authenticate } from "../shopify.server";
import { connectToDatabase } from "../mongodb.server";
import { createVipPass, deactivateVipPasses } from "../models/VipPass.server";



// ---------------- ACTION ----------------

export const action = async ({ request }) => {

  const { admin, session } = await authenticate.admin(request);


  const formData = await request.formData();

  const name = formData.get("name");
  const price = formData.get("price");
  const percentage = formData.get("percentage");
  const duration = formData.get("duration");
  const benefits = formData.get("benefits");

  await connectToDatabase();

  try {

    // ---------------- GET SHOP ID ----------------

    const shopQuery = await admin.graphql(`
      {
        shop {
          id
        }
      }
    `);

    const shopData = await shopQuery.json();
    const shopId = shopData.data.shop.id;


    // ---------------- CREATE PRODUCT ----------------

    const productResponse = await admin.graphql(`
      mutation {
        productCreate(product: {
          title: "${name}",
          descriptionHtml: "<p>${benefits}</p>",
          status: ACTIVE,
          productType: "vip_membership",
          tags: ["vip_pass"]
        }) {
          product {
            id
            variants(first:1) {
              edges {
                node {
                  id
                }
              }
            }
          }
          userErrors {
            message
          }
        }
      }
    `);

    const productResult = await productResponse.json();

    if (productResult.data.productCreate.userErrors.length > 0) {
      return { error: productResult.data.productCreate.userErrors[0].message };
    }

    const product = productResult.data.productCreate.product;

    const productId = product.id;
    const variantId = product.variants.edges[0].node.id;

    await admin.graphql(`
      mutation {
        productUpdate(
          input: {
            id: "${productId}",
            status: UNLISTED
          }
        ) {
          product {
            id
            status
          }
          userErrors {
            message
          }
        }
      }
    `);


    // ---------------- UPDATE VARIANT PRICE ----------------

    await admin.graphql(`
      mutation {
        productVariantsBulkUpdate(
          productId: "${productId}",
          variants: [
            {
              id: "${variantId}",
              price: "${price}",
              inventoryPolicy: CONTINUE
            }
          ]
        ) {
          productVariants {
            id
          }
        }
      }
    `);


    // ---------------- PUBLISH PRODUCT ----------------

    const publicationResponse = await admin.graphql(`
      {
        publications(first:5){
          nodes{
            id
            name
          }
        }
      }
    `);

    const publicationData = await publicationResponse.json();

    const onlineStore = publicationData.data.publications.nodes.find(
      p => p.name === "Online Store"
    );

    if (onlineStore) {

      await admin.graphql(`
        mutation {
          publishablePublish(
            id: "${productId}",
            input: {
              publicationId: "${onlineStore.id}"
            }
          ) {
            publishable {
              availablePublicationsCount {
                count
              }
            }
          }
        }
      `);

    }


    // ---------------- CREATE PRODUCT METAFIELDS ----------------

    

    const metafieldResponse = await admin.graphql(`
      mutation {
        metafieldsSet(metafields: [

          {
            namespace: "vip"
            key: "discount_percentage"
            ownerId: "${productId}"
            type: "number_integer"
            value: "${parseInt(percentage)}"
          },

          {
            namespace: "vip"
            key: "duration_months"
            ownerId: "${productId}"
            type: "number_integer"
            value: "${parseInt(duration)}"
          }

        ]) {
          metafields {
            id
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

    const metafieldResult = await metafieldResponse.json();

    console.log("🔥 METAFIELD RESULT:", JSON.stringify(metafieldResult, null, 2));

    if (metafieldResult.data.metafieldsSet.userErrors.length > 0) {
      console.error("❌ Metafield Errors:", metafieldResult.data.metafieldsSet.userErrors);
    }


    // ---------------- SAVE VARIANT ID IN SHOP METAFIELD ----------------

    await admin.graphql(`
      mutation {
        metafieldsSet(metafields: [
          {
            namespace: "vip"
            key: "pass_variant_id"
            ownerId: "${shopId}"
            type: "single_line_text_field"
            value: "${variantId}"
          },
          {
            namespace: "vip"
            key: "discount_percentage"
            ownerId: "${shopId}"
            type: "number_integer"
            value: "${parseInt(percentage)}"
          }
        ]) {
          metafields {
            id
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

    // ---------------- DEACTIVATE OLD PASSES ----------------

    await deactivateVipPasses(session.shop);
    // ---------------- SAVE TO MONGODB ----------------

    await createVipPass({
      store: session.shop,
      name,
      duration_months: duration,
      discount_percentage: percentage,
      benefits,
      price,
      shopify_product_id: productId,
      shopify_variant_id: variantId,
      is_active: true
    });


    return redirect("/app/passes?created=true");

  } catch (error) {

    console.error(error);

    return {
      error: "Something went wrong while creating Membership"
    };

  }

};


// ---------------- PAGE UI ----------------

export default function CreateVipPass() {

  const actionData = useActionData();
  const navigate = useNavigate();

  const [name, setName] = useState("VIP Monthly Pass");
  const [price, setPrice] = useState("29");
  const [percentage, setPercentage] = useState("50");
  const [duration, setDuration] = useState("1");
  const [benefits, setBenefits] = useState("");

  return (

    <Page>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "16px",
        }}
      >
        {/* LEFT SIDE */}
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          

          <h1 style={{ fontSize: "20px", fontWeight: "600", margin: 0 }}>
            Create Membership
          </h1>
        </div>

        {/* RIGHT SIDE (RED X) */}
        <Button
          icon={XIcon}
          tone="critical"
          variant="tertiary"
          onClick={() => navigate("/app/passes")}
        />
      </div>

      {actionData?.success && (
        <Banner tone="success" title="Membership Created Successfully">
          Product created successfully
        </Banner>
      )}

      {actionData?.error && (
        <Banner tone="critical" title="Error Creating Membership">
          {actionData.error}
        </Banner>
      )}

      <Card>
        <Form method="post">

          <FormLayout>

            <TextField
              label="Title"
              value={name}
              onChange={setName}
              name="name"
              autoComplete="off"
            />

            <TextField
              label="Price"
              type="number"
              value={price}
              onChange={setPrice}
              name="price"
            />

            <TextField
              label="Discount"
              type="number"
              suffix="%"
              value={percentage}
              onChange={setPercentage}
              name="percentage"
            />

            <TextField
              label="Duration (Months)"
              type="number"
              value={duration}
              onChange={setDuration}
              name="duration"
            />

            <TextField
              label="Benefits"
              value={benefits}
              onChange={setBenefits}
              name="benefits"
              multiline={4}
            />

            <Button submit variant="primary">
              Create Membership
            </Button>

          </FormLayout>

        </Form>
      </Card>

    </Page>

  );

}