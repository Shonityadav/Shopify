export function cartTransformRun(input) {
  
  const VIP_ID = input.shop.metafield?.value;
  const GIFT_ID = "42213975720039";

  const VIP_GID = `gid://shopify/ProductVariant/${VIP_ID}`;
  const GIFT_GID = `gid://shopify/ProductVariant/${GIFT_ID}`;

  const operations = [];
  const lines = input.cart.lines;

  const vipLine = lines.find(
    (line) => line.merchandise.id === VIP_GID
  );

  const giftLine = lines.find(
    (line) => line.merchandise.id === GIFT_GID
  );

  // IF VIP EXISTS
  if (vipLine) {
    // Force VIP quantity = 1
    if (vipLine.quantity !== 1) {
      operations.push({
        lineUpdate: {
          cartLineId: vipLine.id,
          quantity: 1,
        },
      });
    }

    // Add Gift if missing
    if (!giftLine) {
      operations.push({
        lineAdd: {
          merchandiseId: GIFT_GID,
          quantity: 1,
        },
      });
    }

    // Force Gift quantity = 1
    if (giftLine && giftLine.quantity !== 1) {
      operations.push({
        lineUpdate: {
          cartLineId: giftLine.id,
          quantity: 1,
        },
      });
    }
  }

  // IF VIP DOES NOT EXIST - remove gift
  if (!vipLine && giftLine) {
    operations.push({
      lineUpdate: {
        cartLineId: giftLine.id,
        quantity: 0,
      },
    });
  }

  return { operations };
}
