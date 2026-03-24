import { z } from 'zod';
import { getTimeBillingConnector } from '../connectors/time-billing';
import { logger } from '../server';

// Schema definitions
export const GetMatterTimeSchema = z.object({
  matter_id: z.string().min(1).describe('The matter ID to get time entries for'),
  start_date: z.string().optional().describe('Filter entries from this date (YYYY-MM-DD)'),
  end_date: z.string().optional().describe('Filter entries until this date (YYYY-MM-DD)'),
  billable_only: z.boolean().optional().default(false).describe('Only return billable time entries'),
});

export const GetUnbilledTimeSchema = z.object({
  matter_id: z.string().optional().describe('Filter unbilled time by matter ID'),
  attorney_id: z.string().optional().describe('Filter unbilled time by attorney ID'),
  client_id: z.string().optional().describe('Filter unbilled time by client ID'),
});

export const GetAttorneyUtilizationSchema = z.object({
  attorney_id: z.string().optional().describe('Specific attorney ID (omit for all attorneys)'),
  start_date: z.string().describe('Period start date (YYYY-MM-DD)'),
  end_date: z.string().describe('Period end date (YYYY-MM-DD)'),
  available_hours_per_day: z.number().optional().default(8).describe('Available work hours per day for utilization calculation'),
});

export const GetTimeSummarySchema = z.object({
  start_date: z.string().describe('Period start date (YYYY-MM-DD)'),
  end_date: z.string().describe('Period end date (YYYY-MM-DD)'),
  matter_id: z.string().optional().describe('Filter by matter ID'),
  attorney_id: z.string().optional().describe('Filter by attorney ID'),
  group_by: z.enum(['matter', 'attorney', 'activity']).optional().describe('Group results by matter, attorney, or activity type'),
});

// Tool implementations
export async function getMatterTime(params: z.infer<typeof GetMatterTimeSchema>) {
  const connector = getTimeBillingConnector();

  logger.info('Getting matter time entries', params);

  try {
    const entries = await connector.getMatterTime(params.matter_id, {
      start_date: params.start_date,
      end_date: params.end_date,
      billable_only: params.billable_only,
    });

    // Calculate totals
    let totalHours = 0;
    let billableHours = 0;
    let totalAmount = 0;

    for (const entry of entries) {
      totalHours += entry.hours;
      totalAmount += entry.amount;
      if (entry.billable) {
        billableHours += entry.hours;
      }
    }

    // Group by attorney
    const byAttorney = new Map<string, { hours: number; amount: number }>();
    for (const entry of entries) {
      const key = entry.user_name || entry.user_id;
      if (!byAttorney.has(key)) {
        byAttorney.set(key, { hours: 0, amount: 0 });
      }
      const data = byAttorney.get(key)!;
      data.hours += entry.hours;
      data.amount += entry.amount;
    }

    logger.info('Retrieved matter time entries', { matter_id: params.matter_id, count: entries.length });

    return {
      success: true,
      matter_id: params.matter_id,
      summary: {
        total_entries: entries.length,
        total_hours: Math.round(totalHours * 100) / 100,
        billable_hours: Math.round(billableHours * 100) / 100,
        non_billable_hours: Math.round((totalHours - billableHours) * 100) / 100,
        total_amount: Math.round(totalAmount * 100) / 100,
      },
      by_attorney: Object.fromEntries(
        Array.from(byAttorney.entries()).map(([name, data]) => [
          name,
          {
            hours: Math.round(data.hours * 100) / 100,
            amount: Math.round(data.amount * 100) / 100,
          },
        ])
      ),
      entries: entries.slice(0, 100).map(e => ({
        id: e.id,
        date: e.date,
        attorney: e.user_name,
        hours: e.hours,
        rate: e.rate,
        amount: e.amount,
        description: e.description,
        activity_type: e.activity_type,
        billable: e.billable,
        billed: e.billed,
      })),
      truncated: entries.length > 100,
    };
  } catch (error: any) {
    logger.error('Failed to get matter time', { error: error.message, matter_id: params.matter_id });
    return {
      success: false,
      error: error.message || 'Failed to get matter time entries',
    };
  }
}

