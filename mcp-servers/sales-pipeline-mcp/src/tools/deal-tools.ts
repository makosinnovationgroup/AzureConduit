import { z } from 'zod';
import { getCrmConnector, Opportunity } from '../connectors/crm';
import { logger } from '../server';

// ============================================
// Schema Definitions
// ============================================

export const GetClosingThisMonthSchema = z.object({
  rep_id: z.string().optional().describe('Filter by specific rep ID'),
  min_amount: z.number().min(0).optional().describe('Minimum deal amount'),
  include_at_risk: z.boolean().optional().default(true).describe('Include deals flagged as at risk'),
});

export const GetStalledDealsSchema = z.object({
  days: z
    .number()
    .min(1)
    .max(180)
    .optional()
    .default(14)
    .describe('Days without activity to consider stalled'),
  min_amount: z.number().min(0).optional().describe('Minimum deal amount'),
  stage: z.string().optional().describe('Filter by specific stage'),
});

export const GetAtRiskDealsSchema = z.object({
  rep_id: z.string().optional().describe('Filter by specific rep ID'),
  min_amount: z.number().min(0).optional().describe('Minimum deal amount'),
});

export const GetLargestDealsSchema = z.object({
  limit: z.number().min(1).max(100).optional().default(20).describe('Number of deals to return'),
  include_closed: z.boolean().optional().default(false).describe('Include closed deals'),
  rep_id: z.string().optional().describe('Filter by specific rep ID'),
});

// ============================================
// Types
// ============================================

export interface DealSummary {
  id: string;
  name: string;
  amount: number;
  stage: string;
  probability: number;
  closeDate: string;
  daysUntilClose: number;
  ownerName: string;
  ownerId: string;
  accountName?: string;
  lastActivityDate?: string;
  daysSinceActivity?: number;
  riskFlag?: boolean;
  riskReason?: string;
}

export interface ClosingThisMonthResult {
  month: string;
  summary: {
    totalDeals: number;
    totalAmount: number;
    weightedAmount: number;
    atRiskCount: number;
    atRiskAmount: number;
  };
  byWeek: Array<{
    weekNumber: number;
    weekStart: string;
    weekEnd: string;
    deals: DealSummary[];
    totalAmount: number;
  }>;
  deals: DealSummary[];
  generatedAt: string;
}

export interface StalledDealsResult {
  threshold: {
    days: number;
    cutoffDate: string;
  };
  summary: {
    totalDeals: number;
    totalAmount: number;
    avgDaysSinceActivity: number;
  };
  byStage: Array<{
    stage: string;
    count: number;
    totalAmount: number;
  }>;
  deals: DealSummary[];
  generatedAt: string;
}

export interface AtRiskDealsResult {
  summary: {
    totalDeals: number;
    totalAmount: number;
    byRiskReason: Record<string, number>;
  };
  deals: Array<DealSummary & { riskReasons: string[] }>;
  generatedAt: string;
}

export interface LargestDealsResult {
  summary: {
    totalDeals: number;
    totalAmount: number;
    avgAmount: number;
  };
  deals: DealSummary[];
  generatedAt: string;
}

// ============================================
// Helper Functions
// ============================================

