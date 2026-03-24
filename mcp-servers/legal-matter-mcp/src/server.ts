import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

// Import tools
import { matterTools } from "./tools/matter-tools.js";
import { timeTools } from "./tools/time-tools.js";
import { billingTools } from "./tools/billing-tools.js";
import { documentTools } from "./tools/document-tools.js";

// Simple logger for the legal matter MCP server
export const logger = {
  info: (message: string, meta?: Record<string, any>) => {
    console.log(JSON.stringify({ level: 'info', message, ...meta, timestamp: new Date().toISOString() }));
  },
  warn: (message: string, meta?: Record<string, any>) => {
    console.warn(JSON.stringify({ level: 'warn', message, ...meta, timestamp: new Date().toISOString() }));
  },
  error: (message: string, meta?: Record<string, any>) => {
    console.error(JSON.stringify({ level: 'error', message, ...meta, timestamp: new Date().toISOString() }));
  },
  debug: (message: string, meta?: Record<string, any>) => {
    if (process.env.DEBUG === 'true') {
      console.log(JSON.stringify({ level: 'debug', message, ...meta, timestamp: new Date().toISOString() }));
    }
  },
};

/**
 * Creates and configures the Legal Matter MCP server
 *
 * This server provides tools for legal practice management including:
 * - Matter management (list, get, search, timeline)
 * - Time tracking and utilization
 * - Billing and accounts receivable
 * - Document management
 *
 * IMPORTANT: This server handles privileged legal information.
 * Ensure proper access controls and ethical considerations are in place.
 */
export function createMcpServer(): McpServer {
  const server = new McpServer({
    name: "legal-matter-mcp",
    version: "1.0.0",
  });

  // Register all matter management tools
  for (const tool of matterTools) {
    server.tool(
      tool.name,
      tool.description,
      tool.schema.shape,
      async (params) => {
        try {
          const validatedParams = tool.schema.parse(params);
          const result = await tool.handler(validatedParams as any);
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(result, null, 2),
              },
            ],
          };
        } catch (error: any) {
          logger.error(`Tool ${tool.name} failed`, { error: error.message });
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  success: false,
                  error: error.message || "An unexpected error occurred",
                }, null, 2),
              },
            ],
            isError: true,
          };
        }
      }
    );
  }

  // Register all time tracking tools
  for (const tool of timeTools) {
    server.tool(
      tool.name,
      tool.description,
      tool.schema.shape,
      async (params) => {
        try {
          const validatedParams = tool.schema.parse(params);
          const result = await tool.handler(validatedParams as any);
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(result, null, 2),
              },
            ],
          };
        } catch (error: any) {
          logger.error(`Tool ${tool.name} failed`, { error: error.message });
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  success: false,
                  error: error.message || "An unexpected error occurred",
                }, null, 2),
              },
            ],
            isError: true,
          };
        }
      }
    );
  }

  // Register all billing tools
  for (const tool of billingTools) {
    server.tool(
      tool.name,
      tool.description,
      tool.schema.shape,
      async (params) => {
        try {
          const validatedParams = tool.schema.parse(params);
          const result = await tool.handler(validatedParams as any);
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(result, null, 2),
              },
            ],
          };
        } catch (error: any) {
          logger.error(`Tool ${tool.name} failed`, { error: error.message });
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  success: false,
                  error: error.message || "An unexpected error occurred",
                }, null, 2),
              },
            ],
            isError: true,
          };
        }
      }
    );
  }

  // Register all document tools
  for (const tool of documentTools) {
    server.tool(
      tool.name,
      tool.description,
      tool.schema.shape,
      async (params) => {
        try {
          const validatedParams = tool.schema.parse(params);
          const result = await tool.handler(validatedParams as any);
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(result, null, 2),
              },
            ],
          };
        } catch (error: any) {
          logger.error(`Tool ${tool.name} failed`, { error: error.message });
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  success: false,
                  error: error.message || "An unexpected error occurred",
                }, null, 2),
              },
            ],
            isError: true,
          };
        }
      }
    );
  }

  logger.info("Legal Matter MCP server created", {
    tools: [
      ...matterTools.map(t => t.name),
      ...timeTools.map(t => t.name),
      ...billingTools.map(t => t.name),
      ...documentTools.map(t => t.name),
    ],
  });

  return server;
}
