import { authenticate } from "../shopify.server";
import { deactivateShop } from "../shop.server";

export const action = async ({ request }) => {
  const { shop } = await authenticate.webhook(request);

  await deactivateShop(shop);

  return new Response("OK", { status: 200 });
};