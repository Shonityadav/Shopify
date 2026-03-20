import {
  Page,
  Card,
  DataTable,
  Button,
  Select,
  Modal,
  InlineStack,
} from "@shopify/polaris";
<<<<<<< HEAD
import { useLoaderData, Form, useNavigation } from "react-router";
=======

import {
  useLoaderData,
  useNavigation,
  Form,
  useRevalidator,
} from "react-router";

>>>>>>> origin/sparsh-safe
import { useState, useMemo } from "react";

import { authenticate } from "../shopify.server";
import { getCustomers, updateCustomer } from "../models/Customer.server";


// ---------------- LOADER ----------------
export async function loader({ request }) {
  const { session } = await authenticate.admin(request);

<<<<<<< HEAD
  try {
    const customers = await getCustomers(session.shop);
=======
  console.log("LOADER SESSION:", session?.shop);

  if (!session?.shop) {
    throw new Response("Unauthorized", { status: 401 });
  }

  try {
    const customers = await getCustomers(session.shop);

    console.log("Customers fetched:", customers?.length);

>>>>>>> origin/sparsh-safe
    return { customers };
  } catch (error) {
    console.error("Error fetching customers:", error);
    throw new Response("Failed to load customers", { status: 500 });
  }
}


// ---------------- ACTION ----------------
export async function action({ request }) {
<<<<<<< HEAD
  const { session } = await authenticate.admin(request);

  const formData = await request.formData();
  const customerId = formData.get("customerId");
  const actionType = formData.get("actionType");

  try {
    if (actionType === "make_vip") {
      const months = Number(formData.get("months"));

      const startDate = new Date();
      const endDate = new Date();
      endDate.setMonth(endDate.getMonth() + months);
=======
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
>>>>>>> origin/sparsh-safe

      await updateCustomer(session.shop, customerId, {
        is_vip: true,
        membership_start_date: startDate,
        membership_end_date: endDate,
      });
<<<<<<< HEAD
    }

    if (actionType === "remove_vip") {
=======

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

>>>>>>> origin/sparsh-safe
      await updateCustomer(session.shop, customerId, {
        is_vip: false,
        membership_start_date: null,
        membership_end_date: null,
      });
<<<<<<< HEAD
    }
=======

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

>>>>>>> origin/sparsh-safe
  } catch (error) {
    console.error("Error updating customer:", error);
    throw new Response("Failed to update customer", { status: 500 });
  }

<<<<<<< HEAD
  return null;
=======
  return { success: true };
>>>>>>> origin/sparsh-safe
}


// ---------------- COMPONENT ----------------
<<<<<<< HEAD
// ---------------- COMPONENT ----------------
export default function CustomersPage() {
  const { customers } = useLoaderData();
  const navigation = useNavigation();
=======
export default function CustomersPage() {

  const { customers } = useLoaderData();
  const navigation = useNavigation();
  const revalidator = useRevalidator();
>>>>>>> origin/sparsh-safe

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
<<<<<<< HEAD
      <Card>
        <InlineStack align="space-between">
=======

      <Card>
        <InlineStack align="space-between">

>>>>>>> origin/sparsh-safe
          <Select
            label="Filter"
            options={filterOptions}
            value={filter}
            onChange={setFilter}
          />
<<<<<<< HEAD
        </InlineStack>

        <DataTable
          columnContentTypes={["text", "text", "text", "text", "text"]}
          headings={["Name", "Email", "Status", "Expiry", "Action"]}
=======

        </InlineStack>

        <DataTable
          columnContentTypes={["text","text","text","text","text"]}
          headings={["Name","Email","Status","Expiry","Action"]}
>>>>>>> origin/sparsh-safe
          rows={rows}
        />
      </Card>

<<<<<<< HEAD
      {/* -------- Make VIP Modal -------- */}
=======

      {/* MAKE VIP MODAL */}

>>>>>>> origin/sparsh-safe
      <Modal
        open={activeModal}
        onClose={() => setActiveModal(false)}
        title="Select Membership Duration"
      >
<<<<<<< HEAD
        <Modal.Section>
          <Form
            method="post"
            onSubmit={() => setActiveModal(false)}
          >
=======

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

>>>>>>> origin/sparsh-safe
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

<<<<<<< HEAD
            <Button submit variant="primary" loading={navigation.state === "submitting"}>
              Confirm VIP
            </Button>
          </Form>
        </Modal.Section>
      </Modal>

      {/* -------- Remove VIP Confirmation Modal -------- */}
=======
            <Button submit loading={navigation.state === "submitting"}>
              Confirm VIP
            </Button>

          </Form>

        </Modal.Section>

      </Modal>


      {/* REMOVE VIP MODAL */}

>>>>>>> origin/sparsh-safe
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
<<<<<<< HEAD
=======

            setTimeout(() => {
              revalidator.revalidate();
            }, 500);
>>>>>>> origin/sparsh-safe
          },
        }}
        secondaryActions={[
          {
            content: "Cancel",
            onAction: () => setRemoveModal(false),
          },
        ]}
      >
<<<<<<< HEAD
        <Modal.Section>
          <p>Are you sure you want to remove this customer from VIP?</p>

          <Form method="post" id="removeVipForm">
            <input type="hidden" name="customerId" value={selectedCustomer} />
            <input type="hidden" name="actionType" value="remove_vip" />
          </Form>
        </Modal.Section>
      </Modal>
=======

        <Modal.Section>

          <p>Are you sure you want to remove this customer from VIP?</p>

          <Form method="post" id="removeVipForm">

            <input type="hidden" name="customerId" value={selectedCustomer} />
            <input type="hidden" name="actionType" value="remove_vip" />

          </Form>

        </Modal.Section>

      </Modal>

>>>>>>> origin/sparsh-safe
    </Page>
  );
}