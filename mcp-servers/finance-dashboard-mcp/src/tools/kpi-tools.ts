import { z } from 'zod';
import { getFinanceConnector } from '../connectors/finance';
import logger from '../utils/logger';

// ==========================================
// Schema Definitions
// ==========================================

export const getFinancialSummarySchema = z.object({});

export const getKPIDashboardSchema = z.object({});

export const comparePeriodsSchema = z.object({
  period1: z.string().describe('First period to compare (e.g., "2024-01" or "Q1 2024")'),
  period2: z.string().describe('Second period to compare (e.g., "2024-02" or "Q2 2024")')
});

// ==========================================
// Tool Handlers
// ==========================================

export async function getFinancialSummary(): Promise<{
  summary: {
    revenue: number;
    expenses: number;
    grossProfit: number;
    netProfit: number;
    grossMargin: number;
    netMargin: number;
    cash: number;
  };
  asOfDate: string;
  currency: string;
}> {
  logger.info('Executing get_financial_summary');

  const connector = getFinanceConnector();
  const metrics = await connector.getFinancialSummary();

  return {
    summary: {
      revenue: metrics.revenue,
      expenses: metrics.expenses,
      grossProfit: metrics.grossProfit,
      netProfit: metrics.netProfit,
      grossMargin: metrics.grossMargin,
      netMargin: metrics.netMargin,
      cash: metrics.cash
    },
    asOfDate: metrics.asOfDate,
    currency: metrics.currency
  };
}

export async function getKPIDashboard(): Promise<{
  kpis: Array<{
    name: string;
    value: number;
    unit: string;
    trend: 'up' | 'down' | 'flat';
    changePercent: number;
    periodLabel: string;
  }>;
  generatedAt: string;
}> {
  logger.info('Executing get_kpi_dashboard');

  const connector = getFinanceConnector();
  const kpis = await connector.getKPIDashboard();

  return {
    kpis,
    generatedAt: new Date().toISOString()
  };
}

export async function comparePeriods(params: z.infer<typeof comparePeriodsSchema>): Promise<{
  period1: { label: string; metrics: Record<string, number> };
  period2: { label: string; metrics: Record<string, number> };
  changes: Array<{ metric: string; value1: number; value2: number; change: number; changePercent: number }>;
  analysis: string;
}> {
  const { period1, period2 } = params;
  logger.info('Executing compare_periods', { period1, period2 });

  const connector = getFinanceConnector();
  const comparison = await connector.comparePeriods(period1, period2);

  // Generate simple analysis text
  const improvements = comparison.changes.filter(c => c.changePercent > 0);
  const declines = comparison.changes.filter(c => c.changePercent < 0);

  let analysis = `Comparison of ${period1} vs ${period2}: `;
  if (improvements.length > 0) {
    analysis += `Improvements in ${improvements.map(i => i.metric).join(', ')}. `;
  }
  if (declines.length > 0) {
    analysis += `Declines in ${declines.map(d => d.metric).join(', ')}.`;
  }

  return {
    period1: {
      label: comparison.period1.label,
      metrics: {
        revenue: comparison.period1.metrics.revenue,
        expenses: comparison.period1.metrics.expenses,
        netProfit: comparison.period1.metrics.netProfit,
        cash: comparison.period1.metrics.cash
      }
    },
    period2: {
      label: comparison.period2.label,
      metrics: {
        revenue: comparison.period2.metrics.revenue,
        expenses: comparison.period2.metrics.expenses,
        netProfit: comparison.period2.metrics.netProfit,
        cash: comparison.period2.metrics.cash
      }
    },
    changes: comparison.changes,
    analysis
  };
}

// ==========================================
// Tool Definitions
// ==========================================

export const kpiToolDefinitions = [
  {
    name: 'get_financial_summary',
    description: 'Get a snapshot of key financial metrics including revenue, expenses, profit margins, and cash position. Ideal for quick executive overview.',
    inputSchema: {
      type: 'object' as const,
      properties: {},
      required: [] as string[]
    }
  },
  {
    name: 'get_kpi_dashboard',
    description: 'Get all financial KPIs with trend indicators showing up/down/flat movement compared to previous period. Includes metrics like revenue, margins, DSO, DPO, current ratio, working capital, and EBITDA.',
    inputSchema: {
      type: 'object' as const,
      properties: {},
      required: [] as string[]
    }
  },
  {
    name: 'compare_periods',
    description: 'Compare financial metrics between two periods (months, quarters, or years). Shows variance and percentage change for key metrics.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        period1: {
          type: 'string',
          description: 'First period to compare (e.g., "2024-01", "Q1 2024", "2024")'
        },
        period2: {
          type: 'string',
          description: 'Second period to compare (e.g., "2024-02", "Q2 2024", "2023")'
        }
      },
      required: ['period1', 'period2']
    }
  }
];
