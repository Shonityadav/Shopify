import { Outlet, useLoaderData, useRouteError } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { AppProvider as ShopifyAppProvider } from "@shopify/shopify-app-react-router/react";
import { AppProvider as PolarisAppProvider } from "@shopify/polaris";
import enTranslations from "@shopify/polaris/locales/en.json";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }) => {
  const url = new URL(request.url);
  const pathname = url.pathname;
  const search = url.search;

  const sellingPlanGroupId = url.searchParams.get("sellingPlanGroupId");

  // ✅ If coming from subscriptions (product page)
  if (sellingPlanGroupId) {
    throw new Response(null, {
      status: 302,
      headers: { Location: `/app/subscriptions${search}` },
    });
  }

  // ✅ If root app load (no param) → assume discount
  if (pathname === "/app" || pathname === "/") {
    throw new Response(null, {
      status: 302,
      headers: { Location: `/app/passes${search}` },
    });
  }

  await authenticate.admin(request);

  return { apiKey: process.env.SHOPIFY_API_KEY || "" };
};

export default function App() {
  const { apiKey } = useLoaderData();

  return (
    <ShopifyAppProvider embedded apiKey={apiKey}>
      <PolarisAppProvider i18n={enTranslations}>
        <s-app-nav>
          <s-link href="/app">Home</s-link>
          <s-link href="/app/passes">Memberships</s-link>
          <s-link href="/app/gifts">Bundle Products</s-link>
          <s-link href="/app/customers">Customers</s-link>
          <s-link href="/app/subscriptions">Subscriptions</s-link>
          <s-link href="/app/additional">Additional page</s-link>
        </s-app-nav>

        <Outlet />
      </PolarisAppProvider>
    </ShopifyAppProvider>
  );
}

// Shopify needs React Router to catch some thrown responses, so that their headers are included in the response.
export function ErrorBoundary() {
  return boundary.error(useRouteError());
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};
