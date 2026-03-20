import {
  Page,
  Card,
  FormLayout,
  TextField,
  Checkbox,
  Button,
} from "@shopify/polaris";
import { useState } from "react";
import { Form } from "react-router";
import { redirect } from "react-router";

import { authenticate } from "../shopify.server";
import { createVipMember } from "../models/VipMember.server";

export async function action({ request }) {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();

  try {
    await createVipMember({
      store: session.shop,
      shopify_customer_id: formData.get("customerId"),
      is_vip: formData.get("isVip") === "on",
      coupons_remaining: Number(formData.get("coupons")) || 0,
    });
  } catch (error) {
    console.error("Error creating VIP member:", error);
    throw new Response("Failed to create VIP member", { status: 500 });
  }

  return redirect("/app/vip-members");
}

export default function CreateVipMember() {
  const [customerId, setCustomerId] = useState("");
  const [isVip, setIsVip] = useState(false);
  const [coupons, setCoupons] = useState("");

  return (
    <Page title="Add VIP Member">
      <Card sectioned>
        <Form method="post">
          <FormLayout>
            <TextField
              label="Shopify Customer ID"
              name="customerId"
              value={customerId}
              onChange={setCustomerId}
            />

            <Checkbox
              label="Is VIP?"
              name="isVip"
              checked={isVip}
              onChange={setIsVip}
            />

            <TextField
              label="Coupons Remaining"
              name="coupons"
              type="number"
              value={coupons}
              onChange={setCoupons}
            />

            <Button submit variant="primary">
              Save Member
            </Button>
          </FormLayout>
        </Form>
      </Card>
    </Page>
  );
}