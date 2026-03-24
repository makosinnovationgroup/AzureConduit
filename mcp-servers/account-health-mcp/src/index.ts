/**
 * Account Health MCP Server - Entry Point
 *
 * This is a cross-system aggregator MCP server that combines data from multiple
 * enterprise systems (CRM, Finance, Support) to provide unified account health insights.
 *
 * Architecture:
 * - HTTP server with SSE transport for MCP protocol
 * - Modular connectors for each data source type
 * - Centralized health calculation service
 * - Tool modules for different insight categories
 */

import express, { Request, Response } from "express";
import { createMcpServer, getConnectorStatus } from "./server.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";

const PORT = process.env.PORT || 8000;

async function main(): Promise<void> {
  console.log("=".repeat(60));
  console.log("Account Health MCP Server");
  console.log("Cross-System Data Aggregator for Account Intelligence");
  console.log("=".repeat(60));

  const app = express();
  app.use(express.json());

  // Create the MCP server (this also initializes connectors)
  console.log("\n[Startup] Initializing MCP server and connectors...");
  const mcpServer = await createMcpServer();

  // Store active transports for cleanup
  const transports: Map<string, SSEServerTransport> = new Map();

  // ==========================================================================
  // Health check endpoint
  // ==========================================================================
  app.get("/health", (_req: Request, res: Response) => {
    const status = getConnectorStatus();

    const healthStatus = {
      status: "healthy",
      server: "account-health-mcp",
      version: "1.0.0",
      timestamp: new Date().toISOString(),
      connectors: {
        crm: {
          provider: status.crm.provider,
          connected: status.crm.connected,
        },
        finance: {
          provider: status.finance.provider,
          connected: status.finance.connected,
        },
        support: {
          provider: status.support.provider,
          connected: status.support.connected,
        },
      },
      active_sessions: transports.size,
    };

    res.json(healthStatus);
  });

  // ==========================================================================
  // Detailed status endpoint
  // ==========================================================================
  app.get("/status", (_req: Request, res: Response) => {
    const status = getConnectorStatus();

    const detailedStatus = {
      server: {
        name: "account-health-mcp",
        version: "1.0.0",
        uptime_seconds: process.uptime(),
        timestamp: new Date().toISOString(),
      },
      connectors: status,
      capabilities: {
        health_scoring: {
          enabled:
            status.crm.connected ||
            status.finance.connected ||
            status.support.connected,
          description:
            "Calculate comprehensive account health scores from multiple data sources",
        },
        revenue_analysis: {
          enabled: status.finance.connected,
          description: "Analyze revenue trends and financial health",
        },
        engagement_tracking: {
          enabled: status.crm.connected || status.support.connected,
          description:
            "Track customer engagement across CRM and support channels",
        },
        support_metrics: {
          enabled: status.support.connected,
          description:
            "Analyze support ticket patterns and customer satisfaction",
        },
      },
      tools: [
        {
          name: "get_account_health",
          category: "health",
          description: "Get comprehensive health score for an account",
        },
        {
          name: "get_top_accounts_health",
          category: "health",
          description: "Get health summary for top accounts by revenue",
        },
        {
          name: "get_at_risk_accounts",
          category: "health",
          description: "Identify accounts with declining health scores",
        },
        {
          name: "get_health_factors",
          category: "health",
          description: "Explain factors contributing to health score",
        },
        {
          name: "get_account_revenue",
          category: "revenue",
          description: "Get revenue history for an account",
        },
        {
          name: "get_revenue_trend",
          category: "revenue",
          description: "Compare revenue between time periods",
        },
        {
          name: "get_account_activity",
          category: "engagement",
          description: "Get recent activity across all systems",
        },
        {
          name: "get_last_contact",
          category: "engagement",
          description: "Find when account was last contacted",
        },
        {
          name: "get_connector_status",
          category: "system",
          description: "Check data source connection status",
        },
      ],
      active_sessions: transports.size,
    };

    res.json(detailedStatus);
  });

  // ==========================================================================
  // SSE endpoint for MCP clients to connect
  // ==========================================================================
  app.get("/sse", async (req: Request, res: Response) => {
    console.log("[HTTP] New SSE connection request");

    const transport = new SSEServerTransport("/messages", res);
    const sessionId = Date.now().toString();
    transports.set(sessionId, transport);

    console.log(`[HTTP] SSE session created: ${sessionId}`);

    res.on("close", () => {
      console.log(`[HTTP] SSE connection closed: ${sessionId}`);
      transports.delete(sessionId);
    });

    await mcpServer.connect(transport);
  });

  // ==========================================================================
  // Messages endpoint for MCP client requests
  // ==========================================================================
  app.post("/messages", async (req: Request, res: Response) => {
    const sessionId = req.query.sessionId as string;
    const transport = transports.get(sessionId);

    if (!transport) {
      console.warn(`[HTTP] Message received for unknown session: ${sessionId}`);
      res.status(400).json({ error: "No active session" });
      return;
    }

    await transport.handlePostMessage(req, res);
  });

  // ==========================================================================
  // Start the server
  // ==========================================================================
  app.listen(PORT, () => {
    console.log("\n" + "=".repeat(60));
    console.log(`Server started successfully!`);
    console.log("=".repeat(60));
    console.log(`\nEndpoints:`);
    console.log(`  Health check:  http://localhost:${PORT}/health`);
    console.log(`  Status:        http://localhost:${PORT}/status`);
    console.log(`  SSE (MCP):     http://localhost:${PORT}/sse`);
    console.log(`\nData Sources:`);

    const status = getConnectorStatus();
    console.log(
      `  CRM:     ${status.crm.provider} - ${status.crm.connected ? "Connected" : "Not connected"}`
    );
    console.log(
      `  Finance: ${status.finance.provider} - ${status.finance.connected ? "Connected" : "Not connected"}`
    );
    console.log(
      `  Support: ${status.support.provider} - ${status.support.connected ? "Connected" : "Not connected"}`
    );

    console.log("\n" + "=".repeat(60));
    console.log("Ready to provide account health insights!");
    console.log("=".repeat(60) + "\n");
  });
}

// Handle uncaught errors
process.on("uncaughtException", (error) => {
  console.error("[Fatal] Uncaught exception:", error);
  process.exit(1);
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("[Fatal] Unhandled rejection at:", promise, "reason:", reason);
  process.exit(1);
});

// Start the server
main().catch((error) => {
  console.error("[Fatal] Failed to start server:", error);
  process.exit(1);
});
