import axios, { AxiosInstance } from 'axios';
import { logger } from '../server';

/**
 * Supported matter management platforms
 */
export type MatterPlatform = 'clio' | 'practicepanther' | 'custom';

export interface MatterManagementConfig {
  platform: MatterPlatform;
  baseUrl: string;
  apiKey?: string;
  clientId?: string;
  clientSecret?: string;
  accessToken?: string;
  refreshToken?: string;
}

export interface Matter {
  id: string;
  number: string;
  name: string;
  description?: string;
  status: 'active' | 'pending' | 'closed' | 'archived';
  client_id: string;
  client_name: string;
  practice_area?: string;
  responsible_attorney_id?: string;
  responsible_attorney_name?: string;
  originating_attorney_id?: string;
  billing_method?: 'hourly' | 'flat_fee' | 'contingency' | 'mixed';
  open_date?: string;
  close_date?: string;
  statute_of_limitations?: string;
  court_name?: string;
  case_number?: string;
  opposing_counsel?: string;
  custom_fields?: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface MatterDeadline {
  id: string;
  matter_id: string;
  title: string;
  description?: string;
  due_date: string;
  type: 'deadline' | 'hearing' | 'filing' | 'meeting' | 'reminder';
  priority: 'high' | 'medium' | 'low';
  status: 'pending' | 'completed' | 'overdue';
  assigned_to?: string;
  reminder_days_before?: number;
}

export interface Client {
  id: string;
  name: string;
  type: 'individual' | 'company';
  email?: string;
  phone?: string;
  address?: string;
  billing_contact?: string;
  matters_count?: number;
  outstanding_balance?: number;
}

export interface Attorney {
  id: string;
  name: string;
  email: string;
  role: string;
  hourly_rate?: number;
  practice_areas?: string[];
  active: boolean;
}

export class MatterManagementConnector {
  private client: AxiosInstance;
  private config: MatterManagementConfig;
  private isConnected: boolean = false;

  constructor(config: MatterManagementConfig) {
    this.config = config;
    this.client = axios.create({
      baseURL: config.baseUrl,
      headers: this.getAuthHeaders(),
    });
  }

  private getAuthHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (this.config.accessToken) {
      headers['Authorization'] = `Bearer ${this.config.accessToken}`;
    } else if (this.config.apiKey) {
      headers['X-API-Key'] = this.config.apiKey;
    }

    return headers;
  }

  async connect(): Promise<void> {
    logger.info('Connecting to matter management system...', { platform: this.config.platform });

    try {
      // Validate connection by making a test request
      await this.client.get('/api/v1/users/me');
      this.isConnected = true;
      logger.info('Successfully connected to matter management system');
    } catch (error) {
      logger.error('Failed to connect to matter management system', { error });
      throw error;
    }
  }

  isConnectionActive(): boolean {
    return this.isConnected;
  }

  /**
   * List matters with optional filters
   */
  async listMatters(params: {
    client_id?: string;
    status?: string;
    attorney?: string;
    practice_area?: string;
    limit?: number;
    offset?: number;
  }): Promise<Matter[]> {
    logger.info('Listing matters', params);

    try {
      const response = await this.client.get('/api/v1/matters', { params });
      return this.normalizeMatterResponse(response.data);
    } catch (error) {
      logger.error('Failed to list matters', { error });
      throw error;
    }
  }

  /**
   * Get a specific matter by ID
   */
  async getMatter(matterId: string): Promise<Matter | null> {
    logger.info('Getting matter', { matterId });

    try {
      const response = await this.client.get(`/api/v1/matters/${matterId}`);
      return this.normalizeMatter(response.data);
    } catch (error: any) {
      if (error.response?.status === 404) {
        return null;
      }
      logger.error('Failed to get matter', { error, matterId });
      throw error;
    }
  }

  /**
   * Search matters by query string
   */
  async searchMatters(query: string): Promise<Matter[]> {
    logger.info('Searching matters', { query });

    try {
      const response = await this.client.get('/api/v1/matters/search', {
        params: { q: query },
      });
      return this.normalizeMatterResponse(response.data);
    } catch (error) {
      logger.error('Failed to search matters', { error, query });
      throw error;
    }
  }

