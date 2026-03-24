import { z } from "zod";
import { getAPConnector, Vendor } from "../connectors/ap.js";
import { getContractConnector, Contract } from "../connectors/contracts.js";
import { getPerformanceConnector, VendorScorecard } from "../connectors/performance.js";

// Schema definitions
export const GetVendorSummarySchema = z.object({
  vendor_id: z.string().min(1).describe("The unique vendor identifier"),
});

export const ListVendorsSchema = z.object({
  category: z.string().optional().describe("Filter by vendor category (e.g., 'IT Services', 'Raw Materials')"),
  status: z.enum(["active", "inactive", "blocked"]).optional().describe("Filter by vendor status"),
});

export const SearchVendorsSchema = z.object({
  query: z.string().min(1).describe("Search term to find vendors by name, display name, or category"),
});

export const GetTopVendorsSchema = z.object({
  limit: z.number().min(1).max(50).optional().default(10).describe("Number of top vendors to return (default: 10)"),
});

// Response types
export interface VendorSummary {
  vendor: Vendor;
  financials: {
    outstandingBalance: number;
    totalSpend: number;
    recentPayments: number;
  };
  contracts: {
    activeContracts: number;
    totalContractValue: number;
    contractList: Array<{
      id: string;
      title: string;
      endDate: string;
      value: number | undefined;
    }>;
  };
  performance: VendorScorecard | null;
}

// Tool implementations
export async function getVendorSummary(
  params: z.infer<typeof GetVendorSummarySchema>
): Promise<VendorSummary | null> {
  const { vendor_id } = params;
  console.log(`Getting vendor summary for: ${vendor_id}`);

  const apConnector = getAPConnector();
  const contractConnector = getContractConnector();
  const performanceConnector = getPerformanceConnector();

  // Get vendor details
  const vendor = await apConnector.getVendor(vendor_id);
  if (!vendor) {
    console.warn(`Vendor not found: ${vendor_id}`);
    return null;
  }

  // Get financial data
  const outstandingBalance = await apConnector.getVendorOutstandingBalance(vendor_id);
  const paymentHistory = await apConnector.getPaymentHistory(vendor_id);
  const totalSpend = paymentHistory.reduce((sum, p) => sum + p.amount, 0);
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const recentPayments = paymentHistory
    .filter((p) => new Date(p.paymentDate) >= thirtyDaysAgo)
    .reduce((sum, p) => sum + p.amount, 0);

  // Get contract data
  const contracts = await contractConnector.getVendorContracts(vendor_id);
  const totalContractValue = contracts.reduce((sum, c) => sum + (c.value || 0), 0);

  // Get performance data
  const scorecard = await performanceConnector.getVendorScorecard(vendor_id);

  return {
    vendor,
    financials: {
      outstandingBalance,
      totalSpend,
      recentPayments,
    },
    contracts: {
      activeContracts: contracts.length,
      totalContractValue,
      contractList: contracts.map((c) => ({
        id: c.id,
        title: c.title,
        endDate: c.endDate,
        value: c.value,
      })),
    },
    performance: scorecard,
  };
}

export async function listVendors(
  params: z.infer<typeof ListVendorsSchema>
): Promise<Vendor[]> {
  const { category, status } = params;
  console.log(`Listing vendors with filters:`, { category, status });

  const apConnector = getAPConnector();
  return apConnector.listVendors({ category, status });
}

export async function searchVendors(
  params: z.infer<typeof SearchVendorsSchema>
): Promise<Vendor[]> {
  const { query } = params;
  console.log(`Searching vendors for: ${query}`);

  const apConnector = getAPConnector();
  return apConnector.searchVendors(query);
}

export async function getTopVendors(
  params: z.infer<typeof GetTopVendorsSchema>
): Promise<
  Array<{
    vendor: Vendor;
    totalSpend: number;
    invoiceCount: number;
  }>
> {
  const { limit } = params;
  console.log(`Getting top ${limit} vendors by spend`);

  const apConnector = getAPConnector();
  return apConnector.getTopVendorsBySpend(limit);
}

// Tool definitions for MCP registration
export const vendorTools = [
  {
    name: "get_vendor_summary",
    description:
      "Get a complete vendor profile including contact info, payment terms, outstanding balance, active contracts, and performance score",
    schema: GetVendorSummarySchema,
    handler: getVendorSummary,
  },
  {
    name: "list_vendors",
    description: "List all vendors with optional filters for category and status",
    schema: ListVendorsSchema,
    handler: listVendors,
  },
  {
    name: "search_vendors",
    description: "Search for vendors by name, display name, or category",
    schema: SearchVendorsSchema,
    handler: searchVendors,
  },
  {
    name: "get_top_vendors",
    description: "Get the top vendors ranked by total spend",
    schema: GetTopVendorsSchema,
    handler: getTopVendors,
  },
];
