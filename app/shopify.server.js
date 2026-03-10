import "@shopify/shopify-app-react-router/adapters/node";
import {
  ApiVersion,
  AppDistribution,
  shopifyApp,
} from "@shopify/shopify-app-react-router/server";

import { getSessionStorage } from "./session.server.js";
import { upsertShop } from "./shop.server.js";
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
  distribution: AppDistribution.AppStore,
  hooks: {
    afterAuth: async ({ session, admin }) => {


      console.log("🔥 afterAuth triggered for:", session.shop);

      await upsertShop(session);

      await shopify.registerWebhooks({ session });

      try {
        console.log("Creating VIP discount during install");

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

        console.log("Discount creation result:", data);

      } catch (error) {
        console.error("Discount creation failed:", error);
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