// @ts-nocheck
/* eslint-disable react/prop-types */

import { render } from "preact";
import { useState } from "preact/hooks";
import "@shopify/ui-extensions/preact";

const BACKEND_URL =
  "https://combinations-moon-state-translated.trycloudflare.com/api/cancel-subscription";

export default async () => {
  const data = await getVipData();

  render(
    <VipProfile
      isVip={data.isVip}
      couponsUsed={data.couponsUsed}
      couponsLeft={data.couponsLeft}
      subscriptions={data.subscriptions}
      endDate={data.endDate}
    />,
    document.body
  );
};

function VipProfile({ isVip, couponsUsed, couponsLeft, subscriptions, endDate  }) {
  const isVipUser = isVip === "true" || isVip === true;

  const [subs, setSubs] = useState(subscriptions);
  const [loadingId, setLoadingId] = useState(null);
  const [confirmId, setConfirmId] = useState(null);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);

    // 👉 GRID HELPER (ADD THIS)
  const chunkArray = (arr, size) => {
    const result = [];
    for (let i = 0; i < (arr || []).length; i += size) {
      result.push(arr.slice(i, i + size));
    }
    return result;
  };

  const gridRows = chunkArray(subs || [], 3);

  function calculateDaysLeft(endDate) {
  if (!endDate) return 0;

  const end = new Date(endDate);
  const now = new Date();

  const diff = end - now;

  const days = Math.ceil(diff / (1000 * 60 * 60 * 24));

  return days > 0 ? days : 0;
}

const daysLeft = calculateDaysLeft(endDate);

  return (
    <s-stack gap="base">

      {/* SUCCESS */}
      {message && (
        <s-banner tone="success">
          <s-text>{message}</s-text>
        </s-banner>
      )}

      {/* ERROR */}
      {error && (
        <s-banner tone="critical">
          <s-text>{error}</s-text>
        </s-banner>
      )}

      {/* VIP */}
      <s-banner tone={isVipUser ? "success" : "info"}>
        <s-stack direction="block" gap="base">
          <s-heading>VIP Membership</s-heading>

          <s-stack direction="inline" gap="small" alignment="center">
  {isVipUser ? (
    <>
      <s-badge tone="auto">VIP Member ⭐</s-badge>

      <s-badge tone={daysLeft <= 5 ? "critical" : "auto"}>
        Days left: {daysLeft}
      </s-badge>
    </>
  ) : (
    <s-badge tone="neutral">Regular Customer</s-badge>
  )}
</s-stack>
           <s-divider />

          <s-stack direction="block" gap="small">
            <s-text>Amount Saved: Rs.2000</s-text>
            <s-text>Coupons Used: {couponsUsed}</s-text>
            <s-text>Coupons Remaining: {couponsLeft}</s-text>
          </s-stack>
        </s-stack>
      </s-banner>

      {/* SUBSCRIPTIONS */}
     <s-heading>Subscriptions</s-heading>

<s-stack gap="base">
  {!subs || !subs.length ? (
    <s-text>No subscriptions</s-text>
  ) : (
    gridRows.map((row, rowIndex) => (
      <s-stack key={rowIndex} direction="inline" gap="base">

        {row.map((sub) => (
          <s-box
            key={sub.id}
            border="base"
            padding="base"
            borderRadius="base"
          >
            <s-stack gap="small">

              {/* STATUS */}
              <s-badge tone={sub.status === "ACTIVE" ? "success" : "critical"}>
                {sub.status}
              </s-badge>

              {/* NEXT BILLING */}
              <s-text appearance="subdued">
                Next: {formatDate(sub.nextBillingDate)}
              </s-text>

              {/* ITEMS */}
              {(sub.items || []).slice(0, 2).map((item, i) => (
                <s-text key={`${sub.id}-${i}`}>• {item}</s-text>
              ))}

              {/* CANCEL BUTTON */}
              {sub.status === "ACTIVE" && (
                <>
                  <s-button
                    tone="critical"
                    size="slim"
                    loading={loadingId === sub.id}
                    onClick={() => {
                      setConfirmId(sub.id);
                    }}
                  >
                    Cancel
                  </s-button>

                  {/* CONFIRMATION */}
                  {confirmId === sub.id && (
                    <s-banner tone="critical">
                      <s-stack gap="small">
                        <s-text>
                          Are you sure you want to cancel?
                        </s-text>

                        <s-stack direction="inline" gap="small">
                          <s-button
                            tone="critical"
                            loading={loadingId === sub.id}
                            onClick={() => {
                              cancelSubscription(
                                sub.id,
                                sub.shop,
                                setSubs,
                                setLoadingId,
                                setConfirmId,
                                setMessage,
                                setError
                              );
                            }}
                          >
                            Yes
                          </s-button>

                          <s-button onClick={() => setConfirmId(null)}>
                            No
                          </s-button>
                        </s-stack>
                      </s-stack>
                    </s-banner>
                  )}
                </>
              )}

            </s-stack>
          </s-box>
        ))}

      </s-stack>
    ))
  )}
</s-stack>
    </s-stack>
  );
}

