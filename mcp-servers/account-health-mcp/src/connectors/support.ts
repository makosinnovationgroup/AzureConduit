/**
 * Generic Support Connector Interface
 * Supports: Zendesk, ServiceNow
 *
 * This connector provides a unified interface for retrieving support ticket
 * and customer service data from various help desk systems. The specific
 * implementation is determined by the SUPPORT_PROVIDER environment variable.
 */

import axios, { AxiosInstance } from "axios";

// =============================================================================
// Types
// =============================================================================

export interface SupportTicket {
  id: string;
  externalId?: string;
  customerId?: string;
  organizationId?: string;
  organizationName?: string;
  subject: string;
  description?: string;
  status: "new" | "open" | "pending" | "on_hold" | "solved" | "closed";
  priority: "low" | "normal" | "high" | "urgent";
  type?: "question" | "incident" | "problem" | "task";
  createdAt: string;
  updatedAt: string;
  resolvedAt?: string;
  requesterName?: string;
  requesterEmail?: string;
  assigneeName?: string;
  assigneeEmail?: string;
  tags?: string[];
  satisfactionRating?: number;
  firstResponseTimeMinutes?: number;
  resolutionTimeMinutes?: number;
}

export interface SupportMetrics {
  organizationId: string;
  organizationName?: string;
  totalTickets: number;
  openTickets: number;
  pendingTickets: number;
  solvedTickets: number;
  averageResolutionTimeHours: number;
  averageFirstResponseTimeHours: number;
  averageSatisfactionScore?: number;
  ticketsByPriority: {
    low: number;
    normal: number;
    high: number;
    urgent: number;
  };
}

export interface SupportConfig {
  provider: "zendesk" | "servicenow";
  // Zendesk config
  zendeskSubdomain?: string;
  zendeskEmail?: string;
  zendeskApiToken?: string;
  // ServiceNow config
  servicenowInstance?: string;
  servicenowUsername?: string;
  servicenowPassword?: string;
  servicenowClientId?: string;
  servicenowClientSecret?: string;
}

// =============================================================================
// Support Connector Interface
// =============================================================================

export interface ISupportConnector {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  isConnected(): boolean;

  // Ticket operations
  getOrganizationTickets(
    organizationId: string,
    days?: number
  ): Promise<SupportTicket[]>;
  getOpenTickets(organizationId: string): Promise<SupportTicket[]>;
  getTicket(ticketId: string): Promise<SupportTicket | null>;
  getRecentTickets(organizationId: string, limit?: number): Promise<SupportTicket[]>;

  // Metrics
  getOrganizationMetrics(
    organizationId: string,
    days?: number
  ): Promise<SupportMetrics>;
  getTicketCount(organizationId: string, days?: number): Promise<number>;

  // Search
  searchTicketsByAccount(accountName: string): Promise<SupportTicket[]>;
}

// =============================================================================
// Zendesk Connector Implementation
// =============================================================================

class ZendeskConnector implements ISupportConnector {
  private config: SupportConfig;
  private client: AxiosInstance | null = null;
  private connected: boolean = false;

  constructor(config: SupportConfig) {
    this.config = config;
  }

  async connect(): Promise<void> {
    console.log("[Support:Zendesk] Connecting...");

    const authString = Buffer.from(
      `${this.config.zendeskEmail}/token:${this.config.zendeskApiToken}`
    ).toString("base64");

    this.client = axios.create({
      baseURL: `https://${this.config.zendeskSubdomain}.zendesk.com/api/v2`,
      headers: {
        Authorization: `Basic ${authString}`,
        "Content-Type": "application/json",
      },
    });

    // Verify connection
    await this.client.get("/users/me.json");

    this.connected = true;
    console.log("[Support:Zendesk] Connected successfully");
  }

  async disconnect(): Promise<void> {
    this.client = null;
    this.connected = false;
    console.log("[Support:Zendesk] Disconnected");
  }

  isConnected(): boolean {
    return this.connected;
  }