export async function getUnbilledTime(params: z.infer<typeof GetUnbilledTimeSchema>) {
  const connector = getTimeBillingConnector();

  logger.info('Getting unbilled time', params);

  try {
    const entries = await connector.getUnbilledTime({
      matter_id: params.matter_id,
      attorney_id: params.attorney_id,
      client_id: params.client_id,
    });

    // Calculate totals
    let totalHours = 0;
    let totalAmount = 0;

    // Group by matter
    const byMatter = new Map<string, { name: string; hours: number; amount: number; oldest_date: string }>();

    for (const entry of entries) {
      totalHours += entry.hours;
      totalAmount += entry.amount;

      const key = entry.matter_id;
      if (!byMatter.has(key)) {
        byMatter.set(key, { name: entry.matter_name || '', hours: 0, amount: 0, oldest_date: entry.date });
      }
      const data = byMatter.get(key)!;
      data.hours += entry.hours;
      data.amount += entry.amount;
      if (entry.date < data.oldest_date) {
        data.oldest_date = entry.date;
      }
    }

    // Group by attorney
    const byAttorney = new Map<string, { hours: number; amount: number }>();
    for (const entry of entries) {
      const key = entry.user_name || entry.user_id;
      if (!byAttorney.has(key)) {
        byAttorney.set(key, { hours: 0, amount: 0 });
      }
      const data = byAttorney.get(key)!;
      data.hours += entry.hours;
      data.amount += entry.amount;
    }

    logger.info('Retrieved unbilled time', { count: entries.length, totalAmount });

    return {
      success: true,
      summary: {
        total_entries: entries.length,
        total_hours: Math.round(totalHours * 100) / 100,
        total_unbilled_amount: Math.round(totalAmount * 100) / 100,
        matters_with_unbilled: byMatter.size,
      },
      by_matter: Array.from(byMatter.entries())
        .sort((a, b) => b[1].amount - a[1].amount)
        .map(([id, data]) => ({
          matter_id: id,
          matter_name: data.name,
          hours: Math.round(data.hours * 100) / 100,
          amount: Math.round(data.amount * 100) / 100,
          oldest_entry_date: data.oldest_date,
        })),
      by_attorney: Object.fromEntries(
        Array.from(byAttorney.entries()).map(([name, data]) => [
          name,
          {
            hours: Math.round(data.hours * 100) / 100,
            amount: Math.round(data.amount * 100) / 100,
          },
        ])
      ),
    };
  } catch (error: any) {
    logger.error('Failed to get unbilled time', { error: error.message });
    return {
      success: false,
      error: error.message || 'Failed to get unbilled time',
    };
  }
}

export async function getAttorneyUtilization(params: z.infer<typeof GetAttorneyUtilizationSchema>) {
  const connector = getTimeBillingConnector();

  logger.info('Getting attorney utilization', params);

  try {
    const utilization = await connector.getAttorneyUtilization({
      attorney_id: params.attorney_id,
      start_date: params.start_date,
      end_date: params.end_date,
      available_hours_per_day: params.available_hours_per_day,
    });

    // Calculate firm-wide averages
    let totalBillable = 0;
    let totalAvailable = 0;
    let totalAmount = 0;

    for (const u of utilization) {
      totalBillable += u.billable_hours;
      totalAvailable += u.available_hours;
      totalAmount += u.billable_amount;
    }

    const averageUtilization = totalAvailable > 0 ? (totalBillable / totalAvailable) * 100 : 0;

    logger.info('Retrieved attorney utilization', { attorneys: utilization.length, averageUtilization });

    return {
      success: true,
      period: {
        start_date: params.start_date,
        end_date: params.end_date,
      },
      firm_summary: {
        total_attorneys: utilization.length,
        total_billable_hours: Math.round(totalBillable * 100) / 100,
        total_available_hours: Math.round(totalAvailable * 100) / 100,
        average_utilization_rate: Math.round(averageUtilization * 100) / 100,
        total_billable_amount: Math.round(totalAmount * 100) / 100,
      },
      attorneys: utilization
        .sort((a, b) => b.utilization_rate - a.utilization_rate)
        .map(u => ({
          attorney_id: u.attorney_id,
          attorney_name: u.attorney_name,
          available_hours: Math.round(u.available_hours * 100) / 100,
          billable_hours: Math.round(u.billable_hours * 100) / 100,
          non_billable_hours: Math.round(u.non_billable_hours * 100) / 100,
          total_hours: Math.round(u.total_hours * 100) / 100,
          utilization_rate: Math.round(u.utilization_rate * 100) / 100,
          billable_amount: Math.round(u.billable_amount * 100) / 100,
        })),
    };
  } catch (error: any) {
    logger.error('Failed to get attorney utilization', { error: error.message });
    return {
      success: false,
      error: error.message || 'Failed to get attorney utilization',
    };
  }
}