function toDealSummary(opp: Opportunity): DealSummary {
  const now = new Date();
  const closeDate = new Date(opp.closeDate);
  const daysUntilClose = Math.ceil((closeDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  let daysSinceActivity: number | undefined;
  if (opp.lastActivityDate) {
    daysSinceActivity = Math.floor(
      (now.getTime() - new Date(opp.lastActivityDate).getTime()) / (1000 * 60 * 60 * 24)
    );
  }

  return {
    id: opp.id,
    name: opp.name,
    amount: opp.amount,
    stage: opp.stage,
    probability: opp.probability,
    closeDate: opp.closeDate.toISOString().split('T')[0],
    daysUntilClose,
    ownerName: opp.ownerName,
    ownerId: opp.ownerId,
    accountName: opp.accountName,
    lastActivityDate: opp.lastActivityDate?.toISOString().split('T')[0],
    daysSinceActivity,
    riskFlag: opp.riskFlag,
    riskReason: opp.riskReason,
  };
}

function getWeekNumber(date: Date): number {
  const startOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
  const dayOfMonth = date.getDate();
  return Math.ceil(dayOfMonth / 7);
}

function identifyRiskReasons(opp: Opportunity): string[] {
  const reasons: string[] = [];
  const now = new Date();

  // Past close date
  if (opp.closeDate < now && !opp.isClosed) {
    reasons.push('past_close_date');
  }

  // No recent activity
  if (opp.lastActivityDate) {
    const daysSinceActivity = Math.floor(
      (now.getTime() - opp.lastActivityDate.getTime()) / (1000 * 60 * 60 * 24)
    );
    if (daysSinceActivity > 14) {
      reasons.push('no_recent_activity');
    }
  } else {
    reasons.push('no_activity_recorded');
  }

  // Probability dropped or low for stage
  if (opp.probability < 50 && opp.stage.toLowerCase().includes('negotiation')) {
    reasons.push('low_probability_late_stage');
  }

  // Close date very soon with low probability
  const daysUntilClose = Math.ceil(
    (opp.closeDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
  );
  if (daysUntilClose <= 7 && opp.probability < 80) {
    reasons.push('imminent_close_low_probability');
  }

  // Large deal with no champion identified (would require custom field)
  if (opp.amount > 100000 && opp.probability < 60) {
    reasons.push('large_deal_low_confidence');
  }

  // Explicitly flagged
  if (opp.riskFlag) {
    reasons.push('manually_flagged');
  }

  return reasons;
}

// ============================================
// Tool Implementations
// ============================================

export async function getClosingThisMonth(
  params: z.infer<typeof GetClosingThisMonthSchema>
): Promise<ClosingThisMonthResult> {
  const connector = getCrmConnector();
  const { rep_id, min_amount, include_at_risk } = params;

  logger.info('Getting deals closing this month', { rep_id, min_amount, include_at_risk });

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

  const opportunities = await connector.getOpportunities({
    ownerId: rep_id,
    closeDateStart: monthStart,
    closeDateEnd: monthEnd,
    isClosed: false,
    minAmount: min_amount,
  });

  // Identify at-risk deals
  const dealsWithRisk = opportunities.map((opp) => {
    const riskReasons = identifyRiskReasons(opp);
    return {
      ...opp,
      riskFlag: riskReasons.length > 0,
      riskReason: riskReasons.join(', '),
    };
  });

  // Filter if not including at-risk
  const filteredDeals = include_at_risk
    ? dealsWithRisk
    : dealsWithRisk.filter((d) => !d.riskFlag);

  // Convert to summaries
  const deals = filteredDeals.map(toDealSummary);

  // Group by week
  const weekMap = new Map<number, DealSummary[]>();
  for (const deal of deals) {
    const closeDate = new Date(deal.closeDate);
    const week = getWeekNumber(closeDate);
    if (!weekMap.has(week)) {
      weekMap.set(week, []);
    }
    weekMap.get(week)!.push(deal);
  }

  const byWeek = Array.from(weekMap.entries())
    .map(([weekNumber, weekDeals]) => {
      const weekStart = new Date(now.getFullYear(), now.getMonth(), (weekNumber - 1) * 7 + 1);
      const weekEnd = new Date(now.getFullYear(), now.getMonth(), weekNumber * 7);
      if (weekEnd > monthEnd) {
        weekEnd.setTime(monthEnd.getTime());
      }

      return {
        weekNumber,
        weekStart: weekStart.toISOString().split('T')[0],
        weekEnd: weekEnd.toISOString().split('T')[0],
        deals: weekDeals,
        totalAmount: weekDeals.reduce((sum, d) => sum + d.amount, 0),
      };
    })
    .sort((a, b) => a.weekNumber - b.weekNumber);

  // Calculate summary
  const atRiskDeals = deals.filter((d) => d.riskFlag);

  const result: ClosingThisMonthResult = {
    month: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`,
    summary: {
      totalDeals: deals.length,
      totalAmount: deals.reduce((sum, d) => sum + d.amount, 0),
      weightedAmount: deals.reduce((sum, d) => sum + d.amount * (d.probability / 100), 0),
      atRiskCount: atRiskDeals.length,
      atRiskAmount: atRiskDeals.reduce((sum, d) => sum + d.amount, 0),
    },
    byWeek,
    deals: deals.sort((a, b) => new Date(a.closeDate).getTime() - new Date(b.closeDate).getTime()),
    generatedAt: new Date().toISOString(),
  };

  logger.info('Deals closing this month generated', {
    month: result.month,
    totalDeals: result.summary.totalDeals,
    totalAmount: result.summary.totalAmount,
  });

  return result;
}

export async function getStalledDeals(
  params: z.infer<typeof GetStalledDealsSchema>
): Promise<StalledDealsResult> {
  const connector = getCrmConnector();
  const { days, min_amount, stage } = params;

  logger.info('Getting stalled deals', { days, min_amount, stage });

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);

  const opportunities = await connector.getOpportunities({
    stage,
    minAmount: min_amount,
    isClosed: false,
    noActivitySince: cutoffDate,
  });

  const deals = opportunities.map(toDealSummary);

  // Group by stage
  const stageMap = new Map<string, { count: number; totalAmount: number }>();
  for (const deal of deals) {
    if (!stageMap.has(deal.stage)) {
      stageMap.set(deal.stage, { count: 0, totalAmount: 0 });
    }
    const stageData = stageMap.get(deal.stage)!;
    stageData.count += 1;
    stageData.totalAmount += deal.amount;
  }

  const byStage = Array.from(stageMap.entries())
    .map(([stageName, data]) => ({
      stage: stageName,
      count: data.count,
      totalAmount: data.totalAmount,
    }))
    .sort((a, b) => b.totalAmount - a.totalAmount);

  // Calculate avg days since activity
  const dealsWithActivity = deals.filter((d) => d.daysSinceActivity !== undefined);
  const avgDaysSinceActivity =
    dealsWithActivity.length > 0
      ? dealsWithActivity.reduce((sum, d) => sum + (d.daysSinceActivity || 0), 0) /
        dealsWithActivity.length
      : 0;

  const result: StalledDealsResult = {
    threshold: {
      days,
      cutoffDate: cutoffDate.toISOString().split('T')[0],
    },
    summary: {
      totalDeals: deals.length,
      totalAmount: deals.reduce((sum, d) => sum + d.amount, 0),
      avgDaysSinceActivity: Math.round(avgDaysSinceActivity),
    },
    byStage,
    deals: deals.sort((a, b) => (b.daysSinceActivity || 0) - (a.daysSinceActivity || 0)),
    generatedAt: new Date().toISOString(),
  };

  logger.info('Stalled deals generated', {
    days,
    totalDeals: result.summary.totalDeals,
    totalAmount: result.summary.totalAmount,
  });

  return result;
}

export async function getAtRiskDeals(
  params: z.infer<typeof GetAtRiskDealsSchema>
): Promise<AtRiskDealsResult> {
  const connector = getCrmConnector();
  const { rep_id, min_amount } = params;

  logger.info('Getting at-risk deals', { rep_id, min_amount });

  const opportunities = await connector.getOpportunities({
    ownerId: rep_id,
    minAmount: min_amount,
    isClosed: false,
  });

  // Identify risk for each deal
  const dealsWithRisk = opportunities
    .map((opp) => {
      const riskReasons = identifyRiskReasons(opp);
      return {
        opp,
        riskReasons,
      };
    })
    .filter((d) => d.riskReasons.length > 0);

  // Count by risk reason
  const byRiskReason: Record<string, number> = {};
  for (const deal of dealsWithRisk) {
    for (const reason of deal.riskReasons) {
      byRiskReason[reason] = (byRiskReason[reason] || 0) + 1;
    }
  }

  const deals = dealsWithRisk.map((d) => ({
    ...toDealSummary(d.opp),
    riskReasons: d.riskReasons,
  }));

  const result: AtRiskDealsResult = {
    summary: {
      totalDeals: deals.length,
      totalAmount: deals.reduce((sum, d) => sum + d.amount, 0),
      byRiskReason,
    },
    deals: deals.sort((a, b) => b.amount - a.amount),
    generatedAt: new Date().toISOString(),
  };

  logger.info('At-risk deals generated', {
    totalDeals: result.summary.totalDeals,
    totalAmount: result.summary.totalAmount,
    riskReasons: Object.keys(byRiskReason),
  });

  return result;
}

export async function getLargestDeals(
  params: z.infer<typeof GetLargestDealsSchema>
): Promise<LargestDealsResult> {
  const connector = getCrmConnector();
  const { limit, include_closed, rep_id } = params;

  logger.info('Getting largest deals', { limit, include_closed, rep_id });

  const opportunities = await connector.getOpportunities({
    ownerId: rep_id,
    isClosed: include_closed ? undefined : false,
    limit,
  });

  // Sort by amount and take top N
  const sortedOpps = opportunities.sort((a, b) => b.amount - a.amount).slice(0, limit);

  const deals = sortedOpps.map(toDealSummary);

  const result: LargestDealsResult = {
    summary: {
      totalDeals: deals.length,
      totalAmount: deals.reduce((sum, d) => sum + d.amount, 0),
      avgAmount: deals.length > 0 ? deals.reduce((sum, d) => sum + d.amount, 0) / deals.length : 0,
    },
    deals,
    generatedAt: new Date().toISOString(),
  };

  logger.info('Largest deals generated', {
    count: result.summary.totalDeals,
    totalAmount: result.summary.totalAmount,
  });

  return result;
}

// ============================================
// Tool Definitions for MCP Registration
// ============================================

export const dealTools = [
  {
    name: 'get_closing_this_month',
    description:
      'Get all deals expected to close this month, grouped by week. Includes risk assessment for each deal. Use for end-of-month forecast calls and identifying deals needing attention.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        rep_id: {
          type: 'string',
          description: 'Filter by specific rep ID (optional)',
        },
        min_amount: {
          type: 'number',
          description: 'Minimum deal amount to include (optional)',
        },
        include_at_risk: {
          type: 'boolean',
          description: 'Include deals flagged as at risk (default: true)',
        },
      },
    },
    handler: getClosingThisMonth,
    schema: GetClosingThisMonthSchema,
  },
  {
    name: 'get_stalled_deals',
    description:
      'Find deals with no activity in a specified number of days. Helps identify opportunities that need re-engagement before they go cold.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        days: {
          type: 'number',
          description: 'Days without activity to consider stalled (default: 14)',
        },
        min_amount: {
          type: 'number',
          description: 'Minimum deal amount to include (optional)',
        },
        stage: {
          type: 'string',
          description: 'Filter by specific pipeline stage (optional)',
        },
      },
    },
    handler: getStalledDeals,
    schema: GetStalledDealsSchema,
  },
  {
    name: 'get_at_risk_deals',
    description:
      'Get deals flagged as at risk based on multiple criteria: past close date, no recent activity, low probability for stage, etc. Essential for proactive deal management.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        rep_id: {
          type: 'string',
          description: 'Filter by specific rep ID (optional)',
        },
        min_amount: {
          type: 'number',
          description: 'Minimum deal amount to include (optional)',
        },
      },
    },
    handler: getAtRiskDeals,
    schema: GetAtRiskDealsSchema,
  },
  {
    name: 'get_largest_deals',
    description:
      'Get the largest deals by amount. Use for executive reporting, whale hunting reviews, and focusing attention on high-value opportunities.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        limit: {
          type: 'number',
          description: 'Number of deals to return (default: 20)',
        },
        include_closed: {
          type: 'boolean',
          description: 'Include closed deals (default: false)',
        },
        rep_id: {
          type: 'string',
          description: 'Filter by specific rep ID (optional)',
        },
      },
    },
    handler: getLargestDeals,
    schema: GetLargestDealsSchema,
  },
];
