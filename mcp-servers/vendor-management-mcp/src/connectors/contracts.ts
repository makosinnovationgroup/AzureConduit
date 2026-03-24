import axios, { AxiosInstance } from "axios";

/**
 * Contract Management Connector
 * Supports DocuSign CLM or a generic REST API
 */

export interface ContractConfig {
  system: "docusign" | "generic";
  // DocuSign CLM
  docusignAccountId?: string;
  docusignAccessToken?: string;
  docusignBaseUrl?: string;
  // Generic
  apiUrl?: string;
  apiKey?: string;
}

export interface Contract {
  id: string;
  contractNumber: string;
  title: string;
  vendorId: string;
  vendorName: string;
  type: "master" | "purchase" | "service" | "nda" | "sow" | "amendment";
  status: "draft" | "pending_approval" | "active" | "expired" | "terminated";
  startDate: string;
  endDate: string;
  value?: number;
  currency?: string;
  autoRenew: boolean;
  renewalTermMonths?: number;
  terminationNoticeDays?: number;
  owner: string;
  department?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ContractDetails extends Contract {
  description?: string;
  terms: ContractTerms;
  signatories: ContractSignatory[];
  attachments: ContractAttachment[];
  amendments: ContractAmendment[];
}

export interface ContractTerms {
  paymentTerms?: string;
  deliveryTerms?: string;
  warrantyTerms?: string;
  liabilityLimit?: number;
  insuranceRequirements?: string;
  confidentialityClause: boolean;
  nonCompeteClause: boolean;
  exclusivityClause: boolean;
  terminationConditions?: string[];
  customClauses?: string[];
}

export interface ContractSignatory {
  name: string;
  title: string;
  email: string;
  signedDate?: string;
  status: "pending" | "signed" | "declined";
}

export interface ContractAttachment {
  id: string;
  name: string;
  type: string;
  size: number;
  uploadedAt: string;
  uploadedBy: string;
}

export interface ContractAmendment {
  id: string;
  amendmentNumber: string;
  effectiveDate: string;
  description: string;
  changes: string[];
  status: "draft" | "active";
}

export interface ExpiringContract {
  contract: Contract;
  daysUntilExpiry: number;
  renewalAction: "auto_renew" | "requires_review" | "must_negotiate";
}

export class ContractConnector {
  private config: ContractConfig;
  private httpClient: AxiosInstance;

  constructor(config: ContractConfig) {
    this.config = config;
    this.httpClient = axios.create({
      timeout: 30000,
    });
  }

  async initialize(): Promise<void> {
    switch (this.config.system) {
      case "docusign":
        await this.initializeDocuSign();
        break;
      case "generic":
        this.initializeGeneric();
        break;
    }
  }

  private async initializeDocuSign(): Promise<void> {
    if (!this.config.docusignAccountId || !this.config.docusignAccessToken) {
      console.warn("DocuSign CLM credentials not configured, using mock data");
      return;
    }

    this.httpClient = axios.create({
      baseURL: this.config.docusignBaseUrl || "https://demo.docusign.net/restapi",
      timeout: 30000,
      headers: {
        Authorization: `Bearer ${this.config.docusignAccessToken}`,
        "Content-Type": "application/json",
      },
    });
    console.log("DocuSign CLM connector initialized");
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
    console.log("Generic Contract connector initialized");
  }

  // Contract Methods
  async listContracts(params?: {
    vendorId?: string;
    status?: string;
    type?: string;
  }): Promise<Contract[]> {
    if (this.config.system === "generic" && this.config.apiUrl) {
      try {
        const response = await this.httpClient.get("/contracts", { params });
        return response.data;
      } catch (error) {
        console.warn("Generic API unavailable, returning mock data");
      }
    }

    return this.getMockContracts(params);
  }

  async getVendorContracts(vendorId: string): Promise<Contract[]> {
    return this.listContracts({ vendorId, status: "active" });
  }

  async getContract(contractId: string): Promise<ContractDetails | null> {
    if (this.config.system === "generic" && this.config.apiUrl) {
      try {
        const response = await this.httpClient.get(`/contracts/${contractId}`);
        return response.data;
      } catch (error) {
        console.warn("Generic API unavailable, returning mock data");
      }
    }

    const contracts = this.getMockContractDetails();
    return contracts.find((c) => c.id === contractId) || null;
  }