  private mapTicket(t: any): SupportTicket {
    const statusMap: { [key: string]: SupportTicket["status"] } = {
      new: "new",
      open: "open",
      pending: "pending",
      hold: "on_hold",
      solved: "solved",
      closed: "closed",
    };

    const priorityMap: { [key: string]: SupportTicket["priority"] } = {
      low: "low",
      normal: "normal",
      high: "high",
      urgent: "urgent",
    };

    const createdAt = new Date(t.created_at);
    const resolvedAt = t.solved_at ? new Date(t.solved_at) : null;
    const resolutionMinutes = resolvedAt
      ? Math.round((resolvedAt.getTime() - createdAt.getTime()) / (1000 * 60))
      : undefined;

    return {
      id: String(t.id),
      externalId: t.external_id,
      organizationId: t.organization_id ? String(t.organization_id) : undefined,
      subject: t.subject,
      description: t.description,
      status: statusMap[t.status] || "open",
      priority: priorityMap[t.priority] || "normal",
      type: t.type as SupportTicket["type"],
      createdAt: t.created_at,
      updatedAt: t.updated_at,
      resolvedAt: t.solved_at,
      requesterName: t.requester?.name,
      requesterEmail: t.requester?.email,
      assigneeName: t.assignee?.name,
      assigneeEmail: t.assignee?.email,
      tags: t.tags,
      satisfactionRating: t.satisfaction_rating?.score === "good" ? 5 : t.satisfaction_rating?.score === "bad" ? 1 : undefined,
      resolutionTimeMinutes: resolutionMinutes,
    };
  }

  async getOrganizationTickets(
    organizationId: string,
    days: number = 90
  ): Promise<SupportTicket[]> {
    if (!this.client) throw new Error("Not connected to Zendesk");

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const response = await this.client.get(
      `/organizations/${organizationId}/tickets.json?sort_by=created_at&sort_order=desc`
    );

    return response.data.tickets
      .filter((t: any) => new Date(t.created_at) >= startDate)
      .map((t: any) => this.mapTicket(t));
  }

  async getOpenTickets(organizationId: string): Promise<SupportTicket[]> {
    if (!this.client) throw new Error("Not connected to Zendesk");

    const response = await this.client.get(
      `/search.json?query=type:ticket organization_id:${organizationId} status<solved`
    );

    return response.data.results.map((t: any) => this.mapTicket(t));
  }

  async getTicket(ticketId: string): Promise<SupportTicket | null> {
    if (!this.client) throw new Error("Not connected to Zendesk");

    try {
      const response = await this.client.get(`/tickets/${ticketId}.json`);
      return this.mapTicket(response.data.ticket);
    } catch {
      return null;
    }
  }

  async getRecentTickets(
    organizationId: string,
    limit: number = 10
  ): Promise<SupportTicket[]> {
    if (!this.client) throw new Error("Not connected to Zendesk");

    const response = await this.client.get(
      `/organizations/${organizationId}/tickets.json?sort_by=created_at&sort_order=desc&per_page=${limit}`
    );

    return response.data.tickets.map((t: any) => this.mapTicket(t));
  }

  async getOrganizationMetrics(
    organizationId: string,
    days: number = 90
  ): Promise<SupportMetrics> {
    const tickets = await this.getOrganizationTickets(organizationId, days);

    const openTickets = tickets.filter(
      (t) => t.status === "new" || t.status === "open"
    ).length;
    const pendingTickets = tickets.filter(
      (t) => t.status === "pending" || t.status === "on_hold"
    ).length;
    const solvedTickets = tickets.filter(
      (t) => t.status === "solved" || t.status === "closed"
    ).length;

    const resolvedTickets = tickets.filter((t) => t.resolutionTimeMinutes);
    const avgResolutionMinutes =
      resolvedTickets.length > 0
        ? resolvedTickets.reduce(
            (sum, t) => sum + (t.resolutionTimeMinutes || 0),
            0
          ) / resolvedTickets.length
        : 0;

    const ratedTickets = tickets.filter((t) => t.satisfactionRating);
    const avgSatisfaction =
      ratedTickets.length > 0
        ? ratedTickets.reduce((sum, t) => sum + (t.satisfactionRating || 0), 0) /
          ratedTickets.length
        : undefined;

    return {
      organizationId,
      totalTickets: tickets.length,
      openTickets,
      pendingTickets,
      solvedTickets,
      averageResolutionTimeHours: avgResolutionMinutes / 60,
      averageFirstResponseTimeHours: 0, // Would need additional API calls
      averageSatisfactionScore: avgSatisfaction,
      ticketsByPriority: {
        low: tickets.filter((t) => t.priority === "low").length,
        normal: tickets.filter((t) => t.priority === "normal").length,
        high: tickets.filter((t) => t.priority === "high").length,
        urgent: tickets.filter((t) => t.priority === "urgent").length,
      },
    };
  }

