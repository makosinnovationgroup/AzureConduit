import { z } from 'zod';
import { getCrmConnector } from '../connectors/crm';
import { logger } from '../server';

// ============================================
// Schema Definitions
// ============================================

export const GetWinRateSchema = z.object({
  period: z
    .string()
    .regex(/^\d{4}(-Q[1-4]|-\d{2})?$/)
    .optional()
    .describe('Period to calculate (e.g., "2024-Q1", "2024-03", or "2024"). Defaults to current year.'),
  group_by: z
    .enum(['rep', 'team', 'segment', 'stage'])
    .optional()
    .default('rep')
    .describe('Dimension to group win rates by'),
  min_deals: z
    .number()
    .min(1)
    .optional()
    .default(5)
    .describe('Minimum closed deals required to include in results'),
});

export const GetSalesCycleSchema = z.object({
  period: z
    .string()
    .regex(/^\d{4}(-Q[1-4]|-\d{2})?$/)
    .optional()
    .describe('Period to calculate (defaults to current year)'),
  group_by: z
    .enum(['rep', 'segment', 'deal_size'])
    .optional()
    .default('rep')
    .describe('Dimension to group sales cycle by'),
  won_only: z
    .boolean()
    .optional()
    .default(true)
    .describe('Only include won deals (vs all closed)'),
});

export const GetLeaderboardSchema = z.object({
  period: z
    .string()
    .regex(/^\d{4}(-Q[1-4]|-\d{2})?$/)
    .optional()
    .describe('Period for leaderboard (defaults to current year)'),
  metric: z
    .enum(['bookings', 'deals_won', 'average_deal_size', 'win_rate'])
    .optional()
    .default('bookings')
    .describe('Metric to rank by'),
  limit: z.number().min(1).max(50).optional().default(10).describe('Number of reps to return'),
});

export const GetQuotaAttainmentSchema = z.object({
  period: z
    .string()
    .regex(/^\d{4}(-Q[1-4]|-\d{2})?$/)
    .describe('Period to calculate (e.g., "2024-Q1", "2024-03", or "2024")'),
  include_forecast: z
    .boolean()
    .optional()
    .default(true)
    .describe('Include forecast attainment in addition to closed'),
});

// ============================================
// Types
// ============================================

export interface WinRateResult {
  period: string;
  groupBy: string;
  overall: {
    won: number;
    lost: number;
    total: number;
    winRate: number;
    wonAmount: number;
    lostAmount: number;
  };
  breakdown: Array<{
    name: string;
    id?: string;
    won: number;
    lost: number;
    total: number;
    winRate: number;
    wonAmount: number;
    lostAmount: number;
    vsOverall: number;
  }>;
  generatedAt: string;
}

export interface SalesCycleResult {
  period: string;
  groupBy: string;
  wonOnly: boolean;
  overall: {
    avgDays: number;
    medianDays: number;
    minDays: number;
    maxDays: number;
    totalDeals: number;
  };
  breakdown: Array<{
    name: string;
    id?: string;
    avgDays: number;
    medianDays: number;
    totalDeals: number;
    vsOverall: number;
  }>;
  byStage: Array<{
    stage: string;
    avgDaysInStage: number;
    totalTransitions: number;
  }>;
  generatedAt: string;
}

export interface LeaderboardResult {
  period: string;
  metric: string;
  rankings: Array<{
    rank: number;
    repId: string;
    repName: string;
    value: number;
    dealsWon: number;
    totalBookings: number;
    avgDealSize: number;
    winRate: number;
    quota?: number;
    attainment?: number;
  }>;
  generatedAt: string;
}

export interface QuotaAttainmentResult {
  period: string;
  summary: {
    totalQuota: number;
    totalClosed: number;
    totalForecast: number;
    closedAttainment: number;
    forecastAttainment: number;
    repsOnTrack: number;
    repsAtRisk: number;
    repsBehind: number;
  };
  byRep: Array<{
    repId: string;
    repName: string;
    quota: number;
    closed: number;
    forecast: number;
    closedAttainment: number;
    forecastAttainment: number;
    gap: number;
    status: 'on_track' | 'at_risk' | 'behind' | 'exceeded';
    rank: number;
  }>;
  generatedAt: string;
}

