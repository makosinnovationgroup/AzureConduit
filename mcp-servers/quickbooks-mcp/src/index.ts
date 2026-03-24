import express, { Request, Response } from 'express';
import dotenv from 'dotenv';
import { logger, startMCPServer } from './server';
import { initializeQuickBooksClient } from './connectors/quickbooks';

// Load environment variables
dotenv.config();

const PORT = parseInt(process.env.PORT || '8000', 10);

async function main(): Promise<void> {
  // Create Express app for health checks
  const app = express();

  // Health check endpoint
  app.get('/health', (_req: Request, res: Response) => {
    res.json({
      status: 'healthy',
      service: 'quickbooks-mcp',
      timestamp: new Date().toISOString(),
      version: '1.0.0'
    });
  });

  // Readiness check - verifies QuickBooks connection is configured
  app.get('/ready', (_req: Request, res: Response) => {
    const hasConfig = !!(
      process.env.QB_CLIENT_ID &&
      process.env.QB_CLIENT_SECRET &&
      process.env.QB_REALM_ID &&
      process.env.QB_REFRESH_TOKEN
    );

    if (hasConfig) {
      res.json({
        status: 'ready',
        quickbooks: 'configured'
      });
    } else {
      res.status(503).json({
        status: 'not ready',
        quickbooks: 'missing configuration',
        required: ['QB_CLIENT_ID', 'QB_CLIENT_SECRET', 'QB_REALM_ID', 'QB_REFRESH_TOKEN']
      });
    }
  });

  // Start HTTP server
  const httpServer = app.listen(PORT, () => {
    logger.info(`HTTP server listening on port ${PORT}`);
    logger.info(`Health check available at http://localhost:${PORT}/health`);
  });

  // Handle graceful shutdown
  const shutdown = async () => {
    logger.info('Shutting down...');
    httpServer.close(() => {
      logger.info('HTTP server closed');
      process.exit(0);
    });
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);

  // Start MCP server (stdio transport)
  try {
    // Pre-initialize the QuickBooks client if config is available
    if (process.env.QB_CLIENT_ID && process.env.QB_CLIENT_SECRET) {
      initializeQuickBooksClient();
    }

    await startMCPServer();
  } catch (error) {
    logger.error('Failed to start MCP server', { error });
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
