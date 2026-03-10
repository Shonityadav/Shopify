import {
  Page,
  Card,
  DataTable,
  Button,
  Select,
  Modal,
  InlineStack,
} from "@shopify/polaris";
import { useLoaderData, Form, useNavigation } from "react-router";
import { useState, useMemo } from "react";

import { authenticate } from "../shopify.server";
import { getCustomers, updateCustomer } from "../models/Customer.server";


// ---------------- LOADER ----------------
export async function loader({ request }) {
  const { session } = await authenticate.admin(request);

  try {
    const customers = await getCustomers(session.shop);
    return { customers };
  } catch (error) {
    console.error("Error fetching customers:", error);
    throw new Response("Failed to load customers", { status: 500 });
  }
}


// ---------------- ACTION ----------------
export async function action({ request }) {
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

      await updateCustomer(session.shop, customerId, {
        is_vip: true,
        membership_start_date: startDate,
        membership_end_date: endDate,
      });
    }

    if (actionType === "remove_vip") {
      await updateCustomer(session.shop, customerId, {
        is_vip: false,
        membership_start_date: null,
        membership_end_date: null,
      });
    }
  } catch (error) {
    console.error("Error updating customer:", error);
    throw new Response("Failed to update customer", { status: 500 });
  }

  return null;
}


// ---------------- COMPONENT ----------------
// ---------------- COMPONENT ----------------
export default function CustomersPage() {
  const { customers } = useLoaderData();
  const navigation = useNavigation();

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
          columnContentTypes={["text", "text", "text", "text", "text"]}
          headings={["Name", "Email", "Status", "Expiry", "Action"]}
          rows={rows}
        />
      </Card>

      {/* -------- Make VIP Modal -------- */}
      <Modal
        open={activeModal}
        onClose={() => setActiveModal(false)}
        title="Select Membership Duration"
      >
        <Modal.Section>
          <Form
            method="post"
            onSubmit={() => setActiveModal(false)}
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

            <Button submit variant="primary" loading={navigation.state === "submitting"}>
              Confirm VIP
            </Button>
          </Form>
        </Modal.Section>
      </Modal>

      {/* -------- Remove VIP Confirmation Modal -------- */}
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