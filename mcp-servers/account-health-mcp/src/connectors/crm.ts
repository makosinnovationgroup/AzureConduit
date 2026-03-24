/**
 * Generic CRM Connector Interface
 * Supports: Salesforce, Dynamics 365
 *
 * This connector provides a unified interface for retrieving account data
 * from various CRM systems. The specific implementation is determined by
 * the CRM_PROVIDER environment variable.
 */

import axios, { AxiosInstance } from "axios";

// =============================================================================
// Types
// =============================================================================

export interface CRMAccount {
  id: string;
  name: string;
  industry?: string;
  website?: string;
  phone?: string;
  billingAddress?: {
    street?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
  };
  accountOwner?: string;
  accountOwnerEmail?: string;
  createdDate: string;
  lastModifiedDate: string;
  annualRevenue?: number;
  numberOfEmployees?: number;
  type?: string; // Customer, Prospect, Partner
  status?: string;
}

export interface CRMContact {
  id: string;
  accountId: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  title?: string;
  isPrimary: boolean;
  lastActivityDate?: string;
}

export interface CRMActivity {
  id: string;
  accountId: string;
  type: "call" | "email" | "meeting" | "task" | "note";
  subject: string;
  description?: string;
  activityDate: string;
  status: string;
  ownerName?: string;
  ownerEmail?: string;
}

export interface CRMOpportunity {
  id: string;
  accountId: string;
  name: string;
  amount: number;
  stage: string;
  probability: number;
  closeDate: string;
  createdDate: string;
  isClosed: boolean;
  isWon: boolean;
}

export interface CRMConfig {
  provider: "salesforce" | "dynamics365";
  // Salesforce config
  sfLoginUrl?: string;
  sfClientId?: string;
  sfClientSecret?: string;
  sfUsername?: string;
  sfPassword?: string;
  // Dynamics 365 config
  d365TenantId?: string;
  d365ClientId?: string;
  d365ClientSecret?: string;
  d365ResourceUrl?: string;
}

// =============================================================================
// CRM Connector Interface
// =============================================================================

export interface ICRMConnector {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  isConnected(): boolean;

  // Account operations
  getAccount(accountId: string): Promise<CRMAccount | null>;
  getAccounts(limit?: number): Promise<CRMAccount[]>;
  searchAccounts(query: string): Promise<CRMAccount[]>;
  getTopAccountsByRevenue(limit: number): Promise<CRMAccount[]>;

  // Contact operations
  getAccountContacts(accountId: string): Promise<CRMContact[]>;
  getPrimaryContact(accountId: string): Promise<CRMContact | null>;

  // Activity operations
  getAccountActivities(
    accountId: string,
    days?: number
  ): Promise<CRMActivity[]>;
  getLastActivity(accountId: string): Promise<CRMActivity | null>;

  // Opportunity operations
  getAccountOpportunities(accountId: string): Promise<CRMOpportunity[]>;
  getOpenOpportunities(accountId: string): Promise<CRMOpportunity[]>;
}

// =============================================================================
// Salesforce Connector Implementation
// =============================================================================

class SalesforceConnector implements ICRMConnector {
  private config: CRMConfig;
  private accessToken: string | null = null;
  private instanceUrl: string | null = null;
  private client: AxiosInstance | null = null;
  private connected: boolean = false;

  constructor(config: CRMConfig) {
    this.config = config;
  }

  async connect(): Promise<void> {
    console.log("[CRM:Salesforce] Connecting...");

    const params = new URLSearchParams({
      grant_type: "password",
      client_id: this.config.sfClientId!,
      client_secret: this.config.sfClientSecret!,
      username: this.config.sfUsername!,
      password: this.config.sfPassword!,
    });

    const response = await axios.post(
      `${this.config.sfLoginUrl}/services/oauth2/token`,
      params.toString(),
      { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
    );

    this.accessToken = response.data.access_token;
    this.instanceUrl = response.data.instance_url;

    this.client = axios.create({
      baseURL: `${this.instanceUrl}/services/data/v59.0`,
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        "Content-Type": "application/json",
      },
    });

    this.connected = true;
    console.log("[CRM:Salesforce] Connected successfully");
  }