  /**
   * Get matter timeline (deadlines, hearings, events)
   */
  async getMatterTimeline(matterId: string): Promise<MatterDeadline[]> {
    logger.info('Getting matter timeline', { matterId });

    try {
      const response = await this.client.get(`/api/v1/matters/${matterId}/calendar`);
      return this.normalizeDeadlineResponse(response.data);
    } catch (error) {
      logger.error('Failed to get matter timeline', { error, matterId });
      throw error;
    }
  }

  /**
   * Get all active matters
   */
  async getActiveMatters(): Promise<Matter[]> {
    logger.info('Getting active matters');

    try {
      const response = await this.client.get('/api/v1/matters', {
        params: { status: 'active' },
      });
      return this.normalizeMatterResponse(response.data);
    } catch (error) {
      logger.error('Failed to get active matters', { error });
      throw error;
    }
  }

  /**
   * Get client details
   */
  async getClient(clientId: string): Promise<Client | null> {
    logger.info('Getting client', { clientId });

    try {
      const response = await this.client.get(`/api/v1/contacts/${clientId}`);
      return this.normalizeClient(response.data);
    } catch (error: any) {
      if (error.response?.status === 404) {
        return null;
      }
      logger.error('Failed to get client', { error, clientId });
      throw error;
    }
  }

  /**
   * Get attorney/user details
   */
  async getAttorney(attorneyId: string): Promise<Attorney | null> {
    logger.info('Getting attorney', { attorneyId });

    try {
      const response = await this.client.get(`/api/v1/users/${attorneyId}`);
      return this.normalizeAttorney(response.data);
    } catch (error: any) {
      if (error.response?.status === 404) {
        return null;
      }
      logger.error('Failed to get attorney', { error, attorneyId });
      throw error;
    }
  }

  /**
   * List attorneys/users
   */
  async listAttorneys(): Promise<Attorney[]> {
    logger.info('Listing attorneys');

    try {
      const response = await this.client.get('/api/v1/users');
      return response.data.data?.map((u: any) => this.normalizeAttorney(u)) || [];
    } catch (error) {
      logger.error('Failed to list attorneys', { error });
      throw error;
    }
  }

  // Normalization methods to handle different platform responses
  private normalizeMatterResponse(data: any): Matter[] {
    const matters = data.data || data.matters || data;
    if (!Array.isArray(matters)) return [];
    return matters.map((m: any) => this.normalizeMatter(m));
  }

  private normalizeMatter(data: any): Matter {
    // Handle different platform field naming conventions
    return {
      id: data.id?.toString() || data.matter_id?.toString(),
      number: data.number || data.matter_number || data.display_number,
      name: data.name || data.description || data.matter_name,
      description: data.description || data.notes,
      status: this.normalizeStatus(data.status),
      client_id: data.client?.id?.toString() || data.client_id?.toString(),
      client_name: data.client?.name || data.client_name,
      practice_area: data.practice_area?.name || data.practice_area,
      responsible_attorney_id: data.responsible_attorney?.id?.toString() || data.attorney_id?.toString(),
      responsible_attorney_name: data.responsible_attorney?.name || data.attorney_name,
      originating_attorney_id: data.originating_attorney?.id?.toString(),
      billing_method: data.billing_method || data.billable_type,
      open_date: data.open_date || data.opened_at,
      close_date: data.close_date || data.closed_at,
      statute_of_limitations: data.statute_of_limitations,
      court_name: data.court_name || data.venue,
      case_number: data.case_number || data.docket_number,
      opposing_counsel: data.opposing_counsel,
      custom_fields: data.custom_field_values || data.custom_fields,
      created_at: data.created_at,
      updated_at: data.updated_at,
    };
  }

  private normalizeStatus(status: string): Matter['status'] {
    const statusMap: Record<string, Matter['status']> = {
      'Open': 'active',
      'Active': 'active',
      'open': 'active',
      'active': 'active',
      'Pending': 'pending',
      'pending': 'pending',
      'Closed': 'closed',
      'closed': 'closed',
      'Archived': 'archived',
      'archived': 'archived',
    };
    return statusMap[status] || 'active';
  }

