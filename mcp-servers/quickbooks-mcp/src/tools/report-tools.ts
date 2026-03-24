import { z } from 'zod';
import { getQuickBooksClient } from '../connectors/quickbooks';
import { logger } from '../server';

export const reportTools = [
  {
    name: 'get_profit_loss',
    description: 'Get a Profit and Loss (Income Statement) report for a specified date range. Shows revenue, expenses, and net income.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        start_date: {
          type: 'string',
          description: 'Start date for the report period (YYYY-MM-DD format)'
        },
        end_date: {
          type: 'string',
          description: 'End date for the report period (YYYY-MM-DD format)'
        }
      },
      required: ['start_date', 'end_date']
    }
  },
  {
    name: 'get_balance_sheet',
    description: 'Get a Balance Sheet report as of a specific date. Shows assets, liabilities, and equity.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        as_of_date: {
          type: 'string',
          description: 'The date for the balance sheet snapshot (YYYY-MM-DD format)'
        }
      },
      required: ['as_of_date']
    }
  },
  {
    name: 'get_cash_flow',
    description: 'Get a Statement of Cash Flows report. Shows cash inflows and outflows from operating, investing, and financing activities.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        start_date: {
          type: 'string',
          description: 'Start date for the report period (YYYY-MM-DD format)'
        },
        end_date: {
          type: 'string',
          description: 'End date for the report period (YYYY-MM-DD format)'
        }
      },
      required: []
    }
  }
];

const ProfitLossSchema = z.object({
  start_date: z.string(),
  end_date: z.string()
});

const BalanceSheetSchema = z.object({
  as_of_date: z.string()
});

const CashFlowSchema = z.object({
  start_date: z.string().optional(),
  end_date: z.string().optional()
});

interface ReportSection {
  name: string;
  total?: number;
  items: Array<{ name: string; value: number }>;
}

function parseReportRows(rows: any): ReportSection[] {
  const sections: ReportSection[] = [];

  if (!rows?.Row) return sections;

  for (const row of rows.Row) {
    if (row.Header && row.Rows) {
      const section: ReportSection = {
        name: row.Header.ColData?.[0]?.value || 'Unknown Section',
        items: []
      };

      if (row.Rows?.Row) {
        for (const subRow of row.Rows.Row) {
          if (subRow.ColData) {
            section.items.push({
              name: subRow.ColData[0]?.value || '',
              value: parseFloat(subRow.ColData[1]?.value || '0')
            });
          }
        }
      }

      if (row.Summary?.ColData) {
        section.total = parseFloat(row.Summary.ColData[1]?.value || '0');
      }

      sections.push(section);
    }
  }

  return sections;
}

export async function handleReportTool(
  toolName: string,
  args: Record<string, unknown>
): Promise<{ content: Array<{ type: 'text'; text: string }> }> {
  const client = getQuickBooksClient();

  try {
    switch (toolName) {
      case 'get_profit_loss': {
        const params = ProfitLossSchema.parse(args);
        logger.info('Getting P&L report', { params });

        const report = await client.getProfitAndLoss(params.start_date, params.end_date);
        const sections = parseReportRows(report.Rows);

        // Calculate summary
        const income = sections.find(s => s.name.toLowerCase().includes('income'))?.total || 0;
        const expenses = sections.find(s => s.name.toLowerCase().includes('expense'))?.total || 0;
        const netIncome = income - expenses;

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              reportName: report.Header?.ReportName || 'Profit and Loss',
              period: {
                start: report.Header?.StartPeriod || params.start_date,
                end: report.Header?.EndPeriod || params.end_date
              },
              summary: {
                totalIncome: income,
                totalExpenses: expenses,
                netIncome
              },
              sections,
              rawData: report.Rows
            }, null, 2)
          }]
        };
      }

      case 'get_balance_sheet': {
        const params = BalanceSheetSchema.parse(args);
        logger.info('Getting balance sheet', { params });

        const report = await client.getBalanceSheet(params.as_of_date);
        const sections = parseReportRows(report.Rows);

        // Extract main totals
        const assets = sections.find(s => s.name.toLowerCase().includes('asset'))?.total || 0;
        const liabilities = sections.find(s => s.name.toLowerCase().includes('liabilit'))?.total || 0;
        const equity = sections.find(s => s.name.toLowerCase().includes('equity'))?.total || 0;

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              reportName: report.Header?.ReportName || 'Balance Sheet',
              asOfDate: report.Header?.EndPeriod || params.as_of_date,
              summary: {
                totalAssets: assets,
                totalLiabilities: liabilities,
                totalEquity: equity,
                liabilitiesAndEquity: liabilities + equity
              },
              sections,
              rawData: report.Rows
            }, null, 2)
          }]
        };
      }

      case 'get_cash_flow': {
        const params = CashFlowSchema.parse(args);
        logger.info('Getting cash flow statement', { params });

        const report = await client.getCashFlow(params.start_date, params.end_date);
        const sections = parseReportRows(report.Rows);

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              reportName: report.Header?.ReportName || 'Statement of Cash Flows',
              period: {
                start: report.Header?.StartPeriod,
                end: report.Header?.EndPeriod
              },
              sections,
              rawData: report.Rows
            }, null, 2)
          }]
        };
      }

      default:
        throw new Error(`Unknown report tool: ${toolName}`);
    }
  } catch (error) {
    logger.error('Report tool error', { toolName, error });
    throw error;
  }
}
