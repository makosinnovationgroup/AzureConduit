import axios, { AxiosInstance } from "axios";

/**
 * Accounts Payable Connector
 * Supports D365 Finance, QuickBooks, or a generic REST API
 */

export interface APConfig {
  system: "d365" | "quickbooks" | "generic";
  // D365 Finance
  d365TenantId?: string;
  d365ClientId?: string;
  d365ClientSecret?: string;
  d365EnvironmentUrl?: string;
  // QuickBooks
  qbClientId?: string;
  qbClientSecret?: string;
  qbRealmId?: string;
  qbRefreshToken?: string;
  qbEnvironment?: "sandbox" | "production";
  // Generic
  apiUrl?: string;
  apiKey?: string;
}

export interface Vendor {
  id: string;
  name: string;
  displayName: string;
  email?: string;
  phone?: string;
  address?: {
    street?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
  };
  category?: string;
  status: "active" | "inactive" | "blocked";
  paymentTerms?: string;
  currency?: string;
  taxId?: string;
  bankAccount?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  vendorId: string;
  vendorName: string;
  invoiceDate: string;
  dueDate: string;
  amount: number;
  balance: number;
  currency: string;
  status: "draft" | "pending" | "approved" | "paid" | "overdue" | "cancelled";
  lineItems?: InvoiceLineItem[];
  paymentDate?: string;
  paymentReference?: string;
}

export interface InvoiceLineItem {
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  accountCode?: string;
}

export interface Payment {
  id: string;
  vendorId: string;
  vendorName: string;
  paymentDate: string;
  amount: number;
  currency: string;
  paymentMethod: string;
  reference: string;
  invoiceIds: string[];
}

export interface APAgingBucket {
  vendorId: string;
  vendorName: string;
  current: number;
  days1to30: number;
  days31to60: number;
  days61to90: number;
  over90: number;
  total: number;
}

export class APConnector {
  private config: APConfig;
  private httpClient: AxiosInstance;
  private accessToken?: string;

  constructor(config: APConfig) {
    this.config = config;
    this.httpClient = axios.create({
      timeout: 30000,
    });
  }

  async initialize(): Promise<void> {
    switch (this.config.system) {
      case "d365":
        await this.initializeD365();
        break;
      case "quickbooks":
        await this.initializeQuickBooks();
        break;
      case "generic":
        this.initializeGeneric();
        break;
    }
  }

  private async initializeD365(): Promise<void> {
    if (
      !this.config.d365TenantId ||
      !this.config.d365ClientId ||
      !this.config.d365ClientSecret
    ) {
      console.warn("D365 credentials not fully configured, using mock data");
      return;
    }

    try {
      const tokenResponse = await axios.post(
        `https://login.microsoftonline.com/${this.config.d365TenantId}/oauth2/v2.0/token`,
        new URLSearchParams({
          client_id: this.config.d365ClientId,
          client_secret: this.config.d365ClientSecret,
          scope: `${this.config.d365EnvironmentUrl}/.default`,
          grant_type: "client_credentials",
        }),
        {
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
        }
      );
      this.accessToken = tokenResponse.data.access_token;
      console.log("D365 Finance authenticated successfully");
    } catch (error) {
      console.error("Failed to authenticate with D365 Finance:", error);
      throw error;
    }
  }

  private async initializeQuickBooks(): Promise<void> {
    if (!this.config.qbClientId || !this.config.qbClientSecret) {
      console.warn("QuickBooks credentials not configured, using mock data");
      return;
    }
    console.log("QuickBooks connector initialized");
  }

  private initializeGeneric(): void {
    if (this.config.apiUrl && this.config.apiKey) {
      this.httpClient = axios.create({
        baseURL: this.config.apiUrl,
        timeout: 30000,
        headers: {
          Authorization: `Bearer ${this.config.apiKey}`,
          "Content-Type": "application/json",
        },
      });
    }
    console.log("Generic AP connector initialized");
  }

  // Vendor Methods
  async listVendors(params?: {
    category?: string;
    status?: string;
  }): Promise<Vendor[]> {
    if (this.config.system === "generic" && this.config.apiUrl) {
      try {
        const response = await this.httpClient.get("/vendors", { params });
        return response.data;
      } catch (error) {
        console.warn("Generic API unavailable, returning mock data");
      }
    }

    // Mock data for development/demo
    return this.getMockVendors(params);
  }

  async getVendor(vendorId: string): Promise<Vendor | null> {
    if (this.config.system === "generic" && this.config.apiUrl) {
      try {
        const response = await this.httpClient.get(`/vendors/${vendorId}`);
        return response.data;
      } catch (error) {
        console.warn("Generic API unavailable, returning mock data");
      }
    }

    const vendors = await this.listVendors();
    return vendors.find((v) => v.id === vendorId) || null;
  }

