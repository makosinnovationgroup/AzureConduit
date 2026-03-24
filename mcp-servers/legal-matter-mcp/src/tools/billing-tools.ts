import { z } from 'zod';
import { getTimeBillingConnector } from '../connectors/time-billing';
import { logger } from '../server';

// Schema definitions
export const GetMatterBillingSchema = z.object({
  matter_id: z.string().min(1).describe('The matter ID to get billing summary for'),
});

export const GetARByClientSchema = z.object({
  client_id: z.string().optional().describe('Specific client ID (omit for all clients with outstanding AR)'),
});

export const GetWIPSchema = z.object({
  matter_id: z.string().optional().describe('Filter WIP by matter ID'),
  client_id: z.string().optional().describe('Filter WIP by client ID'),
});

// Tool implementations
export async function getMatterBilling(params: z.infer<typeof GetMatterBillingSchema>) {
  const connector = getTimeBillingConnector();

  logger.info('Getting matter billing summary', { matter_id: params.matter_id });

  try {
    const billing = await connector.getMatterBilling(params.matter_id);

    logger.info('Retrieved matter billing', {
      matter_id: params.matter_id,
      totalBilled: billing.total_billed,
      outstanding: billing.outstanding_balance,
    });

    return {
      success: true,
      matter: {
        id: billing.matter_id,
        name: billing.matter_name,
        client_name: billing.client_name,
        billing_method: billing.billing_method,
      },
      billing_summary: {
        total_billed: Math.round(billing.total_billed * 100) / 100,
        total_collected: Math.round(billing.total_collected * 100) / 100,
        outstanding_balance: Math.round(billing.outstanding_balance * 100) / 100,
        collection_rate: billing.total_billed > 0
          ? Math.round((billing.total_collected / billing.total_billed) * 10000) / 100
          : 0,
      },
      work_in_progress: {
        unbilled_amount: Math.round(billing.wip_amount * 100) / 100,
      },
      budget: billing.budget ? {
        total_budget: Math.round(billing.budget * 100) / 100,
        budget_remaining: billing.budget_remaining !== undefined
          ? Math.round(billing.budget_remaining * 100) / 100
          : undefined,
        budget_used_percentage: Math.round(((billing.budget - (billing.budget_remaining || 0)) / billing.budget) * 10000) / 100,
      } : undefined,
      trust_balance: billing.trust_balance !== undefined
        ? Math.round(billing.trust_balance * 100) / 100
        : undefined,
      last_invoice_date: billing.last_invoice_date,
      realization_rate: billing.realization_rate !== undefined
        ? Math.round(billing.realization_rate * 100) / 100
        : undefined,
      financial_health: getFinancialHealthIndicator(billing),
    };
  } catch (error: any) {
    logger.error('Failed to get matter billing', { error: error.message, matter_id: params.matter_id });
    return {
      success: false,
      error: error.message || 'Failed to get matter billing summary',
    };
  }
}

export async function getARByClient(params: z.infer<typeof GetARByClientSchema>) {
  const connector = getTimeBillingConnector();

  logger.info('Getting AR by client', { client_id: params.client_id });

  try {
    const arData = await connector.getARByClient(params.client_id);

    // Calculate totals
    let totalOutstanding = 0;
    let totalCurrent = 0;
    let total30 = 0;
    let total60 = 0;
    let total90 = 0;
    let totalOver90 = 0;

    for (const ar of arData) {
      totalOutstanding += ar.total_outstanding;
      totalCurrent += ar.current;
      total30 += ar.days_30;
      total60 += ar.days_60;
      total90 += ar.days_90;
      totalOver90 += ar.over_90;
    }

    logger.info('Retrieved AR by client', {
      clients: arData.length,
      totalOutstanding,
    });

    return {
      success: true,
      summary: {
        total_clients_with_ar: arData.length,
        total_outstanding: Math.round(totalOutstanding * 100) / 100,
        aging_buckets: {
          current: Math.round(totalCurrent * 100) / 100,
          '1-30_days': Math.round(total30 * 100) / 100,
          '31-60_days': Math.round(total60 * 100) / 100,
          '61-90_days': Math.round(total90 * 100) / 100,
          over_90_days: Math.round(totalOver90 * 100) / 100,
        },
        collection_risk: {
          low: Math.round((totalCurrent + total30) * 100) / 100,
          medium: Math.round((total60 + total90) * 100) / 100,
          high: Math.round(totalOver90 * 100) / 100,
        },
      },
      by_client: arData.map(ar => ({
        client_id: ar.client_id,
        client_name: ar.client_name,
        total_outstanding: Math.round(ar.total_outstanding * 100) / 100,
        aging: {
          current: Math.round(ar.current * 100) / 100,
          '1-30_days': Math.round(ar.days_30 * 100) / 100,
          '31-60_days': Math.round(ar.days_60 * 100) / 100,
          '61-90_days': Math.round(ar.days_90 * 100) / 100,
          over_90_days: Math.round(ar.over_90 * 100) / 100,
        },
        oldest_invoice_days: ar.invoices.length > 0
          ? Math.max(...ar.invoices.map(i => i.days_outstanding))
          : 0,
        invoice_count: ar.invoices.length,
        invoices: ar.invoices.slice(0, 5).map(i => ({
          invoice_number: i.invoice_number,
          matter_name: i.matter_name,
          date: i.date,
          due_date: i.due_date,
          amount: Math.round(i.amount * 100) / 100,
          balance: Math.round(i.balance * 100) / 100,
          days_outstanding: i.days_outstanding,
        })),
        has_more_invoices: ar.invoices.length > 5,
      })),
    };
  } catch (error: any) {
    logger.error('Failed to get AR by client', { error: error.message });
    return {
      success: false,
      error: error.message || 'Failed to get accounts receivable',
    };
  }
}

