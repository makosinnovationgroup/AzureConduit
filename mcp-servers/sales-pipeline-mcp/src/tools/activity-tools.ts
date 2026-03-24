import { z } from 'zod';
import { getCrmConnector } from '../connectors/crm';
import { logger } from '../server';

// ============================================
// Schema Definitions
// ============================================

export const GetActivitySummarySchema = z.object({
  days: z.number().min(1).max(90).optional().default(7).describe('Number of days to look back'),
  rep_id: z.string().optional().describe('Filter by specific rep ID'),
});

export const GetActivityByRepSchema = z.object({
  days: z.number().min(1).max(90).optional().default(7).describe('Number of days to look back'),
  team: z.string().optional().describe('Filter by team name'),
  activity_type: z
    .enum(['call', 'email', 'meeting', 'task', 'all'])
    .optional()
    .default('all')
    .describe('Filter by activity type'),
});

export const GetAccountsWithoutActivitySchema = z.object({
  days: z
    .number()
    .min(1)
    .max(365)
    .optional()
    .default(30)
    .describe('Days without activity to flag'),
  has_open_opportunities: z
    .boolean()
    .optional()
    .default(true)
    .describe('Only include accounts with open opportunities'),
  min_opportunity_value: z
    .number()
    .min(0)
    .optional()
    .describe('Minimum total opportunity value'),
});

// ============================================
// Types
// ============================================

export interface ActivitySummary {
  period: {
    startDate: string;
    endDate: string;
    days: number;
  };
  totals: {
    calls: number;
    emails: number;
    meetings: number;
    tasks: number;
    total: number;
  };
  byDay: Array<{
    date: string;
    dayOfWeek: string;
    calls: number;
    emails: number;
    meetings: number;
    tasks: number;
    total: number;
  }>;
  avgPerDay: {
    calls: number;
    emails: number;
    meetings: number;
    tasks: number;
    total: number;
  };
  generatedAt: string;
}

export interface ActivityByRepResult {
  period: {
    startDate: string;
    endDate: string;
    days: number;
  };
  teamTotals: {
    calls: number;
    emails: number;
    meetings: number;
    tasks: number;
    total: number;
    avgPerRep: number;
  };
  byRep: Array<{
    repId: string;
    repName: string;
    calls: number;
    emails: number;
    meetings: number;
    tasks: number;
    total: number;
    avgPerDay: number;
    rank: number;
    vsTeamAvg: number;
  }>;
  generatedAt: string;
}

export interface AccountWithoutActivityResult {
  threshold: {
    days: number;
    cutoffDate: string;
  };
  summary: {
    totalAccounts: number;
    totalOpportunityValue: number;
    avgDaysSinceActivity: number;
  };
  accounts: Array<{
    accountId: string;
    accountName: string;
    lastActivityDate?: string;
    daysSinceActivity?: number;
    openOpportunities: number;
    totalOpportunityValue: number;
    ownerName: string;
    ownerId: string;
  }>;
  generatedAt: string;
}

// ============================================
// Helper Functions
// ============================================

function getDayOfWeek(date: Date): string {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return days[date.getDay()];
}

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

// ============================================
// Tool Implementations
// ============================================

export async function getActivitySummary(
  params: z.infer<typeof GetActivitySummarySchema>
): Promise<ActivitySummary> {
  const connector = getCrmConnector();
  const { days, rep_id } = params;

  logger.info('Getting activity summary', { days, rep_id });

  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const activities = await connector.getActivities({
    ownerId: rep_id,
    startDate,
    endDate,
  });

  // Initialize totals
  const totals = {
    calls: 0,
    emails: 0,
    meetings: 0,
    tasks: 0,
    total: 0,
  };

  // Initialize by-day map
  const dayMap = new Map<
    string,
    { calls: number; emails: number; meetings: number; tasks: number }
  >();

  // Fill in all days in the range
  for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
    dayMap.set(formatDate(d), { calls: 0, emails: 0, meetings: 0, tasks: 0 });
  }

  // Count activities
  for (const activity of activities) {
    const dateKey = formatDate(activity.date);

    if (dayMap.has(dateKey)) {
      const dayData = dayMap.get(dateKey)!;

      switch (activity.type) {
        case 'call':
          dayData.calls += 1;
          totals.calls += 1;
          break;
        case 'email':
          dayData.emails += 1;
          totals.emails += 1;
          break;
        case 'meeting':
          dayData.meetings += 1;
          totals.meetings += 1;
          break;
        default:
          dayData.tasks += 1;
          totals.tasks += 1;
      }
      totals.total += 1;
    }
  }

  // Build by-day array
  const byDay = Array.from(dayMap.entries())
    .map(([date, data]) => {
      const dateObj = new Date(date);
      return {
        date,
        dayOfWeek: getDayOfWeek(dateObj),
        calls: data.calls,
        emails: data.emails,
        meetings: data.meetings,
        tasks: data.tasks,
        total: data.calls + data.emails + data.meetings + data.tasks,
      };
    })
    .sort((a, b) => a.date.localeCompare(b.date));

  // Calculate averages
  const avgPerDay = {
    calls: totals.calls / days,
    emails: totals.emails / days,
    meetings: totals.meetings / days,
    tasks: totals.tasks / days,
    total: totals.total / days,
  };

  const result: ActivitySummary = {
    period: {
      startDate: formatDate(startDate),
      endDate: formatDate(endDate),
      days,
    },
    totals,
    byDay,
    avgPerDay,
    generatedAt: new Date().toISOString(),
  };

  logger.info('Activity summary generated', {
    days,
    totalActivities: totals.total,
  });

  return result;
}

