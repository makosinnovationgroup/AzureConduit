import axios, { AxiosInstance } from 'axios';
import { logger } from '../server';

export interface TimeBillingConfig {
  baseUrl: string;
  apiKey?: string;
  accessToken?: string;
}

export interface TimeEntry {
  id: string;
  matter_id: string;
  matter_name?: string;
  user_id: string;
  user_name?: string;
  date: string;
  hours: number;
  rate: number;
  amount: number;
  description: string;
  activity_type?: string;
  billable: boolean;
  billed: boolean;
  invoice_id?: string;
  created_at: string;
  updated_at: string;
}

export interface Invoice {
  id: string;
  number: string;
  matter_id: string;
  matter_name?: string;
  client_id: string;
  client_name?: string;
  date: string;
  due_date: string;
  subtotal: number;
  tax?: number;
  total: number;
  paid: number;
  balance: number;
  status: 'draft' | 'sent' | 'viewed' | 'paid' | 'partial' | 'overdue' | 'void';
  items?: InvoiceItem[];
  created_at: string;
}

export interface InvoiceItem {
  id: string;
  type: 'time' | 'expense' | 'flat_fee';
  description: string;
  quantity: number;
  rate: number;
  amount: number;
}

export interface AttorneyUtilization {
  attorney_id: string;
  attorney_name: string;
  period_start: string;
  period_end: string;
  available_hours: number;
  billable_hours: number;
  non_billable_hours: number;
  total_hours: number;
  utilization_rate: number;
  billable_amount: number;
  target_hours?: number;
  target_achievement?: number;
}

export interface TimeSummary {
  period_start: string;
  period_end: string;
  total_hours: number;
  billable_hours: number;
  non_billable_hours: number;
  total_amount: number;
  by_matter?: Array<{
    matter_id: string;
    matter_name: string;
    hours: number;
    amount: number;
  }>;
  by_attorney?: Array<{
    attorney_id: string;
    attorney_name: string;
    hours: number;
    amount: number;
  }>;
  by_activity?: Array<{
    activity_type: string;
    hours: number;
    amount: number;
  }>;
}

export interface WorkInProgress {
  matter_id: string;
  matter_name: string;
  client_id: string;
  client_name: string;
  unbilled_time: number;
  unbilled_expenses: number;
  total_wip: number;
  oldest_entry_date?: string;
  time_entries_count: number;
  expense_entries_count: number;
}

export interface AccountsReceivable {
  client_id: string;
  client_name: string;
  total_outstanding: number;
  current: number;
  days_30: number;
  days_60: number;
  days_90: number;
  over_90: number;
  invoices: Array<{
    invoice_id: string;
    invoice_number: string;
    matter_name: string;
    date: string;
    due_date: string;
    amount: number;
    balance: number;
    days_outstanding: number;
  }>;
}

export interface MatterBillingSummary {
  matter_id: string;
  matter_name: string;
  client_name: string;
  billing_method: string;
  total_billed: number;
  total_collected: number;
  outstanding_balance: number;
  wip_amount: number;
  trust_balance?: number;
  budget?: number;
  budget_remaining?: number;
  last_invoice_date?: string;
  realization_rate?: number;
}

export class TimeBillingConnector {
  private client: AxiosInstance;
  private config: TimeBillingConfig;
  private isConnected: boolean = false;

  constructor(config: TimeBillingConfig) {
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
    logger.info('Connecting to time and billing system...');

    try {
      await this.client.get('/api/v1/users/me');
      this.isConnected = true;
      logger.info('Successfully connected to time and billing system');
    } catch (error) {
      logger.error('Failed to connect to time and billing system', { error });
      throw error;
    }
  }

  isConnectionActive(): boolean {
    return this.isConnected;
  }

  /**
   * Get time entries for a specific matter
   */
  async getMatterTime(matterId: string, params?: {
    start_date?: string;
    end_date?: string;
    user_id?: string;
    billable_only?: boolean;
  }): Promise<TimeEntry[]> {
    logger.info('Getting matter time entries', { matterId, ...params });

    try {
      const response = await this.client.get(`/api/v1/matters/${matterId}/activities`, {
        params: {
          type: 'TimeEntry',
          ...params,
        },
      });
      return this.normalizeTimeEntries(response.data);
    } catch (error) {
      logger.error('Failed to get matter time entries', { error, matterId });
      throw error;
    }
  }

