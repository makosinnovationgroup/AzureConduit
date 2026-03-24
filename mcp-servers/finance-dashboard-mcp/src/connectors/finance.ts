import axios, { AxiosInstance } from 'axios';
import logger from '../utils/logger';

// ==========================================
// Type Definitions
// ==========================================

export type FinanceSystemType = 'd365' | 'quickbooks' | 'generic';

export interface FinanceConfig {
  systemType: FinanceSystemType;
  // D365 Config
  d365TenantId?: string;
  d365ClientId?: string;
  d365ClientSecret?: string;
  d365Resource?: string;
  d365Environment?: string;
  // QuickBooks Config
  qbClientId?: string;
  qbClientSecret?: string;
  qbRealmId?: string;
  qbRefreshToken?: string;
  qbEnvironment?: 'sandbox' | 'production';
  // Generic API Config
  apiUrl?: string;
  apiKey?: string;
  // Common Settings
  defaultCurrency: string;
  fiscalYearStartMonth: number;
}

export interface FinancialMetrics {
  revenue: number;
  expenses: number;
  grossProfit: number;
  netProfit: number;
  grossMargin: number;
  netMargin: number;
  cash: number;
  asOfDate: string;
  currency: string;
}

export interface KPIData {
  name: string;
  value: number;
  unit: string;
  trend: 'up' | 'down' | 'flat';
  changePercent: number;
  periodLabel: string;
}

export interface ARSummary {
  totalReceivables: number;
  current: number;
  days1to30: number;
  days31to60: number;
  days61to90: number;
  over90: number;
  dso: number;
  currency: string;
  asOfDate: string;
}

export interface APSummary {
  totalPayables: number;
  current: number;
  days1to30: number;
  days31to60: number;
  days61to90: number;
  over90: number;
  dpo: number;
  currency: string;
  asOfDate: string;
}

export interface CashPosition {
  totalCash: number;
  accounts: Array<{
    name: string;
    balance: number;
    currency: string;
  }>;
  asOfDate: string;
  currency: string;
}

export interface CashFlowForecast {
  periods: Array<{
    periodStart: string;
    periodEnd: string;
    expectedInflows: number;
    expectedOutflows: number;
    netCashFlow: number;
    projectedBalance: number;
  }>;
  currency: string;
}

export interface BudgetVsActual {
  categories: Array<{
    category: string;
    budget: number;
    actual: number;
    variance: number;
    variancePercent: number;
  }>;
  totals: {
    budget: number;
    actual: number;
    variance: number;
    variancePercent: number;
  };
  period: string;
  currency: string;
}

export interface RevenueTrend {
  periods: Array<{
    period: string;
    revenue: number;
    previousPeriodRevenue: number;
    changePercent: number;
  }>;
  currency: string;
}

export interface Receivable {
  id: string;
  customerName: string;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  amount: number;
  balance: number;
  daysOutstanding: number;
  currency: string;
}

export interface Payment {
  id: string;
  vendorName: string;
  invoiceNumber: string;
  dueDate: string;
  amount: number;
  currency: string;
  status: string;
}

// ==========================================
// Finance Connector Class
// ==========================================

export class FinanceConnector {
  private config: FinanceConfig;
  private httpClient: AxiosInstance;
  private accessToken: string | null = null;
  private tokenExpiry: Date | null = null;
  private initialized: boolean = false;

  constructor(config: FinanceConfig) {
    this.config = config;
    this.httpClient = axios.create({
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }

  async initialize(): Promise<void> {
    logger.info('Initializing Finance connector', { systemType: this.config.systemType });

    switch (this.config.systemType) {
      case 'd365':
        await this.initializeD365();
        break;
      case 'quickbooks':
        await this.initializeQuickBooks();
        break;
      case 'generic':
        await this.initializeGeneric();
        break;
    }

    this.initialized = true;
    logger.info('Finance connector initialized successfully');
  }

  private async initializeD365(): Promise<void> {
    if (!this.config.d365TenantId || !this.config.d365ClientId || !this.config.d365ClientSecret) {
      throw new Error('Missing D365 Finance configuration');
    }

    // Get OAuth token
    const tokenUrl = `https://login.microsoftonline.com/${this.config.d365TenantId}/oauth2/token`;

    const tokenResponse = await this.httpClient.post(tokenUrl, new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: this.config.d365ClientId,
      client_secret: this.config.d365ClientSecret,
      resource: this.config.d365Resource || ''
    }), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });

