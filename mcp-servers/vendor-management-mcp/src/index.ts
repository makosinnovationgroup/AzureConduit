import express, { Request, Response } from "express";
import { createMcpServer } from "./server.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";

const PORT = process.env.PORT || 8000;

const app = express();
app.use(express.json());

// Create the MCP server
const mcpServer = createMcpServer();

// Store active transports for cleanup
const transports: Map<string, SSEServerTransport> = new Map();

// Health check endpoint
app.get("/health", (_req: Request, res: Response) => {
  res.json({
    status: "healthy",
    server: "vendor-management-mcp",
    version: "1.0.0",
    connectors: {
      ap: process.env.AP_SYSTEM || "generic",
      contracts: process.env.CONTRACT_SYSTEM || "generic",
      performance: "enabled",
    },
    timestamp: new Date().toISOString(),
  });
});

// SSE endpoint for MCP clients to connect
app.get("/sse", async (req: Request, res: Response) => {
  console.log("New SSE connection");

  const transport = new SSEServerTransport("/messages", res);
  const sessionId = Date.now().toString();
  transports.set(sessionId, transport);

  res.on("close", () => {
    console.log("SSE connection closed");
    transports.delete(sessionId);
  });

  await mcpServer.connect(transport);
});

// Messages endpoint for MCP client requests
app.post("/messages", async (req: Request, res: Response) => {
  const sessionId = req.query.sessionId as string;
  const transport = transports.get(sessionId);

  if (!transport) {
    res.status(400).json({ error: "No active session" });
    return;
  }

  await transport.handlePostMessage(req, res);
});

// Start the server
app.listen(PORT, () => {
  console.log(`Vendor Management MCP server running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(`SSE endpoint: http://localhost:${PORT}/sse`);
  console.log(`AP System: ${process.env.AP_SYSTEM || "generic"}`);
  console.log(`Contract System: ${process.env.CONTRACT_SYSTEM || "generic"}`);
});
