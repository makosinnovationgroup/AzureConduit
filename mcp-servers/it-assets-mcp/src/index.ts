import express, { Request, Response } from 'express';
import dotenv from 'dotenv';

import { logger, runStdioServer } from './server';
import {
  initializeIntuneConnector,
  getIntuneConnector,
  IntuneConfig,
} from './connectors/intune';
import {
  initializeEntraConnector,
  getEntraConnector,
  EntraConfig,
} from './connectors/entra';

// Load environment variables
dotenv.config();

const PORT = parseInt(process.env.PORT || '8000', 10);

// Shared Azure config for both connectors
interface AzureConfig {
  tenantId: string;
  clientId: string;
  clientSecret: string;
}

// Validate required environment variables
function validateEnv(): AzureConfig {
  const required = ['AZURE_TENANT_ID', 'AZURE_CLIENT_ID', 'AZURE_CLIENT_SECRET'];

  const missing = required.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }

  return {
    tenantId: process.env.AZURE_TENANT_ID!,
    clientId: process.env.AZURE_CLIENT_ID!,
    clientSecret: process.env.AZURE_CLIENT_SECRET!,
  };
}

async function main(): Promise<void> {
  try {
    // Validate environment and get config
    const config = validateEnv();

    // Initialize Intune connector
    const intuneConfig: IntuneConfig = {
      tenantId: config.tenantId,
      clientId: config.clientId,
      clientSecret: config.clientSecret,
    };
    const intuneConnector = initializeIntuneConnector(intuneConfig);

    // Initialize Entra ID connector
    const entraConfig: EntraConfig = {
      tenantId: config.tenantId,
      clientId: config.clientId,
      clientSecret: config.clientSecret,
    };
    const entraConnector = initializeEntraConnector(entraConfig);

    // Test connections on startup
    await intuneConnector.connect();
    logger.info('Intune connection established');

    await entraConnector.connect();
    logger.info('Entra ID connection established');

    // Create Express app for health checks
    const app = express();

    app.get('/health', async (_req: Request, res: Response) => {
      try {
        const intuneConnected = getIntuneConnector().isConnectionActive();
        const entraConnected = getEntraConnector().isConnectionActive();

        if (intuneConnected && entraConnected) {
          res.status(200).json({
            status: 'healthy',
            service: 'it-assets-mcp',
            connections: {
              intune: { connected: true },
              entra: { connected: true },
            },
            timestamp: new Date().toISOString(),
          });
        } else {
          res.status(503).json({
            status: 'unhealthy',
            service: 'it-assets-mcp',
            connections: {
              intune: { connected: intuneConnected },
              entra: { connected: entraConnected },
            },
            timestamp: new Date().toISOString(),
          });
        }
      } catch (error) {
        logger.error('Health check failed', { error });
        res.status(503).json({
          status: 'unhealthy',
          service: 'it-assets-mcp',
          error: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString(),
        });
      }
    });

    // Readiness endpoint - checks if connectors can make API calls
    app.get('/ready', async (_req: Request, res: Response) => {
      try {
        const intuneConnector = getIntuneConnector();
        const entraConnector = getEntraConnector();

        // Test Intune connection
        await intuneConnector.getClient();

        // Test Entra connection
        await entraConnector.getClient();

        res.status(200).json({
          status: 'ready',
          service: 'it-assets-mcp',
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        logger.error('Readiness check failed', { error });
        res.status(503).json({
          status: 'not ready',
          service: 'it-assets-mcp',
          error: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString(),
        });
      }
    });

    // Start HTTP server for health checks
    app.listen(PORT, () => {
      logger.info(`Health check server listening on port ${PORT}`);
      logger.info(`Health endpoint: http://localhost:${PORT}/health`);
      logger.info(`Readiness endpoint: http://localhost:${PORT}/ready`);
    });

    // Start MCP server on stdio
    await runStdioServer();
  } catch (error) {
    logger.error('Failed to start server', { error });
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  logger.info('Received SIGINT, shutting down gracefully');
  process.exit(0);
});

process.on('SIGTERM', async () => {
  logger.info('Received SIGTERM, shutting down gracefully');
  process.exit(0);
});

main();
