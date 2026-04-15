import { useState } from "react";
import { useLoaderData, useFetcher } from "react-router";
import {
  Page,
  Card,
  Text,
  Badge,
  Thumbnail,
  BlockStack,
  InlineStack,
  Divider,
  DataTable,
  Button,
  Box,
  InlineGrid,
  Modal,
  Banner,
} from "@shopify/polaris";
import { DeleteIcon, XIcon } from "@shopify/polaris-icons";
import { authenticate } from "../shopify.server";
import { connectToDatabase } from "../mongodb.server";
import { ObjectId } from "mongodb";
import { useNavigate, useLocation } from "react-router";

/* ================= LOADER ================= */

export const loader = async ({ request, params }) => {
  const { admin } = await authenticate.admin(request);
  const db = await connectToDatabase();

  const gift = await db.collection("gifts").findOne({
    _id: new ObjectId(params.id),
  });

  if (!gift) throw new Response("Not Found", { status: 404 });

  // Active status
  let isActive = gift.is_active;
  try {
    const shopQuery = await admin.graphql(`
      { shop { metafield(namespace: "gift", key: "gift_variant_id") { value } } }
    `);
    const shopData = await shopQuery.json();
    const activeVariantId = shopData?.data?.shop?.metafield?.value || null;
    if (activeVariantId) isActive = gift.shopify_variant_id === activeVariantId;
  } catch (err) {
    console.error("STATUS FETCH ERROR:", err);
  }

  // Bundled products
  let products = [];
  try {
    if (gift.bundled_products?.length) {
      const res = await admin.graphql(
        `query getProducts($ids: [ID!]!) {
          nodes(ids: $ids) {
            ... on Product {
              id title
              images(first: 1) { edges { node { url } } }
            }
          }
        }`,
        { variables: { ids: gift.bundled_products } }
      );
      const data = await res.json();
      products = (data?.data?.nodes || [])
        .filter(Boolean)
        .map((p) => ({
          id: p.id,
          title: p.title,
          image: p.images?.edges?.[0]?.node?.url || "",
        }));
    }
  } catch (err) {
    console.error("PRODUCT FETCH ERROR:", err);
  }

  // All shop products (for the add-product picker)
  let allProducts = [];
  try {
    const res = await admin.graphql(`
      { products(first: 50) {
          edges { node {
            id title
            images(first: 1) { edges { node { url } } }
          }}
        }
      }
    `);
    const data = await res.json();
    allProducts = data.data.products.edges.map((e) => ({
      id: e.node.id,
      title: e.node.title,
      image: e.node.images.edges[0]?.node?.url || "",
    }));
  } catch (err) {
    console.error("ALL PRODUCTS FETCH ERROR:", err);
  }

  return {
    gift: {
      ...gift,
      _id: gift._id.toString(),
      is_active: isActive,
      products,
    },
    allProducts,
  };
};

/* ================= ACTION ================= */

export const action = async ({ request, params }) => {
  const { admin } = await authenticate.admin(request);
  const db = await connectToDatabase();
  const formData = await request.formData();
  const intent = formData.get("intent");

  const gift = await db.collection("gifts").findOne({
    _id: new ObjectId(params.id),
  });
  if (!gift) return { error: "Bundle not found" };

  if (intent === "remove_product") {
    const productId = formData.get("productId");
    const updatedProducts = (gift.bundled_products || []).filter(
      (id) => id !== productId
    );

    await db.collection("gifts").updateOne(
      { _id: new ObjectId(params.id) },
      { $set: { bundled_products: updatedProducts } }
    );

    // Sync metafield on the Shopify product
    try {
      await admin.graphql(`
        mutation {
          metafieldsSet(metafields: [{
            namespace: "bundle"
            key: "products"
            ownerId: "${gift.shopify_product_id}"
            type: "json"
            value: "${JSON.stringify(updatedProducts).replace(/"/g, '\\"')}"
          }]) { metafields { id } }
        }
      `);
    } catch (err) {
      console.error("METAFIELD SYNC ERROR:", err);
    }

    return { success: true };
  }

  if (intent === "add_product") {
    const productId = formData.get("productId");
    const current = gift.bundled_products || [];
    if (current.includes(productId)) return { error: "Product already in bundle" };

    const updatedProducts = [...current, productId];

    await db.collection("gifts").updateOne(
      { _id: new ObjectId(params.id) },
      { $set: { bundled_products: updatedProducts } }
    );

    try {
      await admin.graphql(`
        mutation {
          metafieldsSet(metafields: [{
            namespace: "bundle"
            key: "products"
            ownerId: "${gift.shopify_product_id}"
            type: "json"
            value: "${JSON.stringify(updatedProducts).replace(/"/g, '\\"')}"
          }]) { metafields { id } }
        }
      `);
    } catch (err) {
      console.error("METAFIELD SYNC ERROR:", err);
    }

    return { success: true };
  }

  return { error: "Unknown action" };
};

