import { z } from 'zod';
import { getSalesforceConnector } from '../connectors/salesforce';
import { logger } from '../server';

// Schema definitions
export const ListAccountsSchema = z.object({
  limit: z.number().min(1).max(200).optional().default(50),
  industry: z.string().optional(),
  type: z.string().optional(),
});

export const GetAccountSchema = z.object({
  account_id: z.string().min(1).describe('Salesforce Account ID'),
});

export const SearchAccountsSchema = z.object({
  search_term: z.string().min(1).describe('Search term for account name'),
});

// Types
export interface Account {
  Id: string;
  Name: string;
  Industry?: string;
  Type?: string;
  BillingCity?: string;
  BillingState?: string;
  BillingCountry?: string;
  Phone?: string;
  Website?: string;
  AnnualRevenue?: number;
  NumberOfEmployees?: number;
  Description?: string;
  OwnerId?: string;
  CreatedDate?: string;
  LastModifiedDate?: string;
}

// Tool implementations
export async function listAccounts(params: z.infer<typeof ListAccountsSchema>): Promise<Account[]> {
  const connector = getSalesforceConnector();
  const { limit, industry, type } = params;

  logger.info('Listing accounts', { limit, industry, type });

  let whereClause = '';
  const conditions: string[] = [];

  if (industry) {
    conditions.push(`Industry = '${industry.replace(/'/g, "\\'")}'`);
  }
  if (type) {
    conditions.push(`Type = '${type.replace(/'/g, "\\'")}'`);
  }

  if (conditions.length > 0) {
    whereClause = `WHERE ${conditions.join(' AND ')}`;
  }

  const soql = `
    SELECT Id, Name, Industry, Type, BillingCity, BillingState, BillingCountry,
           Phone, Website, AnnualRevenue, NumberOfEmployees, Description,
           OwnerId, CreatedDate, LastModifiedDate
    FROM Account
    ${whereClause}
    ORDER BY Name ASC
    LIMIT ${limit}
  `;

  const accounts = await connector.query<Account>(soql);
  logger.info('Retrieved accounts', { count: accounts.length });

  return accounts;
}

export async function getAccount(params: z.infer<typeof GetAccountSchema>): Promise<Account | null> {
  const connector = getSalesforceConnector();
  const { account_id } = params;

  logger.info('Getting account details', { account_id });

  const soql = `
    SELECT Id, Name, Industry, Type, BillingCity, BillingState, BillingCountry,
           Phone, Website, AnnualRevenue, NumberOfEmployees, Description,
           OwnerId, CreatedDate, LastModifiedDate
    FROM Account
    WHERE Id = '${account_id.replace(/'/g, "\\'")}'
  `;

  const account = await connector.queryOne<Account>(soql);

  if (!account) {
    logger.warn('Account not found', { account_id });
  } else {
    logger.info('Retrieved account', { account_id, name: account.Name });
  }

  return account;
}

export async function searchAccounts(params: z.infer<typeof SearchAccountsSchema>): Promise<Account[]> {
  const connector = getSalesforceConnector();
  const { search_term } = params;

  logger.info('Searching accounts', { search_term });

  // Use SOSL for full-text search
  const conn = await connector.getConnection();
  const searchResult = await conn.search(
    `FIND {${search_term.replace(/[{}]/g, '')}} IN NAME FIELDS RETURNING Account(Id, Name, Industry, Type, BillingCity, BillingState, Phone, Website, AnnualRevenue)`
  );

  const accounts = (searchResult.searchRecords || []) as Account[];
  logger.info('Search completed', { search_term, count: accounts.length });

  return accounts;
}

// Tool definitions for MCP registration
export const accountTools = [
  {
    name: 'list_accounts',
    description: 'List Salesforce accounts with optional filters for industry and type',
    inputSchema: {
      type: 'object' as const,
      properties: {
        limit: {
          type: 'number',
          description: 'Maximum number of accounts to return (1-200, default 50)',
        },
        industry: {
          type: 'string',
          description: 'Filter by industry (e.g., Technology, Healthcare, Finance)',
        },
        type: {
          type: 'string',
          description: 'Filter by account type (e.g., Customer, Partner, Prospect)',
        },
      },
    },
    handler: listAccounts,
    schema: ListAccountsSchema,
  },
  {
    name: 'get_account',
    description: 'Get detailed information about a specific Salesforce account',
    inputSchema: {
      type: 'object' as const,
      properties: {
        account_id: {
          type: 'string',
          description: 'The Salesforce Account ID',
        },
      },
      required: ['account_id'],
    },
    handler: getAccount,
    schema: GetAccountSchema,
  },
  {
    name: 'search_accounts',
    description: 'Search for Salesforce accounts by name using full-text search',
    inputSchema: {
      type: 'object' as const,
      properties: {
        search_term: {
          type: 'string',
          description: 'Search term to find in account names',
        },
      },
      required: ['search_term'],
    },
    handler: searchAccounts,
    schema: SearchAccountsSchema,
  },
];