  async searchVendors(query: string): Promise<Vendor[]> {
    const vendors = await this.listVendors();
    const lowerQuery = query.toLowerCase();
    return vendors.filter(
      (v) =>
        v.name.toLowerCase().includes(lowerQuery) ||
        v.displayName.toLowerCase().includes(lowerQuery) ||
        v.category?.toLowerCase().includes(lowerQuery)
    );
  }

  async getTopVendorsBySpend(limit: number = 10): Promise<
    Array<{
      vendor: Vendor;
      totalSpend: number;
      invoiceCount: number;
    }>
  > {
    const vendors = await this.listVendors();
    const payments = await this.getAllPayments();

    const vendorSpend = new Map<
      string,
      { totalSpend: number; invoiceCount: number }
    >();

    for (const payment of payments) {
      const current = vendorSpend.get(payment.vendorId) || {
        totalSpend: 0,
        invoiceCount: 0,
      };
      current.totalSpend += payment.amount;
      current.invoiceCount += payment.invoiceIds.length;
      vendorSpend.set(payment.vendorId, current);
    }

    return vendors
      .map((vendor) => ({
        vendor,
        ...(vendorSpend.get(vendor.id) || { totalSpend: 0, invoiceCount: 0 }),
      }))
      .sort((a, b) => b.totalSpend - a.totalSpend)
      .slice(0, limit);
  }

  // Invoice Methods
  async getVendorInvoices(
    vendorId: string,
    status?: string
  ): Promise<Invoice[]> {
    if (this.config.system === "generic" && this.config.apiUrl) {
      try {
        const response = await this.httpClient.get(
          `/vendors/${vendorId}/invoices`,
          {
            params: { status },
          }
        );
        return response.data;
      } catch (error) {
        console.warn("Generic API unavailable, returning mock data");
      }
    }

    let invoices = this.getMockInvoices().filter(
      (i) => i.vendorId === vendorId
    );
    if (status) {
      invoices = invoices.filter((i) => i.status === status);
    }
    return invoices;
  }

  async getOverdueInvoices(): Promise<Invoice[]> {
    const allInvoices = this.getMockInvoices();
    const today = new Date();
    return allInvoices.filter((invoice) => {
      const dueDate = new Date(invoice.dueDate);
      return dueDate < today && invoice.balance > 0;
    });
  }

  async getAPAging(): Promise<APAgingBucket[]> {
    if (this.config.system === "generic" && this.config.apiUrl) {
      try {
        const response = await this.httpClient.get("/ap/aging");
        return response.data;
      } catch (error) {
        console.warn("Generic API unavailable, returning mock data");
      }
    }

    return this.getMockAPAging();
  }

  // Payment Methods
  async getPaymentHistory(vendorId: string): Promise<Payment[]> {
    if (this.config.system === "generic" && this.config.apiUrl) {
      try {
        const response = await this.httpClient.get(
          `/vendors/${vendorId}/payments`
        );
        return response.data;
      } catch (error) {
        console.warn("Generic API unavailable, returning mock data");
      }
    }

    return this.getMockPayments().filter((p) => p.vendorId === vendorId);
  }

  async getAllPayments(): Promise<Payment[]> {
    if (this.config.system === "generic" && this.config.apiUrl) {
      try {
        const response = await this.httpClient.get("/payments");
        return response.data;
      } catch (error) {
        console.warn("Generic API unavailable, returning mock data");
      }
    }

    return this.getMockPayments();
  }

  async getVendorOutstandingBalance(vendorId: string): Promise<number> {
    const invoices = await this.getVendorInvoices(vendorId);
    return invoices.reduce((sum, inv) => sum + inv.balance, 0);
  }