// ============================================
// Helper Functions
// ============================================

function calculateMedian(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function getPeriodDates(period: string): { start: Date; end: Date } {
  const now = new Date();

  if (!period) {
    // Default to current year
    return {
      start: new Date(now.getFullYear(), 0, 1),
      end: new Date(now.getFullYear(), 11, 31),
    };
  }

  if (period.includes('Q')) {
    const [year, q] = period.split('-Q');
    const quarter = parseInt(q, 10);
    const month = (quarter - 1) * 3;
    return {
      start: new Date(parseInt(year, 10), month, 1),
      end: new Date(parseInt(year, 10), month + 3, 0),
    };
  } else if (period.length === 7) {
    const [year, month] = period.split('-');
    return {
      start: new Date(parseInt(year, 10), parseInt(month, 10) - 1, 1),
      end: new Date(parseInt(year, 10), parseInt(month, 10), 0),
    };
  } else {
    return {
      start: new Date(parseInt(period, 10), 0, 1),
      end: new Date(parseInt(period, 10), 11, 31),
    };
  }
}

function getAttainmentStatus(attainment: number): 'on_track' | 'at_risk' | 'behind' | 'exceeded' {
  if (attainment >= 100) return 'exceeded';
  if (attainment >= 90) return 'on_track';
  if (attainment >= 70) return 'at_risk';
  return 'behind';
}

function getDealSizeCategory(amount: number): string {
  if (amount >= 500000) return 'Enterprise ($500K+)';
  if (amount >= 100000) return 'Large ($100K-$500K)';
  if (amount >= 25000) return 'Mid-Market ($25K-$100K)';
  return 'SMB (<$25K)';
}

// ============================================
// Tool Implementations
// ============================================

export async function getWinRate(
  params: z.infer<typeof GetWinRateSchema>
): Promise<WinRateResult> {
  const connector = getCrmConnector();
  const { period, group_by, min_deals } = params;

  logger.info('Getting win rate', { period, group_by, min_deals });

  const { start, end } = getPeriodDates(period || new Date().getFullYear().toString());

  // Get closed opportunities in period
  const opportunities = await connector.getOpportunities({
    closeDateStart: start,
    closeDateEnd: end,
    isClosed: true,
  });

  // Calculate overall stats
  const won = opportunities.filter((o) => o.isWon);
  const lost = opportunities.filter((o) => !o.isWon);

  const overall = {
    won: won.length,
    lost: lost.length,
    total: opportunities.length,
    winRate: opportunities.length > 0 ? (won.length / opportunities.length) * 100 : 0,
    wonAmount: won.reduce((sum, o) => sum + o.amount, 0),
    lostAmount: lost.reduce((sum, o) => sum + o.amount, 0),
  };

  // Group by dimension
  const groupMap = new Map<
    string,
    { id?: string; won: number; lost: number; wonAmount: number; lostAmount: number }
  >();

  for (const opp of opportunities) {
    let key: string;
    let id: string | undefined;

    switch (group_by) {
      case 'team':
        key = 'Team'; // Would need team info from rep
        break;
      case 'segment':
        key = opp.segment || 'Unknown';
        break;
      case 'stage':
        key = opp.stage;
        break;
      default:
        key = opp.ownerName;
        id = opp.ownerId;
    }

    if (!groupMap.has(key)) {
      groupMap.set(key, { id, won: 0, lost: 0, wonAmount: 0, lostAmount: 0 });
    }

    const group = groupMap.get(key)!;
    if (opp.isWon) {
      group.won += 1;
      group.wonAmount += opp.amount;
    } else {
      group.lost += 1;
      group.lostAmount += opp.amount;
    }
  }

  // Build breakdown with filtering
  const breakdown = Array.from(groupMap.entries())
    .filter(([_, data]) => data.won + data.lost >= min_deals)
    .map(([name, data]) => {
      const total = data.won + data.lost;
      const winRate = total > 0 ? (data.won / total) * 100 : 0;
      return {
        name,
        id: data.id,
        won: data.won,
        lost: data.lost,
        total,
        winRate,
        wonAmount: data.wonAmount,
        lostAmount: data.lostAmount,
        vsOverall: winRate - overall.winRate,
      };
    })
    .sort((a, b) => b.winRate - a.winRate);

  const result: WinRateResult = {
    period: period || new Date().getFullYear().toString(),
    groupBy: group_by,
    overall,
    breakdown,
    generatedAt: new Date().toISOString(),
  };

  logger.info('Win rate calculated', {
    period: result.period,
    overallWinRate: overall.winRate,
    groupCount: breakdown.length,
  });

  return result;
}

export async function getSalesCycle(
  params: z.infer<typeof GetSalesCycleSchema>
): Promise<SalesCycleResult> {
  const connector = getCrmConnector();
  const { period, group_by, won_only } = params;

  logger.info('Getting sales cycle', { period, group_by, won_only });

  const { start, end } = getPeriodDates(period || new Date().getFullYear().toString());

  // Get closed opportunities in period
  const opportunities = await connector.getOpportunities({
    closeDateStart: start,
    closeDateEnd: end,
    isClosed: true,
    isWon: won_only ? true : undefined,
  });

  // Calculate cycle length for each opportunity
  const cyclesWithOpp = opportunities.map((opp) => {
    const cycleLength = Math.ceil(
      (opp.closeDate.getTime() - opp.createdDate.getTime()) / (1000 * 60 * 60 * 24)
    );
    return { opp, cycleLength };
  });

  const cycleLengths = cyclesWithOpp.map((c) => c.cycleLength);

  // Calculate overall stats
  const overall = {
    avgDays: cycleLengths.length > 0 ? cycleLengths.reduce((a, b) => a + b, 0) / cycleLengths.length : 0,
    medianDays: calculateMedian(cycleLengths),
    minDays: cycleLengths.length > 0 ? Math.min(...cycleLengths) : 0,
    maxDays: cycleLengths.length > 0 ? Math.max(...cycleLengths) : 0,
    totalDeals: cycleLengths.length,
  };

  // Group by dimension
  const groupMap = new Map<string, { id?: string; cycles: number[] }>();

  for (const { opp, cycleLength } of cyclesWithOpp) {
    let key: string;
    let id: string | undefined;

    switch (group_by) {
      case 'segment':
        key = opp.segment || 'Unknown';
        break;
      case 'deal_size':
        key = getDealSizeCategory(opp.amount);
        break;
      default:
        key = opp.ownerName;
        id = opp.ownerId;
    }

    if (!groupMap.has(key)) {
      groupMap.set(key, { id, cycles: [] });
    }

    groupMap.get(key)!.cycles.push(cycleLength);
  }

  // Build breakdown
  const breakdown = Array.from(groupMap.entries())
    .map(([name, data]) => {
      const avgDays = data.cycles.reduce((a, b) => a + b, 0) / data.cycles.length;
      return {
        name,
        id: data.id,
        avgDays,
        medianDays: calculateMedian(data.cycles),
        totalDeals: data.cycles.length,
        vsOverall: avgDays - overall.avgDays,
      };
    })
    .sort((a, b) => a.avgDays - b.avgDays);

  // Stage velocity would require historical stage tracking
  const byStage: SalesCycleResult['byStage'] = [];

  const result: SalesCycleResult = {
    period: period || new Date().getFullYear().toString(),
    groupBy: group_by,
    wonOnly: won_only,
    overall,
    breakdown,
    byStage,
    generatedAt: new Date().toISOString(),
  };

  logger.info('Sales cycle calculated', {
    period: result.period,
    avgDays: overall.avgDays,
    totalDeals: overall.totalDeals,
  });

  return result;
}

export async function getLeaderboard(
  params: z.infer<typeof GetLeaderboardSchema>
): Promise<LeaderboardResult> {
  const connector = getCrmConnector();
  const { period, metric, limit } = params;

  logger.info('Getting leaderboard', { period, metric, limit });

  const { start, end } = getPeriodDates(period || new Date().getFullYear().toString());

  // Get won opportunities in period
  const wonOpps = await connector.getOpportunities({
    closeDateStart: start,
    closeDateEnd: end,
    isClosed: true,
    isWon: true,
  });

  // Get lost opportunities for win rate calculation
  const lostOpps = await connector.getOpportunities({
    closeDateStart: start,
    closeDateEnd: end,
    isClosed: true,
    isWon: false,
  });

  // Get forecasts for quota data
  const forecasts = await connector.getForecasts(period || new Date().getFullYear().toString());
  const quotaMap = new Map(forecasts.map((f) => [f.repId, f.quota]));

  // Aggregate by rep
  const repMap = new Map<
    string,
    { name: string; wonAmount: number; wonCount: number; lostCount: number }
  >();

  for (const opp of wonOpps) {
    if (!repMap.has(opp.ownerId)) {
      repMap.set(opp.ownerId, { name: opp.ownerName, wonAmount: 0, wonCount: 0, lostCount: 0 });
    }
    const rep = repMap.get(opp.ownerId)!;
    rep.wonAmount += opp.amount;
    rep.wonCount += 1;
  }

  for (const opp of lostOpps) {
    if (!repMap.has(opp.ownerId)) {
      repMap.set(opp.ownerId, { name: opp.ownerName, wonAmount: 0, wonCount: 0, lostCount: 0 });
    }
    repMap.get(opp.ownerId)!.lostCount += 1;
  }

  // Build rankings
  let rankings = Array.from(repMap.entries()).map(([repId, data]) => {
    const totalClosed = data.wonCount + data.lostCount;
    const winRate = totalClosed > 0 ? (data.wonCount / totalClosed) * 100 : 0;
    const avgDealSize = data.wonCount > 0 ? data.wonAmount / data.wonCount : 0;
    const quota = quotaMap.get(repId);

    return {
      repId,
      repName: data.name,
      dealsWon: data.wonCount,
      totalBookings: data.wonAmount,
      avgDealSize,
      winRate,
      quota,
      attainment: quota && quota > 0 ? (data.wonAmount / quota) * 100 : undefined,
      // Value to sort by based on metric
      value:
        metric === 'deals_won'
          ? data.wonCount
          : metric === 'average_deal_size'
            ? avgDealSize
            : metric === 'win_rate'
              ? winRate
              : data.wonAmount,
    };
  });

  // Sort by selected metric
  rankings.sort((a, b) => b.value - a.value);

  // Take top N and assign ranks
  rankings = rankings.slice(0, limit).map((r, i) => ({
    ...r,
    rank: i + 1,
  }));

  const result: LeaderboardResult = {
    period: period || new Date().getFullYear().toString(),
    metric,
    rankings,
    generatedAt: new Date().toISOString(),
  };

  logger.info('Leaderboard generated', {
    period: result.period,
    metric,
    topPerformer: rankings[0]?.repName,
  });

  return result;
}

export async function getQuotaAttainment(
  params: z.infer<typeof GetQuotaAttainmentSchema>
): Promise<QuotaAttainmentResult> {
  const connector = getCrmConnector();
  const { period, include_forecast } = params;

  logger.info('Getting quota attainment', { period, include_forecast });

  // Get forecasts which include quota and closed data
  const forecasts = await connector.getForecasts(period);

  // Calculate summary
  const totalQuota = forecasts.reduce((sum, f) => sum + f.quota, 0);
  const totalClosed = forecasts.reduce((sum, f) => sum + f.closed, 0);
  const totalForecast = forecasts.reduce((sum, f) => sum + f.closed + f.commit, 0);

  // Build rep details
  const byRep = forecasts
    .map((f) => {
      const closedAttainment = f.quota > 0 ? (f.closed / f.quota) * 100 : 0;
      const forecastAttainment = f.quota > 0 ? ((f.closed + f.commit) / f.quota) * 100 : 0;

      return {
        repId: f.repId,
        repName: f.repName,
        quota: f.quota,
        closed: f.closed,
        forecast: f.closed + f.commit,
        closedAttainment,
        forecastAttainment,
        gap: f.quota - f.closed,
        status: getAttainmentStatus(include_forecast ? forecastAttainment : closedAttainment),
        rank: 0,
      };
    })
    .sort((a, b) => b.closedAttainment - a.closedAttainment);

  // Assign ranks
  byRep.forEach((r, i) => {
    r.rank = i + 1;
  });

  // Count by status
  const repsOnTrack = byRep.filter((r) => r.status === 'on_track' || r.status === 'exceeded').length;
  const repsAtRisk = byRep.filter((r) => r.status === 'at_risk').length;
  const repsBehind = byRep.filter((r) => r.status === 'behind').length;

  const result: QuotaAttainmentResult = {
    period,
    summary: {
      totalQuota,
      totalClosed,
      totalForecast,
      closedAttainment: totalQuota > 0 ? (totalClosed / totalQuota) * 100 : 0,
      forecastAttainment: totalQuota > 0 ? (totalForecast / totalQuota) * 100 : 0,
      repsOnTrack,
      repsAtRisk,
      repsBehind,
    },
    byRep,
    generatedAt: new Date().toISOString(),
  };

  logger.info('Quota attainment calculated', {
    period,
    closedAttainment: result.summary.closedAttainment,
    repCount: byRep.length,
  });

  return result;
}

// ============================================
// Tool Definitions for MCP Registration
// ============================================

export const performanceTools = [
  {
    name: 'get_win_rate',
    description:
      'Calculate win rate (closed won / total closed) by rep, team, segment, or stage. Shows overall win rate and breakdown with comparison to average. Essential for understanding sales effectiveness.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        period: {
          type: 'string',
          description: 'Period to calculate: "2024-Q1" (quarter), "2024-03" (month), or "2024" (year)',
        },
        group_by: {
          type: 'string',
          enum: ['rep', 'team', 'segment', 'stage'],
          description: 'Dimension to group win rates by (default: rep)',
        },
        min_deals: {
          type: 'number',
          description: 'Minimum closed deals required to include (default: 5)',
        },
      },
    },
    handler: getWinRate,
    schema: GetWinRateSchema,
  },
  {
    name: 'get_sales_cycle',
    description:
      'Calculate average sales cycle length (days from opportunity creation to close) by rep, segment, or deal size. Includes median and range. Use for process improvement and forecasting accuracy.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        period: {
          type: 'string',
          description: 'Period to calculate: "2024-Q1" (quarter), "2024-03" (month), or "2024" (year)',
        },
        group_by: {
          type: 'string',
          enum: ['rep', 'segment', 'deal_size'],
          description: 'Dimension to group sales cycle by (default: rep)',
        },
        won_only: {
          type: 'boolean',
          description: 'Only include won deals vs all closed (default: true)',
        },
      },
    },
    handler: getSalesCycle,
    schema: GetSalesCycleSchema,
  },
  {
    name: 'get_leaderboard',
    description:
      'Get sales rep rankings by selected metric: bookings (revenue), deals won, average deal size, or win rate. Use for gamification, recognition, and identifying top performers.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        period: {
          type: 'string',
          description: 'Period for leaderboard: "2024-Q1" (quarter), "2024-03" (month), or "2024" (year)',
        },
        metric: {
          type: 'string',
          enum: ['bookings', 'deals_won', 'average_deal_size', 'win_rate'],
          description: 'Metric to rank by (default: bookings)',
        },
        limit: {
          type: 'number',
          description: 'Number of reps to return (default: 10)',
        },
      },
    },
    handler: getLeaderboard,
    schema: GetLeaderboardSchema,
  },
  {
    name: 'get_quota_attainment',
    description:
      'Get quota attainment by rep showing closed vs quota and forecast vs quota. Identifies reps on track, at risk, or behind. Critical for sales management and end-of-period planning.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        period: {
          type: 'string',
          description: 'Period to calculate: "2024-Q1" (quarter), "2024-03" (month), or "2024" (year)',
        },
        include_forecast: {
          type: 'boolean',
          description: 'Include forecast in attainment calculation (default: true)',
        },
      },
      required: ['period'],
    },
    handler: getQuotaAttainment,
    schema: GetQuotaAttainmentSchema,
  },
];
