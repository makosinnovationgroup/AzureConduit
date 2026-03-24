import { z } from "zod";
import { getAPConnector, Invoice, Payment, APAgingBucket } from "../connectors/ap.js";

// Schema definitions
export const GetVendorInvoicesSchema = z.object({
  vendor_id: z.string().min(1).describe("The unique vendor identifier"),
  status: z
    .enum(["draft", "pending", "approved", "paid", "overdue", "cancelled"])
    .optional()
    .describe("Filter by invoice status"),
});

export const GetAPAgingSchema = z.object({
  vendor_id: z
    .string()
    .optional()
    .describe("Optional vendor ID to filter aging report for a specific vendor"),
});

export const GetPaymentHistorySchema = z.object({
  vendor_id: z.string().min(1).describe("The unique vendor identifier"),
});

export const GetOverduePayablesSchema = z.object({
  min_amount: z
    .number()
    .optional()
    .describe("Minimum amount to filter overdue invoices"),
  days_overdue: z
    .number()
    .optional()
    .describe("Minimum days overdue to include in results"),
});

// Response types
export interface OverdueInvoice extends Invoice {
  daysOverdue: number;
}

export interface APAgingSummary {
  byVendor: APAgingBucket[];
  totals: {
    current: number;
    days1to30: number;
    days31to60: number;
    days61to90: number;
    over90: number;
    grandTotal: number;
  };
}

// Tool implementations
export async function getVendorInvoices(
  params: z.infer<typeof GetVendorInvoicesSchema>
): Promise<Invoice[]> {
  const { vendor_id, status } = params;
  console.log(`Getting invoices for vendor: ${vendor_id}, status: ${status || "all"}`);

  const apConnector = getAPConnector();
  return apConnector.getVendorInvoices(vendor_id, status);
}

export async function getAPAging(
  params: z.infer<typeof GetAPAgingSchema>
): Promise<APAgingSummary> {
  const { vendor_id } = params;
  console.log(`Getting AP aging report${vendor_id ? ` for vendor: ${vendor_id}` : ""}`);

  const apConnector = getAPConnector();
  let agingData = await apConnector.getAPAging();

  if (vendor_id) {
    agingData = agingData.filter((a) => a.vendorId === vendor_id);
  }

  // Calculate totals
  const totals = agingData.reduce(
    (acc, bucket) => ({
      current: acc.current + bucket.current,
      days1to30: acc.days1to30 + bucket.days1to30,
      days31to60: acc.days31to60 + bucket.days31to60,
      days61to90: acc.days61to90 + bucket.days61to90,
      over90: acc.over90 + bucket.over90,
      grandTotal: acc.grandTotal + bucket.total,
    }),
    {
      current: 0,
      days1to30: 0,
      days31to60: 0,
      days61to90: 0,
      over90: 0,
      grandTotal: 0,
    }
  );

  return {
    byVendor: agingData,
    totals,
  };
}

export async function getPaymentHistory(
  params: z.infer<typeof GetPaymentHistorySchema>
): Promise<Payment[]> {
  const { vendor_id } = params;
  console.log(`Getting payment history for vendor: ${vendor_id}`);

  const apConnector = getAPConnector();
  const payments = await apConnector.getPaymentHistory(vendor_id);

  // Sort by payment date, most recent first
  return payments.sort(
    (a, b) => new Date(b.paymentDate).getTime() - new Date(a.paymentDate).getTime()
  );
}

export async function getOverduePayables(
  params: z.infer<typeof GetOverduePayablesSchema>
): Promise<OverdueInvoice[]> {
  const { min_amount, days_overdue } = params;
  console.log(
    `Getting overdue payables, min_amount: ${min_amount || "any"}, days_overdue: ${
      days_overdue || "any"
    }`
  );

  const apConnector = getAPConnector();
  const overdueInvoices = await apConnector.getOverdueInvoices();
  const today = new Date();

  let result: OverdueInvoice[] = overdueInvoices.map((invoice) => {
    const dueDate = new Date(invoice.dueDate);
    const daysOverdue = Math.ceil(
      (today.getTime() - dueDate.getTime()) / (24 * 60 * 60 * 1000)
    );
    return {
      ...invoice,
      daysOverdue,
    };
  });

  // Apply filters
  if (min_amount !== undefined) {
    result = result.filter((inv) => inv.balance >= min_amount);
  }

  if (days_overdue !== undefined) {
    result = result.filter((inv) => inv.daysOverdue >= days_overdue);
  }

  // Sort by days overdue, most overdue first
  return result.sort((a, b) => b.daysOverdue - a.daysOverdue);
}

// Tool definitions for MCP registration
export const apTools = [
  {
    name: "get_vendor_invoices",
    description: "Get all invoices for a specific vendor, optionally filtered by status",
    schema: GetVendorInvoicesSchema,
    handler: getVendorInvoices,
  },
  {
    name: "get_ap_aging",
    description:
      "Get accounts payable aging report showing outstanding balances by age bucket (current, 1-30, 31-60, 61-90, 90+ days)",
    schema: GetAPAgingSchema,
    handler: getAPAging,
  },
  {
    name: "get_payment_history",
    description: "Get payment history for a specific vendor, sorted by most recent first",
    schema: GetPaymentHistorySchema,
    handler: getPaymentHistory,
  },
  {
    name: "get_overdue_payables",
    description:
      "Get all overdue vendor invoices across all vendors, with optional filters for minimum amount and days overdue",
    schema: GetOverduePayablesSchema,
    handler: getOverduePayables,
  },
];