  /**
   * Get unbilled time entries, optionally filtered by matter or attorney
   */
  async getUnbilledTime(params?: {
    matter_id?: string;
    attorney_id?: string;
    client_id?: string;
  }): Promise<TimeEntry[]> {
    logger.info('Getting unbilled time', params);

    try {
      const response = await this.client.get('/api/v1/activities', {
        params: {
          type: 'TimeEntry',
          billed: false,
          billable: true,
          ...params,
        },
      });
      return this.normalizeTimeEntries(response.data);
    } catch (error) {
      logger.error('Failed to get unbilled time', { error, ...params });
      throw error;
    }
  }

  /**
   * Get attorney utilization metrics
   */
  async getAttorneyUtilization(params: {
    attorney_id?: string;
    start_date: string;
    end_date: string;
    available_hours_per_day?: number;
  }): Promise<AttorneyUtilization[]> {
    logger.info('Getting attorney utilization', params);

    const availableHoursPerDay = params.available_hours_per_day || 8;

    try {
      // Get all time entries for the period
      const response = await this.client.get('/api/v1/activities', {
        params: {
          type: 'TimeEntry',
          user_id: params.attorney_id,
          from: params.start_date,
          to: params.end_date,
        },
      });

      const entries = this.normalizeTimeEntries(response.data);
      return this.calculateUtilization(entries, params.start_date, params.end_date, availableHoursPerDay);
    } catch (error) {
      logger.error('Failed to get attorney utilization', { error, ...params });
      throw error;
    }
  }

  /**
   * Get time summary for a date range
   */
  async getTimeSummary(params: {
    start_date: string;
    end_date: string;
    matter_id?: string;
    attorney_id?: string;
    group_by?: 'matter' | 'attorney' | 'activity';
  }): Promise<TimeSummary> {
    logger.info('Getting time summary', params);

    try {
      const response = await this.client.get('/api/v1/activities', {
        params: {
          type: 'TimeEntry',
          from: params.start_date,
          to: params.end_date,
          matter_id: params.matter_id,
          user_id: params.attorney_id,
        },
      });

      const entries = this.normalizeTimeEntries(response.data);
      return this.calculateTimeSummary(entries, params.start_date, params.end_date, params.group_by);
    } catch (error) {
      logger.error('Failed to get time summary', { error, ...params });
      throw error;
    }
  }

  /**
   * Get billing summary for a matter
   */
  async getMatterBilling(matterId: string): Promise<MatterBillingSummary> {
    logger.info('Getting matter billing summary', { matterId });

    try {
      const [matterResponse, invoicesResponse, wipResponse] = await Promise.all([
        this.client.get(`/api/v1/matters/${matterId}`),
        this.client.get('/api/v1/bills', { params: { matter_id: matterId } }),
        this.getWIPForMatter(matterId),
      ]);

      const matter = matterResponse.data.data || matterResponse.data;
      const invoices = this.normalizeInvoices(invoicesResponse.data);
      const wip = wipResponse;

      const totalBilled = invoices.reduce((sum: number, inv: Invoice) => sum + inv.total, 0);
      const totalCollected = invoices.reduce((sum: number, inv: Invoice) => sum + inv.paid, 0);
      const outstandingBalance = invoices.reduce((sum: number, inv: Invoice) => sum + inv.balance, 0);

      return {
        matter_id: matterId,
        matter_name: matter.name || matter.description,
        client_name: matter.client?.name || matter.client_name,
        billing_method: matter.billing_method || 'hourly',
        total_billed: totalBilled,
        total_collected: totalCollected,
        outstanding_balance: outstandingBalance,
        wip_amount: wip.total_wip,
        trust_balance: matter.trust_balance,
        budget: matter.budget,
        budget_remaining: matter.budget ? matter.budget - totalBilled - wip.total_wip : undefined,
        last_invoice_date: invoices.length > 0 ? invoices[0].date : undefined,
        realization_rate: totalBilled > 0 ? (totalCollected / totalBilled) * 100 : undefined,
      };
    } catch (error) {
      logger.error('Failed to get matter billing summary', { error, matterId });
      throw error;
    }
  }