  async disconnect(): Promise<void> {
    this.accessToken = null;
    this.instanceUrl = null;
    this.client = null;
    this.connected = false;
    console.log("[CRM:Salesforce] Disconnected");
  }

  isConnected(): boolean {
    return this.connected;
  }

  private async query<T>(soql: string): Promise<T[]> {
    if (!this.client) throw new Error("Not connected to Salesforce");
    const response = await this.client.get(
      `/query?q=${encodeURIComponent(soql)}`
    );
    return response.data.records;
  }

  async getAccount(accountId: string): Promise<CRMAccount | null> {
    const records = await this.query<any>(
      `SELECT Id, Name, Industry, Website, Phone, BillingStreet, BillingCity,
              BillingState, BillingPostalCode, BillingCountry, Owner.Name, Owner.Email,
              CreatedDate, LastModifiedDate, AnnualRevenue, NumberOfEmployees, Type
       FROM Account WHERE Id = '${accountId}'`
    );

    if (records.length === 0) return null;

    const r = records[0];
    return {
      id: r.Id,
      name: r.Name,
      industry: r.Industry,
      website: r.Website,
      phone: r.Phone,
      billingAddress: {
        street: r.BillingStreet,
        city: r.BillingCity,
        state: r.BillingState,
        postalCode: r.BillingPostalCode,
        country: r.BillingCountry,
      },
      accountOwner: r.Owner?.Name,
      accountOwnerEmail: r.Owner?.Email,
      createdDate: r.CreatedDate,
      lastModifiedDate: r.LastModifiedDate,
      annualRevenue: r.AnnualRevenue,
      numberOfEmployees: r.NumberOfEmployees,
      type: r.Type,
    };
  }

  async getAccounts(limit: number = 100): Promise<CRMAccount[]> {
    const records = await this.query<any>(
      `SELECT Id, Name, Industry, Website, CreatedDate, LastModifiedDate, AnnualRevenue, Type
       FROM Account ORDER BY LastModifiedDate DESC LIMIT ${limit}`
    );

    return records.map((r) => ({
      id: r.Id,
      name: r.Name,
      industry: r.Industry,
      website: r.Website,
      createdDate: r.CreatedDate,
      lastModifiedDate: r.LastModifiedDate,
      annualRevenue: r.AnnualRevenue,
      type: r.Type,
    }));
  }

  async searchAccounts(query: string): Promise<CRMAccount[]> {
    const records = await this.query<any>(
      `SELECT Id, Name, Industry, Website, CreatedDate, LastModifiedDate, AnnualRevenue
       FROM Account WHERE Name LIKE '%${query}%' LIMIT 50`
    );

    return records.map((r) => ({
      id: r.Id,
      name: r.Name,
      industry: r.Industry,
      website: r.Website,
      createdDate: r.CreatedDate,
      lastModifiedDate: r.LastModifiedDate,
      annualRevenue: r.AnnualRevenue,
    }));
  }

  async getTopAccountsByRevenue(limit: number): Promise<CRMAccount[]> {
    const records = await this.query<any>(
      `SELECT Id, Name, Industry, AnnualRevenue, CreatedDate, LastModifiedDate
       FROM Account WHERE AnnualRevenue != null
       ORDER BY AnnualRevenue DESC LIMIT ${limit}`
    );

    return records.map((r) => ({
      id: r.Id,
      name: r.Name,
      industry: r.Industry,
      annualRevenue: r.AnnualRevenue,
      createdDate: r.CreatedDate,
      lastModifiedDate: r.LastModifiedDate,
    }));
  }

  async getAccountContacts(accountId: string): Promise<CRMContact[]> {
    const records = await this.query<any>(
      `SELECT Id, AccountId, FirstName, LastName, Email, Phone, Title, LastActivityDate
       FROM Contact WHERE AccountId = '${accountId}'`
    );

    return records.map((r, index) => ({
      id: r.Id,
      accountId: r.AccountId,
      firstName: r.FirstName,
      lastName: r.LastName,
      email: r.Email,
      phone: r.Phone,
      title: r.Title,
      isPrimary: index === 0, // First contact is primary in Salesforce
      lastActivityDate: r.LastActivityDate,
    }));
  }