export async function getWIP(params: z.infer<typeof GetWIPSchema>) {
  const connector = getTimeBillingConnector();

  logger.info('Getting WIP', params);

  try {
    const wipData = await connector.getWIP({
      matter_id: params.matter_id,
      client_id: params.client_id,
    });

    // Calculate totals
    let totalUnbilledTime = 0;
    let totalUnbilledExpenses = 0;
    let totalWIP = 0;
    let totalTimeEntries = 0;
    let totalExpenseEntries = 0;

    for (const wip of wipData) {
      totalUnbilledTime += wip.unbilled_time;
      totalUnbilledExpenses += wip.unbilled_expenses;
      totalWIP += wip.total_wip;
      totalTimeEntries += wip.time_entries_count;
      totalExpenseEntries += wip.expense_entries_count;
    }

    // Find oldest unbilled work
    let oldestEntryDate: string | undefined;
    for (const wip of wipData) {
      if (wip.oldest_entry_date && (!oldestEntryDate || wip.oldest_entry_date < oldestEntryDate)) {
        oldestEntryDate = wip.oldest_entry_date;
      }
    }

    logger.info('Retrieved WIP', {
      matters: wipData.length,
      totalWIP,
    });

    return {
      success: true,
      summary: {
        total_matters_with_wip: wipData.length,
        total_wip_amount: Math.round(totalWIP * 100) / 100,
        unbilled_time_amount: Math.round(totalUnbilledTime * 100) / 100,
        unbilled_expenses_amount: Math.round(totalUnbilledExpenses * 100) / 100,
        total_time_entries: totalTimeEntries,
        total_expense_entries: totalExpenseEntries,
        oldest_unbilled_date: oldestEntryDate,
        days_since_oldest: oldestEntryDate
          ? Math.floor((new Date().getTime() - new Date(oldestEntryDate).getTime()) / (1000 * 60 * 60 * 24))
          : 0,
      },
      billing_recommendations: getBillingRecommendations(wipData),
      by_matter: wipData.map(wip => ({
        matter_id: wip.matter_id,
        matter_name: wip.matter_name,
        client_id: wip.client_id,
        client_name: wip.client_name,
        unbilled_time: Math.round(wip.unbilled_time * 100) / 100,
        unbilled_expenses: Math.round(wip.unbilled_expenses * 100) / 100,
        total_wip: Math.round(wip.total_wip * 100) / 100,
        time_entries_count: wip.time_entries_count,
        expense_entries_count: wip.expense_entries_count,
        oldest_entry_date: wip.oldest_entry_date,
        days_since_oldest: wip.oldest_entry_date
          ? Math.floor((new Date().getTime() - new Date(wip.oldest_entry_date).getTime()) / (1000 * 60 * 60 * 24))
          : 0,
        priority: getWIPPriority(wip),
      })),
    };
  } catch (error: any) {
    logger.error('Failed to get WIP', { error: error.message });
    return {
      success: false,
      error: error.message || 'Failed to get work in progress',
    };
  }
}

