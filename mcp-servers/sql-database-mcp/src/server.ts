import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema
} from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import logger from './utils/logger';
import { getConnector } from './connectors/sql';
import {
  toolDefinitions,
  listTables,
  describeTable,
  runQuery,
  getSampleData,
  describeTableSchema,
  runQuerySchema,
  getSampleDataSchema
} from './tools/query-tools';

export function createMcpServer(): Server {
  const server = new Server(
    {
      name: 'sql-database-mcp',
      version: '1.0.0'
    },
    {
      capabilities: {
        tools: {}
      }
    }
  );

  // Handle list tools request
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    logger.info('Listing available tools');
    return {
      tools: toolDefinitions
    };
  });

  // Handle tool calls
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    logger.info('Tool called', { name, args });

    try {
      let result: unknown;

      switch (name) {
        case 'list_tables':
          result = await listTables();
          break;

        case 'describe_table': {
          const params = describeTableSchema.parse(args);
          result = await describeTable(params);
          break;
        }

        case 'run_query': {
          const params = runQuerySchema.parse(args);
          result = await runQuery(params);
          break;
        }

        case 'get_sample_data': {
          const params = getSampleDataSchema.parse(args);
          result = await getSampleData(params);
          break;
        }

        default:
          throw new Error(`Unknown tool: ${name}`);
      }

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2)
          }
        ]
      };
    } catch (error) {
      logger.error('Tool execution failed', { name, error });

      const errorMessage = error instanceof z.ZodError
        ? `Validation error: ${error.errors.map(e => e.message).join(', ')}`
        : error instanceof Error
          ? error.message
          : 'Unknown error occurred';

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ error: errorMessage })
          }
        ],
        isError: true
      };
    }
  });

  return server;
}

export async function startStdioServer(): Promise<void> {
  const server = createMcpServer();
  const transport = new StdioServerTransport();

  // Initialize database connection
  try {
    const connector = getConnector();
    await connector.initialize();
    logger.info('Database connection established');
  } catch (error) {
    logger.error('Failed to establish database connection', { error });
    // Continue anyway - connection will be attempted on first query
  }

  await server.connect(transport);
  logger.info('MCP server started on stdio transport');
}
