import { z } from 'zod';
import { getPropertyConnector, Lease } from '../connectors/property';
import { logger } from '../server';

// Schema definitions
export const ListLeasesSchema = z.object({
  property_id: z.string().optional().describe('Filter by property ID'),
  status: z.enum(['active', 'expired', 'pending', 'terminated']).optional().describe('Filter by lease status'),
  expiring_in_days: z.number().optional().describe('Show leases expiring within this many days'),
});

export const GetLeaseSchema = z.object({
  lease_id: z.string().min(1).describe('The lease ID'),
});

export const GetExpiringLeasesSchema = z.object({
  days: z.number().min(1).default(30).describe('Number of days to look ahead for expiring leases'),
});

// Tool implementations
export async function listLeases(params: z.infer<typeof ListLeasesSchema>): Promise<Lease[]> {
  const connector = getPropertyConnector();
  const { property_id, status, expiring_in_days } = params;

  logger.info('Listing leases', { property_id, status, expiring_in_days });

  const leases = await connector.listLeases({ property_id, status, expiring_in_days });
  logger.info('Retrieved leases', { count: leases.length });

  return leases;
}

export async function getLease(params: z.infer<typeof GetLeaseSchema>): Promise<Lease> {
  const connector = getPropertyConnector();
  const { lease_id } = params;

  logger.info('Getting lease details', { lease_id });

  const lease = await connector.getLease(lease_id);
  logger.info('Retrieved lease', { lease_id, tenant: lease.tenant_name, status: lease.status });

  return lease;
}

export async function getExpiringLeases(params: z.infer<typeof GetExpiringLeasesSchema>): Promise<Lease[]> {
  const connector = getPropertyConnector();
  const { days } = params;

  logger.info('Getting expiring leases', { days });

  const leases = await connector.getExpiringLeases(days);
  logger.info('Retrieved expiring leases', { count: leases.length, within_days: days });

  return leases;
}

export async function getLeaseRenewals(): Promise<Lease[]> {
  const connector = getPropertyConnector();

  logger.info('Getting pending lease renewals');

  const leases = await connector.getLeaseRenewals();
  logger.info('Retrieved lease renewals', { count: leases.length });

  return leases;
}

// Tool definitions for MCP registration
export const leaseTools = [
  {
    name: 'list_leases',
    description: 'List leases with optional filters for property, status, and expiration timeframe. Returns lease details including tenant name, dates, rent amount, and renewal status.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        property_id: {
          type: 'string',
          description: 'Filter by property ID',
        },
        status: {
          type: 'string',
          enum: ['active', 'expired', 'pending', 'terminated'],
          description: 'Filter by lease status',
        },
        expiring_in_days: {
          type: 'number',
          description: 'Show leases expiring within this many days',
        },
      },
    },
    handler: listLeases,
    schema: ListLeasesSchema,
  },
  {
    name: 'get_lease',
    description: 'Get detailed information about a specific lease including tenant, property, unit, dates, rent amount, security deposit, and renewal status.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        lease_id: {
          type: 'string',
          description: 'The lease ID',
        },
      },
      required: ['lease_id'],
    },
    handler: getLease,
    schema: GetLeaseSchema,
  },
  {
    name: 'get_expiring_leases',
    description: 'Get leases that are expiring within a specified number of days. Useful for planning renewals and managing turnover.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        days: {
          type: 'number',
          description: 'Number of days to look ahead for expiring leases (default: 30)',
        },
      },
    },
    handler: getExpiringLeases,
    schema: GetExpiringLeasesSchema,
  },
  {
    name: 'get_lease_renewals',
    description: 'Get all leases with pending renewal offers. Shows leases where renewal has been offered but tenant has not yet responded.',
    inputSchema: {
      type: 'object' as const,
      properties: {},
    },
    handler: getLeaseRenewals,
    schema: z.object({}),
  },
];
