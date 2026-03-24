import QuickBooks from 'node-quickbooks';
import { logger } from '../server';

export interface QuickBooksConfig {
  clientId: string;
  clientSecret: string;
  realmId: string;
  refreshToken: string;
  environment: 'sandbox' | 'production';
}

export interface Invoice {
  Id: string;
  DocNumber: string;
  TxnDate: string;
  DueDate: string;
  TotalAmt: number;
  Balance: number;
  CustomerRef: {
    value: string;
    name: string;
  };
  Line: Array<{
    Description?: string;
    Amount: number;
    DetailType: string;
  }>;
  EmailStatus?: string;
  BillEmail?: { Address: string };
}

export interface Expense {
  Id: string;
  TxnDate: string;
  TotalAmt: number;
  PaymentType: string;
  AccountRef?: {
    value: string;
    name: string;
  };
  EntityRef?: {
    value: string;
    name: string;
    type: string;
  };
  Line: Array<{
    Description?: string;
    Amount: number;
    AccountBasedExpenseLineDetail?: {
      AccountRef: {
        value: string;
        name: string;
      };
    };
  }>;
}

export interface Customer {
  Id: string;
  DisplayName: string;
  CompanyName?: string;
  PrimaryEmailAddr?: { Address: string };
  PrimaryPhone?: { FreeFormNumber: string };
  Balance: number;
  BillAddr?: {
    Line1?: string;
    City?: string;
    CountrySubDivisionCode?: string;
    PostalCode?: string;
  };
  Active: boolean;
}

export interface ReportResponse {
  Header: {
    Time: string;
    ReportName: string;
    DateMacro?: string;
    StartPeriod?: string;
    EndPeriod?: string;
  };
  Columns: {
    Column: Array<{
      ColTitle: string;
      ColType: string;
    }>;
  };
  Rows: {
    Row: Array<{
      ColData?: Array<{ value: string }>;
      Summary?: { ColData: Array<{ value: string }> };
      Rows?: { Row: Array<any> };
      Header?: { ColData: Array<{ value: string }> };
    }>;
  };
}

export class QuickBooksClient {
  private qbo: QuickBooks;
  private config: QuickBooksConfig;
  private accessToken: string = '';

  constructor(config: QuickBooksConfig) {
    this.config = config;
    this.qbo = new QuickBooks(
      config.clientId,
      config.clientSecret,
      this.accessToken,
      false, // no token secret for OAuth2
      config.realmId,
      config.environment === 'sandbox',
      false, // debug mode
      null, // minor version
      '2.0', // OAuth version
      config.refreshToken
    );
  }

  private promisify<T>(method: Function, ...args: any[]): Promise<T> {
    return new Promise((resolve, reject) => {
      method.call(this.qbo, ...args, (err: any, result: T) => {
        if (err) {
          logger.error('QuickBooks API error', { error: err });
          reject(err);
        } else {
          resolve(result);
        }
      });
    });
  }

