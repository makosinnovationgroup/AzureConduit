import { z } from 'zod';
import { getPropertyConnector, Property, Unit, PropertyFinancials, VacancyEntry } from '../connectors/property';
import { logger } from '../server';

// Schema definitions
export const ListPropertiesSchema = z.object({
  type: z.enum(['residential', 'commercial', 'mixed', 'industrial']).optional().describe('Filter by property type'),
  status: z.enum(['active', 'inactive', 'pending']).optional().describe('Filter by property status'),
  manager: z.string().optional().describe('Filter by manager ID or name'),
});

export const GetPropertySchema = z.object({
  property_id: z.string().min(1).describe('The property ID'),
});

export const GetPropertyFinancialsSchema = z.object({
  property_id: z.string().min(1).describe('The property ID'),
  start_date: z.string().optional().describe('Start date for financial period (YYYY-MM-DD)'),
  end_date: z.string().optional().describe('End date for financial period (YYYY-MM-DD)'),
});

// Tool implementations
export async function listProperties(params: z.infer<typeof ListPropertiesSchema>): Promise<Property[]> {
  const connector = getPropertyConnector();
  const { type, status, manager } = params;

  logger.info('Listing properties', { type, status, manager });

  const properties = await connector.listProperties({ type, status, manager });
  logger.info('Retrieved properties', { count: properties.length });

  return properties;
}

export async function getProperty(params: z.infer<typeof GetPropertySchema>): Promise<Property & { units: Unit[] }> {
  const connector = getPropertyConnector();
  const { property_id } = params;

  logger.info('Getting property details', { property_id });

  const property = await connector.getProperty(property_id);
  logger.info('Retrieved property', { property_id, name: property.name, units_count: property.units.length });

  return property;
}

export async function getPropertyFinancials(params: z.infer<typeof GetPropertyFinancialsSchema>): Promise<PropertyFinancials> {
  const connector = getPropertyConnector();
  const { property_id, start_date, end_date } = params;

  logger.info('Getting property financials', { property_id, start_date, end_date });

  const financials = await connector.getPropertyFinancials(property_id, start_date, end_date);
  logger.info('Retrieved property financials', { property_id, noi: financials.net_operating_income });

  return financials;
}

export async function getVacancyReport(): Promise<VacancyEntry[]> {
  const connector = getPropertyConnector();

  logger.info('Getting vacancy report');

  const vacancies = await connector.getVacancyReport();
  logger.info('Retrieved vacancy report', { vacant_units: vacancies.length });

  return vacancies;
}

// Tool definitions for MCP registration
export const propertyTools = [
  {
    name: 'list_properties',
    description: 'List properties in the portfolio with optional filters for type, status, and manager. Returns property details including address, units count, and current value.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        type: {
          type: 'string',
          enum: ['residential', 'commercial', 'mixed', 'industrial'],
          description: 'Filter by property type',
        },
        status: {
          type: 'string',
          enum: ['active', 'inactive', 'pending'],
          description: 'Filter by property status',
        },
        manager: {
          type: 'string',
          description: 'Filter by manager ID or name',
        },
      },
    },
    handler: listProperties,
    schema: ListPropertiesSchema,
  },
  {
    name: 'get_property',
    description: 'Get detailed information about a specific property including all units, their status (occupied/vacant), tenant assignments, and rent amounts.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        property_id: {
          type: 'string',
          description: 'The property ID',
        },
      },
      required: ['property_id'],
    },
    handler: getProperty,
    schema: GetPropertySchema,
  },
  {
    name: 'get_property_financials',
    description: 'Get financial information for a property including gross income, operating expenses, net operating income, maintenance costs, vacancy loss, and rent collection rate.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        property_id: {
          type: 'string',
          description: 'The property ID',
        },
        start_date: {
          type: 'string',
          description: 'Start date for financial period (YYYY-MM-DD)',
        },
        end_date: {
          type: 'string',
          description: 'End date for financial period (YYYY-MM-DD)',
        },
      },
      required: ['property_id'],
    },
    handler: getPropertyFinancials,
    schema: GetPropertyFinancialsSchema,
  },
  {
    name: 'get_vacancy_report',
    description: 'Get a report of all current vacancies across the portfolio. Shows vacant units, days vacant, market rent, and last tenant move-out date.',
    inputSchema: {
      type: 'object' as const,
      properties: {},
    },
    handler: getVacancyReport,
    schema: z.object({}),
  },
];
