import {
  Page,
  Card,
  FormLayout,
  TextField,
  Button,
  Banner
} from "@shopify/polaris";

import { XIcon } from "@shopify/polaris-icons";

import { useState } from "react";
import {
  Form,
  useActionData,
  redirect,
  useNavigate,
  useNavigation,
  useLoaderData
} from "react-router";

import { authenticate } from "../shopify.server";
import { connectToDatabase } from "../mongodb.server";
import { createGift } from "../models/gift.server";

/* ================= LOADER ================= */

export const loader = async ({ request }) => {
  const { admin } = await authenticate.admin(request);

  const res = await admin.graphql(`
    {
      products(first: 20) {
        edges {
          node {
            id
            handle
            title
            images(first: 1) {
              edges {
                node { url }
              }
            }
          }
        }
      }
    }
  `);

  const data = await res.json();

  const products = data.data.products.edges.map((p) => ({
    id: p.node.id,           // GID — used for GraphQL mutations only
    handle: p.node.handle,   // ✅ Handle — used for Liquid all_products lookup
    title: p.node.title,
    image: p.node.images.edges[0]?.node?.url || "",
  }));

  return { products };
};

/* ================= ACTION ================= */

export const action = async ({ request }) => {
  const { admin, session } = await authenticate.admin(request);
  const formData = await request.formData();

  const name = formData.get("name");
  const price = formData.get("price");
  const benefits = formData.get("benefits");
  const image = formData.get("image");

  // ✅ selectedProducts now contains objects: { id, handle }
  const selectedProducts = JSON.parse(formData.get("selectedProducts") || "[]");

  await connectToDatabase();

  try {
    // ✅ VALIDATION
    if (!selectedProducts.length) {
      return { error: "Please select at least one product" };
    }

    const shopQuery = await admin.graphql(`{ shop { id } }`);
    const shopData = await shopQuery.json();
    const shopId = shopData.data.shop.id;

    /* -------- CREATE PRODUCT -------- */

    const productResponse = await admin.graphql(`
      mutation {
        productCreate(product: {
          title: "${name}",
          descriptionHtml: "<p>${benefits}</p>",
          status: ACTIVE,
          productType: "gift_product",
          tags: ["gift","bundle"]
        }) {
          product {
            id
            handle   
            variants(first:1) {
              edges {
                node { id }
              }
            }
          }
          userErrors { message }
        }
      }
    `);

    const productResult = await productResponse.json();

    if (productResult.data.productCreate.userErrors.length > 0) {
      return { error: productResult.data.productCreate.userErrors[0].message };
    }

    const product = productResult.data.productCreate.product;
    const productHandle = product.handle;
    const productId = product.id;
    const variantGid = product.variants.edges[0].node.id;

    // ✅ Extract numeric variant ID from GID for consistent metafield storage
    // e.g. "gid://shopify/ProductVariant/123456" → "123456"
    const variantNumericId = variantGid.split("/").pop();

    /* -------- PUBLISH -------- */

    const publicationResponse = await admin.graphql(`
      {
        publications(first: 5) {
          nodes { id name }
        }
      }
    `);

    const publicationData = await publicationResponse.json();

    const onlineStore = publicationData.data.publications.nodes.find(
      (p) => p.name === "Online Store"
    );

    if (onlineStore) {
      await admin.graphql(`
        mutation {
          publishablePublish(
            id: "${productId}",
            input: { publicationId: "${onlineStore.id}" }
          ) {
            publishable { availablePublicationsCount { count } }
          }
        }
      `);
    }

    /* -------- SET UNLISTED -------- */

    await admin.graphql(`
      mutation {
        productUpdate(input: {
          id: "${productId}",
          status: UNLISTED
        }) {
          product { id status }
        }
      }
    `);

    /* -------- ADD IMAGE -------- */

    await new Promise(resolve => setTimeout(resolve, 1000));

    if (image && image.trim() !== "") {
      const mediaRes = await admin.graphql(`
        mutation {
          productCreateMedia(
            productId: "${productId}",
            media: [{
              originalSource: "${image}",
              mediaContentType: IMAGE
            }]
          ) {
            media {
              status
            }
            mediaUserErrors {
              message
            }
          }
        }
      `);

      const mediaJson = await mediaRes.json();

      if (mediaJson.data.productCreateMedia?.mediaUserErrors?.length) {
        console.error("MEDIA ERROR:", mediaJson.data.productCreateMedia.mediaUserErrors);
      }
    }

    /* -------- UPDATE PRICE -------- */

    await admin.graphql(`
      mutation {
        productVariantsBulkUpdate(
          productId: "${productId}",
          variants: [{
            id: "${variantGid}",
            price: "${price}",
            inventoryPolicy: CONTINUE
          }]
        ) {
          productVariants { id }
        }
      }
    `);

    /* -------- METAFIELDS -------- */

    // ✅ Store handles (not GIDs) so Liquid can do all_products[handle]
    const bundledHandles = selectedProducts.map((p) => p.handle);

    await admin.graphql(`
      mutation {
        metafieldsSet(metafields: [
          {
            namespace: "gift"
            key: "name"
            ownerId: "${productId}"
            type: "single_line_text_field"
            value: "${name.replace(/"/g, '\\"')}"
          },
          {
            namespace: "gift"
            key: "price"
            ownerId: "${productId}"
            type: "number_decimal"
            value: "${price}"
          },
          {
            namespace: "gift"
            key: "benefits"
            ownerId: "${productId}"
            type: "multi_line_text_field"
            value: "${benefits.replace(/"/g, '\\"')}"
          },
          {
            namespace: "gift"
            key: "image"
            ownerId: "${productId}"
            type: "single_line_text_field"
            value: "${image}"
          },
          {
            namespace: "gift"
            key: "is_gift"
            ownerId: "${productId}"
            type: "boolean"
            value: "true"
          },
          {
            namespace: "gift"
            key: "is_active"
            ownerId: "${productId}"
            type: "boolean"
            value: "false"
          },
          {
            namespace: "bundle"
            key: "products"
            ownerId: "${productId}"
            type: "json"
            value: "${JSON.stringify(bundledHandles).replace(/"/g, '\\"')}"
          }
        ]) {
          metafields { id }
        }
      }
    `);

    /* -------- DEFAULT GIFT — save numeric variant ID -------- */

    await admin.graphql(`
      mutation {
        metafieldsSet(metafields: [
          {
            namespace: "gift"
            key: "gift_variant_id"
            ownerId: "${shopId}"
            type: "single_line_text_field"
            value: "${variantNumericId}"
          },
          {
            namespace: "gift"
            key: "product_handle"
            ownerId: "${shopId}"
            type: "single_line_text_field"
            value: "${productHandle}"
          }
        ]) {
          userErrors { message }
        }
      }
    `);

    /* -------- SAVE DB -------- */

    await createGift({
      store: session.shop,
      name,
      price,
      benefits,
      image,
      shopify_product_id: productId,
      shopify_variant_id: variantNumericId,
      gift_handle: productHandle,
      bundled_products: selectedProducts.map((p) => p.id), // keep GIDs in DB for admin reference
    });

    return redirect("/app/gifts");

  } catch (error) {
    console.error(error);
    return { error: "Error creating bundle" };
  }
};

