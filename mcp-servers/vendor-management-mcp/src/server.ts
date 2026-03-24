import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

// Import connectors
import { initializeAPConnector } from "./connectors/ap.js";
import { initializeContractConnector } from "./connectors/contracts.js";
import { initializePerformanceConnector } from "./connectors/performance.js";

// Import tools
import {
  vendorTools,
  getVendorSummary,
  listVendors,
  searchVendors,
  getTopVendors,
} from "./tools/vendor-tools.js";
import {
  apTools,
  getVendorInvoices,
  getAPAging,
  getPaymentHistory,
  getOverduePayables,
} from "./tools/ap-tools.js";
import {
  contractTools,
  getVendorContracts,
  getExpiringContracts,
  getContractDetails,
} from "./tools/contract-tools.js";
import {
  performanceTools,
  getVendorScorecard,
  getUnderperformingVendors,
} from "./tools/performance-tools.js";

/**
 * Creates and configures the Vendor Management MCP server
 * This is a cross-system aggregator for AP, contracts, and vendor performance
 */
export function createMcpServer(): McpServer {
  // Initialize connectors
  initializeAPConnector();
  initializeContractConnector();
  initializePerformanceConnector();

  const server = new McpServer({
    name: "vendor-management-mcp",
    version: "1.0.0",
  });

  // Register Vendor Tools
  server.tool(
    "get_vendor_summary",
    "Get a complete vendor profile including contact info, payment terms, outstanding balance, active contracts, and performance score",
    {
      vendor_id: z.string().describe("The unique vendor identifier"),
    },
    async ({ vendor_id }) => {
      const result = await getVendorSummary({ vendor_id });
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    }
  );

  server.tool(
    "list_vendors",
    "List all vendors with optional filters for category and status",
    {
      category: z
        .string()
        .optional()
        .describe("Filter by vendor category (e.g., 'IT Services', 'Raw Materials')"),
      status: z
        .enum(["active", "inactive", "blocked"])
        .optional()
        .describe("Filter by vendor status"),
    },
    async ({ category, status }) => {
      const result = await listVendors({ category, status });
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    }
  );

  server.tool(
    "search_vendors",
    "Search for vendors by name, display name, or category",
    {
      query: z
        .string()
        .describe("Search term to find vendors by name, display name, or category"),
    },
    async ({ query }) => {
      const result = await searchVendors({ query });
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    }
  );

  server.tool(
    "get_top_vendors",
    "Get the top vendors ranked by total spend",
    {
      limit: z
        .number()
        .min(1)
        .max(50)
        .optional()
        .default(10)
        .describe("Number of top vendors to return (default: 10)"),
    },
    async ({ limit }) => {
      const result = await getTopVendors({ limit });
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    }
  );

  // Register AP Tools
  server.tool(
    "get_vendor_invoices",
    "Get all invoices for a specific vendor, optionally filtered by status",
    {
      vendor_id: z.string().describe("The unique vendor identifier"),
      status: z
        .enum(["draft", "pending", "approved", "paid", "overdue", "cancelled"])
        .optional()
        .describe("Filter by invoice status"),
    },
    async ({ vendor_id, status }) => {
      const result = await getVendorInvoices({ vendor_id, status });
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    }
  );

  server.tool(
    "get_ap_aging",
    "Get accounts payable aging report showing outstanding balances by age bucket (current, 1-30, 31-60, 61-90, 90+ days)",
    {
      vendor_id: z
        .string()
        .optional()
        .describe("Optional vendor ID to filter aging report for a specific vendor"),
    },
    async ({ vendor_id }) => {
      const result = await getAPAging({ vendor_id });
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    }
  );

  server.tool(
    "get_payment_history",
    "Get payment history for a specific vendor, sorted by most recent first",
    {
      vendor_id: z.string().describe("The unique vendor identifier"),
    },
    async ({ vendor_id }) => {
      const result = await getPaymentHistory({ vendor_id });
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    }
  );

  server.tool(
    "get_overdue_payables",
    "Get all overdue vendor invoices across all vendors, with optional filters for minimum amount and days overdue",
    {
      min_amount: z.number().optional().describe("Minimum amount to filter overdue invoices"),
      days_overdue: z
        .number()
        .optional()
        .describe("Minimum days overdue to include in results"),
    },
    async ({ min_amount, days_overdue }) => {
      const result = await getOverduePayables({ min_amount, days_overdue });
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    }
  );

  // Register Contract Tools
  server.tool(
    "get_vendor_contracts",
    "Get all active contracts for a specific vendor, including contract values and details",
    {
      vendor_id: z.string().describe("The unique vendor identifier"),
    },
    async ({ vendor_id }) => {
      const result = await getVendorContracts({ vendor_id });
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    }
  );

  server.tool(
    "get_expiring_contracts",
    "Get contracts expiring within a specified number of days, with renewal action recommendations",
    {
      days: z
        .number()
        .min(1)
        .max(365)
        .optional()
        .default(90)
        .describe("Number of days to look ahead for expiring contracts (default: 90)"),
    },
    async ({ days }) => {
      const result = await getExpiringContracts({ days });
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    }
  );

  server.tool(
    "get_contract_details",
    "Get detailed contract information including terms, obligations, signatories, and amendments",
    {
      contract_id: z.string().describe("The unique contract identifier"),
    },
    async ({ contract_id }) => {
      const result = await getContractDetails({ contract_id });
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    }
  );

  // Register Performance Tools
  server.tool(
    "get_vendor_scorecard",
    "Get comprehensive vendor performance metrics including quality, delivery, price scores, incidents, and performance analysis",
    {
      vendor_id: z.string().describe("The unique vendor identifier"),
    },
    async ({ vendor_id }) => {
      const result = await getVendorScorecard({ vendor_id });
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    }
  );

  server.tool(
    "get_underperforming_vendors",
    "Get all vendors performing below a specified threshold, with issues identified and recommended actions",
    {
      threshold: z
        .number()
        .min(0)
        .max(100)
        .optional()
        .default(70)
        .describe(
          "Performance score threshold (default: 70). Vendors scoring below this are included."
        ),
    },
    async ({ threshold }) => {
      const result = await getUnderperformingVendors({ threshold });
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    }
  );

  console.log("Vendor Management MCP server created with tools:");
  console.log("  Vendor Tools: get_vendor_summary, list_vendors, search_vendors, get_top_vendors");
  console.log(
    "  AP Tools: get_vendor_invoices, get_ap_aging, get_payment_history, get_overdue_payables"
  );
  console.log(
    "  Contract Tools: get_vendor_contracts, get_expiring_contracts, get_contract_details"
  );
  console.log("  Performance Tools: get_vendor_scorecard, get_underperforming_vendors");

  return server;
}
