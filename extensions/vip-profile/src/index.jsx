// @ts-nocheck
/* eslint-disable react/prop-types */

import { render } from "preact";

export default async () => {

  console.log("VIP extension started");

  const vipData = await getVipData();

  console.log("VIP Data:", vipData);

  render(
    <VipProfile
      status={vipData.status}
      couponsUsed={vipData.couponsUsed}
      couponsLeft={vipData.couponsLeft}
    />,
    document.body
  );
};

function VipProfile({ status, couponsUsed, couponsLeft }) {

  console.log("VipProfile rendered");

  const isVip = status === "true";

  return (
    <s-banner tone={isVip ? "success" : "info"}>

      <s-stack direction="block" gap="base">

        <s-heading>VIP Membership</s-heading>

        {isVip ? (
          <s-badge tone="auto">VIP Member ⭐</s-badge>
        ) : (
          <s-badge tone="neutral">Regular Customer</s-badge>
        )}

        <s-divider />

        <s-stack direction="block" gap="small">
          <s-text>Coupons Used: {couponsUsed}</s-text>
          <s-text>Coupons Remaining: {couponsLeft}</s-text>
        </s-stack>

      </s-stack>

    </s-banner>
  );
}

async function getVipData() {

  const response = await fetch(
    "shopify:customer-account/api/2025-10/graphql.json",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query: `
        query getVip {
          customer {
            vipStatus: metafield(namespace: "vip", key: "status") {
              value
            }

            couponsUsed: metafield(namespace: "vip", key: "coupons_used") {
              value
            }
            couponsLeft: metafield(namespace: "vip", key: "coupons_left") {
              value
            }
          }
        }
        `,
      }),
    }
  );

  const result = await response.json();

  console.log("FULL GRAPHQL RESPONSE:", result);

  if (!result.data) {
    console.error("GraphQL error:", result.errors);
    return {
      status: null,
      couponsUsed: 0,
      couponsLeft: 0,
    };
  }

  const data = result.data;

  return {
    status: data.customer?.vipStatus?.value,
    couponsUsed: data.customer?.couponsUsed?.value ?? 0,
    couponsLeft: data.customer?.couponsLeft?.value ?? 0,
  };
}