  async getPrimaryContact(accountId: string): Promise<CRMContact | null> {
    const contacts = await this.getAccountContacts(accountId);
    return contacts.find((c) => c.isPrimary) || contacts[0] || null;
  }

  async getAccountActivities(
    accountId: string,
    days: number = 90
  ): Promise<CRMActivity[]> {
    const dateLimit = new Date();
    dateLimit.setDate(dateLimit.getDate() - days);

    const records = await this.query<any>(
      `SELECT Id, WhatId, Subject, Description, ActivityDate, Status, Owner.Name, Owner.Email, Type
       FROM Task WHERE WhatId = '${accountId}' AND ActivityDate >= ${dateLimit.toISOString().split("T")[0]}
       ORDER BY ActivityDate DESC`
    );

    return records.map((r) => ({
      id: r.Id,
      accountId: r.WhatId,
      type: this.mapActivityType(r.Type),
      subject: r.Subject,
      description: r.Description,
      activityDate: r.ActivityDate,
      status: r.Status,
      ownerName: r.Owner?.Name,
      ownerEmail: r.Owner?.Email,
    }));
  }

  private mapActivityType(
    sfType: string
  ): "call" | "email" | "meeting" | "task" | "note" {
    const typeMap: { [key: string]: "call" | "email" | "meeting" | "task" | "note" } = {
      Call: "call",
      Email: "email",
      Meeting: "meeting",
      Task: "task",
      Note: "note",
    };
    return typeMap[sfType] || "task";
  }

  async getLastActivity(accountId: string): Promise<CRMActivity | null> {
    const activities = await this.getAccountActivities(accountId, 365);
    return activities[0] || null;
  }

  async getAccountOpportunities(accountId: string): Promise<CRMOpportunity[]> {
    const records = await this.query<any>(
      `SELECT Id, AccountId, Name, Amount, StageName, Probability, CloseDate, CreatedDate, IsClosed, IsWon
       FROM Opportunity WHERE AccountId = '${accountId}'
       ORDER BY CloseDate DESC`
    );

    return records.map((r) => ({
      id: r.Id,
      accountId: r.AccountId,
      name: r.Name,
      amount: r.Amount || 0,
      stage: r.StageName,
      probability: r.Probability,
      closeDate: r.CloseDate,
      createdDate: r.CreatedDate,
      isClosed: r.IsClosed,
      isWon: r.IsWon,
    }));
  }

  async getOpenOpportunities(accountId: string): Promise<CRMOpportunity[]> {
    const opportunities = await this.getAccountOpportunities(accountId);
    return opportunities.filter((o) => !o.isClosed);
  }
}

// =============================================================================
// Dynamics 365 Connector Implementation
// =============================================================================

class Dynamics365Connector implements ICRMConnector {
  private config: CRMConfig;
  private accessToken: string | null = null;
  private client: AxiosInstance | null = null;
  private connected: boolean = false;

  constructor(config: CRMConfig) {
    this.config = config;
  }

  async connect(): Promise<void> {
    console.log("[CRM:D365] Connecting...");

    const tokenUrl = `https://login.microsoftonline.com/${this.config.d365TenantId}/oauth2/v2.0/token`;

    const params = new URLSearchParams({
      grant_type: "client_credentials",
      client_id: this.config.d365ClientId!,
      client_secret: this.config.d365ClientSecret!,
      scope: `${this.config.d365ResourceUrl}/.default`,
    });

    const response = await axios.post(tokenUrl, params.toString(), {
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });

    this.accessToken = response.data.access_token;

    this.client = axios.create({
      baseURL: `${this.config.d365ResourceUrl}/api/data/v9.2`,
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        "Content-Type": "application/json",
        "OData-MaxVersion": "4.0",
        "OData-Version": "4.0",
      },
    });

