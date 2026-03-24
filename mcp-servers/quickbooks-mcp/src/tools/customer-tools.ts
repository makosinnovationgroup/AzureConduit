import { z } from 'zod';
import { getQuickBooksClient } from '../connectors/quickbooks';
import { logger } from '../server';

export const customerTools = [
  {
    name: 'list_customers',
    description: 'List all customers from QuickBooks. Returns customer names, contact information, and current balances.',
    inputSchema: {
      type: 'object' as const,
      properties: {},
      required: []
    }
  },
  {
    name: 'get_customer',
    description: 'Get detailed information about a specific customer including their balance and contact details.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        customer_id: {
          type: 'string',
          description: 'The QuickBooks customer ID'
        }
      },
      required: ['customer_id']
    }
  }
];

const GetCustomerSchema = z.object({
  customer_id: z.string()
});

export async function handleCustomerTool(
  toolName: string,
  args: Record<string, unknown>
): Promise<{ content: Array<{ type: 'text'; text: string }> }> {
  const client = getQuickBooksClient();

  try {
    switch (toolName) {
      case 'list_customers': {
        logger.info('Listing customers');

        const customers = await client.listCustomers();

        const summary = customers.map(cust => ({
          id: cust.Id,
          displayName: cust.DisplayName,
          companyName: cust.CompanyName,
          email: cust.PrimaryEmailAddr?.Address,
          phone: cust.PrimaryPhone?.FreeFormNumber,
          balance: cust.Balance,
          active: cust.Active
        }));

        const totalBalance = customers.reduce((sum, cust) => sum + (cust.Balance || 0), 0);
        const activeCount = customers.filter(cust => cust.Active).length;

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              count: customers.length,
              activeCustomers: activeCount,
              totalOutstandingBalance: totalBalance,
              customers: summary
            }, null, 2)
          }]
        };
      }

      case 'get_customer': {
        const params = GetCustomerSchema.parse(args);
        logger.info('Getting customer', { customerId: params.customer_id });

        const customer = await client.getCustomer(params.customer_id);

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              id: customer.Id,
              displayName: customer.DisplayName,
              companyName: customer.CompanyName,
              email: customer.PrimaryEmailAddr?.Address,
              phone: customer.PrimaryPhone?.FreeFormNumber,
              balance: customer.Balance,
              active: customer.Active,
              billingAddress: customer.BillAddr ? {
                line1: customer.BillAddr.Line1,
                city: customer.BillAddr.City,
                state: customer.BillAddr.CountrySubDivisionCode,
                postalCode: customer.BillAddr.PostalCode
              } : null
            }, null, 2)
          }]
        };
      }

      default:
        throw new Error(`Unknown customer tool: ${toolName}`);
    }
  } catch (error) {
    logger.error('Customer tool error', { toolName, error });
    throw error;
  }
}
