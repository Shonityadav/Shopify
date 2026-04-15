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

import { useState, useMemo, useEffect, useRef } from "react";

import { authenticate } from "../shopify.server";
import { getCustomers, updateCustomer } from "../models/Customer.server";


// ---------------- LOADER ----------------
export async function loader({ request }) {
  const { admin, session } = await authenticate.admin(request);

  if (!session?.shop) {
    throw new Response("Unauthorized", { status: 401 });
  }

  try {
    const dbCustomers = await getCustomers(session.shop);

    const res = await admin.graphql(`
      query {
        customers(first: 50) {
          edges {
            node {
              id
              email
              metafields(first: 10) {
                edges {
                  node {
                    namespace
                    key
                    value
                  }
                }
              }
            }
          }
        }
      }
    `);

    const json = await res.json();

    const shopifyCustomers =
      json?.data?.customers?.edges.map(e => {
        const metafields = e.node.metafields.edges;

        const getMeta = (key) =>
          metafields.find(
            m => m.node.key === key && m.node.namespace === "vip"
          )?.node.value;

        return {
          id: e.node.id.split("/").pop(),
          email: e.node.email,
          is_vip_flag: getMeta("is_vip") === "true",
          end_date: getMeta("end_date"),
        };
      }) || [];

    const dbMap = {};
    for (const c of dbCustomers) {
      dbMap[String(c.shopify_customer_id)] = c;
    }

    const now = new Date();
    const finalCustomers = [];

    for (const c of shopifyCustomers) {
      const dbData = dbMap[c.id] || {};

      // ✅ VIP LOGIC (fixed)
      let isVipActive = c.is_vip_flag;

      if (c.is_vip_flag && c.end_date) {
        const expiry = new Date(c.end_date);
        if (expiry < now) {
          isVipActive = false;
        }
      }

      await updateCustomer(session.shop, c.id, {
        email: c.email,
        is_vip: isVipActive,
        membership_end_date: isVipActive ? c.end_date || null : null,
      });

      finalCustomers.push({
        shopify_customer_id: c.id,
        email: c.email,
        first_name: dbData.first_name || "-",
        last_name: dbData.last_name || "-",
        is_vip: isVipActive,
        membership_end_date: isVipActive ? c.end_date || null : null,
      });
    }

    return { customers: finalCustomers };

  } catch (error) {
    console.error(error);
    throw new Response("Failed to load customers", { status: 500 });
  }
}


// ---------------- ACTION ----------------
export async function action({ request }) {
  const { admin, session } = await authenticate.admin(request);

  if (!session?.shop) {
    throw new Response("Unauthorized", { status: 401 });
  }

  const formData = await request.formData();

  const customerId = formData.get("customerId");
  const actionType = formData.get("actionType");
  const months = formData.get("months");

  try {

    // ---------------- MAKE VIP ----------------
    if (actionType === "make_vip") {
      const startDate = new Date();
      const endDate = new Date();
      endDate.setMonth(endDate.getMonth() + Number(months));

      await updateCustomer(session.shop, customerId, {
        is_vip: true,
        membership_start_date: startDate,
        membership_end_date: endDate,
      });

      await admin.graphql(`
        mutation {
          metafieldsSet(metafields: [
            {
              ownerId: "gid://shopify/Customer/${customerId}"
              namespace: "vip"
              key: "is_vip"
              type: "boolean"
              value: "true"
            },
            {
              ownerId: "gid://shopify/Customer/${customerId}"
              namespace: "vip"
              key: "end_date"
              type: "date_time"
              value: "${endDate.toISOString()}"
            }
          ]) {
            userErrors {
              message
            }
          }
        }
      `);
    }

    // ---------------- REMOVE VIP ----------------
    if (actionType === "remove_vip") {
      await updateCustomer(session.shop, customerId, {
        is_vip: false,
        membership_start_date: null,
        membership_end_date: null,
      });

      await admin.graphql(`
        mutation {
          metafieldsSet(metafields: [
            {
              ownerId: "gid://shopify/Customer/${customerId}"
              namespace: "vip"
              key: "is_vip"
              type: "boolean"
              value: "false"
            },
            {
              ownerId: "gid://shopify/Customer/${customerId}"
              namespace: "vip"
              key: "end_date"
              type: "date_time"
              value: "1970-01-01T00:00:00Z"
            }
          ]) {
            userErrors {
              message
            }
          }
        }
      `);
    }

  } catch (error) {
    console.error(error);
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

  const removeFormRef = useRef(null);
  const [wasSubmitting, setWasSubmitting] = useState(false);

  useEffect(() => {
    if (navigation.state === "submitting") {
      setWasSubmitting(true);
    }

    if (wasSubmitting && navigation.state === "idle") {
      revalidator.revalidate();
      setWasSubmitting(false);
    }
  }, [navigation.state, wasSubmitting, revalidator]);

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
    c.is_vip && c.membership_end_date
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

      {/* -------- MAKE VIP MODAL -------- */}
      <Modal
        open={activeModal}
        onClose={() => setActiveModal(false)}
        title="Select Membership Duration"
      >
        <Modal.Section>
          <Form method="post" onSubmit={() => setActiveModal(false)}>
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

      {/* -------- REMOVE VIP MODAL -------- */}
      <Modal
        open={removeModal}
        onClose={() => setRemoveModal(false)}
        title="Confirm Removal"
        primaryAction={{
          content: "Remove VIP",
          destructive: true,
          loading: navigation.state === "submitting",
          onAction: () => {
            removeFormRef.current?.requestSubmit();
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

          <Form method="post" ref={removeFormRef}>
            <input type="hidden" name="customerId" value={selectedCustomer} />
            <input type="hidden" name="actionType" value="remove_vip" />
          </Form>
        </Modal.Section>
      </Modal>

    </Page>
  );
}