  async refreshAccessToken(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.qbo.refreshAccessToken((err: any, result: any) => {
        if (err) {
          logger.error('Failed to refresh access token', { error: err });
          reject(err);
        } else {
          this.accessToken = result.access_token;
          logger.info('Access token refreshed successfully');
          resolve();
        }
      });
    });
  }

  // Invoice Methods
  async listInvoices(params: {
    status?: string;
    customerId?: string;
    limit?: number;
  }): Promise<Invoice[]> {
    const conditions: string[] = [];

    if (params.customerId) {
      conditions.push(`CustomerRef = '${params.customerId}'`);
    }

    if (params.status) {
      if (params.status === 'open') {
        conditions.push('Balance > 0');
      } else if (params.status === 'paid') {
        conditions.push('Balance = 0');
      }
    }

    const query = conditions.length > 0
      ? conditions.join(' AND ')
      : '';

    const limit = params.limit || 100;

    return this.promisify<{ QueryResponse: { Invoice: Invoice[] } }>(
      this.qbo.findInvoices,
      query ? [{ field: 'fetchAll', value: true }, { query }] : [{ field: 'limit', value: limit }]
    ).then(result => result.QueryResponse?.Invoice || []);
  }

  async getInvoice(invoiceId: string): Promise<Invoice> {
    return this.promisify<Invoice>(this.qbo.getInvoice, invoiceId);
  }

  async getOverdueInvoices(): Promise<Invoice[]> {
    const today = new Date().toISOString().split('T')[0];
    const query = `DueDate < '${today}' AND Balance > 0`;

    return this.promisify<{ QueryResponse: { Invoice: Invoice[] } }>(
      this.qbo.findInvoices,
      [{ query }]
    ).then(result => result.QueryResponse?.Invoice || []);
  }

  async getARAgingSummary(): Promise<ReportResponse> {
    return this.promisify<ReportResponse>(this.qbo.reportAgedReceivables, {});
  }

  // Expense Methods (Purchase in QuickBooks)
  async listExpenses(params: {
    vendorId?: string;
    dateFrom?: string;
    dateTo?: string;
  }): Promise<Expense[]> {
    const conditions: string[] = [];

    if (params.vendorId) {
      conditions.push(`EntityRef = '${params.vendorId}'`);
    }

    if (params.dateFrom) {
      conditions.push(`TxnDate >= '${params.dateFrom}'`);
    }

    if (params.dateTo) {
      conditions.push(`TxnDate <= '${params.dateTo}'`);
    }

    const query = conditions.length > 0
      ? conditions.join(' AND ')
      : '';

    return this.promisify<{ QueryResponse: { Purchase: Expense[] } }>(
      this.qbo.findPurchases,
      query ? [{ query }] : []
    ).then(result => result.QueryResponse?.Purchase || []);
  }

  async getExpense(expenseId: string): Promise<Expense> {
    return this.promisify<Expense>(this.qbo.getPurchase, expenseId);
  }

  async getExpensesByCategory(params: {
    dateFrom?: string;
    dateTo?: string;
  }): Promise<ReportResponse> {
    const reportParams: any = {};

    if (params.dateFrom) {
      reportParams.start_date = params.dateFrom;
    }
    if (params.dateTo) {
      reportParams.end_date = params.dateTo;
    }

    return this.promisify<ReportResponse>(
      this.qbo.reportExpensesByVendor,
      reportParams
    );
  }

  // Report Methods
  async getProfitAndLoss(startDate: string, endDate: string): Promise<ReportResponse> {
    return this.promisify<ReportResponse>(this.qbo.reportProfitAndLoss, {
      start_date: startDate,
      end_date: endDate
    });
  }

  async getBalanceSheet(asOfDate: string): Promise<ReportResponse> {
    return this.promisify<ReportResponse>(this.qbo.reportBalanceSheet, {
      date_macro: 'custom',
      end_date: asOfDate
    });
  }

  async getCashFlow(startDate?: string, endDate?: string): Promise<ReportResponse> {
    const params: any = {};
    if (startDate) params.start_date = startDate;
    if (endDate) params.end_date = endDate;

    return this.promisify<ReportResponse>(this.qbo.reportCashFlow, params);
  }

  // Customer Methods
  async listCustomers(): Promise<Customer[]> {
    return this.promisify<{ QueryResponse: { Customer: Customer[] } }>(
      this.qbo.findCustomers,
      [{ field: 'fetchAll', value: true }]
    ).then(result => result.QueryResponse?.Customer || []);
  }

  async getCustomer(customerId: string): Promise<Customer> {
    return this.promisify<Customer>(this.qbo.getCustomer, customerId);
  }
}

let quickBooksClient: QuickBooksClient | null = null;

export function initializeQuickBooksClient(): QuickBooksClient {
  if (!quickBooksClient) {
    const config: QuickBooksConfig = {
      clientId: process.env.QB_CLIENT_ID || '',
      clientSecret: process.env.QB_CLIENT_SECRET || '',
      realmId: process.env.QB_REALM_ID || '',
      refreshToken: process.env.QB_REFRESH_TOKEN || '',
      environment: (process.env.QB_ENVIRONMENT as 'sandbox' | 'production') || 'sandbox'
    };

    if (!config.clientId || !config.clientSecret || !config.realmId || !config.refreshToken) {
      throw new Error('Missing required QuickBooks configuration. Please check environment variables.');
    }

    quickBooksClient = new QuickBooksClient(config);
    logger.info('QuickBooks client initialized', {
      realmId: config.realmId,
      environment: config.environment
    });
  }

  return quickBooksClient;
}

export function getQuickBooksClient(): QuickBooksClient {
  if (!quickBooksClient) {
    return initializeQuickBooksClient();
  }
  return quickBooksClient;
}