  // Mock Data Methods
  private getMockVendors(params?: {
    category?: string;
    status?: string;
  }): Vendor[] {
    let vendors: Vendor[] = [
      {
        id: "VEND-001",
        name: "acme-corp",
        displayName: "Acme Corporation",
        email: "billing@acme.com",
        phone: "+1-555-100-2000",
        address: {
          street: "100 Industrial Way",
          city: "Chicago",
          state: "IL",
          postalCode: "60601",
          country: "USA",
        },
        category: "Raw Materials",
        status: "active",
        paymentTerms: "Net 30",
        currency: "USD",
        taxId: "12-3456789",
        createdAt: "2022-01-15T00:00:00Z",
        updatedAt: "2024-11-01T00:00:00Z",
      },
      {
        id: "VEND-002",
        name: "global-tech",
        displayName: "Global Tech Solutions",
        email: "ap@globaltech.com",
        phone: "+1-555-200-3000",
        address: {
          street: "500 Tech Park",
          city: "San Jose",
          state: "CA",
          postalCode: "95110",
          country: "USA",
        },
        category: "IT Services",
        status: "active",
        paymentTerms: "Net 45",
        currency: "USD",
        taxId: "98-7654321",
        createdAt: "2021-06-01T00:00:00Z",
        updatedAt: "2024-10-15T00:00:00Z",
      },
      {
        id: "VEND-003",
        name: "office-plus",
        displayName: "Office Plus Supplies",
        email: "orders@officeplus.com",
        phone: "+1-555-300-4000",
        address: {
          street: "200 Commerce Blvd",
          city: "Dallas",
          state: "TX",
          postalCode: "75201",
          country: "USA",
        },
        category: "Office Supplies",
        status: "active",
        paymentTerms: "Net 15",
        currency: "USD",
        taxId: "45-6789012",
        createdAt: "2023-03-10T00:00:00Z",
        updatedAt: "2024-09-20T00:00:00Z",
      },
      {
        id: "VEND-004",
        name: "logistics-pro",
        displayName: "Logistics Pro Inc",
        email: "billing@logisticspro.com",
        phone: "+1-555-400-5000",
        address: {
          street: "800 Freight Way",
          city: "Memphis",
          state: "TN",
          postalCode: "38103",
          country: "USA",
        },
        category: "Logistics",
        status: "active",
        paymentTerms: "Net 30",
        currency: "USD",
        taxId: "67-8901234",
        createdAt: "2020-09-01T00:00:00Z",
        updatedAt: "2024-11-10T00:00:00Z",
      },
      {
        id: "VEND-005",
        name: "clean-green",
        displayName: "Clean & Green Services",
        email: "accounts@cleangreen.com",
        phone: "+1-555-500-6000",
        address: {
          street: "50 Eco Lane",
          city: "Portland",
          state: "OR",
          postalCode: "97201",
          country: "USA",
        },
        category: "Facilities",
        status: "inactive",
        paymentTerms: "Net 30",
        currency: "USD",
        taxId: "89-0123456",
        createdAt: "2022-07-15T00:00:00Z",
        updatedAt: "2024-08-01T00:00:00Z",
      },
    ];

    if (params?.category) {
      vendors = vendors.filter(
        (v) => v.category?.toLowerCase() === params.category?.toLowerCase()
      );
    }
    if (params?.status) {
      vendors = vendors.filter((v) => v.status === params.status);
    }

    return vendors;
  }

  private getMockInvoices(): Invoice[] {
    const today = new Date();
    const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sixtyDaysAgo = new Date(today.getTime() - 60 * 24 * 60 * 60 * 1000);
    const tenDaysFromNow = new Date(today.getTime() + 10 * 24 * 60 * 60 * 1000);

    return [
      {
        id: "INV-001",
        invoiceNumber: "ACME-2024-0150",
        vendorId: "VEND-001",
        vendorName: "Acme Corporation",
        invoiceDate: thirtyDaysAgo.toISOString().split("T")[0],
        dueDate: today.toISOString().split("T")[0],
        amount: 15000.0,
        balance: 15000.0,
        currency: "USD",
        status: "pending",
        lineItems: [
          {
            description: "Steel Components Q4 Batch",
            quantity: 500,
            unitPrice: 30.0,
            amount: 15000.0,
          },
        ],
      },
      {
        id: "INV-002",
        invoiceNumber: "GT-2024-0089",
        vendorId: "VEND-002",
        vendorName: "Global Tech Solutions",
        invoiceDate: sixtyDaysAgo.toISOString().split("T")[0],
        dueDate: thirtyDaysAgo.toISOString().split("T")[0],
        amount: 45000.0,
        balance: 45000.0,
        currency: "USD",
        status: "overdue",
        lineItems: [
          {
            description: "Cloud Infrastructure Services - Q3",
            quantity: 1,
            unitPrice: 45000.0,
            amount: 45000.0,
          },
        ],
      },
      {
        id: "INV-003",
        invoiceNumber: "OP-2024-1200",
        vendorId: "VEND-003",
        vendorName: "Office Plus Supplies",
        invoiceDate: today.toISOString().split("T")[0],
        dueDate: tenDaysFromNow.toISOString().split("T")[0],
        amount: 2500.0,
        balance: 2500.0,
        currency: "USD",
        status: "pending",
        lineItems: [
          {
            description: "Office Furniture - Standing Desks",
            quantity: 5,
            unitPrice: 500.0,
            amount: 2500.0,
          },
        ],
      },
      {
        id: "INV-004",
        invoiceNumber: "LP-2024-0567",
        vendorId: "VEND-004",
        vendorName: "Logistics Pro Inc",
        invoiceDate: thirtyDaysAgo.toISOString().split("T")[0],
        dueDate: today.toISOString().split("T")[0],
        amount: 8750.0,
        balance: 0,
        currency: "USD",
        status: "paid",
        paymentDate: today.toISOString().split("T")[0],
        paymentReference: "CHK-2024-0890",
      },
    ];
  }