export async function getTimeSummary(params: z.infer<typeof GetTimeSummarySchema>) {
  const connector = getTimeBillingConnector();

  logger.info('Getting time summary', params);

  try {
    const summary = await connector.getTimeSummary({
      start_date: params.start_date,
      end_date: params.end_date,
      matter_id: params.matter_id,
      attorney_id: params.attorney_id,
      group_by: params.group_by,
    });

    logger.info('Retrieved time summary', { totalHours: summary.total_hours });

    const response: any = {
      success: true,
      period: {
        start_date: params.start_date,
        end_date: params.end_date,
      },
      totals: {
        total_hours: Math.round(summary.total_hours * 100) / 100,
        billable_hours: Math.round(summary.billable_hours * 100) / 100,
        non_billable_hours: Math.round(summary.non_billable_hours * 100) / 100,
        total_amount: Math.round(summary.total_amount * 100) / 100,
        billable_percentage: summary.total_hours > 0
          ? Math.round((summary.billable_hours / summary.total_hours) * 10000) / 100
          : 0,
      },
    };

    // Include groupings based on request
    if (summary.by_matter && summary.by_matter.length > 0) {
      response.by_matter = summary.by_matter
        .sort((a, b) => b.hours - a.hours)
        .slice(0, 50)
        .map(m => ({
          matter_id: m.matter_id,
          matter_name: m.matter_name,
          hours: Math.round(m.hours * 100) / 100,
          amount: Math.round(m.amount * 100) / 100,
        }));
    }

    if (summary.by_attorney && summary.by_attorney.length > 0) {
      response.by_attorney = summary.by_attorney
        .sort((a, b) => b.hours - a.hours)
        .map(a => ({
          attorney_id: a.attorney_id,
          attorney_name: a.attorney_name,
          hours: Math.round(a.hours * 100) / 100,
          amount: Math.round(a.amount * 100) / 100,
        }));
    }

    if (summary.by_activity && summary.by_activity.length > 0) {
      response.by_activity = summary.by_activity
        .sort((a, b) => b.hours - a.hours)
        .map(a => ({
          activity_type: a.activity_type,
          hours: Math.round(a.hours * 100) / 100,
          amount: Math.round(a.amount * 100) / 100,
        }));
    }

    return response;
  } catch (error: any) {
    logger.error('Failed to get time summary', { error: error.message });
    return {
      success: false,
      error: error.message || 'Failed to get time summary',
    };
  }
}

// Tool definitions for MCP registration
export const timeTools = [
  {
    name: 'get_matter_time',
    description: 'Get time entries for a specific legal matter. Returns individual entries and summaries by attorney.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        matter_id: {
          type: 'string',
          description: 'The matter ID to get time entries for',
        },
        start_date: {
          type: 'string',
          description: 'Filter entries from this date (YYYY-MM-DD)',
        },
        end_date: {
          type: 'string',
          description: 'Filter entries until this date (YYYY-MM-DD)',
        },
        billable_only: {
          type: 'boolean',
          description: 'Only return billable time entries',
        },
      },
      required: ['matter_id'],
    },
    handler: getMatterTime,
    schema: GetMatterTimeSchema,
  },
  {
    name: 'get_unbilled_time',
    description: 'Get unbilled time entries across the firm or filtered by matter, attorney, or client. Useful for identifying work ready to bill.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        matter_id: {
          type: 'string',
          description: 'Filter unbilled time by matter ID',
        },
        attorney_id: {
          type: 'string',
          description: 'Filter unbilled time by attorney ID',
        },
        client_id: {
          type: 'string',
          description: 'Filter unbilled time by client ID',
        },
      },
    },
    handler: getUnbilledTime,
    schema: GetUnbilledTimeSchema,
  },
  {
    name: 'get_attorney_utilization',
    description: 'Get billable hours vs available hours for attorneys. Calculates utilization rate for performance analysis.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        attorney_id: {
          type: 'string',
          description: 'Specific attorney ID (omit for all attorneys)',
        },
        start_date: {
          type: 'string',
          description: 'Period start date (YYYY-MM-DD)',
        },
        end_date: {
          type: 'string',
          description: 'Period end date (YYYY-MM-DD)',
        },
        available_hours_per_day: {
          type: 'number',
          description: 'Available work hours per day (default: 8)',
        },
      },
      required: ['start_date', 'end_date'],
    },
    handler: getAttorneyUtilization,
    schema: GetAttorneyUtilizationSchema,
  },
  {
    name: 'get_time_summary',
    description: 'Get time summary for a date range with breakdowns by matter, attorney, and activity type.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        start_date: {
          type: 'string',
          description: 'Period start date (YYYY-MM-DD)',
        },
        end_date: {
          type: 'string',
          description: 'Period end date (YYYY-MM-DD)',
        },
        matter_id: {
          type: 'string',
          description: 'Filter by matter ID',
        },
        attorney_id: {
          type: 'string',
          description: 'Filter by attorney ID',
        },
        group_by: {
          type: 'string',
          enum: ['matter', 'attorney', 'activity'],
          description: 'Primary grouping for results',
        },
      },
      required: ['start_date', 'end_date'],
    },
    handler: getTimeSummary,
    schema: GetTimeSummarySchema,
  },
];
