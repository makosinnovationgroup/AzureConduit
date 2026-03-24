import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createErpConnectorFromEnv } from "./connectors/erp";
import { createShippingConnectorFromEnv } from "./connectors/shipping";
import { createInventoryConnectorFromEnv } from "./connectors/inventory";
import { orderTools } from "./tools/order-tools";
import { shippingTools } from "./tools/shipping-tools";
import { inventoryTools } from "./tools/inventory-tools";

/**
 * Order Status MCP Server
 *
 * Cross-system aggregator combining ERP, shipping, and inventory data
 * to provide unified order status information.
 *
 * Use Cases:
 * - Customer Service: "Where is my order?" queries
 * - Logistics Planning: Monitor delayed orders and shipments in transit
 * - Inventory Management: Check product availability and low stock alerts
 */

export function createMcpServer(): McpServer {
  // Initialize connectors from environment variables
  createErpConnectorFromEnv();
  createShippingConnectorFromEnv();
  createInventoryConnectorFromEnv();

  const server = new McpServer({
    name: "order-status-mcp",
    version: "1.0.0",
  });

  // Register Order Tools
  for (const tool of orderTools) {
    server.tool(
      tool.name,
      tool.description,
      tool.inputSchema.properties,
      async (params) => {
        try {
          const validatedParams = tool.schema.parse(params);
          const result = await tool.handler(validatedParams as never);

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(result, null, 2),
              },
            ],
          };
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : "Unknown error";
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({ error: errorMessage }, null, 2),
              },
            ],
            isError: true,
          };
        }
      }
    );
  }

  // Register Shipping Tools
  for (const tool of shippingTools) {
    server.tool(
      tool.name,
      tool.description,
      tool.inputSchema.properties,
      async (params) => {
        try {
          const validatedParams = tool.schema.parse(params);
          const result = await tool.handler(validatedParams as never);

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(result, null, 2),
              },
            ],
          };
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : "Unknown error";
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({ error: errorMessage }, null, 2),
              },
            ],
            isError: true,
          };
        }
      }
    );
  }

  // Register Inventory Tools
  for (const tool of inventoryTools) {
    server.tool(
      tool.name,
      tool.description,
      tool.inputSchema.properties,
      async (params) => {
        try {
          const validatedParams = tool.schema.parse(params);
          const result = await tool.handler(validatedParams as never);

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(result, null, 2),
              },
            ],
          };
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : "Unknown error";
          return {
            content: [
              {
                type: "text",
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