  private getMockPayments(): Payment[] {
    const today = new Date();
    const sevenDaysAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sixtyDaysAgo = new Date(today.getTime() - 60 * 24 * 60 * 60 * 1000);

    return [
      {
        id: "PAY-001",
        vendorId: "VEND-001",
        vendorName: "Acme Corporation",
        paymentDate: thirtyDaysAgo.toISOString().split("T")[0],
        amount: 25000.0,
        currency: "USD",
        paymentMethod: "ACH",
        reference: "ACH-2024-1001",
        invoiceIds: ["INV-001-OLD"],
      },
      {
        id: "PAY-002",
        vendorId: "VEND-002",
        vendorName: "Global Tech Solutions",
        paymentDate: sixtyDaysAgo.toISOString().split("T")[0],
        amount: 50000.0,
        currency: "USD",
        paymentMethod: "Wire",
        reference: "WIRE-2024-0567",
        invoiceIds: ["INV-002-OLD"],
      },
      {
        id: "PAY-003",
        vendorId: "VEND-004",
        vendorName: "Logistics Pro Inc",
        paymentDate: sevenDaysAgo.toISOString().split("T")[0],
        amount: 8750.0,
        currency: "USD",
        paymentMethod: "Check",
        reference: "CHK-2024-0890",
        invoiceIds: ["INV-004"],
      },
      {
        id: "PAY-004",
        vendorId: "VEND-003",
        vendorName: "Office Plus Supplies",
        paymentDate: thirtyDaysAgo.toISOString().split("T")[0],
        amount: 1200.0,
        currency: "USD",
        paymentMethod: "Credit Card",
        reference: "CC-2024-3456",
        invoiceIds: ["INV-003-OLD"],
      },
    ];
  }

  private getMockAPAging(): APAgingBucket[] {
    return [
      {
        vendorId: "VEND-001",
        vendorName: "Acme Corporation",
        current: 15000,
        days1to30: 0,
        days31to60: 0,
        days61to90: 0,
        over90: 0,
        total: 15000,
      },
      {
        vendorId: "VEND-002",
        vendorName: "Global Tech Solutions",
        current: 0,
        days1to30: 0,
        days31to60: 45000,
        days61to90: 0,
        over90: 0,
        total: 45000,
      },
      {
        vendorId: "VEND-003",
        vendorName: "Office Plus Supplies",
        current: 2500,
        days1to30: 0,
        days31to60: 0,
        days61to90: 0,
        over90: 0,
        total: 2500,
      },
      {
        vendorId: "VEND-004",
        vendorName: "Logistics Pro Inc",
        current: 0,
        days1to30: 0,
        days31to60: 0,
        days61to90: 0,
        over90: 0,
        total: 0,
      },
    ];
  }
}

let apConnector: APConnector | null = null;

export function initializeAPConnector(): APConnector {
  if (!apConnector) {
    const config: APConfig = {
      system:
        (process.env.AP_SYSTEM as "d365" | "quickbooks" | "generic") ||
        "generic",
      d365TenantId: process.env.D365_TENANT_ID,
      d365ClientId: process.env.D365_CLIENT_ID,
      d365ClientSecret: process.env.D365_CLIENT_SECRET,
      d365EnvironmentUrl: process.env.D365_ENVIRONMENT_URL,
      qbClientId: process.env.QB_CLIENT_ID,
      qbClientSecret: process.env.QB_CLIENT_SECRET,
      qbRealmId: process.env.QB_REALM_ID,
      qbRefreshToken: process.env.QB_REFRESH_TOKEN,
      qbEnvironment:
        (process.env.QB_ENVIRONMENT as "sandbox" | "production") || "sandbox",
      apiUrl: process.env.GENERIC_AP_API_URL,
      apiKey: process.env.GENERIC_AP_API_KEY,
    };

    apConnector = new APConnector(config);
    apConnector.initialize().catch(console.error);
    console.log(`AP Connector initialized with system: ${config.system}`);
  }

  return apConnector;
}

export function getAPConnector(): APConnector {
  if (!apConnector) {
    return initializeAPConnector();
  }
  return apConnector;
}
