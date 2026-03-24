import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool
} from '@modelcontextprotocol/sdk/types.js';
import { createLogger, format, transports } from 'winston';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { z } from 'zod';

import { issueToolDefinitions, issueToolHandlers } from './tools/issue-tools';
import { projectToolDefinitions, projectToolHandlers } from './tools/project-tools';
import { sprintToolDefinitions, sprintToolHandlers } from './tools/sprint-tools';

const logger = createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: format.combine(
    format.timestamp(),
    format.json()
  ),
  transports: [
    new transports.Console({
      stderrLevels: ['error', 'warn', 'info', 'debug']
    })
  ]
});

// Combine all tool definitions
const allToolDefinitions = [
  ...issueToolDefinitions,
  ...projectToolDefinitions,
  ...sprintToolDefinitions
];

// Combine all tool handlers
const allToolHandlers: Record<string, (params: unknown) => Promise<unknown>> = {
  ...issueToolHandlers,
  ...projectToolHandlers,
  ...sprintToolHandlers
};

// Convert zod schema to JSON Schema for MCP
function convertToMcpTool(toolDef: { name: string; description: string; inputSchema: z.ZodType }): Tool {
  const jsonSchema = zodToJsonSchema(toolDef.inputSchema, {
    $refStrategy: 'none'
  });

  // Remove $schema property as MCP doesn't expect it
  const { $schema, ...schemaWithoutRef } = jsonSchema as Record<string, unknown>;

  return {
    name: toolDef.name,
    description: toolDef.description,
    inputSchema: schemaWithoutRef as Tool['inputSchema']
  };
}

export function createMcpServer(): Server {
  const server = new Server(
    {
      name: 'jira-mcp',
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

    const tools = allToolDefinitions.map(convertToMcpTool);

    return { tools };
  });

  // Handle tool calls
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    logger.info('Tool called', { tool: name, args });

    const handler = allToolHandlers[name];
    if (!handler) {
      logger.error('Unknown tool requested', { tool: name });
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ error: `Unknown tool: ${name}` })
          }
        ],
        isError: true
      };
    }

    try {
      const result = await handler(args || {});
      logger.info('Tool execution successful', { tool: name });

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2)
          }
        ]
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('Tool execution failed', { tool: name, error: errorMessage });

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

export async function runStdioServer(): Promise<void> {
  const server = createMcpServer();
  const transport = new StdioServerTransport();

  logger.info('Starting Jira MCP server with stdio transport');

  await server.connect(transport);

  logger.info('Jira MCP server connected and running');
}
