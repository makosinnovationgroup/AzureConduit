import 'dotenv/config';
import express, { Request, Response } from 'express';
import logger from './utils/logger';
import { createMcpServer } from './server';
import { getConnector, resetConnector } from './connectors/sql';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';

const app = express();
const PORT = parseInt(process.env.PORT || '8000', 10);

// Middleware
app.use(express.json());

// Health check endpoint
app.get('/health', async (_req: Request, res: Response) => {
  try {
    const connector = getConnector();
    const config = connector.getConfig();

    const health = {
      status: 'healthy',
      service: 'sql-database-mcp',
      timestamp: new Date().toISOString(),
      database: {
        type: config.type,
        host: config.host,
        database: config.database,
        connected: connector.isInitialized()
      }
    };

    // Try to ping the database if connected
    if (connector.isInitialized()) {
      try {
        await connector.query('SELECT 1');
        health.database.connected = true;
      } catch {
        health.database.connected = false;
        health.status = 'degraded';
      }
    }

    res.status(health.status === 'healthy' ? 200 : 503).json(health);
  } catch (error) {
    logger.error('Health check failed', { error });
    res.status(503).json({
      status: 'unhealthy',
      service: 'sql-database-mcp',
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

  // Initialize database connection
  try {
    const connector = getConnector();
    if (!connector.isInitialized()) {
      await connector.initialize();
    }
  } catch (error) {
    logger.error('Failed to initialize database connection', { error });
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
  resetConnector();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('Received SIGINT, shutting down gracefully');
  resetConnector();
  process.exit(0);
});

// Start server
app.listen(PORT, () => {
  logger.info(`SQL Database MCP server listening on port ${PORT}`, {
    port: PORT,
    healthEndpoint: `http://localhost:${PORT}/health`,
    sseEndpoint: `http://localhost:${PORT}/sse`
  });
});

export default app;
