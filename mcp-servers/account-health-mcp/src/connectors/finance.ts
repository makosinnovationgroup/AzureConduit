/**
 * Generic Finance Connector Interface
 * Supports: QuickBooks Online, Dynamics 365 Finance & Operations
 *
 * This connector provides a unified interface for retrieving financial data
 * from various accounting/ERP systems. The specific implementation is determined
 * by the FINANCE_PROVIDER environment variable.
 */

import axios, { AxiosInstance } from "axios";

// =============================================================================
// Types
// =============================================================================

export interface Invoice {
  id: string;
  customerId: string;
  customerName?: string;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  totalAmount: number;
  balanceDue: number;
  status: "open" | "paid" | "overdue" | "partial" | "voided";
  currency: string;
  lineItems?: InvoiceLineItem[];
}

export interface InvoiceLineItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
}

export interface Payment {
  id: string;
  customerId: string;
  customerName?: string;
  paymentDate: string;
  amount: number;
  paymentMethod?: string;
  referenceNumber?: string;
  invoiceId?: string;
}

export interface CustomerBalance {
  customerId: string;
  customerName: string;
  totalBalance: number;
  currentBalance: number;
  overdueBalance: number;
  daysOverdue: number;
  lastPaymentDate?: string;
  lastPaymentAmount?: number;
  creditLimit?: number;
}

export interface RevenueData {
  customerId: string;
  period: string; // YYYY-MM
  totalRevenue: number;
  invoiceCount: number;
  averageInvoiceAmount: number;
}

export interface FinanceConfig {
  provider: "quickbooks" | "dynamics365_finance";
  // QuickBooks config
  qbClientId?: string;
  qbClientSecret?: string;
  qbRealmId?: string;
  qbRefreshToken?: string;
  qbEnvironment?: "sandbox" | "production";
  // Dynamics 365 Finance config
  d365TenantId?: string;
  d365ClientId?: string;
  d365ClientSecret?: string;
  d365FinanceResourceUrl?: string;
}

// =============================================================================
// Finance Connector Interface
// =============================================================================

export interface IFinanceConnector {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  isConnected(): boolean;

  // Invoice operations
  getCustomerInvoices(customerId: string, days?: number): Promise<Invoice[]>;
  getOverdueInvoices(customerId: string): Promise<Invoice[]>;
  getInvoice(invoiceId: string): Promise<Invoice | null>;

  // Payment operations
  getCustomerPayments(customerId: string, days?: number): Promise<Payment[]>;
  getLastPayment(customerId: string): Promise<Payment | null>;

  // Balance operations
  getCustomerBalance(customerId: string): Promise<CustomerBalance | null>;
  getOverdueCustomers(): Promise<CustomerBalance[]>;

  // Revenue operations
  getCustomerRevenue(
    customerId: string,
    startDate: string,
    endDate: string
  ): Promise<RevenueData[]>;
  getRevenueTrend(
    customerId: string,
    periods: number
  ): Promise<RevenueData[]>;
}

// =============================================================================
// QuickBooks Connector Implementation
// =============================================================================

class QuickBooksConnector implements IFinanceConnector {
  private config: FinanceConfig;
  private accessToken: string | null = null;
  private client: AxiosInstance | null = null;
  private connected: boolean = false;

  constructor(config: FinanceConfig) {
    this.config = config;
  }