    this.connected = true;
    console.log("[CRM:D365] Connected successfully");
  }

  async disconnect(): Promise<void> {
    this.accessToken = null;
    this.client = null;
    this.connected = false;
    console.log("[CRM:D365] Disconnected");
  }

  isConnected(): boolean {
    return this.connected;
  }

  private async query<T>(entity: string, filter?: string, select?: string, top?: number): Promise<T[]> {
    if (!this.client) throw new Error("Not connected to Dynamics 365");

    let url = `/${entity}`;
    const params: string[] = [];
    if (filter) params.push(`$filter=${encodeURIComponent(filter)}`);
    if (select) params.push(`$select=${select}`);
    if (top) params.push(`$top=${top}`);
    if (params.length > 0) url += `?${params.join("&")}`;

    const response = await this.client.get(url);
    return response.data.value;
  }

  async getAccount(accountId: string): Promise<CRMAccount | null> {
    if (!this.client) throw new Error("Not connected to Dynamics 365");

    try {
      const response = await this.client.get(`/accounts(${accountId})`);
      const r = response.data;

      return {
        id: r.accountid,
        name: r.name,
        industry: r.industrycode?.toString(),
        website: r.websiteurl,
        phone: r.telephone1,
        billingAddress: {
          street: r.address1_line1,
          city: r.address1_city,
          state: r.address1_stateorprovince,
          postalCode: r.address1_postalcode,
          country: r.address1_country,
        },
        createdDate: r.createdon,
        lastModifiedDate: r.modifiedon,
        annualRevenue: r.revenue,
        numberOfEmployees: r.numberofemployees,
        type: r.customertypecode?.toString(),
      };
    } catch {
      return null;
    }
  }

  async getAccounts(limit: number = 100): Promise<CRMAccount[]> {
    const records = await this.query<any>(
      "accounts",
      undefined,
      "accountid,name,industrycode,websiteurl,createdon,modifiedon,revenue,customertypecode",
      limit
    );

    return records.map((r) => ({
      id: r.accountid,
      name: r.name,
      industry: r.industrycode?.toString(),
      website: r.websiteurl,
      createdDate: r.createdon,
      lastModifiedDate: r.modifiedon,
      annualRevenue: r.revenue,
      type: r.customertypecode?.toString(),
    }));
  }

  async searchAccounts(query: string): Promise<CRMAccount[]> {
    const records = await this.query<any>(
      "accounts",
      `contains(name,'${query}')`,
      "accountid,name,industrycode,websiteurl,createdon,modifiedon,revenue",
      50
    );

    return records.map((r) => ({
      id: r.accountid,
      name: r.name,
      industry: r.industrycode?.toString(),
      website: r.websiteurl,
      createdDate: r.createdon,
      lastModifiedDate: r.modifiedon,
      annualRevenue: r.revenue,
    }));
  }

  async getTopAccountsByRevenue(limit: number): Promise<CRMAccount[]> {
    const records = await this.query<any>(
      "accounts",
      "revenue ne null",
      "accountid,name,industrycode,revenue,createdon,modifiedon",
      limit
    );

    return records
      .sort((a, b) => (b.revenue || 0) - (a.revenue || 0))
      .map((r) => ({
        id: r.accountid,
        name: r.name,
        industry: r.industrycode?.toString(),
        annualRevenue: r.revenue,
        createdDate: r.createdon,
        lastModifiedDate: r.modifiedon,
      }));
  }

  async getAccountContacts(accountId: string): Promise<CRMContact[]> {
    const records = await this.query<any>(
      "contacts",
      `_parentcustomerid_value eq ${accountId}`,
      "contactid,_parentcustomerid_value,firstname,lastname,emailaddress1,telephone1,jobtitle"
    );

    return records.map((r, index) => ({
      id: r.contactid,
      accountId: r._parentcustomerid_value,
      firstName: r.firstname,
      lastName: r.lastname,
      email: r.emailaddress1,
      phone: r.telephone1,
      title: r.jobtitle,
      isPrimary: index === 0,
    }));
  }

  async getPrimaryContact(accountId: string): Promise<CRMContact | null> {
    const contacts = await this.getAccountContacts(accountId);
    return contacts[0] || null;
  }

  async getAccountActivities(
    accountId: string,
    days: number = 90
  ): Promise<CRMActivity[]> {
    const dateLimit = new Date();
    dateLimit.setDate(dateLimit.getDate() - days);

    const records = await this.query<any>(
      "activitypointers",
      `_regardingobjectid_value eq ${accountId} and actualend ge ${dateLimit.toISOString()}`,
      "activityid,_regardingobjectid_value,subject,description,actualend,statecode,activitytypecode"
    );

    return records.map((r) => ({
      id: r.activityid,
      accountId: r._regardingobjectid_value,
      type: this.mapActivityType(r.activitytypecode),
      subject: r.subject,
      description: r.description,
      activityDate: r.actualend,
      status: r.statecode?.toString(),
    }));
  }

  private mapActivityType(
    d365Type: string
  ): "call" | "email" | "meeting" | "task" | "note" {
    const typeMap: { [key: string]: "call" | "email" | "meeting" | "task" | "note" } = {
      phonecall: "call",
      email: "email",
      appointment: "meeting",
      task: "task",
      annotation: "note",
    };
    return typeMap[d365Type] || "task";
  }

  async getLastActivity(accountId: string): Promise<CRMActivity | null> {
    const activities = await this.getAccountActivities(accountId, 365);
    return activities[0] || null;
  }

  async getAccountOpportunities(accountId: string): Promise<CRMOpportunity[]> {
    const records = await this.query<any>(
      "opportunities",
      `_parentaccountid_value eq ${accountId}`,
      "opportunityid,_parentaccountid_value,name,estimatedvalue,stepname,closeprobability,estimatedclosedate,createdon,statecode"
    );

    return records.map((r) => ({
      id: r.opportunityid,
      accountId: r._parentaccountid_value,
      name: r.name,
      amount: r.estimatedvalue || 0,
      stage: r.stepname,
      probability: r.closeprobability,
      closeDate: r.estimatedclosedate,
      createdDate: r.createdon,
      isClosed: r.statecode !== 0,
      isWon: r.statecode === 1,
    }));
  }

  async getOpenOpportunities(accountId: string): Promise<CRMOpportunity[]> {
    const opportunities = await this.getAccountOpportunities(accountId);
    return opportunities.filter((o) => !o.isClosed);
  }
}

