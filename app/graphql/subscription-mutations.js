/**
 * GraphQL Mutations and Queries for Shopify Subscriptions
 * These are template functions that return GraphQL operation strings
 */

/**
 * Create a Selling Plan Group
 * @returns {string} GraphQL mutation
 */
export function getCreateSellingPlanGroupMutation() {
  return `
    mutation CreateSellingPlanGroup($name: String!) {
      sellingPlanGroupCreate(
        input: {
          name: $name
          options: ["Delivery every"]
          sellingPlansToCreate: [
            {
              name: "Deliver every month"
              options: ["1 month"]
              category: SUBSCRIPTION
              billingPolicy: {
                recurring: {
                  interval: MONTH
                  intervalCount: 1
                }
              }
              deliveryPolicy: {
                recurring: {
                  interval: MONTH
                  intervalCount: 1
                }
              }
            }
          ]
        }
      ) {
        sellingPlanGroup {
          id
          sellingPlans(first:1){
            nodes{
              id
            }
          }
        }
        userErrors {
          field
          message
        }
      }
    }
  `;
}

/**
 * Create a Selling Plan within a group
 * @returns {string} GraphQL mutation
 */
export function getCreateSellingPlanMutation() {
  return `
    mutation CreateSellingPlan(
      $sellingPlanGroupId: ID!
      $name: String!
      $description: String
      $billingPolicy: SellingPlanBillingPolicyInput!
      $deliveryPolicy: SellingPlanDeliveryPolicyInput!
    ) {
      sellingPlanCreate(
        input: {
          sellingPlanGroupId: $sellingPlanGroupId
          name: $name
          description: $description
          billingPolicy: $billingPolicy
          deliveryPolicy: $deliveryPolicy
        }
      ) {
        sellingPlan {
          id
          name
          description
        }
        userErrors {
          field
          message
        }
      }
    }
  `;
}

/**
 * Add Products to a Selling Plan Group
 * @returns {string} GraphQL mutation
 */
export function getAddProductsToSellingPlanGroupMutation() {
  return `
    mutation AddProductsToSellingPlanGroup(
      $id: ID!
      $productIds: [ID!]!
    ) {
      sellingPlanGroupAddProducts(
        id: $id
        productIds: $productIds
      ) {
        sellingPlanGroup {
          id
          name
          products(first: 10) {
            nodes {
              id
              title
            }
          }
        }
        userErrors {
          field
          message
        }
      }
    }
  `;
}

/**
 * Query Subscription Contracts
 * @returns {string} GraphQL query
 */
export function getSubscriptionContractsQuery() {
  return `
    query GetSubscriptionContracts(
      $first: Int
      $after: String
      $status: SubscriptionContractStatus
      $customerId: ID
    ) {
      subscriptionContracts(
        first: $first
        after: $after
        status: $status
        customerId: $customerId
      ) {
        edges {
          node {
            id
            status
            lastPaymentStatus
            nextBillingDate
            currencyCode
            originalContract {
              id
            }
            customer {
              id
              email
            }
            createdAt
            updatedAt
            lines(first: 10) {
              edges {
                node {
                  id
                  variantId
                  quantity
                  sellingPlanId
                  currentPrice
                }
              }
            }
            billingAttempts(first: 10, tail: true) {
              edges {
                node {
                  id
                  status
                  errorMessage
                  createdAt
                }
              }
            }
          }
        }
        pageInfo {
          hasNextPage
          endCursor
        }
      }
    }
  `;
}

/**
 * Query a single Subscription Contract by ID
 * @returns {string} GraphQL query
 */
export function getSingleSubscriptionContractQuery() {
  return `
    query GetSubscriptionContract($id: ID!) {
      subscriptionContract(id: $id) {
        id
        status
        lastPaymentStatus
        nextBillingDate
        currencyCode
        customer {
          id
          email
          firstName
          lastName
        }
        createdAt
        updatedAt
        orders(first: 20) {
          edges {
            node {
              id
              name
              createdAt
              totalPrice
              financialStatus
            }
          }
        }
        lines(first: 10) {
          edges {
            node {
              id
              variantId
              quantity
              sellingPlanId
              currentPrice
            }
          }
        }
        billingAttempts(first: 20, tail: true) {
          edges {
            node {
              id
              status
              errorMessage
              orderId
              createdAt
            }
          }
        }
      }
    }
  `;
}

/**
 * Update Subscription Contract
 * @returns {string} GraphQL mutation
 */
export function getUpdateSubscriptionContractMutation() {
  return `
    mutation UpdateSubscriptionContract(
      $id: ID!
      $nextBillingDate: DateTime
      $status: SubscriptionContractStatus
    ) {
      subscriptionContractUpdate(
        input: {
          id: $id
          nextBillingDate: $nextBillingDate
          status: $status
        }
      ) {
        contract {
          id
          status
          nextBillingDate
        }
        userErrors {
          field
          message
        }
      }
    }
  `;
}

/**
 * Query Selling Plan Groups
 * @returns {string} GraphQL query
 */
export function getSellingPlanGroupsQuery() {
  return `
    query getSellingPlanGroups($first: Int!) {
      sellingPlanGroups(first: $first) {
        edges {
          node {
            id
            name
            options
            sellingPlans(first: 10) {
              edges {
                node {
                  id
                  name
                }
              }
            }
          }
        }
      }
    }
  `;
}

/**
 * Query Subscription Billing Attempts
 * @returns {string} GraphQL query
 */
export function getSubscriptionBillingAttemptsQuery() {
  return `
    query GetBillingAttempts(
      $subscriptionContractId: ID!
      $first: Int
    ) {
      subscriptionBillingAttempts(
        subscriptionContractId: $subscriptionContractId
        first: $first
      ) {
        edges {
          node {
            id
            status
            errorMessage
            orderId
            originalOrderId
            idempotencyKey
            createdAt
            completedAt
          }
        }
      }
    }
  `;
}


export function getUpdateSellingPlanMutation() {
  return `
  mutation updateSellingPlan($id: ID!, $input: SellingPlanGroupInput!) {
    sellingPlanGroupUpdate(id: $id, input: $input) {
      sellingPlanGroup {
        id
      }
      userErrors {
        field
        message
      }
    }
  }
  `;
}