import express, { Request, Response } from 'express';
import dotenv from 'dotenv';

import { logger, runStdioServer } from './server';
import {
  initializeCrmConnector,
  getCrmConnector,
  CrmConfig,
  CrmProvider,
} from './connectors/crm';

// Load environment variables
dotenv.config();

const PORT = parseInt(process.env.PORT || '8000', 10);

// Validate required environment variables based on provider
function validateEnv(): CrmConfig {
  const provider = (process.env.CRM_PROVIDER || 'salesforce') as CrmProvider;

  const config: CrmConfig = { provider };

  switch (provider) {
    case 'salesforce': {
      const required = [
        'SF_LOGIN_URL',
        'SF_CLIENT_ID',
        'SF_CLIENT_SECRET',
        'SF_USERNAME',
        'SF_PASSWORD',
      ];

      const missing = required.filter((key) => !process.env[key]);
      if (missing.length > 0) {
        throw new Error(`Missing required Salesforce environment variables: ${missing.join(', ')}`);
      }

      config.salesforce = {
        loginUrl: process.env.SF_LOGIN_URL!,
        clientId: process.env.SF_CLIENT_ID!,
        clientSecret: process.env.SF_CLIENT_SECRET!,
        username: process.env.SF_USERNAME!,
        password: process.env.SF_PASSWORD!,
      };
      break;
    }

    case 'd365': {
      const required = [
        'D365_TENANT_ID',
        'D365_CLIENT_ID',
        'D365_CLIENT_SECRET',
        'D365_RESOURCE_URL',
      ];

      const missing = required.filter((key) => !process.env[key]);
      if (missing.length > 0) {
        throw new Error(`Missing required D365 environment variables: ${missing.join(', ')}`);
      }

      config.d365 = {
        tenantId: process.env.D365_TENANT_ID!,
        clientId: process.env.D365_CLIENT_ID!,
        clientSecret: process.env.D365_CLIENT_SECRET!,
        resourceUrl: process.env.D365_RESOURCE_URL!,
      };
      break;
    }

    case 'generic': {
      const required = ['GENERIC_API_BASE_URL', 'GENERIC_API_KEY'];

      const missing = required.filter((key) => !process.env[key]);
      if (missing.length > 0) {
        throw new Error(`Missing required Generic CRM environment variables: ${missing.join(', ')}`);
      }

      config.generic = {
        apiBaseUrl: process.env.GENERIC_API_BASE_URL!,
        apiKey: process.env.GENERIC_API_KEY!,
        apiSecret: process.env.GENERIC_API_SECRET || '',
      };
      break;
    }

    default:
      throw new Error(`Unknown CRM provider: ${provider}`);
  }

  return config;
}

async function main(): Promise<void> {
  try {
    // Validate environment and initialize CRM connector
    const config = validateEnv();
    const connector = initializeCrmConnector(config);

    // Test connection on startup
    await connector.connect();
    logger.info('CRM connection established', { provider: config.provider });

    // Create Express app for health checks
    const app = express();

    app.get('/health', async (_req: Request, res: Response) => {
      try {
        const crmConnector = getCrmConnector();
        const isConnected = crmConnector.isConnectionActive();

        if (isConnected) {
          res.status(200).json({
            status: 'healthy',
            service: 'sales-pipeline-mcp',
            crm: {
              provider: config.provider,
              connected: true,
            },
            timestamp: new Date().toISOString(),
          });
        } else {
          res.status(503).json({
            status: 'unhealthy',
            service: 'sales-pipeline-mcp',
            crm: {
              provider: config.provider,
              connected: false,
            },
            timestamp: new Date().toISOString(),
          });
        }
      } catch (error) {
        logger.error('Health check failed', { error });
        res.status(503).json({
          status: 'unhealthy',
          service: 'sales-pipeline-mcp',
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
    const connector = getCrmConnector();
    await connector.disconnect();
  } catch (error) {
    // Connector may not be initialized
  }
  process.exit(0);
});

process.on('SIGTERM', async () => {
  logger.info('Received SIGTERM, shutting down gracefully');
  try {
    const connector = getCrmConnector();
    await connector.disconnect();
  } catch (error) {
    // Connector may not be initialized
  }
  process.exit(0);
});

main();
