import {
  DiscountApplicationStrategy,
} from "../generated/api";

/**
 * @param {RunInput} input
 * @returns {FunctionRunResult}
 */
export function run(input) {

  console.log("===== FUNCTION START =====");

  // ---------------- METAFIELD DEBUG ----------------

  console.log("RAW VIP METAFIELD:", input.shop.metafield);
  console.log("RAW GIFT METAFIELD:", input.shop.gift_metafield);

  const vipVariantGid = input.shop.vip_metafield?.value;
  const giftVariantGid = input.shop.gift_metafield?.value;

  console.log("VIP GID:", vipVariantGid);
  console.log("GIFT GID:", giftVariantGid);

  const VIP_VARIANT_ID = vipVariantGid
    ? vipVariantGid.split("/").pop()
    : null;

  const GIFT_VARIANT_ID = giftVariantGid
    ? giftVariantGid.split("/").pop()
    : null;

  console.log("PARSED VIP ID:", VIP_VARIANT_ID);
  console.log("PARSED GIFT ID:", GIFT_VARIANT_ID);

  const cartLines = input.cart.lines;

  console.log("CART LINES COUNT:", cartLines.length);

  /* ------------------------------------------
     1️⃣ VIP CHECK
  ------------------------------------------ */

  const hasVipMembership = cartLines.some(line => {
    const match =
      line.merchandise.__typename === "ProductVariant" &&
      VIP_VARIANT_ID &&
      line.merchandise.id.endsWith(VIP_VARIANT_ID);

    console.log("VIP CHECK LINE:", {
      variantId: line.merchandise.id,
      match
    });

    return match;
  });

  const isVipCustomer =
    input.cart.buyerIdentity?.customer?.metafield?.value === "true";

  console.log("VIP CHECK RESULT:", {
    hasVipMembership,
    isVipCustomer
  });

  if (!hasVipMembership && !isVipCustomer) {
    console.log("❌ NOT VIP → NO DISCOUNT");
    return {
      discountApplicationStrategy: DiscountApplicationStrategy.All,
      discounts: [],
    };
  }

  const discounts = [];

  /* ------------------------------------------
     2️⃣ APPLY DISCOUNTS
  ------------------------------------------ */

  const vipDiscountPercentage = input.shop.discount_metafield?.value
    ? parseFloat(input.shop.discount_metafield.value)
    : null;

  console.log("VIP DISCOUNT (SHOP):", vipDiscountPercentage);

  for (const line of cartLines) {

    if (line.merchandise.__typename !== "ProductVariant") {
      console.log("⏭️ Skipping non-variant line");
      continue;
    }

    const variantId = line.merchandise.id;

    const expectedVipGid = VIP_VARIANT_ID
      ? `gid://shopify/ProductVariant/${VIP_VARIANT_ID}`
      : null;

    const expectedGiftGid = GIFT_VARIANT_ID
      ? `gid://shopify/ProductVariant/${GIFT_VARIANT_ID}`
      : null;

    const isVip =
      VIP_VARIANT_ID &&
      variantId === expectedVipGid;

    const isGift =
      GIFT_VARIANT_ID &&
      variantId === expectedGiftGid;

    console.log("🔍 LINE CHECK:", {
      variantId,
      expectedVipGid,
      expectedGiftGid,
      isVip,
      isGift
    });

    // Skip VIP product
    if (isVip) {
      console.log("⏭️ Skipping VIP product");
      continue;
    }
    // Gift → 100%
    if (isGift) {
      console.log("🎁 APPLYING 100% DISCOUNT TO GIFT");

      discounts.push({
        targets: [{ cartLine: { id: line.id } }],
        value: {
          percentage: { value: 100 }
        }
      });

      continue;
    }

    // ✅ Use dynamic discount instead of hardcoded 50%
    const finalDiscount = vipDiscountPercentage ?? 50;

    console.log("📦 APPLYING DISCOUNT TO NORMAL PRODUCT:", finalDiscount);

    discounts.push({
      targets: [{ cartLine: { id: line.id } }],
      value: {
        percentage: { value: finalDiscount }
      }
    });
  }


  return {
    discountApplicationStrategy: DiscountApplicationStrategy.All,
    discounts,
  };
}