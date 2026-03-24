import { z } from 'zod';
import { getPropertyConnector, Tenant } from '../connectors/property';
import { logger } from '../server';

// Schema definitions
export const ListTenantsSchema = z.object({
  property_id: z.string().optional().describe('Filter by property ID'),
  status: z.enum(['active', 'inactive', 'pending', 'evicted']).optional().describe('Filter by tenant status'),
});

export const GetTenantSchema = z.object({
  tenant_id: z.string().min(1).describe('The tenant ID'),
});

export const SearchTenantsSchema = z.object({
  query: z.string().min(1).describe('Search term to match against tenant name, email, or phone'),
});

// Tool implementations
export async function listTenants(params: z.infer<typeof ListTenantsSchema>): Promise<Tenant[]> {
  const connector = getPropertyConnector();
  const { property_id, status } = params;

  logger.info('Listing tenants', { property_id, status });

  const tenants = await connector.listTenants({ property_id, status });
  logger.info('Retrieved tenants', { count: tenants.length });

  return tenants;
}

export async function getTenant(params: z.infer<typeof GetTenantSchema>): Promise<Tenant> {
  const connector = getPropertyConnector();
  const { tenant_id } = params;

  logger.info('Getting tenant details', { tenant_id });

  const tenant = await connector.getTenant(tenant_id);
  logger.info('Retrieved tenant', {
    tenant_id,
    name: `${tenant.first_name} ${tenant.last_name}`,
    balance: tenant.balance,
    payment_history_count: tenant.payment_history.length,
  });

  return tenant;
}

export async function getDelinquentTenants(): Promise<Tenant[]> {
  const connector = getPropertyConnector();

  logger.info('Getting delinquent tenants');

  const tenants = await connector.getDelinquentTenants();
  const totalOwed = tenants.reduce((sum, t) => sum + t.balance, 0);
  logger.info('Retrieved delinquent tenants', { count: tenants.length, total_owed: totalOwed });

  return tenants;
}

export async function searchTenants(params: z.infer<typeof SearchTenantsSchema>): Promise<Tenant[]> {
  const connector = getPropertyConnector();
  const { query } = params;

  logger.info('Searching tenants', { query });

  const tenants = await connector.searchTenants(query);
  logger.info('Search completed', { query, count: tenants.length });

  return tenants;
}

// Tool definitions for MCP registration
export const tenantTools = [
  {
    name: 'list_tenants',
    description: 'List tenants with optional filters for property and status. Returns tenant details including contact info, current property, and balance.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        property_id: {
          type: 'string',
          description: 'Filter by property ID',
        },
        status: {
          type: 'string',
          enum: ['active', 'inactive', 'pending', 'evicted'],
          description: 'Filter by tenant status',
        },
      },
    },
    handler: listTenants,
    schema: ListTenantsSchema,
  },
  {
    name: 'get_tenant',
    description: 'Get detailed information about a specific tenant including contact info, current lease, balance, and payment history.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        tenant_id: {
          type: 'string',
          description: 'The tenant ID',
        },
      },
      required: ['tenant_id'],
    },
    handler: getTenant,
    schema: GetTenantSchema,
  },
  {
    name: 'get_delinquent_tenants',
    description: 'Get all tenants with overdue rent balances. Shows tenant details and amount owed.',
    inputSchema: {
      type: 'object' as const,
      properties: {},
    },
    handler: getDelinquentTenants,
    schema: z.object({}),
  },
  {
    name: 'search_tenants',
    description: 'Search for tenants by name, email, or phone number. Useful for finding tenant records.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        query: {
          type: 'string',
          description: 'Search term to match against tenant name, email, or phone',
        },
      },
      required: ['query'],
    },
    handler: searchTenants,
    schema: SearchTenantsSchema,
  },
];