  async connect(): Promise<void> {
    console.log("[Finance:QuickBooks] Connecting...");

    const baseUrl =
      this.config.qbEnvironment === "production"
        ? "https://oauth.platform.intuit.com"
        : "https://oauth.platform.intuit.com";

    // Exchange refresh token for access token
    const authHeader = Buffer.from(
      `${this.config.qbClientId}:${this.config.qbClientSecret}`
    ).toString("base64");

    const response = await axios.post(
      `${baseUrl}/oauth2/v1/tokens/bearer`,
      new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: this.config.qbRefreshToken!,
      }).toString(),
      {
        headers: {
          Authorization: `Basic ${authHeader}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
      }
    );

    this.accessToken = response.data.access_token;

    const apiBaseUrl =
      this.config.qbEnvironment === "production"
        ? "https://quickbooks.api.intuit.com"
        : "https://sandbox-quickbooks.api.intuit.com";

    this.client = axios.create({
      baseURL: `${apiBaseUrl}/v3/company/${this.config.qbRealmId}`,
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
    });

    this.connected = true;
    console.log("[Finance:QuickBooks] Connected successfully");
  }

  async disconnect(): Promise<void> {
    this.accessToken = null;
    this.client = null;
    this.connected = false;
    console.log("[Finance:QuickBooks] Disconnected");
  }

  isConnected(): boolean {
    return this.connected;
  }

  private async query<T>(queryString: string): Promise<T[]> {
    if (!this.client) throw new Error("Not connected to QuickBooks");

    const response = await this.client.get(
      `/query?query=${encodeURIComponent(queryString)}`
    );
    const queryResponse = response.data.QueryResponse;
    return Object.values(queryResponse)[0] as T[] || [];
  }

  async getCustomerInvoices(
    customerId: string,
    days: number = 365
  ): Promise<Invoice[]> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const records = await this.query<any>(
      `SELECT * FROM Invoice WHERE CustomerRef = '${customerId}' AND TxnDate >= '${startDate.toISOString().split("T")[0]}'`
    );

    return records.map((r) => this.mapInvoice(r));
  }

  private mapInvoice(r: any): Invoice {
    const now = new Date();
    const dueDate = new Date(r.DueDate);
    const isOverdue = dueDate < now && r.Balance > 0;

    let status: Invoice["status"] = "open";
    if (r.Balance === 0) status = "paid";
    else if (isOverdue) status = "overdue";
    else if (r.Balance < r.TotalAmt) status = "partial";

    return {
      id: r.Id,
      customerId: r.CustomerRef?.value,
      customerName: r.CustomerRef?.name,
      invoiceNumber: r.DocNumber,
      invoiceDate: r.TxnDate,
      dueDate: r.DueDate,
      totalAmount: r.TotalAmt,
      balanceDue: r.Balance,
      status,
      currency: r.CurrencyRef?.value || "USD",
      lineItems: r.Line?.filter((l: any) => l.DetailType === "SalesItemLineDetail").map((l: any) => ({
        id: l.Id,
        description: l.Description,
        quantity: l.SalesItemLineDetail?.Qty,
        unitPrice: l.SalesItemLineDetail?.UnitPrice,
        amount: l.Amount,
      })),
    };
  }

  async getOverdueInvoices(customerId: string): Promise<Invoice[]> {
    const invoices = await this.getCustomerInvoices(customerId, 365);
    return invoices.filter((i) => i.status === "overdue");
  }

  async getInvoice(invoiceId: string): Promise<Invoice | null> {
    if (!this.client) throw new Error("Not connected to QuickBooks");

    try {
      const response = await this.client.get(`/invoice/${invoiceId}`);
      return this.mapInvoice(response.data.Invoice);
    } catch {
      return null;
    }
  }

  async getCustomerPayments(
    customerId: string,
    days: number = 365
  ): Promise<Payment[]> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const records = await this.query<any>(
      `SELECT * FROM Payment WHERE CustomerRef = '${customerId}' AND TxnDate >= '${startDate.toISOString().split("T")[0]}'`
    );

    return records.map((r) => ({
      id: r.Id,
      customerId: r.CustomerRef?.value,
      customerName: r.CustomerRef?.name,
      paymentDate: r.TxnDate,
      amount: r.TotalAmt,
      paymentMethod: r.PaymentMethodRef?.name,
      referenceNumber: r.PaymentRefNum,
    }));
  }

  async getLastPayment(customerId: string): Promise<Payment | null> {
    const payments = await this.getCustomerPayments(customerId, 365);
    if (payments.length === 0) return null;

    return payments.sort(
      (a, b) =>
        new Date(b.paymentDate).getTime() - new Date(a.paymentDate).getTime()
    )[0];
  }

  async getCustomerBalance(customerId: string): Promise<CustomerBalance | null> {
    const invoices = await this.getCustomerInvoices(customerId, 365);
    const lastPayment = await this.getLastPayment(customerId);

    if (invoices.length === 0) return null;

    const now = new Date();
    let totalBalance = 0;
    let currentBalance = 0;
    let overdueBalance = 0;
    let maxDaysOverdue = 0;

    for (const invoice of invoices) {
      if (invoice.balanceDue > 0) {
        totalBalance += invoice.balanceDue;
        const dueDate = new Date(invoice.dueDate);
        if (dueDate < now) {
          overdueBalance += invoice.balanceDue;
          const daysOverdue = Math.floor(
            (now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)
          );
          maxDaysOverdue = Math.max(maxDaysOverdue, daysOverdue);
        } else {
          currentBalance += invoice.balanceDue;
        }
      }
    }

    return {
      customerId,
      customerName: invoices[0]?.customerName || "",
      totalBalance,
      currentBalance,
      overdueBalance,
      daysOverdue: maxDaysOverdue,
      lastPaymentDate: lastPayment?.paymentDate,
      lastPaymentAmount: lastPayment?.amount,
    };
  }

  async getOverdueCustomers(): Promise<CustomerBalance[]> {
    const records = await this.query<any>(
      `SELECT * FROM Invoice WHERE Balance > '0'`
    );

    const customerIds = [...new Set(records.map((r) => r.CustomerRef?.value))];
    const balances: CustomerBalance[] = [];

    for (const customerId of customerIds) {
      if (customerId) {
        const balance = await this.getCustomerBalance(customerId);
        if (balance && balance.overdueBalance > 0) {
          balances.push(balance);
        }
      }
    }

    return balances.sort((a, b) => b.overdueBalance - a.overdueBalance);
  }

  async getCustomerRevenue(
    customerId: string,
    startDate: string,
    endDate: string
  ): Promise<RevenueData[]> {
    const records = await this.query<any>(
      `SELECT * FROM Invoice WHERE CustomerRef = '${customerId}'
       AND TxnDate >= '${startDate}' AND TxnDate <= '${endDate}'`
    );

    // Group by month
    const monthlyData: { [key: string]: { total: number; count: number } } = {};

    for (const r of records) {
      const date = new Date(r.TxnDate);
      const period = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

      if (!monthlyData[period]) {
        monthlyData[period] = { total: 0, count: 0 };
      }
      monthlyData[period].total += r.TotalAmt || 0;
      monthlyData[period].count += 1;
    }

    return Object.entries(monthlyData)
      .map(([period, data]) => ({
        customerId,
        period,
        totalRevenue: data.total,
        invoiceCount: data.count,
        averageInvoiceAmount: data.count > 0 ? data.total / data.count : 0,
      }))
      .sort((a, b) => a.period.localeCompare(b.period));
  }

  async getRevenueTrend(
    customerId: string,
    periods: number = 12
  ): Promise<RevenueData[]> {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - periods);

    return this.getCustomerRevenue(
      customerId,
      startDate.toISOString().split("T")[0],
      endDate.toISOString().split("T")[0]
    );
  }
}

// =============================================================================
// Dynamics 365 Finance Connector Implementation
// =============================================================================

class Dynamics365FinanceConnector implements IFinanceConnector {
  private config: FinanceConfig;
  private accessToken: string | null = null;
  private client: AxiosInstance | null = null;
  private connected: boolean = false;

  constructor(config: FinanceConfig) {
    this.config = config;
  }

  async connect(): Promise<void> {
    console.log("[Finance:D365] Connecting...");

    const tokenUrl = `https://login.microsoftonline.com/${this.config.d365TenantId}/oauth2/v2.0/token`;

    const params = new URLSearchParams({
      grant_type: "client_credentials",
      client_id: this.config.d365ClientId!,
      client_secret: this.config.d365ClientSecret!,
      scope: `${this.config.d365FinanceResourceUrl}/.default`,
    });

    const response = await axios.post(tokenUrl, params.toString(), {
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });

    this.accessToken = response.data.access_token;

    this.client = axios.create({
      baseURL: `${this.config.d365FinanceResourceUrl}/data`,
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        "Content-Type": "application/json",
        "OData-MaxVersion": "4.0",
        "OData-Version": "4.0",
      },
    });

    this.connected = true;
    console.log("[Finance:D365] Connected successfully");
  }

