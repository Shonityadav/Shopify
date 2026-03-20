import { connectToDatabase } from "../mongodb.server";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }) => {

  const { session } = await authenticate.admin(request);
  const db = await connectToDatabase();

  const coupons = db.collection("coupons");

  const coupon = await coupons.findOne({
    shop: session.shop,
    isUsed: false
  });

  return Response.json({
    coupon: coupon?.couponCode || null
  });
};