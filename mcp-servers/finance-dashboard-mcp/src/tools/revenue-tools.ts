import { z } from 'zod';
import { getFinanceConnector } from '../connectors/finance';
import logger from '../utils/logger';

// ==========================================
// Schema Definitions
// ==========================================

export const getRevenueTrendSchema = z.object({
  granularity: z.enum(['month', 'quarter']).default('month').describe('Time granularity for revenue data'),
  periods: z.number().min(1).max(24).default(12).describe('Number of periods to include (1-24)')
});

export const getRevenueBySegmentSchema = z.object({});

export const getMRRSchema = z.object({});

// ==========================================
// Tool Handlers
// ==========================================

export async function getRevenueTrend(params: z.infer<typeof getRevenueTrendSchema>): Promise<{
  trend: Array<{
    period: string;
    revenue: number;
    previousPeriodRevenue: number;
    changePercent: number;
    trend: 'up' | 'down' | 'flat';
  }>;
  summary: {
    totalRevenue: number;
    averageRevenue: number;
    highestPeriod: { period: string; revenue: number };
    lowestPeriod: { period: string; revenue: number };
    overallGrowth: number;
  };
  granularity: string;
  currency: string;
}> {
  const { granularity = 'month', periods = 12 } = params;
  logger.info('Executing get_revenue_trend', { granularity, periods });

  const connector = getFinanceConnector();
  const revenueTrend = await connector.getRevenueTrend(granularity, periods);

  // Calculate summary statistics
  const trendData = revenueTrend.periods.map(p => ({
    ...p,
    trend: p.changePercent > 1 ? 'up' as const :
           p.changePercent < -1 ? 'down' as const : 'flat' as const
  }));

  const totalRevenue = trendData.reduce((sum, p) => sum + p.revenue, 0);
  const averageRevenue = totalRevenue / trendData.length;

  const sorted = [...trendData].sort((a, b) => b.revenue - a.revenue);
  const highestPeriod = { period: sorted[0].period, revenue: sorted[0].revenue };
  const lowestPeriod = { period: sorted[sorted.length - 1].period, revenue: sorted[sorted.length - 1].revenue };

  const firstRevenue = trendData[trendData.length - 1]?.revenue || 0;
  const lastRevenue = trendData[0]?.revenue || 0;
  const overallGrowth = firstRevenue > 0 ? ((lastRevenue - firstRevenue) / firstRevenue) * 100 : 0;

  return {
    trend: trendData,
    summary: {
      totalRevenue,
      averageRevenue: Math.round(averageRevenue),
      highestPeriod,
      lowestPeriod,
      overallGrowth: Math.round(overallGrowth * 10) / 10
    },
    granularity,
    currency: revenueTrend.currency
  };
}

export async function getRevenueBySegment(): Promise<{
  segments: Array<{
    name: string;
    revenue: number;
    percent: number;
    growth: number;
    trend: 'up' | 'down' | 'flat';
  }>;
  totalRevenue: number;
  topSegment: { name: string; revenue: number; percent: number };
  fastestGrowing: { name: string; growth: number };
  currency: string;
  period: string;
}> {
  logger.info('Executing get_revenue_by_segment');

  const connector = getFinanceConnector();
  const segmentData = await connector.getRevenueBySegment();

  // Add trend based on growth
  const segmentsWithTrend = segmentData.segments.map(s => ({
    ...s,
    trend: s.growth > 2 ? 'up' as const :
           s.growth < -2 ? 'down' as const : 'flat' as const
  }));

  // Find top segment and fastest growing
  const sortedByRevenue = [...segmentsWithTrend].sort((a, b) => b.revenue - a.revenue);
  const sortedByGrowth = [...segmentsWithTrend].sort((a, b) => b.growth - a.growth);

  return {
    segments: segmentsWithTrend,
    totalRevenue: segmentData.totalRevenue,
    topSegment: {
      name: sortedByRevenue[0].name,
      revenue: sortedByRevenue[0].revenue,
      percent: sortedByRevenue[0].percent
    },
    fastestGrowing: {
      name: sortedByGrowth[0].name,
      growth: sortedByGrowth[0].growth
    },
    currency: segmentData.currency,
    period: segmentData.period
  };
}

export async function getMRR(): Promise<{
  mrr: number;
  arr: number;
  metrics: {
    growth: number;
    churn: number;
    netNewMRR: number;
    expansionMRR: number;
    contractionMRR: number;
  };
  healthIndicators: {
    churnRisk: 'low' | 'medium' | 'high';
    growthHealth: 'strong' | 'moderate' | 'weak';
  };
  currency: string;
  asOfDate: string;
  analysis: string;
}> {
  logger.info('Executing get_mrr');

  const connector = getFinanceConnector();
  const mrrData = await connector.getMRR();

  // Calculate health indicators
  const churnRisk = mrrData.churn > 5 ? 'high' as const :
                    mrrData.churn > 2 ? 'medium' as const : 'low' as const;

  const growthHealth = mrrData.growth > 10 ? 'strong' as const :
                       mrrData.growth > 5 ? 'moderate' as const : 'weak' as const;

  // Generate analysis
  let analysis = `MRR of ${mrrData.mrr.toLocaleString()} ${mrrData.currency} with ${mrrData.growth}% month-over-month growth. `;
  analysis += `ARR run rate is ${mrrData.arr.toLocaleString()} ${mrrData.currency}. `;

  if (churnRisk === 'high') {
    analysis += 'Warning: Churn rate is high and should be addressed. ';
  } else if (churnRisk === 'low') {
    analysis += 'Churn rate is healthy. ';
  }

  if (mrrData.expansionMRR > mrrData.contractionMRR) {
    analysis += `Net expansion is positive with ${mrrData.expansionMRR.toLocaleString()} expansion vs ${mrrData.contractionMRR.toLocaleString()} contraction.`;
  } else {
    analysis += `Warning: Contraction exceeds expansion - focus on customer success.`;
  }

  return {
    mrr: mrrData.mrr,
    arr: mrrData.arr,
    metrics: {
      growth: mrrData.growth,
      churn: mrrData.churn,
      netNewMRR: mrrData.netNewMRR,
      expansionMRR: mrrData.expansionMRR,
      contractionMRR: mrrData.contractionMRR
    },
    healthIndicators: {
      churnRisk,
      growthHealth
    },
    currency: mrrData.currency,
    asOfDate: mrrData.asOfDate,
    analysis
  };
}

// ==========================================
// Tool Definitions
// ==========================================

export const revenueToolDefinitions = [
  {
    name: 'get_revenue_trend',
    description: 'Get revenue trend over time by month or quarter. Includes period-over-period comparison and summary statistics.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        granularity: {
          type: 'string',
          enum: ['month', 'quarter'],
          description: 'Time granularity for revenue data (default: month)',
          default: 'month'
        },
        periods: {
          type: 'number',
          description: 'Number of periods to include (1-24, default: 12)',
          minimum: 1,
          maximum: 24,
          default: 12
        }
      },
      required: [] as string[]
    }
  },
  {
    name: 'get_revenue_by_segment',
    description: 'Get revenue breakdown by business segment or product line. Shows revenue, percentage of total, and growth for each segment.',
    inputSchema: {
      type: 'object' as const,
      properties: {},
      required: [] as string[]
    }
  },
  {
    name: 'get_mrr',
    description: 'Get Monthly Recurring Revenue (MRR) metrics for SaaS/subscription businesses. Includes MRR, ARR, growth rate, churn, expansion, and contraction metrics.',
    inputSchema: {
      type: 'object' as const,
      properties: {},
      required: [] as string[]
    }
  }
];