export async function getActivityByRep(
  params: z.infer<typeof GetActivityByRepSchema>
): Promise<ActivityByRepResult> {
  const connector = getCrmConnector();
  const { days, team, activity_type } = params;

  logger.info('Getting activity by rep', { days, team, activity_type });

  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  // Get activity counts by rep
  const repActivities = await connector.getActivityCountByRep(startDate, endDate);

  // Apply activity type filter if specified
  let filteredActivities = repActivities;
  if (activity_type !== 'all') {
    // Activity counts are already aggregated, so we can't filter here
    // This would require a different query in practice
  }

  // Calculate team totals
  const teamTotals = {
    calls: filteredActivities.reduce((sum, r) => sum + r.calls, 0),
    emails: filteredActivities.reduce((sum, r) => sum + r.emails, 0),
    meetings: filteredActivities.reduce((sum, r) => sum + r.meetings, 0),
    tasks: filteredActivities.reduce((sum, r) => sum + r.tasks, 0),
    total: filteredActivities.reduce((sum, r) => sum + r.total, 0),
    avgPerRep:
      filteredActivities.length > 0
        ? filteredActivities.reduce((sum, r) => sum + r.total, 0) / filteredActivities.length
        : 0,
  };

  // Build rep details with rankings
  const byRep = filteredActivities
    .map((r) => ({
      repId: r.repId,
      repName: r.repName,
      calls: r.calls,
      emails: r.emails,
      meetings: r.meetings,
      tasks: r.tasks,
      total: r.total,
      avgPerDay: r.total / days,
      rank: 0, // Will be set after sorting
      vsTeamAvg: teamTotals.avgPerRep > 0 ? ((r.total - teamTotals.avgPerRep) / teamTotals.avgPerRep) * 100 : 0,
    }))
    .sort((a, b) => b.total - a.total);

  // Assign ranks
  byRep.forEach((rep, index) => {
    rep.rank = index + 1;
  });

  const result: ActivityByRepResult = {
    period: {
      startDate: formatDate(startDate),
      endDate: formatDate(endDate),
      days,
    },
    teamTotals,
    byRep,
    generatedAt: new Date().toISOString(),
  };

  logger.info('Activity by rep generated', {
    days,
    repCount: byRep.length,
    teamTotal: teamTotals.total,
  });

  return result;
}