  async getTicketCount(
    organizationId: string,
    days: number = 90
  ): Promise<number> {
    const tickets = await this.getOrganizationTickets(organizationId, days);
    return tickets.length;
  }

  async searchTicketsByAccount(accountName: string): Promise<SupportTicket[]> {
    if (!this.client) throw new Error("Not connected to Zendesk");

    const response = await this.client.get(
      `/search.json?query=type:ticket "${accountName}"`
    );

    return response.data.results.map((t: any) => this.mapTicket(t));
  }
}

// =============================================================================
// ServiceNow Connector Implementation
// =============================================================================

class ServiceNowConnector implements ISupportConnector {
  private config: SupportConfig;
  private accessToken: string | null = null;
  private client: AxiosInstance | null = null;
  private connected: boolean = false;

  constructor(config: SupportConfig) {
    this.config = config;
  }

  async connect(): Promise<void> {
    console.log("[Support:ServiceNow] Connecting...");

    const baseUrl = `https://${this.config.servicenowInstance}.service-now.com`;

    // OAuth2 authentication
    const tokenResponse = await axios.post(
      `${baseUrl}/oauth_token.do`,
      new URLSearchParams({
        grant_type: "password",
        client_id: this.config.servicenowClientId!,
        client_secret: this.config.servicenowClientSecret!,
        username: this.config.servicenowUsername!,
        password: this.config.servicenowPassword!,
      }).toString(),
      {
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      }
    );

    this.accessToken = tokenResponse.data.access_token;

    this.client = axios.create({
      baseURL: `${baseUrl}/api/now`,
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
    });

    this.connected = true;
    console.log("[Support:ServiceNow] Connected successfully");
  }

  async disconnect(): Promise<void> {
    this.accessToken = null;
    this.client = null;
    this.connected = false;
    console.log("[Support:ServiceNow] Disconnected");
  }

  isConnected(): boolean {
    return this.connected;
  }

  private mapTicket(t: any): SupportTicket {
    const stateMap: { [key: string]: SupportTicket["status"] } = {
      "1": "new",
      "2": "open",
      "3": "pending",
      "4": "on_hold",
      "6": "solved",
      "7": "closed",
    };

    const priorityMap: { [key: string]: SupportTicket["priority"] } = {
      "1": "urgent",
      "2": "high",
      "3": "normal",
      "4": "low",
      "5": "low",
    };

    const createdAt = new Date(t.sys_created_on);
    const resolvedAt = t.resolved_at ? new Date(t.resolved_at) : null;
    const resolutionMinutes = resolvedAt
      ? Math.round((resolvedAt.getTime() - createdAt.getTime()) / (1000 * 60))
      : undefined;

    return {
      id: t.sys_id,
      externalId: t.number,
      organizationId: t.company?.value,
      organizationName: t.company?.display_value,
      subject: t.short_description,
      description: t.description,
      status: stateMap[t.state] || "open",
      priority: priorityMap[t.priority] || "normal",
      type: t.sys_class_name === "incident" ? "incident" : "task",
      createdAt: t.sys_created_on,
      updatedAt: t.sys_updated_on,
      resolvedAt: t.resolved_at,
      requesterName: t.caller_id?.display_value,
      assigneeName: t.assigned_to?.display_value,
      resolutionTimeMinutes: resolutionMinutes,
    };
  }

  async getOrganizationTickets(
    organizationId: string,
    days: number = 90
  ): Promise<SupportTicket[]> {
    if (!this.client) throw new Error("Not connected to ServiceNow");

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    const startDateStr = startDate.toISOString().replace("T", " ").split(".")[0];

    const response = await this.client.get(
      `/table/incident?sysparm_query=company=${organizationId}^sys_created_on>=${startDateStr}^ORDERBYDESCsys_created_on`
    );

    return response.data.result.map((t: any) => this.mapTicket(t));
  }

  async getOpenTickets(organizationId: string): Promise<SupportTicket[]> {
    if (!this.client) throw new Error("Not connected to ServiceNow");

    const response = await this.client.get(
      `/table/incident?sysparm_query=company=${organizationId}^stateIN1,2,3,4^ORDERBYDESCsys_created_on`
    );

    return response.data.result.map((t: any) => this.mapTicket(t));
  }

