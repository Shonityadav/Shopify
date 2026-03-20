import { authenticate } from "../shopify.server";
import { getShopsCollection } from "../shop.server";

export const action = async ({ request }) => {
  const { payload, topic, shop } =
    await authenticate.webhook(request);

  console.log(`Received ${topic} webhook for ${shop}`);

  const currentScopes = payload.current;

  if (currentScopes) {
    const shops = await getShopsCollection();

    await shops.updateOne(
      { shop },
      {
        $set: {
          scope: currentScopes.toString(),
          updatedAt: new Date(),
        },
      }
    );

    console.log("✅ Updated scopes for:", shop);
  }

  return new Response("OK", { status: 200 });
};