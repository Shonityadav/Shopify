// export default async function handler(req, res) {
//   try {
//     const { customerId, shop } = req.query;

//     if (!customerId) {
//       return res.json({
//         success: false,
//         isVIP: false,
//         message: "Login required",
//       });
//     }

//     const response = await fetch(
//       `https://${shop}/admin/api/2024-01/graphql.json`,
//       {
//         method: "POST",
//         headers: {
//           "Content-Type": "application/json",
//           "X-Shopify-Access-Token": process.env.SHOPIFY_ADMIN_TOKEN,
//         },
//         body: JSON.stringify({
//           query: `
//             query {
//               customer(id: "gid://shopify/Customer/${customerId}") {
//                 metafield(namespace: "vip", key: "is_vip") {
//                   value
//                 }
//               }
//             }
//           `,
//         }),
//       }
//     );

//     const data = await response.json();

//     const isVIP =
//       data?.data?.customer?.metafield?.value === "true";

//     return res.json({
//       success: true,
//       isVIP,
//       message: isVIP ? "VIP user" : "Not VIP",
//     });

//   } catch (err) {
//     console.error("VIP STATUS ERROR:", err);

//     return res.json({
//       success: false,
//       isVIP: false,
//       message: "Something went wrong",
//     });
//   }
// }