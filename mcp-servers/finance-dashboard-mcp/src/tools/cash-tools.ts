import { z } from 'zod';
import { getFinanceConnector } from '../connectors/finance';
import logger from '../utils/logger';

// ==========================================
// Schema Definitions
// ==========================================

export const getCashPositionSchema = z.object({});

export const getCashFlowForecastSchema = z.object({
  periods: z.number().min(1).max(12).default(6).describe('Number of months to forecast (1-12)')
});

export const getCashRunwaySchema = z.object({});

// ==========================================
// Tool Handlers
// ==========================================

export async function getCashPosition(): Promise<{
  totalCash: number;
  accounts: Array<{
    name: string;
    balance: number;
    currency: string;
  }>;
  asOfDate: string;
  currency: string;
}> {
  logger.info('Executing get_cash_position');

  const connector = getFinanceConnector();
  const position = await connector.getCashPosition();

  return {
    totalCash: position.totalCash,
    accounts: position.accounts,
    asOfDate: position.asOfDate,
    currency: position.currency
  };
}

export async function getCashFlowForecast(params: z.infer<typeof getCashFlowForecastSchema>): Promise<{
  forecast: Array<{
    periodStart: string;
    periodEnd: string;
    expectedInflows: number;
    expectedOutflows: number;
    netCashFlow: number;
    projectedBalance: number;
  }>;
  currency: string;
  periodsAhead: number;
}> {
  const { periods = 6 } = params;
  logger.info('Executing get_cash_flow_forecast', { periods });

  const connector = getFinanceConnector();
  const forecast = await connector.getCashFlowForecast(periods);

  return {
    forecast: forecast.periods,
    currency: forecast.currency,
    periodsAhead: periods
  };
}

export async function getCashRunway(): Promise<{
  currentCash: number;
  averageMonthlyBurn: number;
  runwayMonths: number;
  runwayEndDate: string;
  currency: string;
  burnTrend: 'increasing' | 'decreasing' | 'stable';
  analysis: string;
}> {
  logger.info('Executing get_cash_runway');

  const connector = getFinanceConnector();
  const runway = await connector.getCashRunway();

  // Generate analysis text
  let analysis = `At current burn rate of ${runway.averageMonthlyBurn.toLocaleString()} ${runway.currency}/month, `;
  analysis += `cash runway is approximately ${runway.runwayMonths} months (until ${runway.runwayEndDate}). `;

  if (runway.burnTrend === 'increasing') {
    analysis += 'Warning: Burn rate is increasing, which may shorten runway.';
  } else if (runway.burnTrend === 'decreasing') {
    analysis += 'Positive trend: Burn rate is decreasing.';
  } else {
    analysis += 'Burn rate has been stable.';
  }

  return {
    currentCash: runway.currentCash,
    averageMonthlyBurn: runway.averageMonthlyBurn,
    runwayMonths: runway.runwayMonths,
    runwayEndDate: runway.runwayEndDate,
    currency: runway.currency,
    burnTrend: runway.burnTrend,
    analysis
  };
}

// ==========================================
// Tool Definitions
// ==========================================

export const cashToolDefinitions = [
  {
    name: 'get_cash_position',
    description: 'Get current cash position across all bank accounts. Shows total cash and breakdown by account.',
    inputSchema: {
      type: 'object' as const,
      properties: {},
      required: [] as string[]
    }
  },
  {
    name: 'get_cash_flow_forecast',
    description: 'Get projected cash flow for upcoming months including expected inflows, outflows, net cash flow, and projected ending balance.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        periods: {
          type: 'number',
          description: 'Number of months to forecast (1-12, default: 6)',
          minimum: 1,
          maximum: 12,
          default: 6
        }
      },
      required: [] as string[]
    }
  },
  {
    name: 'get_cash_runway',
    description: 'Calculate months of cash runway based on current cash position and average monthly burn rate. Includes trend analysis.',
    inputSchema: {
      type: 'object' as const,
      properties: {},
      required: [] as string[]
    }
  }
];