// Helper functions
function getFinancialHealthIndicator(billing: {
  total_billed: number;
  total_collected: number;
  outstanding_balance: number;
  wip_amount: number;
  budget?: number;
  budget_remaining?: number;
}): { status: string; notes: string[] } {
  const notes: string[] = [];
  let healthScore = 100;

  // Check collection rate
  if (billing.total_billed > 0) {
    const collectionRate = billing.total_collected / billing.total_billed;
    if (collectionRate < 0.7) {
      healthScore -= 30;
      notes.push('Collection rate below 70%');
    } else if (collectionRate < 0.85) {
      healthScore -= 15;
      notes.push('Collection rate could be improved');
    }
  }

  // Check outstanding balance relative to billed
  if (billing.total_billed > 0) {
    const outstandingRatio = billing.outstanding_balance / billing.total_billed;
    if (outstandingRatio > 0.5) {
      healthScore -= 25;
      notes.push('High outstanding balance relative to total billed');
    }
  }

  // Check WIP aging
  if (billing.wip_amount > billing.total_billed * 0.3) {
    healthScore -= 15;
    notes.push('Significant unbilled work in progress');
  }

  // Check budget status
  if (billing.budget && billing.budget_remaining !== undefined) {
    if (billing.budget_remaining < 0) {
      healthScore -= 20;
      notes.push('Matter is over budget');
    } else if (billing.budget_remaining < billing.budget * 0.1) {
      healthScore -= 10;
      notes.push('Less than 10% of budget remaining');
    }
  }

  let status: string;
  if (healthScore >= 80) {
    status = 'Good';
  } else if (healthScore >= 60) {
    status = 'Fair';
  } else if (healthScore >= 40) {
    status = 'Needs Attention';
  } else {
    status = 'Critical';
  }

  if (notes.length === 0) {
    notes.push('Matter financials are healthy');
  }

  return { status, notes };
}

function getBillingRecommendations(wipData: Array<{
  matter_id: string;
  matter_name: string;
  total_wip: number;
  oldest_entry_date?: string;
}>): string[] {
  const recommendations: string[] = [];

  // Find matters with old unbilled work
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const oldWIP = wipData.filter(w =>
    w.oldest_entry_date && new Date(w.oldest_entry_date) < thirtyDaysAgo
  );

  if (oldWIP.length > 0) {
    recommendations.push(`${oldWIP.length} matters have unbilled time over 30 days old - consider sending invoices`);
  }

  // Find matters with high WIP amounts
  const highWIP = wipData.filter(w => w.total_wip > 10000).sort((a, b) => b.total_wip - a.total_wip);
  if (highWIP.length > 0) {
    recommendations.push(`${highWIP.length} matters have WIP over $10,000 - "${highWIP[0].matter_name}" has highest at $${highWIP[0].total_wip.toFixed(2)}`);
  }

  // General recommendation
  const totalWIP = wipData.reduce((sum, w) => sum + w.total_wip, 0);
  if (totalWIP > 50000) {
    recommendations.push(`Total WIP of $${totalWIP.toFixed(2)} - consider billing cycle review`);
  }

  if (recommendations.length === 0) {
    recommendations.push('WIP levels are within normal parameters');
  }

  return recommendations;
}

function getWIPPriority(wip: {
  total_wip: number;
  oldest_entry_date?: string;
}): 'high' | 'medium' | 'low' {
  const daysSinceOldest = wip.oldest_entry_date
    ? Math.floor((new Date().getTime() - new Date(wip.oldest_entry_date).getTime()) / (1000 * 60 * 60 * 24))
    : 0;

  // High priority: over 60 days old or WIP over $15,000
  if (daysSinceOldest > 60 || wip.total_wip > 15000) {
    return 'high';
  }

  // Medium priority: over 30 days old or WIP over $5,000
  if (daysSinceOldest > 30 || wip.total_wip > 5000) {
    return 'medium';
  }

  return 'low';
}

// Tool definitions for MCP registration
export const billingTools = [
  {
    name: 'get_matter_billing',
    description: 'Get comprehensive billing summary for a legal matter including billed, collected, outstanding amounts, WIP, budget status, and financial health indicators.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        matter_id: {
          type: 'string',
          description: 'The matter ID to get billing summary for',
        },
      },
      required: ['matter_id'],
    },
    handler: getMatterBilling,
    schema: GetMatterBillingSchema,
  },
  {
    name: 'get_ar_by_client',
    description: 'Get accounts receivable aging report by client. Shows outstanding invoices grouped by aging buckets (current, 30, 60, 90, 90+ days).',
    inputSchema: {
      type: 'object' as const,
      properties: {
        client_id: {
          type: 'string',
          description: 'Specific client ID (omit for all clients with outstanding AR)',
        },
      },
    },
    handler: getARByClient,
    schema: GetARByClientSchema,
  },
  {
    name: 'get_wip',
    description: 'Get work in progress (WIP) - unbilled time and expenses not yet invoiced. Includes billing priority recommendations.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        matter_id: {
          type: 'string',
          description: 'Filter WIP by matter ID',
        },
        client_id: {
          type: 'string',
          description: 'Filter WIP by client ID',
        },
      },
    },
    handler: getWIP,
    schema: GetWIPSchema,
  },
];