  async getExpiringContracts(days: number): Promise<ExpiringContract[]> {
    const allContracts = await this.listContracts({ status: "active" });
    const today = new Date();
    const expiryThreshold = new Date(today.getTime() + days * 24 * 60 * 60 * 1000);

    const expiringContracts: ExpiringContract[] = [];

    for (const contract of allContracts) {
      const endDate = new Date(contract.endDate);
      if (endDate <= expiryThreshold && endDate >= today) {
        const daysUntilExpiry = Math.ceil(
          (endDate.getTime() - today.getTime()) / (24 * 60 * 60 * 1000)
        );

        let renewalAction: "auto_renew" | "requires_review" | "must_negotiate";
        if (contract.autoRenew) {
          renewalAction = "auto_renew";
        } else if (daysUntilExpiry > 30) {
          renewalAction = "requires_review";
        } else {
          renewalAction = "must_negotiate";
        }

        expiringContracts.push({
          contract,
          daysUntilExpiry,
          renewalAction,
        });
      }
    }

    return expiringContracts.sort((a, b) => a.daysUntilExpiry - b.daysUntilExpiry);
  }

  async getContractsByVendorId(vendorId: string): Promise<Contract[]> {
    const contracts = await this.listContracts();
    return contracts.filter((c) => c.vendorId === vendorId);
  }

  async getActiveContractValue(vendorId: string): Promise<number> {
    const contracts = await this.getVendorContracts(vendorId);
    return contracts.reduce((sum, c) => sum + (c.value || 0), 0);
  }

  // Mock Data Methods
  private getMockContracts(params?: {
    vendorId?: string;
    status?: string;
    type?: string;
  }): Contract[] {
    const today = new Date();
    const sixMonthsFromNow = new Date(today.getTime() + 180 * 24 * 60 * 60 * 1000);
    const oneYearFromNow = new Date(today.getTime() + 365 * 24 * 60 * 60 * 1000);
    const twoYearsFromNow = new Date(today.getTime() + 730 * 24 * 60 * 60 * 1000);
    const thirtyDaysFromNow = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);
    const sixtyDaysFromNow = new Date(today.getTime() + 60 * 24 * 60 * 60 * 1000);
    const oneYearAgo = new Date(today.getTime() - 365 * 24 * 60 * 60 * 1000);
    const twoYearsAgo = new Date(today.getTime() - 730 * 24 * 60 * 60 * 1000);

    let contracts: Contract[] = [
      {
        id: "CTR-001",
        contractNumber: "MSA-2023-001",
        title: "Master Supply Agreement - Acme Corporation",
        vendorId: "VEND-001",
        vendorName: "Acme Corporation",
        type: "master",
        status: "active",
        startDate: oneYearAgo.toISOString().split("T")[0],
        endDate: oneYearFromNow.toISOString().split("T")[0],
        value: 500000,
        currency: "USD",
        autoRenew: true,
        renewalTermMonths: 12,
        terminationNoticeDays: 90,
        owner: "Sarah Johnson",
        department: "Procurement",
        createdAt: twoYearsAgo.toISOString(),
        updatedAt: oneYearAgo.toISOString(),
      },
      {
        id: "CTR-002",
        contractNumber: "SVC-2024-015",
        title: "IT Infrastructure Services Agreement",
        vendorId: "VEND-002",
        vendorName: "Global Tech Solutions",
        type: "service",
        status: "active",
        startDate: oneYearAgo.toISOString().split("T")[0],
        endDate: thirtyDaysFromNow.toISOString().split("T")[0],
        value: 180000,
        currency: "USD",
        autoRenew: false,
        terminationNoticeDays: 30,
        owner: "Mike Chen",
        department: "IT",
        createdAt: oneYearAgo.toISOString(),
        updatedAt: today.toISOString(),
      },
      {
        id: "CTR-003",
        contractNumber: "PO-2024-200",
        title: "Office Supplies Annual Contract",
        vendorId: "VEND-003",
        vendorName: "Office Plus Supplies",
        type: "purchase",
        status: "active",
        startDate: sixMonthsFromNow.toISOString().split("T")[0],
        endDate: sixtyDaysFromNow.toISOString().split("T")[0],
        value: 25000,
        currency: "USD",
        autoRenew: true,
        renewalTermMonths: 12,
        terminationNoticeDays: 30,
        owner: "Lisa Park",
        department: "Operations",
        createdAt: oneYearAgo.toISOString(),
        updatedAt: today.toISOString(),
      },
      {
        id: "CTR-004",
        contractNumber: "LOG-2022-010",
        title: "Logistics and Freight Services Agreement",
        vendorId: "VEND-004",
        vendorName: "Logistics Pro Inc",
        type: "service",
        status: "active",
        startDate: twoYearsAgo.toISOString().split("T")[0],
        endDate: twoYearsFromNow.toISOString().split("T")[0],
        value: 350000,
        currency: "USD",
        autoRenew: true,
        renewalTermMonths: 24,
        terminationNoticeDays: 120,
        owner: "Tom Wilson",
        department: "Supply Chain",
        createdAt: twoYearsAgo.toISOString(),
        updatedAt: oneYearAgo.toISOString(),
      },
      {
        id: "CTR-005",
        contractNumber: "NDA-2023-050",
        title: "Non-Disclosure Agreement - Clean & Green",
        vendorId: "VEND-005",
        vendorName: "Clean & Green Services",
        type: "nda",
        status: "expired",
        startDate: twoYearsAgo.toISOString().split("T")[0],
        endDate: oneYearAgo.toISOString().split("T")[0],
        autoRenew: false,
        owner: "Legal Team",
        department: "Legal",
        createdAt: twoYearsAgo.toISOString(),
        updatedAt: oneYearAgo.toISOString(),
      },
    ];

