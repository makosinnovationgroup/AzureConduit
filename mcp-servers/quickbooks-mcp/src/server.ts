import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import winston from 'winston';

import { invoiceTools, handleInvoiceTool } from './tools/invoice-tools';
import { expenseTools, handleExpenseTool } from './tools/expense-tools';
import { reportTools, handleReportTool } from './tools/report-tools';
import { customerTools, handleCustomerTool } from './tools/customer-tools';
import { initializeQuickBooksClient } from './connectors/quickbooks';

// Configure logger
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
      )
    })
  ]
});

// Combine all tools
const allTools = [
  ...invoiceTools,
  ...expenseTools,
  ...reportTools,
  ...customerTools
];

// Tool name to handler mapping
const invoiceToolNames = invoiceTools.map(t => t.name);
const expenseToolNames = expenseTools.map(t => t.name);
const reportToolNames = reportTools.map(t => t.name);
const customerToolNames = customerTools.map(t => t.name);

export function createMCPServer(): Server {
  const server = new Server(
    {
      name: 'quickbooks-mcp',
      version: '1.0.0',
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  // List available tools
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    logger.info('Listing tools');
    return {
      tools: allTools,
    };
  });

  // Handle tool calls
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    logger.info('Tool called', { name, args });

    try {
      // Route to appropriate handler based on tool name
      if (invoiceToolNames.includes(name)) {
        return await handleInvoiceTool(name, args || {});
      }

      if (expenseToolNames.includes(name)) {
        return await handleExpenseTool(name, args || {});
      }

      if (reportToolNames.includes(name)) {
        return await handleReportTool(name, args || {});
      }

      if (customerToolNames.includes(name)) {
        return await handleCustomerTool(name, args || {});
      }

      throw new Error(`Unknown tool: ${name}`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Tool execution failed', { name, error: errorMessage });

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            error: true,
            message: errorMessage
          })
        }],
        isError: true
      };
    }
  });

  return server;
}

export async function startMCPServer(): Promise<void> {
  logger.info('Starting QuickBooks MCP Server');

  // Initialize QuickBooks client
  try {
    initializeQuickBooksClient();
    logger.info('QuickBooks client initialized');
  } catch (error) {
    logger.error('Failed to initialize QuickBooks client', { error });
    throw error;
  }

  const server = createMCPServer();
  const transport = new StdioServerTransport();

  await server.connect(transport);
  logger.info('MCP Server connected via stdio');
}
