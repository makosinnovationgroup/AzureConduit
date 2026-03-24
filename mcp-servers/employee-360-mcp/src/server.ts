import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

// Import all tools
import { employeeTools } from './tools/employee-tools';
import { hrTools } from './tools/hr-tools';
import { itTools } from './tools/it-tools';
import { activityTools } from './tools/activity-tools';

/**
 * Creates and configures the Employee 360 MCP server
 * Aggregates HR, IT, and directory data for complete employee views
 */
export function createMcpServer(): McpServer {
  const server = new McpServer({
    name: 'employee-360-mcp',
    version: '1.0.0',
  });

  // Register Employee 360 tools (cross-system aggregation)
  for (const tool of employeeTools) {
    server.tool(
      tool.name,
      tool.description,
      tool.schema instanceof z.ZodObject
        ? tool.schema.shape
        : {},
      async (params) => {
        try {
          const validated = tool.schema.parse(params);
          const result = await tool.handler(validated);
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(result, null, 2),
              },
            ],
          };
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({ error: errorMessage }, null, 2),
              },
            ],
            isError: true,
          };
        }
      }
    );
  }

  // Register HR tools
  for (const tool of hrTools) {
    server.tool(
      tool.name,
      tool.description,
      tool.schema instanceof z.ZodObject
        ? tool.schema.shape
        : {},
      async (params) => {
        try {
          const validated = tool.schema.parse(params);
          const result = await tool.handler(validated);
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(result, null, 2),
              },
            ],
          };
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({ error: errorMessage }, null, 2),
              },
            ],
            isError: true,
          };
        }
      }
    );
  }

  // Register IT tools
  for (const tool of itTools) {
    server.tool(
      tool.name,
      tool.description,
      tool.schema instanceof z.ZodObject
        ? tool.schema.shape
        : {},
      async (params) => {
        try {
          const validated = tool.schema.parse(params);
          const result = await tool.handler(validated);
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(result, null, 2),
              },
            ],
          };
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({ error: errorMessage }, null, 2),
              },
            ],
            isError: true,
          };
        }
      }
    );
  }

  // Register Activity tools
  for (const tool of activityTools) {
    server.tool(
      tool.name,
      tool.description,
      tool.schema instanceof z.ZodObject
        ? tool.schema.shape
        : {},
      async (params) => {
        try {
          const validated = tool.schema.parse(params);
          const result = await tool.handler(validated);
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(result, null, 2),
              },
            ],
          };
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({ error: errorMessage }, null, 2),
              },
            ],
            isError: true,
          };
        }
      }
    );
  }

  return server;
}