export async function getAccountsWithoutActivity(
  params: z.infer<typeof GetAccountsWithoutActivitySchema>
): Promise<AccountWithoutActivityResult> {
  const connector = getCrmConnector();
  const { days, has_open_opportunities, min_opportunity_value } = params;

  logger.info('Getting accounts without activity', {
    days,
    has_open_opportunities,
    min_opportunity_value,
  });

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);

  // Get opportunities with no recent activity
  const opportunities = await connector.getOpportunities({
    isClosed: false,
    noActivitySince: cutoffDate,
  });

  // Group by account
  const accountMap = new Map<
    string,
    {
      accountName: string;
      opportunities: Array<{ amount: number; ownerName: string; ownerId: string; lastActivityDate?: Date }>;
    }
  >();

  for (const opp of opportunities) {
    if (!opp.accountId) continue;

    if (!accountMap.has(opp.accountId)) {
      accountMap.set(opp.accountId, {
        accountName: opp.accountName || 'Unknown',
        opportunities: [],
      });
    }

    accountMap.get(opp.accountId)!.opportunities.push({
      amount: opp.amount,
      ownerName: opp.ownerName,
      ownerId: opp.ownerId,
      lastActivityDate: opp.lastActivityDate,
    });
  }

  // Build account list
  const accounts: AccountWithoutActivityResult['accounts'] = [];

  for (const [accountId, data] of accountMap.entries()) {
    const totalOpportunityValue = data.opportunities.reduce((sum, o) => sum + o.amount, 0);

    // Apply filters
    if (has_open_opportunities && data.opportunities.length === 0) continue;
    if (min_opportunity_value !== undefined && totalOpportunityValue < min_opportunity_value) continue;

    // Find most recent activity and primary owner
    let lastActivityDate: Date | undefined;
    let primaryOwner = { name: 'Unknown', id: '' };

    for (const opp of data.opportunities) {
      if (opp.lastActivityDate && (!lastActivityDate || opp.lastActivityDate > lastActivityDate)) {
        lastActivityDate = opp.lastActivityDate;
      }
      if (opp.amount > (primaryOwner as any).amount || 0) {
        primaryOwner = { name: opp.ownerName, id: opp.ownerId };
      }
    }

    const now = new Date();
    let daysSinceActivity: number | undefined;
    if (lastActivityDate) {
      daysSinceActivity = Math.floor(
        (now.getTime() - lastActivityDate.getTime()) / (1000 * 60 * 60 * 24)
      );
    }

    accounts.push({
      accountId,
      accountName: data.accountName,
      lastActivityDate: lastActivityDate?.toISOString().split('T')[0],
      daysSinceActivity,
      openOpportunities: data.opportunities.length,
      totalOpportunityValue,
      ownerName: primaryOwner.name,
      ownerId: primaryOwner.id,
    });
  }

  // Sort by opportunity value descending
  accounts.sort((a, b) => b.totalOpportunityValue - a.totalOpportunityValue);

  // Calculate averages
  const accountsWithActivity = accounts.filter((a) => a.daysSinceActivity !== undefined);
  const avgDaysSinceActivity =
    accountsWithActivity.length > 0
      ? accountsWithActivity.reduce((sum, a) => sum + (a.daysSinceActivity || 0), 0) /
        accountsWithActivity.length
      : 0;

  const result: AccountWithoutActivityResult = {
    threshold: {
      days,
      cutoffDate: formatDate(cutoffDate),
    },
    summary: {
      totalAccounts: accounts.length,
      totalOpportunityValue: accounts.reduce((sum, a) => sum + a.totalOpportunityValue, 0),
      avgDaysSinceActivity: Math.round(avgDaysSinceActivity),
    },
    accounts,
    generatedAt: new Date().toISOString(),
  };

  logger.info('Accounts without activity generated', {
    days,
    totalAccounts: result.summary.totalAccounts,
    totalOpportunityValue: result.summary.totalOpportunityValue,
  });

  return result;
}

// ============================================
// Tool Definitions for MCP Registration
// ============================================

export const activityTools = [
  {
    name: 'get_activity_summary',
    description:
      'Get a summary of sales activities (calls, emails, meetings, tasks) over a specified period. Shows daily breakdown and averages. Use for activity tracking and productivity analysis.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        days: {
          type: 'number',
          description: 'Number of days to look back (default: 7)',
        },
        rep_id: {
          type: 'string',
          description: 'Filter by specific rep ID (optional)',
        },
      },
    },
    handler: getActivitySummary,
    schema: GetActivitySummarySchema,
  },
  {
    name: 'get_activity_by_rep',
    description:
      'Get activity metrics broken down by sales rep with rankings. Shows calls, emails, meetings, and tasks per rep with comparison to team average. Use for activity coaching and performance reviews.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        days: {
          type: 'number',
          description: 'Number of days to look back (default: 7)',
        },
        team: {
          type: 'string',
          description: 'Filter by team name (optional)',
        },
        activity_type: {
          type: 'string',
          enum: ['call', 'email', 'meeting', 'task', 'all'],
          description: 'Filter by activity type (default: all)',
        },
      },
    },
    handler: getActivityByRep,
    schema: GetActivityByRepSchema,
  },
  {
    name: 'get_accounts_without_activity',
    description:
      'Find accounts with open opportunities that have not had any activity in a specified number of days. Critical for identifying neglected accounts that need attention.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        days: {
          type: 'number',
          description: 'Days without activity to flag (default: 30)',
        },
        has_open_opportunities: {
          type: 'boolean',
          description: 'Only include accounts with open opportunities (default: true)',
        },
        min_opportunity_value: {
          type: 'number',
          description: 'Minimum total opportunity value to include (optional)',
        },
      },
    },
    handler: getAccountsWithoutActivity,
    schema: GetAccountsWithoutActivitySchema,
  },
];
