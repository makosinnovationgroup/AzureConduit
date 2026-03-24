import { z } from 'zod';
import { getQuickBooksClient } from '../connectors/quickbooks';
import { logger } from '../server';

export const expenseTools = [
  {
    name: 'list_expenses',
    description: 'List expenses/purchases from QuickBooks. Optionally filter by vendor ID and date range.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        vendor_id: {
          type: 'string',
          description: 'Filter expenses by vendor ID'
        },
        date_from: {
          type: 'string',
          description: 'Start date for filtering (YYYY-MM-DD format)'
        },
        date_to: {
          type: 'string',
          description: 'End date for filtering (YYYY-MM-DD format)'
        }
      },
      required: []
    }
  },
  {
    name: 'get_expense',
    description: 'Get detailed information about a specific expense/purchase by its ID.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        expense_id: {
          type: 'string',
          description: 'The QuickBooks expense/purchase ID'
        }
      },
      required: ['expense_id']
    }
  },
  {
    name: 'get_expenses_by_category',
    description: 'Get expenses grouped by category/account for analysis. Optionally filter by date range.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        date_from: {
          type: 'string',
          description: 'Start date for filtering (YYYY-MM-DD format)'
        },
        date_to: {
          type: 'string',
          description: 'End date for filtering (YYYY-MM-DD format)'
        }
      },
      required: []
    }
  }
];

const ListExpensesSchema = z.object({
  vendor_id: z.string().optional(),
  date_from: z.string().optional(),
  date_to: z.string().optional()
});

const GetExpenseSchema = z.object({
  expense_id: z.string()
});

const ExpensesByCategorySchema = z.object({
  date_from: z.string().optional(),
  date_to: z.string().optional()
});

export async function handleExpenseTool(
  toolName: string,
  args: Record<string, unknown>
): Promise<{ content: Array<{ type: 'text'; text: string }> }> {
  const client = getQuickBooksClient();

  try {
    switch (toolName) {
      case 'list_expenses': {
        const params = ListExpensesSchema.parse(args);
        logger.info('Listing expenses', { params });

        const expenses = await client.listExpenses({
          vendorId: params.vendor_id,
          dateFrom: params.date_from,
          dateTo: params.date_to
        });

        const summary = expenses.map(exp => ({
          id: exp.Id,
          date: exp.TxnDate,
          vendor: exp.EntityRef?.name,
          paymentType: exp.PaymentType,
          account: exp.AccountRef?.name,
          total: exp.TotalAmt,
          categories: exp.Line
            ?.filter(line => line.AccountBasedExpenseLineDetail)
            .map(line => ({
              account: line.AccountBasedExpenseLineDetail?.AccountRef?.name,
              amount: line.Amount,
              description: line.Description
            }))
        }));

        const totalExpenses = expenses.reduce((sum, exp) => sum + exp.TotalAmt, 0);

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              count: expenses.length,
              totalExpenses,
              expenses: summary
            }, null, 2)
          }]
        };
      }

      case 'get_expense': {
        const params = GetExpenseSchema.parse(args);
        logger.info('Getting expense', { expenseId: params.expense_id });

        const expense = await client.getExpense(params.expense_id);

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              id: expense.Id,
              date: expense.TxnDate,
              vendor: {
                id: expense.EntityRef?.value,
                name: expense.EntityRef?.name,
                type: expense.EntityRef?.type
              },
              paymentType: expense.PaymentType,
              account: {
                id: expense.AccountRef?.value,
                name: expense.AccountRef?.name
              },
              total: expense.TotalAmt,
              lineItems: expense.Line?.map(line => ({
                description: line.Description,
                amount: line.Amount,
                account: line.AccountBasedExpenseLineDetail?.AccountRef?.name
              }))
            }, null, 2)
          }]
        };
      }

      case 'get_expenses_by_category': {
        const params = ExpensesByCategorySchema.parse(args);
        logger.info('Getting expenses by category', { params });

        const report = await client.getExpensesByCategory({
          dateFrom: params.date_from,
          dateTo: params.date_to
        });

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              reportName: report.Header?.ReportName,
              startDate: report.Header?.StartPeriod,
              endDate: report.Header?.EndPeriod,
              columns: report.Columns?.Column?.map(col => col.ColTitle),
              data: report.Rows
            }, null, 2)
          }]
        };
      }

      default:
        throw new Error(`Unknown expense tool: ${toolName}`);
    }
  } catch (error) {
    logger.error('Expense tool error', { toolName, error });
    throw error;
  }
}
