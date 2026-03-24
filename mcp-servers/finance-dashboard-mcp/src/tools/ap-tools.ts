import { z } from 'zod';
import { getFinanceConnector } from '../connectors/finance';
import logger from '../utils/logger';

// ==========================================
// Schema Definitions
// ==========================================

export const getAPSummarySchema = z.object({});

export const getAPAgingSchema = z.object({});

export const getUpcomingPaymentsSchema = z.object({
  period: z.enum(['week', 'month']).default('week').describe('Time period for upcoming payments')
});

// ==========================================
// Tool Handlers
// ==========================================

export async function getAPSummary(): Promise<{
  totalPayables: number;
  agingBuckets: {
    current: number;
    days1to30: number;
    days31to60: number;
    days61to90: number;
    over90: number;
  };
  dpo: number;
  currency: string;
  asOfDate: string;
}> {
  logger.info('Executing get_ap_summary');

  const connector = getFinanceConnector();
  const summary = await connector.getAPSummary();

  return {
    totalPayables: summary.totalPayables,
    agingBuckets: {
      current: summary.current,
      days1to30: summary.days1to30,
      days31to60: summary.days31to60,
      days61to90: summary.days61to90,
      over90: summary.over90
    },
    dpo: summary.dpo,
    currency: summary.currency,
    asOfDate: summary.asOfDate
  };
}

export async function getAPAging(): Promise<{
  summary: {
    totalPayables: number;
    dpo: number;
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
  logger.info('Executing get_ap_aging');

  const connector = getFinanceConnector();
  const aging = await connector.getAPAging();

  return {
    summary: {
      totalPayables: aging.summary.totalPayables,
      dpo: aging.summary.dpo
    },
    aging: aging.details,
    currency: aging.summary.currency,
    asOfDate: aging.summary.asOfDate
  };
}

export async function getUpcomingPayments(params: z.infer<typeof getUpcomingPaymentsSchema>): Promise<{
  payments: Array<{
    vendorName: string;
    invoiceNumber: string;
    dueDate: string;
    amount: number;
    status: string;
  }>;
  totalAmount: number;
  currency: string;
  period: string;
  count: number;
}> {
  const { period = 'week' } = params;
  logger.info('Executing get_upcoming_payments', { period });

  const connector = getFinanceConnector();
  const payments = await connector.getUpcomingPayments(period);

  return {
    payments: payments.payments.map(p => ({
      vendorName: p.vendorName,
      invoiceNumber: p.invoiceNumber,
      dueDate: p.dueDate,
      amount: p.amount,
      status: p.status
    })),
    totalAmount: payments.totalAmount,
    currency: payments.currency,
    period: payments.period,
    count: payments.payments.length
  };
}

// ==========================================
// Tool Definitions
// ==========================================

export const apToolDefinitions = [
  {
    name: 'get_ap_summary',
    description: 'Get accounts payable summary including total AP, aging buckets (current, 1-30, 31-60, 61-90, 90+ days), and Days Payable Outstanding (DPO).',
    inputSchema: {
      type: 'object' as const,
      properties: {},
      required: [] as string[]
    }
  },
  {
    name: 'get_ap_aging',
    description: 'Get detailed accounts payable aging report with breakdown by aging bucket including amounts, percentages, and invoice counts.',
    inputSchema: {
      type: 'object' as const,
      properties: {},
      required: [] as string[]
    }
  },
  {
    name: 'get_upcoming_payments',
    description: 'Get payments due this week or month. Helps with cash flow planning and ensuring vendors are paid on time.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        period: {
          type: 'string',
          enum: ['week', 'month'],
          description: 'Time period for upcoming payments (default: week)',
          default: 'week'
        }
      },
      required: [] as string[]
    }
  }
];