  /**
   * Get accounts receivable by client (aging report)
   */
  async getARByClient(clientId?: string): Promise<AccountsReceivable[]> {
    logger.info('Getting AR by client', { clientId });

    try {
      const response = await this.client.get('/api/v1/bills', {
        params: {
          contact_id: clientId,
          status: 'outstanding',
        },
      });

      const invoices = this.normalizeInvoices(response.data);
      return this.calculateARByClient(invoices);
    } catch (error) {
      logger.error('Failed to get AR by client', { error, clientId });
      throw error;
    }
  }

  /**
   * Get work in progress (WIP) summary
   */
  async getWIP(params?: {
    matter_id?: string;
    client_id?: string;
  }): Promise<WorkInProgress[]> {
    logger.info('Getting WIP', params);

    try {
      const response = await this.client.get('/api/v1/activities', {
        params: {
          billed: false,
          billable: true,
          matter_id: params?.matter_id,
          client_id: params?.client_id,
        },
      });

      const entries = this.normalizeTimeEntries(response.data);
      return this.calculateWIP(entries);
    } catch (error) {
      logger.error('Failed to get WIP', { error, ...params });
      throw error;
    }
  }

  private async getWIPForMatter(matterId: string): Promise<WorkInProgress> {
    const wipList = await this.getWIP({ matter_id: matterId });
    return wipList[0] || {
      matter_id: matterId,
      matter_name: '',
      client_id: '',
      client_name: '',
      unbilled_time: 0,
      unbilled_expenses: 0,
      total_wip: 0,
      time_entries_count: 0,
      expense_entries_count: 0,
    };
  }

  // Normalization and calculation methods
  private normalizeTimeEntries(data: any): TimeEntry[] {
    const entries = data.data || data.activities || data;
    if (!Array.isArray(entries)) return [];

    return entries.map((e: any) => ({
      id: e.id?.toString(),
      matter_id: e.matter?.id?.toString() || e.matter_id?.toString(),
      matter_name: e.matter?.name || e.matter_name,
      user_id: e.user?.id?.toString() || e.user_id?.toString(),
      user_name: e.user?.name || e.user_name,
      date: e.date,
      hours: parseFloat(e.quantity) || parseFloat(e.hours) || 0,
      rate: parseFloat(e.rate) || 0,
      amount: parseFloat(e.total) || parseFloat(e.amount) || 0,
      description: e.note || e.description || e.narrative,
      activity_type: e.activity_description?.name || e.activity_type,
      billable: e.non_billable !== true && e.billable !== false,
      billed: e.billed === true,
      invoice_id: e.bill?.id?.toString() || e.invoice_id?.toString(),
      created_at: e.created_at,
      updated_at: e.updated_at,
    }));
  }

  private normalizeInvoices(data: any): Invoice[] {
    const invoices = data.data || data.bills || data;
    if (!Array.isArray(invoices)) return [];

    return invoices.map((inv: any) => ({
      id: inv.id?.toString(),
      number: inv.number || inv.bill_number,
      matter_id: inv.matter?.id?.toString() || inv.matter_id?.toString(),
      matter_name: inv.matter?.name,
      client_id: inv.client?.id?.toString() || inv.contact_id?.toString(),
      client_name: inv.client?.name,
      date: inv.issued_at || inv.date,
      due_date: inv.due_at || inv.due_date,
      subtotal: parseFloat(inv.sub_total) || 0,
      tax: parseFloat(inv.tax_total) || 0,
      total: parseFloat(inv.total) || 0,
      paid: parseFloat(inv.paid) || 0,
      balance: parseFloat(inv.balance) || parseFloat(inv.due) || 0,
      status: this.normalizeInvoiceStatus(inv),
      created_at: inv.created_at,
    }));
  }

