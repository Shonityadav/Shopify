import { authenticate } from "../shopify.server";
import { updateCustomer } from "../models/Customer.server";

export const action = async ({ request }) => {
  const { topic, shop, payload } =
    await authenticate.webhook(request);

  if (topic !== "customers/update") {
    return new Response("Invalid topic", { status: 400 });
  }

  try {
    await updateCustomer(shop, payload.id, {
      email: payload.email,
      first_name: payload.first_name,
      last_name: payload.last_name,
    });
    console.log("✅ Customer updated:", payload.id);
  } catch (error) {
    console.error("❌ Error updating customer:", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  return new Response("OK", { status: 200 });
};