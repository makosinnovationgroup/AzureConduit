import { z } from 'zod';
import { getConnector } from '../connectors/sql';
import logger from '../utils/logger';

// Schema definitions for tool parameters
export const listTablesSchema = z.object({});

export const describeTableSchema = z.object({
  table_name: z.string().min(1).describe('The name of the table to describe')
});

export const runQuerySchema = z.object({
  query: z.string().min(1).describe('The SELECT query to execute')
});

export const getSampleDataSchema = z.object({
  table_name: z.string().min(1).describe('The name of the table to get sample data from'),
  limit: z.number().min(1).max(1000).default(10).describe('Maximum number of rows to return (1-1000)')
});

// Validate that a query is SELECT-only (no INSERT, UPDATE, DELETE, DROP, etc.)
function validateSelectOnly(query: string): void {
  const normalizedQuery = query.trim().toUpperCase();

  // List of dangerous SQL keywords that we don't allow
  const dangerousKeywords = [
    'INSERT',
    'UPDATE',
    'DELETE',
    'DROP',
    'CREATE',
    'ALTER',
    'TRUNCATE',
    'EXEC',
    'EXECUTE',
    'GRANT',
    'REVOKE',
    'MERGE',
    'CALL',
    'SET ',
    'DECLARE',
    'BEGIN',
    'COMMIT',
    'ROLLBACK',
    'SAVEPOINT'
  ];

  // Check if query starts with SELECT or WITH (for CTEs)
  if (!normalizedQuery.startsWith('SELECT') && !normalizedQuery.startsWith('WITH')) {
    throw new Error('Only SELECT queries are allowed. Query must start with SELECT or WITH.');
  }

  // Check for dangerous keywords anywhere in the query
  for (const keyword of dangerousKeywords) {
    // Use word boundary check to avoid false positives
    const regex = new RegExp(`\\b${keyword}\\b`, 'i');
    if (regex.test(query)) {
      throw new Error(`Query contains forbidden keyword: ${keyword}. Only SELECT queries are allowed.`);
    }
  }

  // Check for semicolons (to prevent multiple statements)
  const withoutStrings = query.replace(/'[^']*'/g, '').replace(/"[^"]*"/g, '');
  if (withoutStrings.includes(';')) {
    throw new Error('Multiple statements are not allowed. Please provide a single SELECT query.');
  }
}

// Tool handlers
export async function listTables(): Promise<{ tables: Array<{ name: string; schema: string; type: string }> }> {
  logger.info('Listing tables');

  const connector = getConnector();
  const tables = await connector.listTables();

  const result = {
    tables: tables.map(t => ({
      name: t.table_name,
      schema: t.table_schema,
      type: t.table_type
    }))
  };

  logger.info('Listed tables', { count: result.tables.length });
  return result;
}

export async function describeTable(params: z.infer<typeof describeTableSchema>): Promise<{
  table_name: string;
  columns: Array<{
    name: string;
    type: string;
    nullable: boolean;
    default_value: string | null;
    max_length: number | null;
  }>;
}> {
  const { table_name } = params;
  logger.info('Describing table', { table_name });

  const connector = getConnector();
  const columns = await connector.describeTable(table_name);

  const result = {
    table_name,
    columns: columns.map(c => ({
      name: c.column_name,
      type: c.data_type,
      nullable: c.is_nullable === 'YES',
      default_value: c.column_default,
      max_length: c.character_maximum_length
    }))
  };

  logger.info('Described table', { table_name, column_count: result.columns.length });
  return result;
}

export async function runQuery(params: z.infer<typeof runQuerySchema>): Promise<{
  query: string;
  row_count: number;
  rows: Record<string, unknown>[];
}> {
  const { query } = params;
  logger.info('Running query', { query: query.substring(0, 100) });

  // Validate that it's a SELECT query only
  validateSelectOnly(query);

  const connector = getConnector();
  const result = await connector.query(query);

  logger.info('Query completed', { row_count: result.rowCount });

  return {
    query,
    row_count: result.rowCount,
    rows: result.rows
  };
}

export async function getSampleData(params: z.infer<typeof getSampleDataSchema>): Promise<{
  table_name: string;
  limit: number;
  row_count: number;
  rows: Record<string, unknown>[];
}> {
  const { table_name, limit = 10 } = params;
  logger.info('Getting sample data', { table_name, limit });

  const connector = getConnector();
  const result = await connector.getSampleData(table_name, limit);

  logger.info('Sample data retrieved', { table_name, row_count: result.rowCount });

  return {
    table_name,
    limit,
    row_count: result.rowCount,
    rows: result.rows
  };
}

// Tool definitions for MCP registration
export const toolDefinitions = [
  {
    name: 'list_tables',
    description: 'List all tables in the connected database. Returns table names, schemas, and types.',
    inputSchema: {
      type: 'object' as const,
      properties: {},
      required: [] as string[]
    }
  },
  {
    name: 'describe_table',
    description: 'Get the schema/structure of a specific table including column names, data types, nullable status, default values, and max lengths.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        table_name: {
          type: 'string',
          description: 'The name of the table to describe'
        }
      },
      required: ['table_name']
    }
  },
  {
    name: 'run_query',
    description: 'Execute a SELECT query against the database. Only SELECT queries are allowed for safety - INSERT, UPDATE, DELETE, and other modifying statements will be rejected.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        query: {
          type: 'string',
          description: 'The SELECT query to execute. Must be a valid SELECT statement.'
        }
      },
      required: ['query']
    }
  },
  {
    name: 'get_sample_data',
    description: 'Get sample rows from a table. Useful for understanding the data structure and contents of a table.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        table_name: {
          type: 'string',
          description: 'The name of the table to get sample data from'
        },
        limit: {
          type: 'number',
          description: 'Maximum number of rows to return (1-1000, default: 10)',
          minimum: 1,
          maximum: 1000,
          default: 10
        }
      },
      required: ['table_name']
    }
  }
];
