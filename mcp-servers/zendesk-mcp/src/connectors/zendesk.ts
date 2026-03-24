import axios, { AxiosInstance, AxiosError } from 'axios';
import logger from '../utils/logger';

export interface ZendeskConfig {
  subdomain: string;
  email: string;
  apiToken: string;
}

export interface ZendeskTicket {
  id: number;
  url: string;
  subject: string;
  description: string;
  status: string;
  priority: string | null;
  requester_id: number;
  assignee_id: number | null;
  group_id: number | null;
  created_at: string;
  updated_at: string;
  tags: string[];
  custom_fields: Array<{ id: number; value: unknown }>;
  via: {
    channel: string;
    source: {
      from: unknown;
      to: unknown;
      rel: string | null;
    };
  };
}

export interface ZendeskComment {
  id: number;
  type: string;
  author_id: number;
  body: string;
  html_body: string;
  plain_body: string;
  public: boolean;
  created_at: string;
}

export interface ZendeskUser {
  id: number;
  url: string;
  name: string;
  email: string;
  role: string;
  active: boolean;
  created_at: string;
  updated_at: string;
  phone: string | null;
  organization_id: number | null;
  tags: string[];
  verified: boolean;
  suspended: boolean;
}

export interface ZendeskTicketMetrics {
  id: number;
  ticket_id: number;
  created_at: string;
  updated_at: string;
  group_stations: number;
  assignee_stations: number;
  reopens: number;
  replies: number;
  assignee_updated_at: string | null;
  requester_updated_at: string | null;
  initially_assigned_at: string | null;
  assigned_at: string | null;
  solved_at: string | null;
  latest_comment_added_at: string | null;
  reply_time_in_minutes: {
    calendar: number | null;
    business: number | null;
  };
  first_resolution_time_in_minutes: {
    calendar: number | null;
    business: number | null;
  };
  full_resolution_time_in_minutes: {
    calendar: number | null;
    business: number | null;
  };
  agent_wait_time_in_minutes: {
    calendar: number | null;
    business: number | null;
  };
  requester_wait_time_in_minutes: {
    calendar: number | null;
    business: number | null;
  };
}

export interface ZendeskSearchResult<T> {
  results: T[];
  count: number;
  next_page: string | null;
  previous_page: string | null;
}

export class ZendeskConnector {
  private client: AxiosInstance;
  private config: ZendeskConfig;

  constructor(config: ZendeskConfig) {
    this.config = config;

    // Create base64 encoded credentials for API token authentication
    // Format: {email}/token:{api_token}
    const credentials = Buffer.from(`${config.email}/token:${config.apiToken}`).toString('base64');

    this.client = axios.create({
      baseURL: `https://${config.subdomain}.zendesk.com/api/v2`,
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/json',
      },
    });

