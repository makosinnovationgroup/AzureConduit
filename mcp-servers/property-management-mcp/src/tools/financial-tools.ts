import { z } from 'zod';
import { getPropertyConnector, RentRollEntry } from '../connectors/property';
import { logger } from '../server';

// Schema definitions
export const GetRentRollSchema = z.object({
  property_id: z.string().optional().describe('Filter by property ID (optional - shows all properties if not specified)'),
});

export const GetIncomeStatementSchema = z.object({
  property_id: z.string().optional().describe('Filter by property ID (optional - shows portfolio-wide if not specified)'),
  start_date: z.string().describe('Start date for statement period (YYYY-MM-DD)'),
  end_date: z.string().describe('End date for statement period (YYYY-MM-DD)'),
});

// Types
interface IncomeStatementReport {
  period: { start: string; end: string };
  income: { category: string; amount: number }[];
  expenses: { category: string; amount: number }[];
  total_income: number;
  total_expenses: number;
  net_income: number;
}

interface CollectionsReport {
  total_expected: number;
  total_collected: number;
  total_outstanding: number;
  collection_rate: number;
  by_property: {
    property_id: string;
    property_name: string;
    expected: number;
    collected: number;
    outstanding: number;
  }[];
}

// Tool implementations
export async function getRentRoll(params: z.infer<typeof GetRentRollSchema>): Promise<RentRollEntry[]> {
  const connector = getPropertyConnector();
  const { property_id } = params;

  logger.info('Getting rent roll', { property_id: property_id || 'all' });

  const rentRoll = await connector.getRentRoll(property_id);
  const totalRent = rentRoll.reduce((sum, r) => sum + r.rent_amount, 0);
  const totalBalance = rentRoll.reduce((sum, r) => sum + r.balance, 0);

  logger.info('Retrieved rent roll', {
    units: rentRoll.length,
    total_monthly_rent: totalRent,
    total_outstanding: totalBalance,
  });

  return rentRoll;
}

export async function getIncomeStatement(params: z.infer<typeof GetIncomeStatementSchema>): Promise<IncomeStatementReport> {
  const connector = getPropertyConnector();
  const { property_id, start_date, end_date } = params;

  logger.info('Getting income statement', { property_id: property_id || 'portfolio', start_date, end_date });

  const statement = await connector.getIncomeStatement({ property_id, start_date, end_date });

  logger.info('Retrieved income statement', {
    period: `${start_date} to ${end_date}`,
    total_income: statement.total_income,
    total_expenses: statement.total_expenses,
    net_income: statement.net_income,
  });

  return statement;
}

export async function getCollectionsReport(): Promise<CollectionsReport> {
  const connector = getPropertyConnector();

  logger.info('Getting collections report');

  const report = await connector.getCollectionsReport();

  logger.info('Retrieved collections report', {
    collection_rate: report.collection_rate,
    total_outstanding: report.total_outstanding,
    properties_count: report.by_property.length,
  });

  return report;
}

// Tool definitions for MCP registration
export const financialTools = [
  {
    name: 'get_rent_roll',
    description: 'Get the rent roll showing all occupied units with tenant names, lease dates, rent amounts, and current balances. Can be filtered to a specific property or show the entire portfolio.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        property_id: {
          type: 'string',
          description: 'Filter by property ID (optional - shows all properties if not specified)',
        },
      },
    },
    handler: getRentRoll,
    schema: GetRentRollSchema,
  },
  {
    name: 'get_income_statement',
    description: 'Get an income statement showing revenue and expenses for a date range. Categories include rental income, fees, maintenance, utilities, insurance, taxes, and more.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        property_id: {
          type: 'string',
          description: 'Filter by property ID (optional - shows portfolio-wide if not specified)',
        },
        start_date: {
          type: 'string',
          description: 'Start date for statement period (YYYY-MM-DD)',
        },
        end_date: {
          type: 'string',
          description: 'End date for statement period (YYYY-MM-DD)',
        },
      },
      required: ['start_date', 'end_date'],
    },
    handler: getIncomeStatement,
    schema: GetIncomeStatementSchema,
  },
  {
    name: 'get_collections_report',
    description: 'Get a report on rent collection status across the portfolio. Shows expected rent, collected amount, outstanding balances, and collection rate by property.',
    inputSchema: {
      type: 'object' as const,
      properties: {},
    },
    handler: getCollectionsReport,
    schema: z.object({}),
  },
];