/* -----------------------------
   FETCH
----------------------------- */
async function getVipData() {
  try {
    const response = await fetch(
      "shopify:customer-account/api/unstable/graphql.json",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: `
            query {
              shop {
                myshopifyDomain
              }
              customer {
                id
                isVip: metafield(namespace: "vip", key: "is_vip") {
                  value
                }
                couponsUsed: metafield(namespace: "vip", key: "coupons_used") {
                  value
                }
                couponsLeft: metafield(namespace: "vip", key: "coupons_left") {
                  value
                }
                endDate: metafield(namespace: "vip", key: "end_date") {
                  value
                }
              }
            }
          `,
        }),
      }
    );

    const result = await response.json();

    const customer = result.data.customer;
    const customerId = customer.id;
    const shop = result.data.shop.myshopifyDomain;

    const subRes = await fetch(
      `${BACKEND_URL}?customerId=${encodeURIComponent(
        customerId
      )}&shop=${shop}`
    );

    const subData = await subRes.json();

    return {
      isVip: customer?.isVip?.value ?? null,
      couponsUsed: parseInt(customer?.couponsUsed?.value ?? "0"),
      couponsLeft: parseInt(customer?.couponsLeft?.value ?? "0"),
      endDate: customer?.endDate?.value || null,
      subscriptions:
        (subData.subscriptions || []).map((sub) => ({
          ...sub,
          shop,
        })) || [],
    };
  } catch (error) {
    console.error("❌ Fetch error:", error);
    return fallbackData();
  }
}

/* -----------------------------
   CANCEL
----------------------------- */
async function cancelSubscription(
  contractId,
  shop,
  setSubs,
  setLoadingId,
  setConfirmId,
  setMessage,
  setError
) {
  try {
    console.log("🚀 API CALL START", contractId, shop);

    setLoadingId(contractId);

    const body = new URLSearchParams({
      contractId,
      shop,
    });

    const res = await fetch(BACKEND_URL, {
      method: "POST",
      body,
    });

    const data = await res.json();

    console.log("📦 API RESPONSE:", data);

    if (data.success) {
      setSubs((prev) => prev.filter((s) => s.id !== contractId));
      setMessage("Subscription cancelled successfully ✅");
    } else {
      setError("Failed to cancel subscription ❌");
    }
  } catch (err) {
    console.error("❌ Cancel error:", err);
    setError("Something went wrong ❌");
  } finally {
    setConfirmId(null);
    setLoadingId(null);
  }
}

/* ----------------------------- */
function formatDate(dateString) {
  if (!dateString) return "N/A";

  return new Date(dateString).toLocaleDateString("en-IN", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function fallbackData() {
  return {
    isVip: false,
    couponsUsed: 0,
    couponsLeft: 0,
    subscriptions: [],
  };
}