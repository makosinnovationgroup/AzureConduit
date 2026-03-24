import express, { Request, Response } from "express";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import winston from "winston";
import * as dotenv from "dotenv";
import { createMcpServer, getConfigSummary } from "./server";
import { createRestClientFromEnv } from "./connectors/rest-client";

// Load environment variables
dotenv.config();

// Configure logger
export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || "info",
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.printf(({ level, message, timestamp, stack }) => {
      if (stack) {
        return `${timestamp} [${level.toUpperCase()}]: ${message}\n${stack}`;
      }
      return `${timestamp} [${level.toUpperCase()}]: ${message}`;
    })
  ),
  transports: [new winston.transports.Console()],
});

// Create Express app
const app = express();
app.use(express.json());

// Store active transports for cleanup
const activeTransports = new Map<string, SSEServerTransport>();

// Health check endpoint
app.get("/health", (_req: Request, res: Response) => {
  let restClientConfig: Record<string, unknown> | null = null;

  try {
    const restClient = createRestClientFromEnv();
    restClientConfig = getConfigSummary(restClient);
  } catch (error) {
    // REST client not configured, that's okay for health check
    logger.debug("REST client not configured:", error);
  }

  res.json({
    status: "healthy",
    service: "rest-api-mcp",
    version: "1.0.0",
    timestamp: new Date().toISOString(),
    activeConnections: activeTransports.size,
    restClientConfigured: restClientConfig !== null,
    restClientConfig,
  });
});

// SSE endpoint for MCP communication
app.get("/sse", async (req: Request, res: Response) => {
  logger.info("New SSE connection request");

  try {
    // Create REST client and MCP server
    const restClient = createRestClientFromEnv();
    const mcpServer = createMcpServer(restClient);

    // Create SSE transport
    const transport = new SSEServerTransport("/messages", res);
    const sessionId = `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    activeTransports.set(sessionId, transport);

    logger.info(`SSE session started: ${sessionId}`);
    logger.info(`REST client config: ${JSON.stringify(getConfigSummary(restClient))}`);

    // Handle connection close
    res.on("close", () => {
      logger.info(`SSE session closed: ${sessionId}`);
      activeTransports.delete(sessionId);
    });

    // Connect server to transport
    await mcpServer.connect(transport);
  } catch (error) {
    logger.error("Error establishing SSE connection:", error);
    if (!res.headersSent) {
      res.status(500).json({
        error: "Failed to establish SSE connection",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }
});

// Messages endpoint for SSE transport
app.post("/messages", async (req: Request, res: Response) => {
  const sessionId = req.query.sessionId as string;
  logger.debug(`Received message for session: ${sessionId || "unknown"}`);

  // Find the transport by iterating (since we might not have exact session ID)
  // In production, you'd want a more robust session management
  if (activeTransports.size === 0) {
    res.status(400).json({ error: "No active SSE sessions" });
    return;
  }

  // For simplicity, send to the most recent transport
  // In production, implement proper session routing
  const transport = Array.from(activeTransports.values()).pop();
  if (transport) {
    try {
      await transport.handlePostMessage(req, res);
    } catch (error) {
      logger.error("Error handling message:", error);
      if (!res.headersSent) {
        res.status(500).json({ error: "Failed to handle message" });
      }
    }
  } else {
    res.status(400).json({ error: "No active transport found" });
  }
});

// Configuration info endpoint (for debugging)
app.get("/config", (_req: Request, res: Response) => {
  try {
    const restClient = createRestClientFromEnv();
    res.json(getConfigSummary(restClient));
  } catch (error) {
    res.status(500).json({
      error: "Failed to load configuration",
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

// Start server
const PORT = parseInt(process.env.PORT || "8000", 10);

app.listen(PORT, () => {
  logger.info(`REST API MCP Server running on port ${PORT}`);
  logger.info(`Health check: http://localhost:${PORT}/health`);
  logger.info(`SSE endpoint: http://localhost:${PORT}/sse`);
  logger.info(`Config endpoint: http://localhost:${PORT}/config`);
});