  async disconnect(): Promise<void> {
    this.accessToken = null;
    this.client = null;
    this.connected = false;
    console.log("[Finance:D365] Disconnected");
  }

  isConnected(): boolean {
    return this.connected;
  }

  private async query<T>(entity: string, filter?: string, select?: string, top?: number): Promise<T[]> {
    if (!this.client) throw new Error("Not connected to Dynamics 365 Finance");

    let url = `/${entity}`;
    const params: string[] = [];
    if (filter) params.push(`$filter=${encodeURIComponent(filter)}`);
    if (select) params.push(`$select=${select}`);
    if (top) params.push(`$top=${top}`);
    if (params.length > 0) url += `?${params.join("&")}`;

    const response = await this.client.get(url);
    return response.data.value;
  }

  async getCustomerInvoices(
    customerId: string,
    days: number = 365
  ): Promise<Invoice[]> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const records = await this.query<any>(
      "SalesInvoiceHeaders",
      `InvoiceAccount eq '${customerId}' and InvoiceDate ge ${startDate.toISOString()}`
    );

    return records.map((r) => this.mapInvoice(r));
  }

  private mapInvoice(r: any): Invoice {
    const now = new Date();
    const dueDate = new Date(r.DueDate);
    const isOverdue = dueDate < now && r.InvoiceAmountMST - (r.SettledAmountMST || 0) > 0;
    const balanceDue = r.InvoiceAmountMST - (r.SettledAmountMST || 0);

    let status: Invoice["status"] = "open";
    if (balanceDue === 0) status = "paid";
    else if (isOverdue) status = "overdue";
    else if (balanceDue < r.InvoiceAmountMST) status = "partial";

    return {
      id: r.InvoiceNumber,
      customerId: r.InvoiceAccount,
      customerName: r.CustomerName,
      invoiceNumber: r.InvoiceNumber,
      invoiceDate: r.InvoiceDate,
      dueDate: r.DueDate,
      totalAmount: r.InvoiceAmountMST,
      balanceDue,
      status,
      currency: r.CurrencyCode || "USD",
    };
  }

  async getOverdueInvoices(customerId: string): Promise<Invoice[]> {
    const invoices = await this.getCustomerInvoices(customerId, 365);
    return invoices.filter((i) => i.status === "overdue");
  }

  async getInvoice(invoiceId: string): Promise<Invoice | null> {
    const records = await this.query<any>(
      "SalesInvoiceHeaders",
      `InvoiceNumber eq '${invoiceId}'`
    );

    return records.length > 0 ? this.mapInvoice(records[0]) : null;
  }

  async getCustomerPayments(
    customerId: string,
    days: number = 365
  ): Promise<Payment[]> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const records = await this.query<any>(
      "CustomerPaymentJournalLines",
      `AccountNum eq '${customerId}' and TransDate ge ${startDate.toISOString()}`
    );

    return records.map((r) => ({
      id: r.JournalBatchNumber + "-" + r.LineNumber,
      customerId: r.AccountNum,
      paymentDate: r.TransDate,
      amount: Math.abs(r.CreditAmount || r.AmountCurCredit || 0),
      paymentMethod: r.MethodOfPayment,
      referenceNumber: r.PaymentReference,
    }));
  }

  async getLastPayment(customerId: string): Promise<Payment | null> {
    const payments = await this.getCustomerPayments(customerId, 365);
    if (payments.length === 0) return null;

    return payments.sort(
      (a, b) =>
        new Date(b.paymentDate).getTime() - new Date(a.paymentDate).getTime()
    )[0];
  }

  async getCustomerBalance(customerId: string): Promise<CustomerBalance | null> {
    const invoices = await this.getCustomerInvoices(customerId, 365);
    const lastPayment = await this.getLastPayment(customerId);

    if (invoices.length === 0) return null;

    const now = new Date();
    let totalBalance = 0;
    let currentBalance = 0;
    let overdueBalance = 0;
    let maxDaysOverdue = 0;

    for (const invoice of invoices) {
      if (invoice.balanceDue > 0) {
        totalBalance += invoice.balanceDue;
        const dueDate = new Date(invoice.dueDate);
        if (dueDate < now) {
          overdueBalance += invoice.balanceDue;
          const daysOverdue = Math.floor(
            (now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)
          );
          maxDaysOverdue = Math.max(maxDaysOverdue, daysOverdue);
        } else {
          currentBalance += invoice.balanceDue;
        }
      }
    }

    return {
      customerId,
      customerName: invoices[0]?.customerName || "",
      totalBalance,
      currentBalance,
      overdueBalance,
      daysOverdue: maxDaysOverdue,
      lastPaymentDate: lastPayment?.paymentDate,
      lastPaymentAmount: lastPayment?.amount,
    };
  }

  async getOverdueCustomers(): Promise<CustomerBalance[]> {
    // Get all open invoices
    const records = await this.query<any>(
      "SalesInvoiceHeaders",
      "InvoiceAmountMST gt SettledAmountMST"
    );

    const customerIds = [
      ...new Set(records.map((r) => r.InvoiceAccount)),
    ];
    const balances: CustomerBalance[] = [];

    for (const customerId of customerIds) {
      if (customerId) {
        const balance = await this.getCustomerBalance(customerId);
        if (balance && balance.overdueBalance > 0) {
          balances.push(balance);
        }
      }
    }

    return balances.sort((a, b) => b.overdueBalance - a.overdueBalance);
  }

  async getCustomerRevenue(
    customerId: string,
    startDate: string,
    endDate: string
  ): Promise<RevenueData[]> {
    const records = await this.query<any>(
      "SalesInvoiceHeaders",
      `InvoiceAccount eq '${customerId}' and InvoiceDate ge ${startDate} and InvoiceDate le ${endDate}`
    );

    // Group by month
    const monthlyData: { [key: string]: { total: number; count: number } } = {};

    for (const r of records) {
      const date = new Date(r.InvoiceDate);
      const period = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

      if (!monthlyData[period]) {
        monthlyData[period] = { total: 0, count: 0 };
      }
      monthlyData[period].total += r.InvoiceAmountMST || 0;
      monthlyData[period].count += 1;
    }

    return Object.entries(monthlyData)
      .map(([period, data]) => ({
        customerId,
        period,
        totalRevenue: data.total,
        invoiceCount: data.count,
        averageInvoiceAmount: data.count > 0 ? data.total / data.count : 0,
      }))
      .sort((a, b) => a.period.localeCompare(b.period));
  }

  async getRevenueTrend(
    customerId: string,
    periods: number = 12
  ): Promise<RevenueData[]> {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - periods);

    return this.getCustomerRevenue(
      customerId,
      startDate.toISOString().split("T")[0],
      endDate.toISOString().split("T")[0]
    );
  }
}

