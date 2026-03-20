import {
  Page,
  Card,
  DataTable,
  Button,
  Select,
  Modal,
  InlineStack,
} from "@shopify/polaris";

import {
  useLoaderData,
  useNavigation,
  Form,
  useRevalidator,
} from "react-router";

import { useState, useMemo } from "react";

import { authenticate } from "../shopify.server";
import { getCustomers, updateCustomer } from "../models/Customer.server";


// ---------------- LOADER ----------------
export async function loader({ request }) {
  const { session } = await authenticate.admin(request);

  console.log("LOADER SESSION:", session?.shop);

  if (!session?.shop) {
    throw new Response("Unauthorized", { status: 401 });
  }

  try {
    const customers = await getCustomers(session.shop);

    console.log("Customers fetched:", customers?.length);

    return { customers };
  } catch (error) {
    console.error("Error fetching customers:", error);
    throw new Response("Failed to load customers", { status: 500 });
  }
}


// ---------------- ACTION ----------------
export async function action({ request }) {
  const { admin, session } = await authenticate.admin(request);

  console.log("ACTION SESSION:", session?.shop);

  if (!session?.shop) {
    throw new Response("Unauthorized", { status: 401 });
  }

  const formData = await request.formData();

  const customerId = formData.get("customerId");
  const actionType = formData.get("actionType");
  const months = formData.get("months");

  console.log("Form Data:", {
    customerId,
    actionType,
    months,
  });

  try {

    // ---------------- MAKE VIP ----------------
    if (actionType === "make_vip") {

      const startDate = new Date();
      const endDate = new Date();
      endDate.setMonth(endDate.getMonth() + Number(months));

      console.log("Updating MongoDB VIP...");

      await updateCustomer(session.shop, customerId, {
        is_vip: true,
        membership_start_date: startDate,
        membership_end_date: endDate,
      });

      console.log("MongoDB updated successfully");

      console.log("Updating Shopify metafields...");

      const response = await admin.graphql(`
        mutation {
          metafieldsSet(metafields: [
            {
              ownerId: "gid://shopify/Customer/${customerId}"
              namespace: "vip"
              key: "status"
              type: "boolean"
              value: "true"
            },
            {
              ownerId: "gid://shopify/Customer/${customerId}"
              namespace: "vip"
              key: "coupons_used"
              type: "number_integer"
              value: "0"
            },
            {
              ownerId: "gid://shopify/Customer/${customerId}"
              namespace: "vip"
              key: "coupons_left"
              type: "number_integer"
              value: "5"
            }
          ]) {
            metafields {
              id
            }
            userErrors {
              field
              message
            }
          }
        }
      `);

      const result = await response.json();

      console.log("Metafield response:", result);

      if (result?.data?.metafieldsSet?.userErrors?.length) {
        console.error("Metafield errors:", result.data.metafieldsSet.userErrors);
      }
    }

    // ---------------- REMOVE VIP ----------------
    if (actionType === "remove_vip") {

      console.log("Removing VIP from MongoDB");

      await updateCustomer(session.shop, customerId, {
        is_vip: false,
        membership_start_date: null,
        membership_end_date: null,
      });

      console.log("MongoDB VIP removed");

      const response = await admin.graphql(`
        mutation {
          metafieldsSet(metafields: [
            {
              ownerId: "gid://shopify/Customer/${customerId}"
              namespace: "vip"
              key: "status"
              type: "boolean"
              value: "false"
            }
          ]) {
            metafields {
              id
            }
            userErrors {
              field
              message
            }
          }
        }
      `);

      const result = await response.json();

      console.log("Metafield remove response:", result);
    }

  } catch (error) {
    console.error("Error updating customer:", error);
    throw new Response("Failed to update customer", { status: 500 });
  }

  return { success: true };
}


// ---------------- COMPONENT ----------------
export default function CustomersPage() {

  const { customers } = useLoaderData();
  const navigation = useNavigation();
  const revalidator = useRevalidator();

  const [activeModal, setActiveModal] = useState(false);
  const [removeModal, setRemoveModal] = useState(false);

  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [months, setMonths] = useState("1");
  const [filter, setFilter] = useState("all");

  const monthOptions = [
    { label: "1 Month", value: "1" },
    { label: "2 Months", value: "2" },
    { label: "3 Months", value: "3" },
  ];

  const filterOptions = [
    { label: "All", value: "all" },
    { label: "VIP Members", value: "vip" },
    { label: "Non VIP", value: "nonvip" },
  ];

  const filteredCustomers = useMemo(() => {
    if (filter === "vip") return customers.filter(c => c.is_vip);
    if (filter === "nonvip") return customers.filter(c => !c.is_vip);
    return customers;
  }, [customers, filter]);

  const rows = filteredCustomers.map((c) => [
    c.first_name || "-",
    c.email || "-",
    c.is_vip ? "VIP" : "Normal",
    c.membership_end_date
      ? new Date(c.membership_end_date).toLocaleDateString()
      : "-",
    c.is_vip ? (
      <Button
        tone="critical"
        size="slim"
        onClick={() => {
          setSelectedCustomer(c.shopify_customer_id);
          setRemoveModal(true);
        }}
      >
        Remove VIP
      </Button>
    ) : (
      <Button
        size="slim"
        onClick={() => {
          setSelectedCustomer(c.shopify_customer_id);
          setActiveModal(true);
        }}
      >
        Make VIP
      </Button>
    ),
  ]);

  return (
    <Page title="Customers Management">

      <Card>
        <InlineStack align="space-between">

          <Select
            label="Filter"
            options={filterOptions}
            value={filter}
            onChange={setFilter}
          />

        </InlineStack>

        <DataTable
          columnContentTypes={["text","text","text","text","text"]}
          headings={["Name","Email","Status","Expiry","Action"]}
          rows={rows}
        />
      </Card>


      {/* MAKE VIP MODAL */}

      <Modal
        open={activeModal}
        onClose={() => setActiveModal(false)}
        title="Select Membership Duration"
      >

        <Modal.Section>

          <Form
            method="post"
            onSubmit={() => {
              setActiveModal(false);

              setTimeout(() => {
                revalidator.revalidate();
              }, 500);
            }}
          >

            <input type="hidden" name="customerId" value={selectedCustomer} />
            <input type="hidden" name="actionType" value="make_vip" />

            <Select
              label="Membership Duration"
              options={monthOptions}
              value={months}
              onChange={setMonths}
              name="months"
            />

            <br />

            <Button submit loading={navigation.state === "submitting"}>
              Confirm VIP
            </Button>

          </Form>

        </Modal.Section>

      </Modal>


      {/* REMOVE VIP MODAL */}

      <Modal
        open={removeModal}
        onClose={() => setRemoveModal(false)}
        title="Confirm Removal"
        primaryAction={{
          content: "Remove VIP",
          destructive: true,
          loading: navigation.state === "submitting",
          onAction: () => {
            document.getElementById("removeVipForm").requestSubmit();
            setRemoveModal(false);

            setTimeout(() => {
              revalidator.revalidate();
            }, 500);
          },
        }}
        secondaryActions={[
          {
            content: "Cancel",
            onAction: () => setRemoveModal(false),
          },
        ]}
      >

        <Modal.Section>

          <p>Are you sure you want to remove this customer from VIP?</p>

          <Form method="post" id="removeVipForm">

            <input type="hidden" name="customerId" value={selectedCustomer} />
            <input type="hidden" name="actionType" value="remove_vip" />

          </Form>

        </Modal.Section>

      </Modal>

    </Page>
  );
}