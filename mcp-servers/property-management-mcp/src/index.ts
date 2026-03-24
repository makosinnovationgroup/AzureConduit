import express, { Request, Response } from 'express';
import { createMcpServer } from './server.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { logger } from './server.js';

const PORT = process.env.PORT || 8000;

const app = express();
app.use(express.json());

// Create the MCP server
const mcpServer = createMcpServer();

// Store active transports for cleanup
const transports: Map<string, SSEServerTransport> = new Map();

// Health check endpoint
app.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    server: 'property-management-mcp',
    timestamp: new Date().toISOString(),
    tools: [
      'list_properties',
      'get_property',
      'get_property_financials',
      'get_vacancy_report',
      'list_leases',
      'get_lease',
      'get_expiring_leases',
      'get_lease_renewals',
      'list_tenants',
      'get_tenant',
      'get_delinquent_tenants',
      'search_tenants',
      'list_work_orders',
      'get_work_order',
      'get_open_maintenance',
      'get_maintenance_costs',
      'get_rent_roll',
      'get_income_statement',
      'get_collections_report',
    ],
  });
});

// SSE endpoint for MCP clients to connect
app.get('/sse', async (req: Request, res: Response) => {
  logger.info('New SSE connection');

  const transport = new SSEServerTransport('/messages', res);
  const sessionId = Date.now().toString();
  transports.set(sessionId, transport);

  res.on('close', () => {
    logger.info('SSE connection closed', { sessionId });
    transports.delete(sessionId);
  });

  await mcpServer.connect(transport);
});

// Messages endpoint for MCP client requests
app.post('/messages', async (req: Request, res: Response) => {
  const sessionId = req.query.sessionId as string;
  const transport = transports.get(sessionId);

  if (!transport) {
    res.status(400).json({ error: 'No active session' });
    return;
  }

  await transport.handlePostMessage(req, res);
});

// Start the server
app.listen(PORT, () => {
  logger.info(`Property Management MCP server running on port ${PORT}`);
  logger.info(`Health check: http://localhost:${PORT}/health`);
  logger.info(`SSE endpoint: http://localhost:${PORT}/sse`);
  logger.info('Demo mode: ' + (process.env.DEMO_MODE === 'true' ? 'enabled' : 'disabled'));
});
