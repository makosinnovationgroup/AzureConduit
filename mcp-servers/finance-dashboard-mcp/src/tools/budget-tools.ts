import { z } from 'zod';
import { getFinanceConnector } from '../connectors/finance';
import logger from '../utils/logger';

// ==========================================
// Schema Definitions
// ==========================================

export const getBudgetVsActualSchema = z.object({
  period: z.string().optional().describe('Period to analyze (e.g., "2024-01" for January 2024). Defaults to current month.')
});

export const getVarianceReportSchema = z.object({
  threshold: z.number().min(1).max(100).default(10).describe('Variance threshold percentage to flag as significant (1-100)')
});

export const getDepartmentSpendingSchema = z.object({
  period: z.string().optional().describe('Period to analyze (e.g., "2024-01" for January 2024). Defaults to current month.')
});

// ==========================================
// Tool Handlers
// ==========================================

export async function getBudgetVsActual(params: z.infer<typeof getBudgetVsActualSchema>): Promise<{
  categories: Array<{
    category: string;
    budget: number;
    actual: number;
    variance: number;
    variancePercent: number;
    status: 'on-track' | 'over-budget' | 'under-budget';
  }>;
  totals: {
    budget: number;
    actual: number;
    variance: number;
    variancePercent: number;
  };
  period: string;
  currency: string;
}> {
  const { period } = params;
  logger.info('Executing get_budget_vs_actual', { period });

  const connector = getFinanceConnector();
  const budgetData = await connector.getBudgetVsActual(period);

  return {
    categories: budgetData.categories.map(c => ({
      ...c,
      status: c.variancePercent > 5 ? 'over-budget' : c.variancePercent < -5 ? 'under-budget' : 'on-track'
    })),
    totals: budgetData.totals,
    period: budgetData.period,
    currency: budgetData.currency
  };
}

export async function getVarianceReport(params: z.infer<typeof getVarianceReportSchema>): Promise<{
  significantVariances: Array<{
    category: string;
    budget: number;
    actual: number;
    variance: number;
    variancePercent: number;
    status: 'over' | 'under';
    recommendation: string;
  }>;
  threshold: number;
  totalOverBudget: number;
  totalUnderBudget: number;
  currency: string;
}> {
  const { threshold = 10 } = params;
  logger.info('Executing get_variance_report', { threshold });

  const connector = getFinanceConnector();
  const variances = await connector.getVarianceReport(threshold);

  // Add recommendations for each variance
  const withRecommendations = variances.significantVariances.map(v => {
    let recommendation = '';
    if (v.status === 'over') {
      recommendation = `Review ${v.category} spending and identify cost reduction opportunities.`;
    } else {
      recommendation = `${v.category} is under budget. Consider reallocating to higher-priority areas.`;
    }
    return { ...v, recommendation };
  });

  const totalOverBudget = withRecommendations
    .filter(v => v.status === 'over')
    .reduce((sum, v) => sum + v.variance, 0);

  const totalUnderBudget = withRecommendations
    .filter(v => v.status === 'under')
    .reduce((sum, v) => sum + Math.abs(v.variance), 0);

  return {
    significantVariances: withRecommendations,
    threshold,
    totalOverBudget,
    totalUnderBudget,
    currency: variances.currency
  };
}

export async function getDepartmentSpending(params: z.infer<typeof getDepartmentSpendingSchema>): Promise<{
  departments: Array<{
    name: string;
    budget: number;
    spent: number;
    remaining: number;
    utilizationPercent: number;
    status: 'on-track' | 'at-risk' | 'over-budget';
  }>;
  totalBudget: number;
  totalSpent: number;
  totalRemaining: number;
  period: string;
  currency: string;
}> {
  const { period } = params;
  logger.info('Executing get_department_spending', { period });

  const connector = getFinanceConnector();
  const spending = await connector.getDepartmentSpending(period);

  // Add status based on utilization
  const departmentsWithStatus = spending.departments.map(d => ({
    ...d,
    status: d.utilizationPercent > 100 ? 'over-budget' as const :
            d.utilizationPercent > 90 ? 'at-risk' as const : 'on-track' as const
  }));

  const totalBudget = spending.departments.reduce((sum, d) => sum + d.budget, 0);
  const totalSpent = spending.departments.reduce((sum, d) => sum + d.spent, 0);
  const totalRemaining = spending.departments.reduce((sum, d) => sum + d.remaining, 0);

  return {
    departments: departmentsWithStatus,
    totalBudget,
    totalSpent,
    totalRemaining,
    period: spending.period,
    currency: spending.currency
  };
}

// ==========================================
// Tool Definitions
// ==========================================

export const budgetToolDefinitions = [
  {
    name: 'get_budget_vs_actual',
    description: 'Compare budgeted amounts to actual spending by category. Shows variance in both absolute and percentage terms with on-track/over-budget/under-budget status.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        period: {
          type: 'string',
          description: 'Period to analyze (e.g., "2024-01" for January 2024). Defaults to current month.'
        }
      },
      required: [] as string[]
    }
  },
  {
    name: 'get_variance_report',
    description: 'Get report of significant budget variances that exceed a specified threshold. Includes recommendations for each variance.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        threshold: {
          type: 'number',
          description: 'Variance threshold percentage to flag as significant (1-100, default: 10)',
          minimum: 1,
          maximum: 100,
          default: 10
        }
      },
      required: [] as string[]
    }
  },
  {
    name: 'get_department_spending',
    description: 'Get spending by department showing budget, amount spent, remaining budget, and utilization percentage.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        period: {
          type: 'string',
          description: 'Period to analyze (e.g., "2024-01" for January 2024). Defaults to current month.'
        }
      },
      required: [] as string[]
    }
  }
];
