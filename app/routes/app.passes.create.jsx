import {
  Page,
  Card,
  FormLayout,
  TextField,
  Button,
  Banner
} from "@shopify/polaris";

import { useState } from "react";
import { Form, useActionData } from "react-router";

import { authenticate } from "../shopify.server";
import { connectToDatabase } from "../mongodb.server";



// ---------------- ACTION ----------------

export const action = async ({ request }) => {
    
  const { admin, session } = await authenticate.admin(request);

  const formData = await request.formData();

  const name = formData.get("name");
  const price = formData.get("price");


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
          status: ACTIVE,
          productType: "vip_membership",
          tags: ["vip_pass"]
        }) {
          product {
            id
            variants(first: 1) {
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
          userErrors {
            message
          }
        }
      }
    `);
    // ---------------- GET ONLINE STORE PUBLICATION ----------------

    const publicationResponse = await admin.graphql(`
      {
        publications(first: 10) {
          edges {
            node {
              id
              name
            }
          }
        }
      }
    `);

    const publicationData = await publicationResponse.json();

    const onlineStore = publicationData.data.publications.edges.find(
      p => p.node.name === "Online Store"
    );


    // ---------------- PUBLISH PRODUCT ----------------

    if (onlineStore) {

      await admin.graphql(`
        mutation {
          publishablePublish(
            id: "${productId}",
            input: {
              publicationId: "${onlineStore.node.id}"
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

    // ---------------- SAVE TO DATABASE ----------------

    const db = await connectToDatabase();

    await db.collection("passes").insertOne({
    store: session.shop,
    name,
    duration_months: 1,
    price: Number(price),
    shopify_product_id: productId,
    shopify_variant_id: variantId,
    is_active: true,
    createdAt: new Date(),
    });


    // ---------------- SAVE VARIANT IN SHOP METAFIELD ----------------

    await admin.graphql(`
      mutation {
        metafieldsSet(metafields: [
          {
            namespace: "vip"
            key: "pass_variant_id"
            ownerId: "${shopId}"
            type: "single_line_text_field"
            value: "${variantId}"
          }
        ]) {
          metafields {
            id
          }
        }
      }
    `);


    return {
      success: true,
      productId,
      variantId
    };

  } catch (error) {

    console.error(error);

    return {
      error: "Something went wrong while creating VIP pass"
    };

  }

};


// ---------------- PAGE UI ----------------

export default function CreateVipPass() {

  const actionData = useActionData();

  const [name, setName] = useState("VIP Monthly Pass");
  const [price, setPrice] = useState("29");

  return (

    <Page title="Create VIP Pass">

      {actionData?.success && (
        <Banner tone="success" title="VIP Pass Created Successfully">
          Product ID: {actionData.productId}
        </Banner>
      )}

      {actionData?.error && (
        <Banner tone="critical" title="Error Creating VIP Pass">
          {actionData.error}
        </Banner>
      )}

      <Card>
        <Form method="post">

          <FormLayout>

            <TextField
              label="Pass Name"
              value={name}
              onChange={setName}
              name="name"
              autoComplete="off"
            />

            <TextField
              label="Monthly Price"
              type="number"
              value={price}
              onChange={setPrice}
              name="price"
              autoComplete="off"
            />

            <Button submit variant="primary">
              Create VIP Pass
            </Button>

          </FormLayout>

        </Form>
      </Card>

    </Page>

  );
}