    this.accessToken = tokenResponse.data.access_token;
    this.tokenExpiry = new Date(Date.now() + (tokenResponse.data.expires_in - 300) * 1000);

    logger.info('D365 Finance authentication successful');
  }

  private async initializeQuickBooks(): Promise<void> {
    if (!this.config.qbClientId || !this.config.qbClientSecret || !this.config.qbRealmId) {
      throw new Error('Missing QuickBooks configuration');
    }

    // QuickBooks OAuth token refresh
    const tokenUrl = 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer';

    const tokenResponse = await this.httpClient.post(tokenUrl, new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: this.config.qbRefreshToken || ''
    }), {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${Buffer.from(`${this.config.qbClientId}:${this.config.qbClientSecret}`).toString('base64')}`
      }
    });

    this.accessToken = tokenResponse.data.access_token;
    this.tokenExpiry = new Date(Date.now() + (tokenResponse.data.expires_in - 300) * 1000);

    logger.info('QuickBooks authentication successful');
  }

  private async initializeGeneric(): Promise<void> {
    if (!this.config.apiUrl) {
      throw new Error('Missing generic API URL configuration');
    }

    // Validate connectivity
    try {
      await this.httpClient.get(`${this.config.apiUrl}/health`, {
        headers: this.config.apiKey ? { 'Authorization': `Bearer ${this.config.apiKey}` } : {}
      });
    } catch (error) {
      logger.warn('Generic API health check failed, continuing anyway');
    }

    logger.info('Generic API connector initialized');
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  getConfig(): FinanceConfig {
    return this.config;
  }

  // ==========================================
  // Financial Summary Methods
  // ==========================================

  async getFinancialSummary(): Promise<FinancialMetrics> {
    logger.info('Fetching financial summary');

    // In production, this would call the actual finance system API
    // For now, return mock data that represents typical financial metrics
    const mockData: FinancialMetrics = {
      revenue: 1250000,
      expenses: 875000,
      grossProfit: 500000,
      netProfit: 375000,
      grossMargin: 40.0,
      netMargin: 30.0,
      cash: 2150000,
      asOfDate: new Date().toISOString().split('T')[0],
      currency: this.config.defaultCurrency
    };

    return mockData;
  }

  async getKPIDashboard(): Promise<KPIData[]> {
    logger.info('Fetching KPI dashboard');

    const kpis: KPIData[] = [
      { name: 'Revenue', value: 1250000, unit: 'USD', trend: 'up', changePercent: 12.5, periodLabel: 'vs Last Month' },
      { name: 'Gross Margin', value: 40.0, unit: '%', trend: 'up', changePercent: 2.1, periodLabel: 'vs Last Month' },
      { name: 'Net Margin', value: 30.0, unit: '%', trend: 'flat', changePercent: 0.3, periodLabel: 'vs Last Month' },
      { name: 'Operating Cash Flow', value: 425000, unit: 'USD', trend: 'up', changePercent: 8.7, periodLabel: 'vs Last Month' },
      { name: 'DSO', value: 42, unit: 'days', trend: 'down', changePercent: -5.2, periodLabel: 'vs Last Month' },
      { name: 'DPO', value: 35, unit: 'days', trend: 'flat', changePercent: 1.1, periodLabel: 'vs Last Month' },
      { name: 'Current Ratio', value: 2.4, unit: 'x', trend: 'up', changePercent: 4.3, periodLabel: 'vs Last Month' },
      { name: 'Quick Ratio', value: 1.8, unit: 'x', trend: 'up', changePercent: 3.5, periodLabel: 'vs Last Month' },
      { name: 'Working Capital', value: 1850000, unit: 'USD', trend: 'up', changePercent: 6.2, periodLabel: 'vs Last Month' },
      { name: 'EBITDA', value: 450000, unit: 'USD', trend: 'up', changePercent: 9.8, periodLabel: 'vs Last Month' }
    ];

    return kpis;
  }

  async comparePeriods(period1: string, period2: string): Promise<{
    period1: { label: string; metrics: FinancialMetrics };
    period2: { label: string; metrics: FinancialMetrics };
    changes: { metric: string; value1: number; value2: number; change: number; changePercent: number }[];
  }> {
    logger.info('Comparing periods', { period1, period2 });

    // Mock comparison data
    const period1Metrics: FinancialMetrics = {
      revenue: 1250000,
      expenses: 875000,
      grossProfit: 500000,
      netProfit: 375000,
      grossMargin: 40.0,
      netMargin: 30.0,
      cash: 2150000,
      asOfDate: period1,
      currency: this.config.defaultCurrency
    };

    const period2Metrics: FinancialMetrics = {
      revenue: 1111000,
      expenses: 800000,
      grossProfit: 444000,
      netProfit: 311000,
      grossMargin: 39.9,
      netMargin: 28.0,
      cash: 1950000,
      asOfDate: period2,
      currency: this.config.defaultCurrency
    };

    const changes = [
      { metric: 'Revenue', value1: period1Metrics.revenue, value2: period2Metrics.revenue, change: 139000, changePercent: 12.5 },
      { metric: 'Expenses', value1: period1Metrics.expenses, value2: period2Metrics.expenses, change: 75000, changePercent: 9.4 },
      { metric: 'Net Profit', value1: period1Metrics.netProfit, value2: period2Metrics.netProfit, change: 64000, changePercent: 20.6 },
      { metric: 'Cash', value1: period1Metrics.cash, value2: period2Metrics.cash, change: 200000, changePercent: 10.3 }
    ];

    return {
      period1: { label: period1, metrics: period1Metrics },
      period2: { label: period2, metrics: period2Metrics },
      changes
    };
  }

  // ==========================================
  // Accounts Receivable Methods
  // ==========================================

  async getARSummary(): Promise<ARSummary> {
    logger.info('Fetching AR summary');

    return {
      totalReceivables: 850000,
      current: 425000,
      days1to30: 212500,
      days31to60: 127500,
      days61to90: 51000,
      over90: 34000,
      dso: 42,
      currency: this.config.defaultCurrency,
      asOfDate: new Date().toISOString().split('T')[0]
    };
  }

  async getARAging(): Promise<{
    summary: ARSummary;
    details: Array<{ bucket: string; amount: number; percent: number; invoiceCount: number }>;
  }> {
    logger.info('Fetching AR aging report');

    const summary = await this.getARSummary();

    return {
      summary,
      details: [
        { bucket: 'Current', amount: 425000, percent: 50.0, invoiceCount: 45 },
        { bucket: '1-30 Days', amount: 212500, percent: 25.0, invoiceCount: 28 },
        { bucket: '31-60 Days', amount: 127500, percent: 15.0, invoiceCount: 15 },
        { bucket: '61-90 Days', amount: 51000, percent: 6.0, invoiceCount: 8 },
        { bucket: 'Over 90 Days', amount: 34000, percent: 4.0, invoiceCount: 5 }
      ]
    };
  }

  async getTopReceivables(limit: number = 10): Promise<Receivable[]> {
    logger.info('Fetching top receivables', { limit });

    const receivables: Receivable[] = [
      { id: 'INV-001', customerName: 'Acme Corporation', invoiceNumber: 'INV-2024-001', invoiceDate: '2024-01-15', dueDate: '2024-02-15', amount: 125000, balance: 125000, daysOutstanding: 45, currency: 'USD' },
      { id: 'INV-002', customerName: 'TechStart Inc', invoiceNumber: 'INV-2024-002', invoiceDate: '2024-01-20', dueDate: '2024-02-20', amount: 87500, balance: 87500, daysOutstanding: 40, currency: 'USD' },
      { id: 'INV-003', customerName: 'Global Industries', invoiceNumber: 'INV-2024-003', invoiceDate: '2024-01-25', dueDate: '2024-02-25', amount: 65000, balance: 65000, daysOutstanding: 35, currency: 'USD' },
      { id: 'INV-004', customerName: 'Midwest Manufacturing', invoiceNumber: 'INV-2024-004', invoiceDate: '2024-02-01', dueDate: '2024-03-01', amount: 52000, balance: 52000, daysOutstanding: 28, currency: 'USD' },
      { id: 'INV-005', customerName: 'Pacific Trading Co', invoiceNumber: 'INV-2024-005', invoiceDate: '2024-02-05', dueDate: '2024-03-05', amount: 48000, balance: 48000, daysOutstanding: 24, currency: 'USD' }
    ];

    return receivables.slice(0, limit);
  }

  async getCollectionForecast(weeks: number = 4): Promise<{
    weeks: Array<{ weekStart: string; weekEnd: string; expectedCollections: number; invoiceCount: number }>;
    totalExpected: number;
    currency: string;
  }> {
    logger.info('Fetching collection forecast', { weeks });

    const forecast = {
      weeks: [
        { weekStart: '2024-03-04', weekEnd: '2024-03-10', expectedCollections: 125000, invoiceCount: 12 },
        { weekStart: '2024-03-11', weekEnd: '2024-03-17', expectedCollections: 185000, invoiceCount: 18 },
        { weekStart: '2024-03-18', weekEnd: '2024-03-24', expectedCollections: 95000, invoiceCount: 9 },
        { weekStart: '2024-03-25', weekEnd: '2024-03-31', expectedCollections: 145000, invoiceCount: 14 }
      ],
      totalExpected: 550000,
      currency: this.config.defaultCurrency
    };

    return { ...forecast, weeks: forecast.weeks.slice(0, weeks) };
  }

  // ==========================================
  // Accounts Payable Methods
  // ==========================================

  async getAPSummary(): Promise<APSummary> {
    logger.info('Fetching AP summary');

    return {
      totalPayables: 620000,
      current: 310000,
      days1to30: 186000,
      days31to60: 93000,
      days61to90: 21700,
      over90: 9300,
      dpo: 35,
      currency: this.config.defaultCurrency,
      asOfDate: new Date().toISOString().split('T')[0]
    };
  }

  async getAPAging(): Promise<{
    summary: APSummary;
    details: Array<{ bucket: string; amount: number; percent: number; invoiceCount: number }>;
  }> {
    logger.info('Fetching AP aging report');

    const summary = await this.getAPSummary();

    return {
      summary,
      details: [
        { bucket: 'Current', amount: 310000, percent: 50.0, invoiceCount: 32 },
        { bucket: '1-30 Days', amount: 186000, percent: 30.0, invoiceCount: 22 },
        { bucket: '31-60 Days', amount: 93000, percent: 15.0, invoiceCount: 11 },
        { bucket: '61-90 Days', amount: 21700, percent: 3.5, invoiceCount: 4 },
        { bucket: 'Over 90 Days', amount: 9300, percent: 1.5, invoiceCount: 2 }
      ]
    };
  }

  async getUpcomingPayments(period: 'week' | 'month' = 'week'): Promise<{
    payments: Payment[];
    totalAmount: number;
    currency: string;
    period: string;
  }> {
    logger.info('Fetching upcoming payments', { period });

    const payments: Payment[] = [
      { id: 'PAY-001', vendorName: 'Office Supplies Co', invoiceNumber: 'VS-2024-101', dueDate: '2024-03-07', amount: 2500, currency: 'USD', status: 'pending' },
      { id: 'PAY-002', vendorName: 'Cloud Services Inc', invoiceNumber: 'CS-2024-045', dueDate: '2024-03-08', amount: 15000, currency: 'USD', status: 'pending' },
      { id: 'PAY-003', vendorName: 'Marketing Agency', invoiceNumber: 'MA-2024-022', dueDate: '2024-03-10', amount: 8500, currency: 'USD', status: 'pending' },
      { id: 'PAY-004', vendorName: 'IT Solutions', invoiceNumber: 'IT-2024-089', dueDate: '2024-03-12', amount: 12000, currency: 'USD', status: 'scheduled' },
      { id: 'PAY-005', vendorName: 'Utilities Provider', invoiceNumber: 'UP-2024-003', dueDate: '2024-03-15', amount: 3200, currency: 'USD', status: 'pending' }
    ];

    const totalAmount = payments.reduce((sum, p) => sum + p.amount, 0);

    return {
      payments,
      totalAmount,
      currency: this.config.defaultCurrency,
      period: period === 'week' ? 'This Week' : 'This Month'
    };
  }

  // ==========================================
  // Cash Management Methods
  // ==========================================

  async getCashPosition(): Promise<CashPosition> {
    logger.info('Fetching cash position');

    return {
      totalCash: 2150000,
      accounts: [
        { name: 'Operating Account', balance: 1250000, currency: 'USD' },
        { name: 'Payroll Account', balance: 450000, currency: 'USD' },
        { name: 'Reserve Account', balance: 350000, currency: 'USD' },
        { name: 'Petty Cash', balance: 5000, currency: 'USD' },
        { name: 'Money Market', balance: 95000, currency: 'USD' }
      ],
      asOfDate: new Date().toISOString().split('T')[0],
      currency: this.config.defaultCurrency
    };
  }

  async getCashFlowForecast(periods: number = 6): Promise<CashFlowForecast> {
    logger.info('Fetching cash flow forecast', { periods });

    const forecastPeriods = [
      { periodStart: '2024-03-01', periodEnd: '2024-03-31', expectedInflows: 1150000, expectedOutflows: 925000, netCashFlow: 225000, projectedBalance: 2375000 },
      { periodStart: '2024-04-01', periodEnd: '2024-04-30', expectedInflows: 1200000, expectedOutflows: 950000, netCashFlow: 250000, projectedBalance: 2625000 },
      { periodStart: '2024-05-01', periodEnd: '2024-05-31', expectedInflows: 1180000, expectedOutflows: 980000, netCashFlow: 200000, projectedBalance: 2825000 },
      { periodStart: '2024-06-01', periodEnd: '2024-06-30', expectedInflows: 1250000, expectedOutflows: 1050000, netCashFlow: 200000, projectedBalance: 3025000 },
      { periodStart: '2024-07-01', periodEnd: '2024-07-31', expectedInflows: 1100000, expectedOutflows: 920000, netCashFlow: 180000, projectedBalance: 3205000 },
      { periodStart: '2024-08-01', periodEnd: '2024-08-31', expectedInflows: 1300000, expectedOutflows: 1000000, netCashFlow: 300000, projectedBalance: 3505000 }
    ];

    return {
      periods: forecastPeriods.slice(0, periods),
      currency: this.config.defaultCurrency
    };
  }

  async getCashRunway(): Promise<{
    currentCash: number;
    averageMonthlyBurn: number;
    runwayMonths: number;
    runwayEndDate: string;
    currency: string;
    burnTrend: 'increasing' | 'decreasing' | 'stable';
  }> {
    logger.info('Fetching cash runway');

    const currentCash = 2150000;
    const averageMonthlyBurn = 875000;
    const runwayMonths = Math.floor(currentCash / averageMonthlyBurn);

    const endDate = new Date();
    endDate.setMonth(endDate.getMonth() + runwayMonths);

    return {
      currentCash,
      averageMonthlyBurn,
      runwayMonths,
      runwayEndDate: endDate.toISOString().split('T')[0],
      currency: this.config.defaultCurrency,
      burnTrend: 'stable'
    };
  }

  // ==========================================
  // Budget Methods
  // ==========================================

  async getBudgetVsActual(period?: string): Promise<BudgetVsActual> {
    logger.info('Fetching budget vs actual', { period });

    return {
      categories: [
        { category: 'Revenue', budget: 1200000, actual: 1250000, variance: 50000, variancePercent: 4.2 },
        { category: 'Cost of Goods Sold', budget: 720000, actual: 750000, variance: -30000, variancePercent: -4.2 },
        { category: 'Salaries & Wages', budget: 350000, actual: 345000, variance: 5000, variancePercent: 1.4 },
        { category: 'Marketing', budget: 80000, actual: 92000, variance: -12000, variancePercent: -15.0 },
        { category: 'Operations', budget: 120000, actual: 115000, variance: 5000, variancePercent: 4.2 },
        { category: 'IT & Technology', budget: 45000, actual: 48000, variance: -3000, variancePercent: -6.7 },
        { category: 'Professional Services', budget: 30000, actual: 28000, variance: 2000, variancePercent: 6.7 },
        { category: 'Other Expenses', budget: 25000, actual: 22000, variance: 3000, variancePercent: 12.0 }
      ],
      totals: {
        budget: 650000,
        actual: 650000,
        variance: 0,
        variancePercent: 0
      },
      period: period || new Date().toISOString().slice(0, 7),
      currency: this.config.defaultCurrency
    };
  }

  async getVarianceReport(threshold: number = 10): Promise<{
    significantVariances: Array<{
      category: string;
      budget: number;
      actual: number;
      variance: number;
      variancePercent: number;
      status: 'over' | 'under';
    }>;
    threshold: number;
    currency: string;
  }> {
    logger.info('Fetching variance report', { threshold });

    return {
      significantVariances: [
        { category: 'Marketing', budget: 80000, actual: 92000, variance: 12000, variancePercent: 15.0, status: 'over' },
        { category: 'Other Expenses', budget: 25000, actual: 22000, variance: -3000, variancePercent: -12.0, status: 'under' }
      ],
      threshold,
      currency: this.config.defaultCurrency
    };
  }

  async getDepartmentSpending(period?: string): Promise<{
    departments: Array<{
      name: string;
      budget: number;
      spent: number;
      remaining: number;
      utilizationPercent: number;
    }>;
    period: string;
    currency: string;
  }> {
    logger.info('Fetching department spending', { period });

    return {
      departments: [
        { name: 'Engineering', budget: 250000, spent: 228000, remaining: 22000, utilizationPercent: 91.2 },
        { name: 'Sales', budget: 180000, spent: 165000, remaining: 15000, utilizationPercent: 91.7 },
        { name: 'Marketing', budget: 80000, spent: 92000, remaining: -12000, utilizationPercent: 115.0 },
        { name: 'Operations', budget: 120000, spent: 98000, remaining: 22000, utilizationPercent: 81.7 },
        { name: 'HR', budget: 45000, spent: 38000, remaining: 7000, utilizationPercent: 84.4 },
        { name: 'Finance', budget: 35000, spent: 29000, remaining: 6000, utilizationPercent: 82.9 }
      ],
      period: period || new Date().toISOString().slice(0, 7),
      currency: this.config.defaultCurrency
    };
  }

  // ==========================================
  // Revenue Methods
  // ==========================================

  async getRevenueTrend(granularity: 'month' | 'quarter' = 'month', periods: number = 12): Promise<RevenueTrend> {
    logger.info('Fetching revenue trend', { granularity, periods });

    const monthlyData = [
      { period: '2024-01', revenue: 1050000, previousPeriodRevenue: 980000, changePercent: 7.1 },
      { period: '2024-02', revenue: 1120000, previousPeriodRevenue: 1050000, changePercent: 6.7 },
      { period: '2024-03', revenue: 1250000, previousPeriodRevenue: 1120000, changePercent: 11.6 },
      { period: '2023-12', revenue: 980000, previousPeriodRevenue: 920000, changePercent: 6.5 },
      { period: '2023-11', revenue: 920000, previousPeriodRevenue: 890000, changePercent: 3.4 },
      { period: '2023-10', revenue: 890000, previousPeriodRevenue: 850000, changePercent: 4.7 }
    ];

    return {
      periods: monthlyData.slice(0, periods),
      currency: this.config.defaultCurrency
    };
  }

  async getRevenueBySegment(): Promise<{
    segments: Array<{
      name: string;
      revenue: number;
      percent: number;
      growth: number;
    }>;
    totalRevenue: number;
    currency: string;
    period: string;
  }> {
    logger.info('Fetching revenue by segment');

    return {
      segments: [
        { name: 'Enterprise', revenue: 625000, percent: 50.0, growth: 15.2 },
        { name: 'Mid-Market', revenue: 312500, percent: 25.0, growth: 8.5 },
        { name: 'SMB', revenue: 187500, percent: 15.0, growth: 12.3 },
        { name: 'Professional Services', revenue: 125000, percent: 10.0, growth: 5.8 }
      ],
      totalRevenue: 1250000,
      currency: this.config.defaultCurrency,
      period: new Date().toISOString().slice(0, 7)
    };
  }

  async getMRR(): Promise<{
    mrr: number;
    arr: number;
    growth: number;
    churn: number;
    netNewMRR: number;
    expansionMRR: number;
    contractionMRR: number;
    currency: string;
    asOfDate: string;
  }> {
    logger.info('Fetching MRR metrics');

    return {
      mrr: 425000,
      arr: 5100000,
      growth: 8.5,
      churn: 2.1,
      netNewMRR: 35000,
      expansionMRR: 22000,
      contractionMRR: 8500,
      currency: this.config.defaultCurrency,
      asOfDate: new Date().toISOString().split('T')[0]
    };
  }
}

// ==========================================
// Singleton Instance Management
// ==========================================

let financeConnector: FinanceConnector | null = null;

export function initializeFinanceConnector(): FinanceConnector {
  if (!financeConnector) {
    const config: FinanceConfig = {
      systemType: (process.env.FINANCE_SYSTEM as FinanceSystemType) || 'generic',
      // D365 Config
      d365TenantId: process.env.D365_TENANT_ID,
      d365ClientId: process.env.D365_CLIENT_ID,
      d365ClientSecret: process.env.D365_CLIENT_SECRET,
      d365Resource: process.env.D365_RESOURCE,
      d365Environment: process.env.D365_ENVIRONMENT,
      // QuickBooks Config
      qbClientId: process.env.QB_CLIENT_ID,
      qbClientSecret: process.env.QB_CLIENT_SECRET,
      qbRealmId: process.env.QB_REALM_ID,
      qbRefreshToken: process.env.QB_REFRESH_TOKEN,
      qbEnvironment: (process.env.QB_ENVIRONMENT as 'sandbox' | 'production') || 'sandbox',
      // Generic Config
      apiUrl: process.env.FINANCE_API_URL,
      apiKey: process.env.FINANCE_API_KEY,
      // Common Settings
      defaultCurrency: process.env.DEFAULT_CURRENCY || 'USD',
      fiscalYearStartMonth: parseInt(process.env.FISCAL_YEAR_START_MONTH || '1', 10)
    };

    financeConnector = new FinanceConnector(config);
    logger.info('Finance connector created', {
      systemType: config.systemType,
      defaultCurrency: config.defaultCurrency
    });
  }

  return financeConnector;
}

export function getFinanceConnector(): FinanceConnector {
  if (!financeConnector) {
    return initializeFinanceConnector();
  }
  return financeConnector;
}

export function resetFinanceConnector(): void {
  financeConnector = null;
  logger.info('Finance connector reset');
}
