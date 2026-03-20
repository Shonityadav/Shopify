import "@shopify/shopify-app-react-router/adapters/node";
import {
  ApiVersion,
  AppDistribution,
  shopifyApp,
} from "@shopify/shopify-app-react-router/server";

import { getSessionStorage } from "./session.server.js";
import { upsertShop } from "./shop.server.js";
import { initializeSubscribeSave } from "./services/SubscriptionService.server.js";
import { attachSellingPlanToProducts } from "./services/SubscriptionService.server.js";
// import { authenticate } from "./shopify.server";

const sessionStorage =  getSessionStorage();

const shopify = shopifyApp({
  apiKey: process.env.SHOPIFY_API_KEY,
  apiSecretKey: process.env.SHOPIFY_API_SECRET || "",
  apiVersion: ApiVersion.October25,
  scopes: process.env.SCOPES?.split(","),
  appUrl: process.env.SHOPIFY_APP_URL || "",
  authPathPrefix: "/auth",
  sessionStorage,
  distribution: AppDistribution.AppStoreOrDevelopement,
  hooks: {
    afterAuth: async ({ session, admin }) => {
      console.log("🔥 afterAuth hook called!");
      console.log("🔥 Session shop:", session?.shop);
      console.log("🔥 Session scope:", session?.scope);

      console.log("🔥 afterAuth triggered for:", session.shop);

      await upsertShop(session);

      console.log("✅ Shop upserted, now registering webhooks...");

      await shopify.registerWebhooks({ session });

      console.log("✅ Webhooks registered successfully!");

      try {
        console.log("🔄 Creating VIP discount during install");

        const response = await admin.graphql(`
          mutation CreateVipDiscount($startsAt: DateTime!) {
            discountAutomaticAppCreate(
              automaticAppDiscount: {
                title: "VIP Bundle Discount"
                functionHandle: "vip-bundle-discount"
                startsAt: $startsAt
                metafields: [
                  {
                    namespace: "$app:vip-bundle"
                    key: "function-configuration"
                    type: "json"
                    value: "{}"
                  }
                ]
              }
            ) {
              automaticAppDiscount {
                discountId
                title
              }
              userErrors {
                field
                message
              }
            }
          }
        `,{
          variables: {
            startsAt: new Date().toISOString()
          }
        });

        const data = await response.json();

        if (data.errors) {
          console.error("❌ GraphQL Error creating discount:", data.errors[0]?.message);
        } else if (data.data?.discountAutomaticAppCreate?.userErrors?.length > 0) {
          console.warn("⚠️  Discount creation warning:", data.data.discountAutomaticAppCreate.userErrors);
        } else {
          console.log("✅ VIP discount created:", data.data?.discountAutomaticAppCreate?.automaticAppDiscount?.discountId);
        }

      } catch (error) {
        console.warn("⚠️  Discount creation failed (non-blocking):", error.message);
        // Don't throw - this should not block app installation
      }

      // Initialize Subscribe & Save
      try {
        console.log("🔄 Initializing Subscribe & Save feature...");
        const group = await initializeSubscribeSave(admin, session.shop);
        console.log("Selling plan group:", group);

        // Fetch all products
        const productsResponse = await admin.graphql(`
          query {
            products(first: 250) {
              nodes {
                id
              }
            }
          }
        `);

        const productsData = await productsResponse.json();
        const productIds = productsData.data.products.nodes.map(p => p.id);

        await attachSellingPlanToProducts(admin, session.shop, productIds);

        console.log("✅ Subscribe & Save attached to all products");
        console.log("✅ Subscribe & Save initialized successfully!");
      } catch (error) {
        console.error("❌ Error initializing Subscribe & Save:", error);
        // Don't fail the entire installation if Subscribe & Save setup fails
      }
    },
  },

  future: {
    expiringOfflineAccessTokens: true,
  },

  webhooks: {
    ORDERS_CREATE: {
      deliveryMethod: "http",
      callbackUrl: "/webhooks/orders_create",
    },

    ORDERS_UPDATED: {
      deliveryMethod: "http",
      callbackUrl: "/webhooks/orders_updated",
    },

    ORDERS_PAID: {
      deliveryMethod: "http",
      callbackUrl: "/webhooks/orders/paid",
    },

    CUSTOMERS_CREATE: {
      deliveryMethod: "http",
      callbackUrl: "/webhooks/customers/create",
    },

    CUSTOMERS_UPDATE: {
      deliveryMethod: "http",
      callbackUrl: "/webhooks/customers/update",
    },

    APP_SCOPES_UPDATE: {
      deliveryMethod: "http",
      callbackUrl: "/webhooks/app/scopes_update",
    },

    APP_UNINSTALLED: {
      deliveryMethod: "http",
      callbackUrl: "/webhooks/app_uninstalled",
    },
  },

  ...(process.env.SHOP_CUSTOM_DOMAIN
    ? { customShopDomains: [process.env.SHOP_CUSTOM_DOMAIN] }
    : {}),
});

export default shopify;
export const authenticate = shopify.authenticate;
export const login = shopify.login;
export const registerWebhooks = shopify.registerWebhooks;
export const addDocumentResponseHeaders =
  shopify.addDocumentResponseHeaders;