// =============================================================================
// Factory and Singleton
// =============================================================================

let financeConnector: IFinanceConnector | null = null;

export function initializeFinanceConnector(
  config: FinanceConfig
): IFinanceConnector {
  if (config.provider === "quickbooks") {
    financeConnector = new QuickBooksConnector(config);
  } else if (config.provider === "dynamics365_finance") {
    financeConnector = new Dynamics365FinanceConnector(config);
  } else {
    throw new Error(`Unknown finance provider: ${config.provider}`);
  }
  return financeConnector;
}

export function getFinanceConnector(): IFinanceConnector {
  if (!financeConnector) {
    throw new Error(
      "Finance connector not initialized. Call initializeFinanceConnector first."
    );
  }
  return financeConnector;
}

export function createFinanceConfigFromEnv(): FinanceConfig {
  const provider = (process.env.FINANCE_PROVIDER || "quickbooks") as
    | "quickbooks"
    | "dynamics365_finance";

  return {
    provider,
    // QuickBooks
    qbClientId: process.env.QB_CLIENT_ID,
    qbClientSecret: process.env.QB_CLIENT_SECRET,
    qbRealmId: process.env.QB_REALM_ID,
    qbRefreshToken: process.env.QB_REFRESH_TOKEN,
    qbEnvironment: (process.env.QB_ENVIRONMENT || "sandbox") as
      | "sandbox"
      | "production",
    // Dynamics 365 Finance
    d365TenantId: process.env.D365_TENANT_ID,
    d365ClientId: process.env.D365_CLIENT_ID,
    d365ClientSecret: process.env.D365_CLIENT_SECRET,
    d365FinanceResourceUrl: process.env.D365_FINANCE_RESOURCE_URL,
  };
}