  async getTicket(ticketId: string): Promise<SupportTicket | null> {
    if (!this.client) throw new Error("Not connected to ServiceNow");

    try {
      const response = await this.client.get(`/table/incident/${ticketId}`);
      return this.mapTicket(response.data.result);
    } catch {
      return null;
    }
  }

  async getRecentTickets(
    organizationId: string,
    limit: number = 10
  ): Promise<SupportTicket[]> {
    if (!this.client) throw new Error("Not connected to ServiceNow");

    const response = await this.client.get(
      `/table/incident?sysparm_query=company=${organizationId}^ORDERBYDESCsys_created_on&sysparm_limit=${limit}`
    );

    return response.data.result.map((t: any) => this.mapTicket(t));
  }

  async getOrganizationMetrics(
    organizationId: string,
    days: number = 90
  ): Promise<SupportMetrics> {
    const tickets = await this.getOrganizationTickets(organizationId, days);

    const openTickets = tickets.filter(
      (t) => t.status === "new" || t.status === "open"
    ).length;
    const pendingTickets = tickets.filter(
      (t) => t.status === "pending" || t.status === "on_hold"
    ).length;
    const solvedTickets = tickets.filter(
      (t) => t.status === "solved" || t.status === "closed"
    ).length;

    const resolvedTickets = tickets.filter((t) => t.resolutionTimeMinutes);
    const avgResolutionMinutes =
      resolvedTickets.length > 0
        ? resolvedTickets.reduce(
            (sum, t) => sum + (t.resolutionTimeMinutes || 0),
            0
          ) / resolvedTickets.length
        : 0;

    return {
      organizationId,
      totalTickets: tickets.length,
      openTickets,
      pendingTickets,
      solvedTickets,
      averageResolutionTimeHours: avgResolutionMinutes / 60,
      averageFirstResponseTimeHours: 0,
      ticketsByPriority: {
        low: tickets.filter((t) => t.priority === "low").length,
        normal: tickets.filter((t) => t.priority === "normal").length,
        high: tickets.filter((t) => t.priority === "high").length,
        urgent: tickets.filter((t) => t.priority === "urgent").length,
      },
    };
  }

  async getTicketCount(
    organizationId: string,
    days: number = 90
  ): Promise<number> {
    const tickets = await this.getOrganizationTickets(organizationId, days);
    return tickets.length;
  }

  async searchTicketsByAccount(accountName: string): Promise<SupportTicket[]> {
    if (!this.client) throw new Error("Not connected to ServiceNow");

    const response = await this.client.get(
      `/table/incident?sysparm_query=short_descriptionLIKE${accountName}^ORdescriptionLIKE${accountName}^ORDERBYDESCsys_created_on&sysparm_limit=50`
    );

    return response.data.result.map((t: any) => this.mapTicket(t));
  }
}

// =============================================================================
// Factory and Singleton
// =============================================================================

let supportConnector: ISupportConnector | null = null;

export function initializeSupportConnector(
  config: SupportConfig
): ISupportConnector {
  if (config.provider === "zendesk") {
    supportConnector = new ZendeskConnector(config);
  } else if (config.provider === "servicenow") {
    supportConnector = new ServiceNowConnector(config);
  } else {
    throw new Error(`Unknown support provider: ${config.provider}`);
  }
  return supportConnector;
}

export function getSupportConnector(): ISupportConnector {
  if (!supportConnector) {
    throw new Error(
      "Support connector not initialized. Call initializeSupportConnector first."
    );
  }
  return supportConnector;
}

export function createSupportConfigFromEnv(): SupportConfig {
  const provider = (process.env.SUPPORT_PROVIDER || "zendesk") as
    | "zendesk"
    | "servicenow";

  return {
    provider,
    // Zendesk
    zendeskSubdomain: process.env.ZENDESK_SUBDOMAIN,
    zendeskEmail: process.env.ZENDESK_EMAIL,
    zendeskApiToken: process.env.ZENDESK_API_TOKEN,
    // ServiceNow
    servicenowInstance: process.env.SERVICENOW_INSTANCE,
    servicenowUsername: process.env.SERVICENOW_USERNAME,
    servicenowPassword: process.env.SERVICENOW_PASSWORD,
    servicenowClientId: process.env.SERVICENOW_CLIENT_ID,
    servicenowClientSecret: process.env.SERVICENOW_CLIENT_SECRET,
  };
}