/* ================= UI ================= */

export default function GiftDetails() {
  const { gift, allProducts } = useLoaderData();
  const navigate = useNavigate();
  const location = useLocation();
  const fetcher = useFetcher();

  const [isEditMode, setIsEditMode] = useState(false);

  // Delete confirmation modal state
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [productToDelete, setProductToDelete] = useState(null);

  // Add product picker state
  const [addPickerOpen, setAddPickerOpen] = useState(false);

  const currentProductIds = gift.products?.map((p) => p.id) || [];
  const availableToAdd = allProducts.filter(
    (p) => !currentProductIds.includes(p.id)
  );

  const statusBadge = gift.is_active ? (
    <Badge tone="success">Active</Badge>
  ) : (
    <Badge tone="critical">Inactive</Badge>
  );

  // ── Confirm delete ──
  const handleDeleteClick = (product) => {
    setProductToDelete(product);
    setDeleteModalOpen(true);
  };

  const handleDeleteConfirm = () => {
    if (!productToDelete) return;
    const fd = new FormData();
    fd.append("intent", "remove_product");
    fd.append("productId", productToDelete.id);
    fetcher.submit(fd, { method: "post" });
    setDeleteModalOpen(false);
    setProductToDelete(null);
  };

  // ── Add product ──
  const handleAddProduct = (productId) => {
    const fd = new FormData();
    fd.append("intent", "add_product");
    fd.append("productId", productId);
    fetcher.submit(fd, { method: "post" });
  };

  // ── Build table rows ──
  const productRows = gift.products?.length
    ? gift.products.map((p) => [
        <InlineStack key={`${p.id}-name`} gap="300" blockAlign="center">
          <Thumbnail source={p.image} alt={p.title} size="small" />
          <Text variant="bodyMd" fontWeight="semibold">
            {p.title}
          </Text>
        </InlineStack>,
        <Text key={`${p.id}-vendor`} variant="bodySm" tone="subdued">
          Shopify
        </Text>,
        <Badge key={`${p.id}-badge`} tone="success">
          Tracked
        </Badge>,
        // X button — only visible in edit mode
        isEditMode ? (
          <Button
            key={`${p.id}-delete`}
            icon={XIcon}
            tone="critical"
            variant="plain"
            onClick={() => handleDeleteClick(p)}
            accessibilityLabel={`Remove ${p.title}`}
          />
        ) : (
          <span key={`${p.id}-delete`} />
        ),
      ])
    : [];

  return (
    <Page
      title={gift.name}
      titleMetadata={statusBadge}
      backAction={{
        content: "Gifts",
        onAction: () => navigate(`/app/gifts${location.search}`),
      }}
      primaryAction={
        isEditMode ? (
          <Button variant="secondary" onClick={() => setIsEditMode(false)}>
            Done 
            </Button>
        ) : (
          <Button variant="primary" onClick={() => setIsEditMode(true)}>
            Edit bundle
          </Button>
        )
      }
    >
      <BlockStack gap="500">

        {/* ── Metric cards ── */}
        <InlineGrid columns={3} gap="400">
          <Card>
            <BlockStack gap="100">
              <Text variant="bodySm" tone="subdued">Bundle price</Text>
              <Text variant="heading2xl" as="p">{gift.price}</Text>
            </BlockStack>
          </Card>
          <Card>
            <BlockStack gap="100">
              <Text variant="bodySm" tone="subdued">Total products</Text>
              <Text variant="heading2xl" as="p">{gift.products?.length ?? 0}</Text>
            </BlockStack>
          </Card>
          <Card>
            <BlockStack gap="100">
              <Text variant="bodySm" tone="subdued">Status</Text>
              <Box paddingBlockStart="100">{statusBadge}</Box>
            </BlockStack>
          </Card>
        </InlineGrid>

        {/* ── Products table ── */}
        <Card padding="0">
          <Box padding="400" paddingBlockEnd="300">
            <InlineStack align="space-between" blockAlign="center">
              <Text variant="headingMd">Products in this bundle</Text>
              {isEditMode && (
                <Button
                  variant="plain"
                  onClick={() => setAddPickerOpen(true)}
                  disabled={availableToAdd.length === 0}
                >
                  + Add product
                </Button>
              )}
            </InlineStack>
          </Box>

          <Divider />

          {gift.products?.length ? (
            <DataTable
              columnContentTypes={["text", "text", "text", "text"]}
              headings={["Product", "Vendor", "Inventory", ""]}
              rows={productRows}
            />
          ) : (
            <Box padding="600">
              <Text tone="subdued" alignment="center">
                No products in this bundle
              </Text>
            </Box>
          )}
        </Card>

      </BlockStack>

      {/* ── Delete confirmation modal ── */}
      <Modal
        open={deleteModalOpen}
        onClose={() => {
          setDeleteModalOpen(false);
          setProductToDelete(null);
        }}
        title="Remove product from bundle?"
        primaryAction={{
          content: "Remove",
          destructive: true,
          icon: DeleteIcon,
          onAction: handleDeleteConfirm,
          loading: fetcher.state === "submitting",
        }}
        secondaryActions={[
          {
            content: "Cancel",
            onAction: () => {
              setDeleteModalOpen(false);
              setProductToDelete(null);
            },
          },
        ]}
      >
        <Modal.Section>
          {productToDelete && (
            <InlineStack gap="400" blockAlign="center">
              <Thumbnail
                source={productToDelete.image}
                alt={productToDelete.title}
                size="small"
              />
              <BlockStack gap="100">
                <Text variant="bodyMd" fontWeight="semibold">
                  {productToDelete.title}
                </Text>
                <Text variant="bodySm" tone="subdued">
                  This product will be removed from the bundle. The product
                  itself will not be deleted from your store.
                </Text>
              </BlockStack>
            </InlineStack>
          )}
        </Modal.Section>
      </Modal>

      {/* ── Add product picker modal ── */}
      <Modal
        open={addPickerOpen}
        onClose={() => setAddPickerOpen(false)}
        title="Add products to bundle"
      >
        <Modal.Section>
          {availableToAdd.length === 0 ? (
            <Banner tone="info">All your products are already in this bundle.</Banner>
          ) : (
            <BlockStack gap="300">
              {availableToAdd.map((p) => (
                <InlineStack
                  key={p.id}
                  align="space-between"
                  blockAlign="center"
                >
                  <InlineStack gap="300" blockAlign="center">
                    <Thumbnail source={p.image} alt={p.title} size="small" />
                    <Text variant="bodyMd">{p.title}</Text>
                  </InlineStack>
                  <Button
                    size="slim"
                    variant="secondary"
                    onClick={() => {
                      handleAddProduct(p.id);
                      setAddPickerOpen(false);
                    }}
                    loading={
                      fetcher.state === "submitting" &&
                      fetcher.formData?.get("productId") === p.id
                    }
                  >
                    Add
                  </Button>
                </InlineStack>
              ))}
            </BlockStack>
          )}
        </Modal.Section>
      </Modal>
    </Page>
  );
}