  private normalizeInvoiceStatus(inv: any): Invoice['status'] {
    if (inv.status) {
      const statusMap: Record<string, Invoice['status']> = {
        'Draft': 'draft',
        'draft': 'draft',
        'Sent': 'sent',
        'sent': 'sent',
        'Paid': 'paid',
        'paid': 'paid',
        'Partial': 'partial',
        'partial': 'partial',
        'Overdue': 'overdue',
        'overdue': 'overdue',
        'Void': 'void',
        'void': 'void',
      };
      return statusMap[inv.status] || 'sent';
    }

    if (inv.balance === 0 || inv.balance <= 0) return 'paid';
    if (inv.balance < inv.total) return 'partial';
    if (new Date(inv.due_at || inv.due_date) < new Date()) return 'overdue';
    return 'sent';
  }

  private calculateUtilization(
    entries: TimeEntry[],
    startDate: string,
    endDate: string,
    availableHoursPerDay: number
  ): AttorneyUtilization[] {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const workDays = this.getWorkDays(start, end);
    const availableHours = workDays * availableHoursPerDay;

    // Group by attorney
    const byAttorney = new Map<string, { name: string; billable: number; nonBillable: number; amount: number }>();

    for (const entry of entries) {
      const key = entry.user_id;
      if (!byAttorney.has(key)) {
        byAttorney.set(key, { name: entry.user_name || '', billable: 0, nonBillable: 0, amount: 0 });
      }

      const data = byAttorney.get(key)!;
      if (entry.billable) {
        data.billable += entry.hours;
        data.amount += entry.amount;
      } else {
        data.nonBillable += entry.hours;
      }
    }

    return Array.from(byAttorney.entries()).map(([attorneyId, data]) => ({
      attorney_id: attorneyId,
      attorney_name: data.name,
      period_start: startDate,
      period_end: endDate,
      available_hours: availableHours,
      billable_hours: data.billable,
      non_billable_hours: data.nonBillable,
      total_hours: data.billable + data.nonBillable,
      utilization_rate: availableHours > 0 ? (data.billable / availableHours) * 100 : 0,
      billable_amount: data.amount,
    }));
  }

  private calculateTimeSummary(
    entries: TimeEntry[],
    startDate: string,
    endDate: string,
    groupBy?: 'matter' | 'attorney' | 'activity'
  ): TimeSummary {
    let totalHours = 0;
    let billableHours = 0;
    let nonBillableHours = 0;
    let totalAmount = 0;

    const byMatter = new Map<string, { name: string; hours: number; amount: number }>();
    const byAttorney = new Map<string, { name: string; hours: number; amount: number }>();
    const byActivity = new Map<string, { hours: number; amount: number }>();

    for (const entry of entries) {
      totalHours += entry.hours;
      totalAmount += entry.amount;

      if (entry.billable) {
        billableHours += entry.hours;
      } else {
        nonBillableHours += entry.hours;
      }

      // Group by matter
      if (!byMatter.has(entry.matter_id)) {
        byMatter.set(entry.matter_id, { name: entry.matter_name || '', hours: 0, amount: 0 });
      }
      const matterData = byMatter.get(entry.matter_id)!;
      matterData.hours += entry.hours;
      matterData.amount += entry.amount;

      // Group by attorney
      if (!byAttorney.has(entry.user_id)) {
        byAttorney.set(entry.user_id, { name: entry.user_name || '', hours: 0, amount: 0 });
      }
      const attorneyData = byAttorney.get(entry.user_id)!;
      attorneyData.hours += entry.hours;
      attorneyData.amount += entry.amount;

      // Group by activity
      const activityKey = entry.activity_type || 'Other';
      if (!byActivity.has(activityKey)) {
        byActivity.set(activityKey, { hours: 0, amount: 0 });
      }
      const activityData = byActivity.get(activityKey)!;
      activityData.hours += entry.hours;
      activityData.amount += entry.amount;
    }

    return {
      period_start: startDate,
      period_end: endDate,
      total_hours: totalHours,
      billable_hours: billableHours,
      non_billable_hours: nonBillableHours,
      total_amount: totalAmount,
      by_matter: Array.from(byMatter.entries()).map(([id, data]) => ({
        matter_id: id,
        matter_name: data.name,
        hours: data.hours,
        amount: data.amount,
      })),
      by_attorney: Array.from(byAttorney.entries()).map(([id, data]) => ({
        attorney_id: id,
        attorney_name: data.name,
        hours: data.hours,
        amount: data.amount,
      })),
      by_activity: Array.from(byActivity.entries()).map(([type, data]) => ({
        activity_type: type,
        hours: data.hours,
        amount: data.amount,
      })),
    };
  }

