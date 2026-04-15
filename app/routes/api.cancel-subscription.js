/* -----------------------------
   DB IMPORT
----------------------------- */
import { connectToDatabase } from "../mongodb.server";

/* -----------------------------
   CORS HEADERS
----------------------------- */
const corsHeaders = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

/* -----------------------------
   OPTIONS (CORS preflight)
----------------------------- */
export function options() {
  return new Response(null, { status: 204, headers: corsHeaders });
}

/* -----------------------------
   GET SUBSCRIPTIONS
----------------------------- */
export const loader = async ({ request }) => {
  try {
    const url = new URL(request.url);
    const customerId = url.searchParams.get("customerId");
    const shop = url.searchParams.get("shop");

    if (!customerId || !shop) {
      return new Response(
        JSON.stringify({ subscriptions: [] }),
        { status: 200, headers: corsHeaders }
      );
    }

    console.log("📡 Shop:", shop);
    console.log("📡 Customer:", customerId);

    const db = await connectToDatabase();

    const session = await db.collection("sessions").findOne({
      shop: shop,
      isOnline: false,
    });

    if (!session?.accessToken) {
      console.error("❌ No session found for shop:", shop);

      return new Response(
        JSON.stringify({ error: "Shop not authenticated" }),
        { status: 400, headers: corsHeaders }
      );
    }

    const ACCESS_TOKEN = session.accessToken;

    const customerGid = customerId.startsWith("gid://")
      ? customerId
      : `gid://shopify/Customer/${customerId}`;

    const response = await fetch(
      `https://${shop}/admin/api/2023-10/graphql.json`,
      {
        method: "POST",
        headers: {
          "X-Shopify-Access-Token": ACCESS_TOKEN,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query: `
            query getSubs($customerId: ID!) {
              customer(id: $customerId) {
                subscriptionContracts(first: 10) {
                  edges {
                    node {
                      id
                      status
                      nextBillingDate
                      lines(first: 10) {
                        edges {
                          node {
                            title
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          `,
          variables: { customerId: customerGid },
        }),
      }
    );

    const data = await response.json();
    console.log("🧾 Shopify response:", JSON.stringify(data, null, 2));

    const subs =
      data?.data?.customer?.subscriptionContracts?.edges
        ?.map((edge) => edge.node)
        ?.filter((sub) => sub.status === "ACTIVE") // 🔥 filter here
        ?.map((sub) => ({
          id: sub.id,
          status: sub.status,
          nextBillingDate: sub.nextBillingDate,
          items: sub.lines.edges.map((l) => l.node.title),
        })) || [];

    return new Response(
      JSON.stringify({ subscriptions: subs }),
      { status: 200, headers: corsHeaders }
    );

  } catch (error) {
    console.error("❌ Loader Error:", error);

    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: corsHeaders }
    );
  }
};

/* -----------------------------
   CANCEL SUBSCRIPTION
----------------------------- */
export const action = async ({ request }) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: corsHeaders }
    );
  }

  try {
    const formData = await request.formData();
    const contractId = formData.get("contractId");
    const shop = formData.get("shop");

    if (!contractId || !shop) {
      return new Response(
        JSON.stringify({ error: "Missing contractId or shop" }),
        { status: 400, headers: corsHeaders }
      );
    }

    console.log("🗑️ Cancelling:", contractId, "for shop:", shop);

    const db = await connectToDatabase();

    const session = await db.collection("sessions").findOne({
      shop: shop,
      isOnline: false,
    });

    if (!session?.accessToken) {
      console.error("❌ No access token for shop:", shop);

      return new Response(
        JSON.stringify({ error: "Shop not authenticated" }),
        { status: 400, headers: corsHeaders }
      );
    }

    const ACCESS_TOKEN = session.accessToken;

    const response = await fetch(
      `https://${shop}/admin/api/2023-10/graphql.json`,
      {
        method: "POST",
        headers: {
          "X-Shopify-Access-Token": ACCESS_TOKEN,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query: `
            mutation cancelSub($id: ID!) {
              subscriptionContractCancel(subscriptionContractId: $id) {
                userErrors {
                  field
                  message
                }
              }
            }
          `,
          variables: { id: contractId },
        }),
      }
    );

    const data = await response.json();

    console.log("🧾 Cancel mutation FULL response:", JSON.stringify(data, null, 2));

    if (data.errors) {
      console.error("❌ GraphQL errors:", data.errors);

      return new Response(
        JSON.stringify({ success: false, errors: data.errors }),
        { status: 200, headers: corsHeaders }
      );
    }

    const userErrors =
      data?.data?.subscriptionContractCancel?.userErrors || [];

    if (userErrors.length > 0) {
      console.error("❌ Cancel errors:", userErrors);

      return new Response(
        JSON.stringify({ success: false, errors: userErrors }),
        { status: 200, headers: corsHeaders }
      );
    }

    console.log("✅ Subscription cancelled successfully");

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: corsHeaders }
    );

  } catch (error) {
    console.error("❌ Action Error:", error);

    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: corsHeaders }
    );
  }
};