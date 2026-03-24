import express, { Request, Response } from 'express';
import dotenv from 'dotenv';

import { logger, runStdioServer } from './server';
import {
  initializeSalesforceConnector,
  getSalesforceConnector,
  SalesforceConfig,
} from './connectors/salesforce';

// Load environment variables
dotenv.config();

const PORT = parseInt(process.env.PORT || '8000', 10);

// Validate required environment variables
function validateEnv(): SalesforceConfig {
  const required = [
    'SF_LOGIN_URL',
    'SF_CLIENT_ID',
    'SF_CLIENT_SECRET',
    'SF_USERNAME',
    'SF_PASSWORD',
  ];

  const missing = required.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }

  return {
    loginUrl: process.env.SF_LOGIN_URL!,
    clientId: process.env.SF_CLIENT_ID!,
    clientSecret: process.env.SF_CLIENT_SECRET!,
    username: process.env.SF_USERNAME!,
    password: process.env.SF_PASSWORD!,
  };
}

async function main(): Promise<void> {
  try {
    // Validate environment and initialize Salesforce connector
    const config = validateEnv();
    const connector = initializeSalesforceConnector(config);

    // Test connection on startup
    await connector.connect();
    logger.info('Salesforce connection established');

    // Create Express app for health checks
    const app = express();

    app.get('/health', async (_req: Request, res: Response) => {
      try {
        const sfConnector = getSalesforceConnector();
        const isConnected = sfConnector.isConnectionActive();

        if (isConnected) {
          res.status(200).json({
            status: 'healthy',
            service: 'salesforce-mcp',
            salesforce: {
              connected: true,
            },
            timestamp: new Date().toISOString(),
          });
        } else {
          res.status(503).json({
            status: 'unhealthy',
            service: 'salesforce-mcp',
            salesforce: {
              connected: false,
            },
            timestamp: new Date().toISOString(),
          });
        }
      } catch (error) {
        logger.error('Health check failed', { error });
        res.status(503).json({
          status: 'unhealthy',
          service: 'salesforce-mcp',
          error: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString(),
        });
      }
    });

    // Start HTTP server for health checks
    app.listen(PORT, () => {
      logger.info(`Health check server listening on port ${PORT}`);
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
  try {
    const connector = getSalesforceConnector();
    await connector.disconnect();
  } catch (error) {
    // Connector may not be initialized
  }
  process.exit(0);
});

process.on('SIGTERM', async () => {
  logger.info('Received SIGTERM, shutting down gracefully');
  try {
    const connector = getSalesforceConnector();
    await connector.disconnect();
  } catch (error) {
    // Connector may not be initialized
  }
  process.exit(0);
});

main();
