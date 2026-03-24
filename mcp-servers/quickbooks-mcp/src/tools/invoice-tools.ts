import { z } from 'zod';
import { getQuickBooksClient } from '../connectors/quickbooks';
import { logger } from '../server';

export const invoiceTools = [
  {
    name: 'list_invoices',
    description: 'List invoices from QuickBooks. Optionally filter by status (open/paid), customer ID, or limit the number of results.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        status: {
          type: 'string',
          description: 'Filter by invoice status: "open" (unpaid), "paid", or omit for all',
          enum: ['open', 'paid']
        },
        customer_id: {
          type: 'string',
          description: 'Filter invoices by customer ID'
        },
        limit: {
          type: 'number',
          description: 'Maximum number of invoices to return (default: 100)'
        }
      },
      required: []
    }
  },
  {
    name: 'get_invoice',
    description: 'Get detailed information about a specific invoice by its ID.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        invoice_id: {
          type: 'string',
          description: 'The QuickBooks invoice ID'
        }
      },
      required: ['invoice_id']
    }
  },
  {
    name: 'get_overdue_invoices',
    description: 'Get all invoices that are past their due date and still have an unpaid balance.',
    inputSchema: {
      type: 'object' as const,
      properties: {},
      required: []
    }
  },
  {
    name: 'get_ar_aging',
    description: 'Get an accounts receivable aging summary report showing outstanding invoice amounts by age bucket (current, 1-30 days, 31-60 days, etc.).',
    inputSchema: {
      type: 'object' as const,
      properties: {},
      required: []
    }
  }
];

const ListInvoicesSchema = z.object({
  status: z.enum(['open', 'paid']).optional(),
  customer_id: z.string().optional(),
  limit: z.number().optional()
});

const GetInvoiceSchema = z.object({
  invoice_id: z.string()
});

export async function handleInvoiceTool(
  toolName: string,
  args: Record<string, unknown>
): Promise<{ content: Array<{ type: 'text'; text: string }> }> {
  const client = getQuickBooksClient();

  try {
    switch (toolName) {
      case 'list_invoices': {
        const params = ListInvoicesSchema.parse(args);
        logger.info('Listing invoices', { params });

        const invoices = await client.listInvoices({
          status: params.status,
          customerId: params.customer_id,
          limit: params.limit
        });

        const summary = invoices.map(inv => ({
          id: inv.Id,
          docNumber: inv.DocNumber,
          customer: inv.CustomerRef?.name,
          date: inv.TxnDate,
          dueDate: inv.DueDate,
          total: inv.TotalAmt,
          balance: inv.Balance,
          status: inv.Balance === 0 ? 'Paid' : 'Open'
        }));

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              count: invoices.length,
              invoices: summary
            }, null, 2)
          }]
        };
      }

      case 'get_invoice': {
        const params = GetInvoiceSchema.parse(args);
        logger.info('Getting invoice', { invoiceId: params.invoice_id });

        const invoice = await client.getInvoice(params.invoice_id);

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              id: invoice.Id,
              docNumber: invoice.DocNumber,
              customer: {
                id: invoice.CustomerRef?.value,
                name: invoice.CustomerRef?.name
              },
              date: invoice.TxnDate,
              dueDate: invoice.DueDate,
              total: invoice.TotalAmt,
              balance: invoice.Balance,
              status: invoice.Balance === 0 ? 'Paid' : 'Open',
              email: invoice.BillEmail?.Address,
              emailStatus: invoice.EmailStatus,
              lineItems: invoice.Line?.filter(line => line.DetailType !== 'SubTotalLineDetail').map(line => ({
                description: line.Description,
                amount: line.Amount
              }))
            }, null, 2)
          }]
        };
      }

      case 'get_overdue_invoices': {
        logger.info('Getting overdue invoices');

        const invoices = await client.getOverdueInvoices();

        const summary = invoices.map(inv => ({
          id: inv.Id,
          docNumber: inv.DocNumber,
          customer: inv.CustomerRef?.name,
          dueDate: inv.DueDate,
          daysOverdue: Math.floor(
            (new Date().getTime() - new Date(inv.DueDate).getTime()) / (1000 * 60 * 60 * 24)
          ),
          balance: inv.Balance
        }));

        const totalOverdue = summary.reduce((sum, inv) => sum + inv.balance, 0);

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              count: invoices.length,
              totalOverdue,
              invoices: summary
            }, null, 2)
          }]
        };
      }

      case 'get_ar_aging': {
        logger.info('Getting AR aging summary');

        const report = await client.getARAgingSummary();

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              reportName: report.Header?.ReportName,
              asOfDate: report.Header?.EndPeriod,
              data: report.Rows
            }, null, 2)
          }]
        };
      }

      default:
        throw new Error(`Unknown invoice tool: ${toolName}`);
    }
  } catch (error) {
    logger.error('Invoice tool error', { toolName, error });
    throw error;
  }
}
