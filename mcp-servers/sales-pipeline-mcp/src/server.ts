import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ErrorCode,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import winston from 'winston';

import { pipelineTools } from './tools/pipeline-tools';
import { forecastTools } from './tools/forecast-tools';
import { dealTools } from './tools/deal-tools';
import { activityTools } from './tools/activity-tools';
import { performanceTools } from './tools/performance-tools';

// Initialize logger
export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'sales-pipeline-mcp' },
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      ),
    }),
  ],
});

// Combine all tools
const allTools = [
  ...pipelineTools,
  ...forecastTools,
  ...dealTools,
  ...activityTools,
  ...performanceTools,
];

// Create tool lookup map
const toolMap = new Map(allTools.map((tool) => [tool.name, tool]));

export function createMcpServer(): Server {
  const server = new Server(
    {
      name: 'sales-pipeline-mcp',
      version: '1.0.0',
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  // Handle list tools request
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    logger.info('Listing available tools', { count: allTools.length });
    return {
      tools: allTools.map((tool) => ({
        name: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema,
      })),
    };
  });

  // Handle tool calls
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    logger.info('Tool called', { name, args });

    const tool = toolMap.get(name);
    if (!tool) {
      throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
    }

    try {
      // Validate arguments with zod schema
      const validatedArgs = tool.schema.parse(args || {});

      // Execute the tool handler
      const result = await tool.handler(validatedArgs);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error) {
      logger.error('Tool execution failed', { name, error });

      if (error instanceof Error) {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                error: error.message,
                name: error.name,
              }),
            },
          ],
          isError: true,
        };
      }

      throw new McpError(ErrorCode.InternalError, 'An unexpected error occurred');
    }
  });

  return server;
}

export async function runStdioServer(): Promise<void> {
  const server = createMcpServer();
  const transport = new StdioServerTransport();

  await server.connect(transport);
  logger.info('Sales Pipeline MCP server running on stdio');
}
