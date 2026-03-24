import { z } from 'zod';
import { getFinanceConnector } from '../connectors/finance';
import logger from '../utils/logger';

// ==========================================
// Schema Definitions
// ==========================================

export const getARSummarySchema = z.object({});

export const getARAgingSchema = z.object({});

export const getTopReceivablesSchema = z.object({
  limit: z.number().min(1).max(100).default(10).describe('Maximum number of receivables to return (1-100)')
});

export const getCollectionForecastSchema = z.object({
  weeks: z.number().min(1).max(12).default(4).describe('Number of weeks to forecast (1-12)')
});

// ==========================================
// Tool Handlers
// ==========================================

export async function getARSummary(): Promise<{
  totalReceivables: number;
  agingBuckets: {
    current: number;
    days1to30: number;
    days31to60: number;
    days61to90: number;
    over90: number;
  };
  dso: number;
  currency: string;
  asOfDate: string;
}> {
  logger.info('Executing get_ar_summary');

  const connector = getFinanceConnector();
  const summary = await connector.getARSummary();

  return {
    totalReceivables: summary.totalReceivables,
    agingBuckets: {
      current: summary.current,
      days1to30: summary.days1to30,
      days31to60: summary.days31to60,
      days61to90: summary.days61to90,
      over90: summary.over90
    },
    dso: summary.dso,
    currency: summary.currency,
    asOfDate: summary.asOfDate
  };
}

export async function getARAging(): Promise<{
  summary: {
    totalReceivables: number;
    dso: number;
  };
  aging: Array<{
    bucket: string;
    amount: number;
    percent: number;
    invoiceCount: number;
  }>;
  currency: string;
  asOfDate: string;
}> {
  logger.info('Executing get_ar_aging');

  const connector = getFinanceConnector();
  const aging = await connector.getARAging();

  return {
    summary: {
      totalReceivables: aging.summary.totalReceivables,
      dso: aging.summary.dso
    },
    aging: aging.details,
    currency: aging.summary.currency,
    asOfDate: aging.summary.asOfDate
  };
}

export async function getTopReceivables(params: z.infer<typeof getTopReceivablesSchema>): Promise<{
  receivables: Array<{
    customerName: string;
    invoiceNumber: string;
    dueDate: string;
    amount: number;
    balance: number;
    daysOutstanding: number;
  }>;
  totalAmount: number;
  currency: string;
  count: number;
}> {
  const { limit = 10 } = params;
  logger.info('Executing get_top_receivables', { limit });

  const connector = getFinanceConnector();
  const receivables = await connector.getTopReceivables(limit);

  const totalAmount = receivables.reduce((sum, r) => sum + r.balance, 0);

  return {
    receivables: receivables.map(r => ({
      customerName: r.customerName,
      invoiceNumber: r.invoiceNumber,
      dueDate: r.dueDate,
      amount: r.amount,
      balance: r.balance,
      daysOutstanding: r.daysOutstanding
    })),
    totalAmount,
    currency: receivables[0]?.currency || 'USD',
    count: receivables.length
  };
}

export async function getCollectionForecast(params: z.infer<typeof getCollectionForecastSchema>): Promise<{
  forecast: Array<{
    weekStart: string;
    weekEnd: string;
    expectedCollections: number;
    invoiceCount: number;
  }>;
  totalExpected: number;
  currency: string;
  weeksAhead: number;
}> {
  const { weeks = 4 } = params;
  logger.info('Executing get_collection_forecast', { weeks });

  const connector = getFinanceConnector();
  const forecast = await connector.getCollectionForecast(weeks);

  return {
    forecast: forecast.weeks,
    totalExpected: forecast.totalExpected,
    currency: forecast.currency,
    weeksAhead: weeks
  };
}

// ==========================================
// Tool Definitions
// ==========================================

export const arToolDefinitions = [
  {
    name: 'get_ar_summary',
    description: 'Get accounts receivable summary including total AR, aging buckets (current, 1-30, 31-60, 61-90, 90+ days), and Days Sales Outstanding (DSO).',
    inputSchema: {
      type: 'object' as const,
      properties: {},
      required: [] as string[]
    }
  },
  {
    name: 'get_ar_aging',
    description: 'Get detailed accounts receivable aging report with breakdown by aging bucket including amounts, percentages, and invoice counts.',
    inputSchema: {
      type: 'object' as const,
      properties: {},
      required: [] as string[]
    }
  },
  {
    name: 'get_top_receivables',
    description: 'Get the largest outstanding receivables sorted by balance. Useful for focusing collection efforts on high-value invoices.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        limit: {
          type: 'number',
          description: 'Maximum number of receivables to return (1-100, default: 10)',
          minimum: 1,
          maximum: 100,
          default: 10
        }
      },
      required: [] as string[]
    }
  },
  {
    name: 'get_collection_forecast',
    description: 'Get expected collections by week based on invoice due dates. Helps with cash flow planning and collection prioritization.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        weeks: {
          type: 'number',
          description: 'Number of weeks to forecast (1-12, default: 4)',
          minimum: 1,
          maximum: 12,
          default: 4
        }
      },
      required: [] as string[]
    }
  }
];