// =============================================================================
// Factory and Singleton
// =============================================================================

let crmConnector: ICRMConnector | null = null;

export function initializeCRMConnector(config: CRMConfig): ICRMConnector {
  if (config.provider === "salesforce") {
    crmConnector = new SalesforceConnector(config);
  } else if (config.provider === "dynamics365") {
    crmConnector = new Dynamics365Connector(config);
  } else {
    throw new Error(`Unknown CRM provider: ${config.provider}`);
  }
  return crmConnector;
}

export function getCRMConnector(): ICRMConnector {
  if (!crmConnector) {
    throw new Error(
      "CRM connector not initialized. Call initializeCRMConnector first."
    );
  }
  return crmConnector;
}

export function createCRMConfigFromEnv(): CRMConfig {
  const provider = (process.env.CRM_PROVIDER || "salesforce") as "salesforce" | "dynamics365";

  return {
    provider,
    // Salesforce
    sfLoginUrl: process.env.SF_LOGIN_URL,
    sfClientId: process.env.SF_CLIENT_ID,
    sfClientSecret: process.env.SF_CLIENT_SECRET,
    sfUsername: process.env.SF_USERNAME,
    sfPassword: process.env.SF_PASSWORD,
    // Dynamics 365
    d365TenantId: process.env.D365_TENANT_ID,
    d365ClientId: process.env.D365_CLIENT_ID,
    d365ClientSecret: process.env.D365_CLIENT_SECRET,
    d365ResourceUrl: process.env.D365_RESOURCE_URL,
  };
}
