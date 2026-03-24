import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

/**
 * Creates and configures the MCP server with two simple tools:
 * - hello_world: Returns "Hello, World!" (no parameters)
 * - echo: Returns whatever text is passed in
 */
export function createMcpServer(): McpServer {
  const server = new McpServer({
    name: "hello-world-mcp",
    version: "1.0.0",
  });

  // Tool 1: hello_world - Returns a simple greeting
  server.tool(
    "hello_world",
    "Returns a friendly 'Hello, World!' greeting",
    {},
    async () => {
      return {
        content: [
          {
            type: "text",
            text: "Hello, World!",
          },
        ],
      };
    }
  );

  // Tool 2: echo - Returns whatever message is passed in
  server.tool(
    "echo",
    "Echoes back the provided message",
    {
      message: z.string().describe("The message to echo back"),
    },
    async ({ message }) => {
      return {
        content: [
          {
            type: "text",
            text: message,
          },
        ],
      };
    }
  );

  return server;
}
