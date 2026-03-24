import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import winston from 'winston';
import { initializePropertyConnector, PropertyManagementConfig } from './connectors/property';
import { propertyTools } from './tools/property-tools';
import { leaseTools } from './tools/lease-tools';
import { tenantTools } from './tools/tenant-tools';
import { maintenanceTools } from './tools/maintenance-tools';
import { financialTools } from './tools/financial-tools';

// Create logger
export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      ),
    }),
  ],
});

/**
 * Creates and configures the MCP server with property management tools
 */
export function createMcpServer(): McpServer {
  // Initialize property management connector
  const config: PropertyManagementConfig = {
    provider: (process.env.PROPERTY_MANAGEMENT_PROVIDER as 'appfolio' | 'buildium' | 'generic') || 'generic',
    baseUrl: process.env.PROPERTY_API_BASE_URL,
    clientId: process.env.APPFOLIO_CLIENT_ID || process.env.BUILDIUM_CLIENT_ID,
    clientSecret: process.env.APPFOLIO_CLIENT_SECRET || process.env.BUILDIUM_CLIENT_SECRET,
    apiKey: process.env.PROPERTY_API_KEY,
    databaseName: process.env.APPFOLIO_DATABASE_NAME,
    demoMode: process.env.DEMO_MODE === 'true',
  };

  const connector = initializePropertyConnector(config);

  // Connect to the property management system (async, but we don't await here)
  connector.connect().catch((error) => {
    logger.error('Failed to connect to property management system', { error });
  });

  const server = new McpServer({
    name: 'property-management-mcp',
    version: '1.0.0',
  });

  // Register all property tools
  for (const tool of propertyTools) {
    server.tool(
      tool.name,
      tool.description,
      tool.inputSchema.properties ? Object.fromEntries(
        Object.entries(tool.inputSchema.properties).map(([key, value]) => [
          key,
          tool.schema.shape[key] || require('zod').z.any(),
        ])
      ) : {},
      async (params) => {
        try {
          const validatedParams = tool.schema.parse(params);
          const result = await tool.handler(validatedParams);
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(result, null, 2),
              },
            ],
          };
        } catch (error) {
          logger.error(`Error in ${tool.name}`, { error });
          return {
            content: [
              {
                type: 'text',
                text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
              },
            ],
            isError: true,
          };
        }
      }
    );
  }

  // Register all lease tools
  for (const tool of leaseTools) {
    server.tool(
      tool.name,
      tool.description,
      tool.inputSchema.properties ? Object.fromEntries(
        Object.entries(tool.inputSchema.properties).map(([key, value]) => [
          key,
          tool.schema.shape[key] || require('zod').z.any(),
        ])
      ) : {},
      async (params) => {
        try {
          const validatedParams = tool.schema.parse(params);
          const result = await tool.handler(validatedParams);
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(result, null, 2),
              },
            ],
          };
        } catch (error) {
          logger.error(`Error in ${tool.name}`, { error });
          return {
            content: [
              {
                type: 'text',
                text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
              },
            ],
            isError: true,
          };
        }
      }
    );
  }

  // Register all tenant tools
  for (const tool of tenantTools) {
    server.tool(
      tool.name,
      tool.description,
      tool.inputSchema.properties ? Object.fromEntries(
        Object.entries(tool.inputSchema.properties).map(([key, value]) => [
          key,
          tool.schema.shape[key] || require('zod').z.any(),
        ])
      ) : {},
      async (params) => {
        try {
          const validatedParams = tool.schema.parse(params);
          const result = await tool.handler(validatedParams);
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(result, null, 2),
              },
            ],
          };
        } catch (error) {
          logger.error(`Error in ${tool.name}`, { error });
          return {
            content: [
              {
                type: 'text',
                text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
              },
            ],
            isError: true,
          };
        }
      }
    );
  }

  // Register all maintenance tools
  for (const tool of maintenanceTools) {
    server.tool(
      tool.name,
      tool.description,
      tool.inputSchema.properties ? Object.fromEntries(
        Object.entries(tool.inputSchema.properties).map(([key, value]) => [
          key,
          tool.schema.shape[key] || require('zod').z.any(),
        ])
      ) : {},
      async (params) => {
        try {
          const validatedParams = tool.schema.parse(params);
          const result = await tool.handler(validatedParams);
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(result, null, 2),
              },
            ],
          };
        } catch (error) {
          logger.error(`Error in ${tool.name}`, { error });
          return {
            content: [
              {
                type: 'text',
                text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
              },
            ],
            isError: true,
          };
        }
      }
    );
  }

  // Register all financial tools
  for (const tool of financialTools) {
    server.tool(
      tool.name,
      tool.description,
      tool.inputSchema.properties ? Object.fromEntries(
        Object.entries(tool.inputSchema.properties).map(([key, value]) => [
          key,
          tool.schema.shape[key] || require('zod').z.any(),
        ])
      ) : {},
      async (params) => {
        try {
          const validatedParams = tool.schema.parse(params);
          const result = await tool.handler(validatedParams);
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(result, null, 2),
              },
            ],
          };
        } catch (error) {
          logger.error(`Error in ${tool.name}`, { error });
          return {
            content: [
              {
                type: 'text',
                text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
              },
            ],
            isError: true,
          };
        }
      }
    );
  }

  logger.info('Property Management MCP server initialized', {
    tools: [
      ...propertyTools.map(t => t.name),
      ...leaseTools.map(t => t.name),
      ...tenantTools.map(t => t.name),
      ...maintenanceTools.map(t => t.name),
      ...financialTools.map(t => t.name),
    ],
  });

  return server;
}
