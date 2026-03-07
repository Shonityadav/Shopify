import {
  DiscountApplicationStrategy,
} from "../generated/api";

/**
 * @param {RunInput} input
 * @returns {FunctionRunResult}
 */
export function run(input) {

  const vipVariantGid = input.shop.metafield?.value;

  const VIP_VARIANT_ID = vipVariantGid
    ? vipVariantGid.split("/").pop()
    : null;   // VIP membership variant ID
  const GIFT_VARIANT_ID = "42213975720039";  // Gift variant ID

  const cartLines = input.cart.lines;

  // ------------------------------------------
  // 1️⃣ Check if VIP membership exists
  // ------------------------------------------
  const hasVipMembership = cartLines.some(line =>
    line.merchandise.__typename === "ProductVariant" &&
    line.merchandise.id.endsWith(VIP_VARIANT_ID)
  );

  // If VIP not in cart → no discount
  if (!hasVipMembership) {
    return {
      discountApplicationStrategy: DiscountApplicationStrategy.All,
      discounts: [],
    };
  }

  const discounts = [];

  // ------------------------------------------
  // 2️⃣ Apply discounts
  // ------------------------------------------
  for (const line of cartLines) {

    if (line.merchandise.__typename !== "ProductVariant") continue;

    const variantId = line.merchandise.id;

    const isVip = variantId.endsWith(VIP_VARIANT_ID);
    const isGift = variantId.endsWith(GIFT_VARIANT_ID);

    // -------------------------------
    // VIP Membership → no discount
    // -------------------------------
    if (isVip) continue;

    // -------------------------------
    // Gift → 100% FREE
    // -------------------------------
    if (isGift) {
      discounts.push({
        targets: [{ cartLine: { id: line.id } }],
        value: {
          percentage: { value: 100 }
        }
      });
      continue;
    }

    // -------------------------------
    // Main Products → 50% OFF
    // -------------------------------
    discounts.push({
      targets: [{ cartLine: { id: line.id } }],
      value: {
        percentage: { value: 50 }
      }
    });

  }

  return {
    discountApplicationStrategy: DiscountApplicationStrategy.All,
    discounts,
  };
}