/* ================= UI ================= */

export default function CreateGift() {
  const { products } = useLoaderData();
  const actionData = useActionData();
  const navigate = useNavigate();
  const navigation = useNavigation();

  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [benefits, setBenefits] = useState("");
  const [image, setImage] = useState("");

  // ✅ Store full product objects { id, handle, title } instead of just IDs
  const [selectedProducts, setSelectedProducts] = useState([]);

  const isSubmitting = navigation.state === "submitting";

  const toggleProduct = (product) => {
    setSelectedProducts((prev) => {
      const alreadySelected = prev.some((p) => p.id === product.id);
      return alreadySelected
        ? prev.filter((p) => p.id !== product.id)
        : [...prev, { id: product.id, handle: product.handle }];
    });
  };

  return (
    <Page>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
        <h1 style={{ fontSize: 20 }}>Create Bundle Product</h1>
        <Button
          icon={XIcon}
          tone="critical"
          variant="tertiary"
          onClick={() => navigate("/app/gifts")}
        />
      </div>

      {actionData?.error && <Banner tone="critical">{actionData.error}</Banner>}

      <Card>
        <Form method="post" replace>
          <FormLayout>

            <TextField label="Bundle Product Title" value={name} onChange={setName} name="name" />
            <TextField label="Price" type="number" value={price} onChange={setPrice} name="price" />
            <TextField label="Benefits" multiline={4} value={benefits} onChange={setBenefits} name="benefits" />
            <TextField label="Image URL" value={image} onChange={setImage} name="image" />

            {/* PRODUCT SELECTOR */}
            <div>
              <h3>Select Products</h3>

              {selectedProducts.length === 0 && (
                <Banner tone="warning">Select at least one product</Banner>
              )}

              <div style={{
                display: "grid",
                gridTemplateColumns: "repeat(3,1fr)",
                gap: 10
              }}>
                {products.map((p) => {
                  const isSelected = selectedProducts.some((s) => s.id === p.id);

                  return (
                    <div
                      key={p.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => toggleProduct(p)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") toggleProduct(p);
                      }}
                      style={{
                        border: isSelected ? "2px solid green" : "1px solid #ddd",
                        padding: 8,
                        cursor: "pointer",
                        outline: "none"
                      }}
                    >
                      <img
                        src={p.image}
                        alt={p.title}
                        style={{ width: "100%", height: 80, objectFit: "cover" }}
                      />
                      <p>{p.title}</p>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* ✅ Pass full objects so action gets both id and handle */}
            <input
              type="hidden"
              name="selectedProducts"
              value={JSON.stringify(selectedProducts)}
              readOnly
            />

            <Button
              submit
              variant="primary"
              loading={isSubmitting}
              disabled={isSubmitting || selectedProducts.length === 0}
            >
              {isSubmitting ? "Creating..." : "Create Bundle Product"}
            </Button>

          </FormLayout>
        </Form>
      </Card>
    </Page>
  );
}