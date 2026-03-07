import { Page, Card, DataTable } from "@shopify/polaris";
import { useLoaderData, useNavigate } from "react-router";

import { authenticate } from "../shopify.server";
import { connectToDatabase } from "../mongodb.server";


export async function loader({ request }) {
    await connectToDatabase();
    // Authenticate current shop
    const { session } = await authenticate.admin(request);
    
    // Connect to MongoDB

  // Fetch passes for this store only
    const db = await connectToDatabase();

    const passes = await db
    .collection("passes")
    .find({ store: session.shop })
    .toArray();

    return { passes };
    }

export default function Passes() {
  const { passes } = useLoaderData();
  const navigate = useNavigate();

  const rows = passes.map((pass) => [
    pass.name,
    pass.passType,
    `${pass.discountValue}%`,
    pass.isActive ? "Active" : "Disabled",
  ]);

  return (
    <Page
      title="Pass Management"
      primaryAction={{
        content: "Create Pass",
        onAction: () => navigate("create"),
      }}
    >
      <Card>
        <DataTable
          columnContentTypes={["text", "text", "text", "text"]}
          headings={["Name", "Type", "Discount", "Status"]}
          rows={rows}
        />
      </Card>
    </Page>
  );
}