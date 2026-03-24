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
    server: "order-status-mcp",
    version: "1.0.0",
    description: "Cross-system order status aggregator",
    systems: {
      erp: process.env.ERP_TYPE || "generic",
      shipping: process.env.SHIPPING_CARRIER || "generic",
      inventory: process.env.INVENTORY_SYSTEM_TYPE || "generic",
    },
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
  console.log(`Order Status MCP server running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(`SSE endpoint: http://localhost:${PORT}/sse`);
  console.log("");
  console.log("Available tools:");
  console.log("  Order Tools:");
  console.log("    - get_order_status: Complete order status with shipping and tracking");
  console.log("    - search_orders: Search orders with filters");
  console.log("    - get_recent_orders: Recent orders for a customer");
  console.log("    - get_delayed_orders: Orders behind schedule");
  console.log("  Shipping Tools:");
  console.log("    - get_tracking: Tracking details for a shipment");
  console.log("    - get_shipments_in_transit: All shipments currently in transit");
  console.log("    - get_delivery_eta: Estimated delivery for an order");
  console.log("  Inventory Tools:");
  console.log("    - check_availability: Check stock availability for a product");
  console.log("    - get_inventory_levels: Current inventory levels");
  console.log("    - get_low_stock_alerts: Products below reorder point");
});