    // Add response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => response,
      (error: AxiosError) => {
        if (error.response) {
          logger.error('Zendesk API error', {
            status: error.response.status,
            statusText: error.response.statusText,
            data: error.response.data,
            url: error.config?.url,
          });
        } else if (error.request) {
          logger.error('Zendesk API request error - no response received', {
            url: error.config?.url,
          });
        } else {
          logger.error('Zendesk API error', { message: error.message });
        }
        throw error;
      }
    );

    logger.info('Zendesk connector initialized', { subdomain: config.subdomain });
  }

  // Ticket Operations
  async listTickets(params?: {
    status?: string;
    priority?: string;
    assignee_id?: number;
    requester_id?: number;
    per_page?: number;
    page?: number;
  }): Promise<{ tickets: ZendeskTicket[]; count: number; next_page: string | null }> {
    logger.info('Listing tickets', { params });

    // Build query string for filtering
    const queryParts: string[] = [];
    if (params?.status) queryParts.push(`status:${params.status}`);
    if (params?.priority) queryParts.push(`priority:${params.priority}`);
    if (params?.assignee_id) queryParts.push(`assignee_id:${params.assignee_id}`);
    if (params?.requester_id) queryParts.push(`requester_id:${params.requester_id}`);

    let endpoint = '/tickets.json';
    const queryParams: Record<string, string | number> = {
      per_page: params?.per_page || 25,
      page: params?.page || 1,
    };

    // If we have filters, use the search endpoint instead
    if (queryParts.length > 0) {
      endpoint = '/search.json';
      queryParams.query = `type:ticket ${queryParts.join(' ')}`;
    }

    const response = await this.client.get(endpoint, { params: queryParams });

    if (queryParts.length > 0) {
      // Search endpoint returns results differently
      return {
        tickets: response.data.results,
        count: response.data.count,
        next_page: response.data.next_page,
      };
    }

    return {
      tickets: response.data.tickets,
      count: response.data.count,
      next_page: response.data.next_page,
    };
  }

  async getTicket(ticketId: number): Promise<ZendeskTicket> {
    logger.info('Getting ticket', { ticketId });
    const response = await this.client.get(`/tickets/${ticketId}.json`);
    return response.data.ticket;
  }

  async getTicketComments(ticketId: number): Promise<ZendeskComment[]> {
    logger.info('Getting ticket comments', { ticketId });
    const response = await this.client.get(`/tickets/${ticketId}/comments.json`);
    return response.data.comments;
  }

  async getTicketWithComments(ticketId: number): Promise<{ ticket: ZendeskTicket; comments: ZendeskComment[] }> {
    const [ticket, comments] = await Promise.all([
      this.getTicket(ticketId),
      this.getTicketComments(ticketId),
    ]);
    return { ticket, comments };
  }

  async searchTickets(query: string, per_page: number = 25): Promise<ZendeskSearchResult<ZendeskTicket>> {
    logger.info('Searching tickets', { query });
    const response = await this.client.get('/search.json', {
      params: {
        query: `type:ticket ${query}`,
        per_page,
      },
    });
    return response.data;
  }

  async getTicketMetrics(ticketId: number): Promise<ZendeskTicketMetrics> {
    logger.info('Getting ticket metrics', { ticketId });
    const response = await this.client.get(`/tickets/${ticketId}/metrics.json`);
    return response.data.ticket_metric;
  }

  // User Operations
  async listAgents(per_page: number = 100): Promise<ZendeskUser[]> {
    logger.info('Listing agents');
    const response = await this.client.get('/users.json', {
      params: {
        role: 'agent',
        per_page,
      },
    });

    // Also get admins as they can also handle tickets
    const adminResponse = await this.client.get('/users.json', {
      params: {
        role: 'admin',
        per_page,
      },
    });

    return [...response.data.users, ...adminResponse.data.users];
  }

  async getUser(userId: number): Promise<ZendeskUser> {
    logger.info('Getting user', { userId });
    const response = await this.client.get(`/users/${userId}.json`);
    return response.data.user;
  }

  async searchUsers(query: string, per_page: number = 25): Promise<ZendeskSearchResult<ZendeskUser>> {
    logger.info('Searching users', { query });
    const response = await this.client.get('/search.json', {
      params: {
        query: `type:user ${query}`,
        per_page,
      },
    });
    return response.data;
  }

  // Analytics Operations
  async getTicketCounts(): Promise<{
    new: number;
    open: number;
    pending: number;
    hold: number;
    solved: number;
    closed: number;
  }> {
    logger.info('Getting ticket counts');
    const response = await this.client.get('/tickets/count.json');
    const totalCount = response.data.count.value;

    // Get counts by status using search
    const statuses = ['new', 'open', 'pending', 'hold', 'solved', 'closed'];
    const counts: Record<string, number> = {};

    await Promise.all(
      statuses.map(async (status) => {
        const searchResponse = await this.client.get('/search/count.json', {
          params: { query: `type:ticket status:${status}` },
        });
        counts[status] = searchResponse.data.count;
      })
    );

    return counts as {
      new: number;
      open: number;
      pending: number;
      hold: number;
      solved: number;
      closed: number;
    };
  }

  async getTicketsByAssignee(): Promise<Array<{ assignee_id: number; count: number }>> {
    logger.info('Getting tickets by assignee');

    // Get all agents first
    const agents = await this.listAgents();

    // Get ticket counts for each agent
    const results = await Promise.all(
      agents.map(async (agent) => {
        const response = await this.client.get('/search/count.json', {
          params: { query: `type:ticket assignee_id:${agent.id} status<solved` },
        });
        return {
          assignee_id: agent.id,
          name: agent.name,
          email: agent.email,
          count: response.data.count,
        };
      })
    );

    // Filter out agents with 0 tickets and sort by count
    return results
      .filter((r) => r.count > 0)
      .sort((a, b) => b.count - a.count);
  }

  // Test connection
  async testConnection(): Promise<boolean> {
    try {
      await this.client.get('/users/me.json');
      logger.info('Zendesk connection test successful');
      return true;
    } catch (error) {
      logger.error('Zendesk connection test failed', { error });
      return false;
    }
  }
}

let zendeskConnector: ZendeskConnector | null = null;

export function initializeZendeskConnector(config: ZendeskConfig): ZendeskConnector {
  zendeskConnector = new ZendeskConnector(config);
  return zendeskConnector;
}

export function getZendeskConnector(): ZendeskConnector {
  if (!zendeskConnector) {
    throw new Error('Zendesk connector not initialized. Call initializeZendeskConnector first.');
  }
  return zendeskConnector;
}
