import { authenticate } from "../shopify.server";
import { connectToDatabase } from "../mongodb.server";
import { useLoaderData } from "react-router";

export async function loader({ request }) {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;

  const db = await connectToDatabase();
  const vipCollection = db.collection("vip_members");
  const couponsCollection = db.collection("coupons");

  const vipData = await vipCollection.findOne({ shop });
  const coupons = await couponsCollection
    .find({ shop })
    .toArray();

  return { vipData, coupons };
}

export default function VipPage() {
  const { vipData, coupons } = useLoaderData();

  return (
    <div style={{ padding: 20 }}>
      <h1>VIP Dashboard</h1>

      {vipData?.isVip ? (
        <>
          <p>✅ VIP Active</p>
          <p>
            Membership ends:{" "}
            {new Date(vipData.membershipEndDate).toLocaleDateString()}
          </p>

          <h3>Coupons:</h3>
          <ul>
            {coupons.map((coupon) => (
              <li key={coupon._id}>
                {coupon.couponCode} - Used:{" "}
                {coupon.isUsed ? "Yes" : "No"}
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p>❌ Not a VIP</p>
      )}
    </div>
  );
}