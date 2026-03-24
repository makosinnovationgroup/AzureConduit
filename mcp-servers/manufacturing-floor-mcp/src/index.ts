import 'dotenv/config';
import express, { Request, Response } from 'express';
import logger from './utils/logger';
import { createMcpServer } from './server';
import { getMESConnector, resetMESConnector } from './connectors/mes';
import { getERPConnector, resetERPConnector } from './connectors/erp';
import { getQualityConnector, resetQualityConnector } from './connectors/quality';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';

const app = express();
const PORT = parseInt(process.env.PORT || '8000', 10);

// Middleware
app.use(express.json());

// Health check endpoint
app.get('/health', async (_req: Request, res: Response) => {
  try {
    const mesConnector = getMESConnector();
    const erpConnector = getERPConnector();
    const qualityConnector = getQualityConnector();

    const health = {
      status: 'healthy',
      service: 'manufacturing-floor-mcp',
      timestamp: new Date().toISOString(),
      connectors: {
        mes: {
          initialized: mesConnector.isInitialized(),
          config: mesConnector.getConfig()
        },
        erp: {
          initialized: erpConnector.isInitialized(),
          config: erpConnector.getConfig()
        },
        quality: {
          initialized: qualityConnector.isInitialized(),
          config: qualityConnector.getConfig()
        }
      }
    };

    // Check if any connector is not initialized
    const allConnected = mesConnector.isInitialized() &&
                         erpConnector.isInitialized() &&
                         qualityConnector.isInitialized();

    if (!allConnected) {
      health.status = 'degraded';
    }

    res.status(health.status === 'healthy' ? 200 : 503).json(health);
  } catch (error) {
    logger.error('Health check failed', { error });
    res.status(503).json({
      status: 'unhealthy',
      service: 'manufacturing-floor-mcp',
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

  // Initialize connectors
  try {
    const mesConnector = getMESConnector();
    if (!mesConnector.isInitialized()) {
      await mesConnector.initialize();
    }
  } catch (error) {
    logger.error('Failed to initialize MES connection', { error });
  }

  try {
    const erpConnector = getERPConnector();
    if (!erpConnector.isInitialized()) {
      await erpConnector.initialize();
    }
  } catch (error) {
    logger.error('Failed to initialize ERP connection', { error });
  }

  try {
    const qualityConnector = getQualityConnector();
    if (!qualityConnector.isInitialized()) {
      await qualityConnector.initialize();
    }
  } catch (error) {
    logger.error('Failed to initialize Quality system connection', { error });
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
function cleanup() {
  logger.info('Shutting down gracefully');
  resetMESConnector();
  resetERPConnector();
  resetQualityConnector();
}

process.on('SIGTERM', () => {
  logger.info('Received SIGTERM');
  cleanup();
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('Received SIGINT');
  cleanup();
  process.exit(0);
});

// Start server
app.listen(PORT, () => {
  logger.info(`Manufacturing Floor MCP server listening on port ${PORT}`, {
    port: PORT,
    healthEndpoint: `http://localhost:${PORT}/health`,
    sseEndpoint: `http://localhost:${PORT}/sse`
  });
});

export default app;