  private calculateARByClient(invoices: Invoice[]): AccountsReceivable[] {
    const today = new Date();
    const byClient = new Map<string, AccountsReceivable>();

    for (const invoice of invoices) {
      if (invoice.balance <= 0) continue;

      const clientId = invoice.client_id;
      if (!byClient.has(clientId)) {
        byClient.set(clientId, {
          client_id: clientId,
          client_name: invoice.client_name || '',
          total_outstanding: 0,
          current: 0,
          days_30: 0,
          days_60: 0,
          days_90: 0,
          over_90: 0,
          invoices: [],
        });
      }

      const ar = byClient.get(clientId)!;
      const dueDate = new Date(invoice.due_date);
      const daysOutstanding = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));

      ar.total_outstanding += invoice.balance;

      if (daysOutstanding <= 0) {
        ar.current += invoice.balance;
      } else if (daysOutstanding <= 30) {
        ar.days_30 += invoice.balance;
      } else if (daysOutstanding <= 60) {
        ar.days_60 += invoice.balance;
      } else if (daysOutstanding <= 90) {
        ar.days_90 += invoice.balance;
      } else {
        ar.over_90 += invoice.balance;
      }

      ar.invoices.push({
        invoice_id: invoice.id,
        invoice_number: invoice.number,
        matter_name: invoice.matter_name || '',
        date: invoice.date,
        due_date: invoice.due_date,
        amount: invoice.total,
        balance: invoice.balance,
        days_outstanding: Math.max(0, daysOutstanding),
      });
    }

    return Array.from(byClient.values()).sort((a, b) => b.total_outstanding - a.total_outstanding);
  }

  private calculateWIP(entries: TimeEntry[]): WorkInProgress[] {
    const byMatter = new Map<string, WorkInProgress>();

    for (const entry of entries) {
      if (!byMatter.has(entry.matter_id)) {
        byMatter.set(entry.matter_id, {
          matter_id: entry.matter_id,
          matter_name: entry.matter_name || '',
          client_id: '',
          client_name: '',
          unbilled_time: 0,
          unbilled_expenses: 0,
          total_wip: 0,
          time_entries_count: 0,
          expense_entries_count: 0,
        });
      }

      const wip = byMatter.get(entry.matter_id)!;
      wip.unbilled_time += entry.amount;
      wip.total_wip += entry.amount;
      wip.time_entries_count += 1;

      if (!wip.oldest_entry_date || entry.date < wip.oldest_entry_date) {
        wip.oldest_entry_date = entry.date;
      }
    }

    return Array.from(byMatter.values()).sort((a, b) => b.total_wip - a.total_wip);
  }

  private getWorkDays(start: Date, end: Date): number {
    let count = 0;
    const current = new Date(start);

    while (current <= end) {
      const dayOfWeek = current.getDay();
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        count++;
      }
      current.setDate(current.getDate() + 1);
    }

    return count;
  }
}

let timeBillingConnector: TimeBillingConnector | null = null;

export function initializeTimeBillingConnector(): TimeBillingConnector {
  if (!timeBillingConnector) {
    const config: TimeBillingConfig = {
      baseUrl: process.env.MATTER_BASE_URL || 'https://app.clio.com',
      apiKey: process.env.MATTER_API_KEY,
      accessToken: process.env.MATTER_ACCESS_TOKEN,
    };

    if (!config.baseUrl) {
      throw new Error('Missing required MATTER_BASE_URL configuration');
    }

    timeBillingConnector = new TimeBillingConnector(config);
    logger.info('Time and billing connector initialized');
  }

  return timeBillingConnector;
}

export function getTimeBillingConnector(): TimeBillingConnector {
  if (!timeBillingConnector) {
    return initializeTimeBillingConnector();
  }
  return timeBillingConnector;
}
