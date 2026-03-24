import 'dotenv/config';
import express, { Request, Response } from 'express';
import logger from './utils/logger';
import { createMcpServer } from './server';
import { getFinanceConnector, resetFinanceConnector } from './connectors/finance';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';

const app = express();
const PORT = parseInt(process.env.PORT || '8000', 10);

// Middleware
app.use(express.json());

// Health check endpoint
app.get('/health', async (_req: Request, res: Response) => {
  try {
    const connector = getFinanceConnector();
    const config = connector.getConfig();

    const health = {
      status: 'healthy',
      service: 'finance-dashboard-mcp',
      timestamp: new Date().toISOString(),
      finance: {
        systemType: config.systemType,
        connected: connector.isInitialized(),
        currency: config.defaultCurrency
      },
      tools: {
        kpi: ['get_financial_summary', 'get_kpi_dashboard', 'compare_periods'],
        ar: ['get_ar_summary', 'get_ar_aging', 'get_top_receivables', 'get_collection_forecast'],
        ap: ['get_ap_summary', 'get_ap_aging', 'get_upcoming_payments'],
        cash: ['get_cash_position', 'get_cash_flow_forecast', 'get_cash_runway'],
        budget: ['get_budget_vs_actual', 'get_variance_report', 'get_department_spending'],
        revenue: ['get_revenue_trend', 'get_revenue_by_segment', 'get_mrr']
      }
    };

    // Try to verify connector is working
    if (!connector.isInitialized()) {
      health.status = 'degraded';
      health.finance.connected = false;
    }

    res.status(health.status === 'healthy' ? 200 : 503).json(health);
  } catch (error) {
    logger.error('Health check failed', { error });
    res.status(503).json({
      status: 'unhealthy',
      service: 'finance-dashboard-mcp',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// SSE endpoint for MCP communication
app.get('/sse', async (req: Request, res: Response) => {
  logger.info('SSE connection established');

  const transport = new SSEServerTransport('/messages', res);
  const server = createMcpServer();

  // Initialize finance connector
  try {
    const connector = getFinanceConnector();
    if (!connector.isInitialized()) {
      await connector.initialize();
    }
  } catch (error) {
    logger.error('Failed to initialize finance connector', { error });
    // Continue anyway - mock data will be used
  }

  await server.connect(transport);

  req.on('close', () => {
    logger.info('SSE connection closed');
  });
});

// Messages endpoint for SSE transport
app.post('/messages', async (req: Request, res: Response) => {
  // This endpoint is used by SSE transport for receiving messages
  // The actual handling is done by the SSE transport
  res.status(200).send('OK');
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('Received SIGTERM, shutting down gracefully');
  resetFinanceConnector();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('Received SIGINT, shutting down gracefully');
  resetFinanceConnector();
  process.exit(0);
});

// Start server
app.listen(PORT, () => {
  logger.info(`Finance Dashboard MCP server listening on port ${PORT}`, {
    port: PORT,
    healthEndpoint: `http://localhost:${PORT}/health`,
    sseEndpoint: `http://localhost:${PORT}/sse`
  });
});

export default app;