  private normalizeDeadlineResponse(data: any): MatterDeadline[] {
    const deadlines = data.data || data.calendar_entries || data;
    if (!Array.isArray(deadlines)) return [];
    return deadlines.map((d: any) => ({
      id: d.id?.toString(),
      matter_id: d.matter_id?.toString() || d.matter?.id?.toString(),
      title: d.name || d.title || d.summary,
      description: d.description || d.notes,
      due_date: d.due_date || d.start_at || d.date,
      type: this.normalizeDeadlineType(d.type || d.calendar_entry_type),
      priority: d.priority || 'medium',
      status: this.normalizeDeadlineStatus(d),
      assigned_to: d.assigned_to?.name || d.assignee,
      reminder_days_before: d.reminder_days || d.reminder,
    }));
  }

  private normalizeDeadlineType(type: string): MatterDeadline['type'] {
    const typeMap: Record<string, MatterDeadline['type']> = {
      'Deadline': 'deadline',
      'deadline': 'deadline',
      'Hearing': 'hearing',
      'hearing': 'hearing',
      'Filing': 'filing',
      'filing': 'filing',
      'Meeting': 'meeting',
      'meeting': 'meeting',
      'Reminder': 'reminder',
      'reminder': 'reminder',
    };
    return typeMap[type] || 'deadline';
  }

  private normalizeDeadlineStatus(data: any): MatterDeadline['status'] {
    if (data.completed || data.status === 'completed') return 'completed';

    const dueDate = new Date(data.due_date || data.start_at || data.date);
    if (dueDate < new Date()) return 'overdue';

    return 'pending';
  }

  private normalizeClient(data: any): Client {
    return {
      id: data.id?.toString(),
      name: data.name || data.display_name,
      type: data.type === 'Company' || data.company ? 'company' : 'individual',
      email: data.primary_email?.address || data.email,
      phone: data.primary_phone?.number || data.phone,
      address: data.primary_address?.city || data.address,
      billing_contact: data.billing_contact?.name,
      matters_count: data.matters_count,
      outstanding_balance: data.outstanding_balance,
    };
  }

  private normalizeAttorney(data: any): Attorney {
    return {
      id: data.id?.toString(),
      name: data.name || `${data.first_name} ${data.last_name}`,
      email: data.email,
      role: data.role || data.type || 'Attorney',
      hourly_rate: data.default_hourly_rate || data.hourly_rate,
      practice_areas: data.practice_areas || [],
      active: data.enabled !== false && data.active !== false,
    };
  }
}

let matterConnector: MatterManagementConnector | null = null;

export function initializeMatterConnector(): MatterManagementConnector {
  if (!matterConnector) {
    const config: MatterManagementConfig = {
      platform: (process.env.MATTER_PLATFORM as MatterPlatform) || 'clio',
      baseUrl: process.env.MATTER_BASE_URL || 'https://app.clio.com',
      apiKey: process.env.MATTER_API_KEY,
      clientId: process.env.MATTER_CLIENT_ID,
      clientSecret: process.env.MATTER_CLIENT_SECRET,
      accessToken: process.env.MATTER_ACCESS_TOKEN,
      refreshToken: process.env.MATTER_REFRESH_TOKEN,
    };

    if (!config.baseUrl) {
      throw new Error('Missing required MATTER_BASE_URL configuration');
    }

    if (!config.accessToken && !config.apiKey) {
      throw new Error('Missing required authentication. Provide MATTER_ACCESS_TOKEN or MATTER_API_KEY');
    }

    matterConnector = new MatterManagementConnector(config);
    logger.info('Matter management connector initialized', {
      platform: config.platform,
      baseUrl: config.baseUrl,
    });
  }

  return matterConnector;
}

export function getMatterConnector(): MatterManagementConnector {
  if (!matterConnector) {
    return initializeMatterConnector();
  }
  return matterConnector;
}
