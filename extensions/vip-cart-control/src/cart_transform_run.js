export function cartTransformRun(input) {

  const operations = [];

  // Get VIP variant ID from shop metafield
  const VIP_ID = input.shop.metafield?.value;
  if (!VIP_ID) {
    console.log("No VIP variant ID found in metafield");
    return { operations };
  }

  // Get gift variant ID (hardcoded for now, can be made configurable later)
  const GIFT_ID = "42213975720039";

  const VIP_GID = `gid://shopify/ProductVariant/${VIP_ID}`;
  const GIFT_GID = `gid://shopify/ProductVariant/${GIFT_ID}`;

  const lines = input.cart.lines;

  // Find VIP and gift lines in cart
  const vipLine = lines.find(
    (line) => line.merchandise.id === VIP_GID
  );

  const giftLine = lines.find(
    (line) => line.merchandise.id === GIFT_GID
  );

  // CASE 1: VIP product is in cart
  if (vipLine) {
    console.log("VIP product found in cart");

    // Force VIP quantity to 1 (VIP passes should be single quantity)
    if (vipLine.quantity !== 1) {
      operations.push({
        lineUpdate: {
          cartLineId: vipLine.id,
          quantity: 1,
        },
      });
    }

    // Add gift product if it's missing
    if (!giftLine) {
      console.log("Adding gift product to cart");
      operations.push({
        lineAdd: {
          merchandiseId: GIFT_GID,
          quantity: 1,
        },
      });
    }
    // Ensure gift quantity is 1 if it exists
    else if (giftLine.quantity !== 1) {
      operations.push({
        lineUpdate: {
          cartLineId: giftLine.id,
          quantity: 1,
        },
      });
    }
  }

  // CASE 2: VIP product is NOT in cart, but gift is present
  else if (!vipLine && giftLine) {
    console.log("VIP product removed, removing gift product");
    operations.push({
      lineUpdate: {
        cartLineId: giftLine.id,
        quantity: 0, // This removes the line from cart
      },
    });
  }

  // CASE 3: Neither VIP nor gift in cart - no action needed
  else {
    console.log("No VIP or gift products in cart");
  }

  return { operations };
}