    if (params?.vendorId) {
      contracts = contracts.filter((c) => c.vendorId === params.vendorId);
    }
    if (params?.status) {
      contracts = contracts.filter((c) => c.status === params.status);
    }
    if (params?.type) {
      contracts = contracts.filter((c) => c.type === params.type);
    }

    return contracts;
  }

  private getMockContractDetails(): ContractDetails[] {
    const baseContracts = this.getMockContracts();
    const today = new Date();

    return baseContracts.map((contract) => ({
      ...contract,
      description: `This agreement governs the relationship between the parties for ${contract.title.toLowerCase()}.`,
      terms: {
        paymentTerms: "Net 30 from invoice date",
        deliveryTerms: "FOB Destination",
        warrantyTerms: "12-month warranty on all goods and services",
        liabilityLimit: contract.value ? contract.value * 2 : 100000,
        insuranceRequirements: "General liability $1M, Professional liability $2M",
        confidentialityClause: true,
        nonCompeteClause: false,
        exclusivityClause: contract.type === "master",
        terminationConditions: [
          "Material breach with 30-day cure period",
          "Insolvency or bankruptcy",
          "Mutual written agreement",
          "Convenience with required notice period",
        ],
      },
      signatories: [
        {
          name: "John Smith",
          title: "VP of Procurement",
          email: "john.smith@company.com",
          signedDate: contract.startDate,
          status: "signed" as const,
        },
        {
          name: "Jane Doe",
          title: "Account Executive",
          email: `contact@${contract.vendorName.toLowerCase().replace(/\s+/g, "")}.com`,
          signedDate: contract.startDate,
          status: "signed" as const,
        },
      ],
      attachments: [
        {
          id: `ATT-${contract.id}-001`,
          name: "Signed Agreement.pdf",
          type: "application/pdf",
          size: 245000,
          uploadedAt: contract.createdAt,
          uploadedBy: contract.owner,
        },
        {
          id: `ATT-${contract.id}-002`,
          name: "Pricing Schedule.xlsx",
          type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          size: 52000,
          uploadedAt: contract.createdAt,
          uploadedBy: contract.owner,
        },
      ],
      amendments: contract.id === "CTR-001" ? [
        {
          id: "AMD-001",
          amendmentNumber: "A1",
          effectiveDate: today.toISOString().split("T")[0],
          description: "Price adjustment for 2024",
          changes: [
            "Increased unit prices by 3% effective January 1, 2024",
            "Added new product categories",
          ],
          status: "active" as const,
        },
      ] : [],
    }));
  }
}

let contractConnector: ContractConnector | null = null;

export function initializeContractConnector(): ContractConnector {
  if (!contractConnector) {
    const config: ContractConfig = {
      system: (process.env.CONTRACT_SYSTEM as "docusign" | "generic") || "generic",
      docusignAccountId: process.env.DOCUSIGN_ACCOUNT_ID,
      docusignAccessToken: process.env.DOCUSIGN_ACCESS_TOKEN,
      docusignBaseUrl: process.env.DOCUSIGN_BASE_URL,
      apiUrl: process.env.GENERIC_CONTRACT_API_URL,
      apiKey: process.env.GENERIC_CONTRACT_API_KEY,
    };

    contractConnector = new ContractConnector(config);
    contractConnector.initialize().catch(console.error);
    console.log(`Contract Connector initialized with system: ${config.system}`);
  }

  return contractConnector;
}

export function getContractConnector(): ContractConnector {
  if (!contractConnector) {
    return initializeContractConnector();
  }
  return contractConnector;
}
