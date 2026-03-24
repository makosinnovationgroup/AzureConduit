import 'dotenv/config';
import express, { Request, Response } from 'express';
import { createLogger, format, transports } from 'winston';
import { getJiraClient, resetJiraClient } from './connectors/jira';
import { createMcpServer, runStdioServer } from './server';

const logger = createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: format.combine(
    format.timestamp(),
    format.json()
  ),
  transports: [new transports.Console()]
});

const PORT = parseInt(process.env.PORT || '8000', 10);

async function startHttpServer(): Promise<void> {
  const app = express();

  app.use(express.json());

  // Health check endpoint
  app.get('/health', async (req: Request, res: Response) => {
    try {
      const client = getJiraClient();
      const isHealthy = await client.healthCheck();

      if (isHealthy) {
        res.status(200).json({
          status: 'healthy',
          service: 'jira-mcp',
          timestamp: new Date().toISOString(),
          jira: {
            connected: true,
            host: process.env.JIRA_HOST
          }
        });
      } else {
        res.status(503).json({
          status: 'unhealthy',
          service: 'jira-mcp',
          timestamp: new Date().toISOString(),
          jira: {
            connected: false,
            host: process.env.JIRA_HOST
          },
          error: 'Failed to connect to Jira'
        });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('Health check failed', { error: errorMessage });

      res.status(503).json({
        status: 'unhealthy',
        service: 'jira-mcp',
        timestamp: new Date().toISOString(),
        jira: {
          connected: false,
          host: process.env.JIRA_HOST || 'not configured'
        },
        error: errorMessage
      });
    }
  });

  // Readiness check (for Kubernetes)
  app.get('/ready', async (req: Request, res: Response) => {
    try {
      const client = getJiraClient();
      const isReady = await client.healthCheck();

      if (isReady) {
        res.status(200).json({ ready: true });
      } else {
        res.status(503).json({ ready: false, reason: 'Jira connection failed' });
      }
    } catch (error) {
      res.status(503).json({ ready: false, reason: 'Configuration error' });
    }
  });

  // Liveness check (for Kubernetes)
  app.get('/live', (req: Request, res: Response) => {
    res.status(200).json({ alive: true });
  });

  // Server info endpoint
  app.get('/info', (req: Request, res: Response) => {
    res.json({
      name: 'jira-mcp',
      version: '1.0.0',
      description: 'MCP server for Jira Cloud API integration',
      tools: [
        'list_issues',
        'get_issue',
        'search_issues',
        'get_my_issues',
        'list_projects',
        'get_project',
        'get_project_stats',
        'list_sprints',
        'get_sprint',
        'get_active_sprint',
        'get_sprint_burndown'
      ]
    });
  });

  app.listen(PORT, () => {
    logger.info(`HTTP server listening on port ${PORT}`);
    logger.info(`Health check available at http://localhost:${PORT}/health`);
  });
}

async function main(): Promise<void> {
  logger.info('Starting Jira MCP server');

  // Validate required environment variables
  const requiredEnvVars = ['JIRA_HOST', 'JIRA_EMAIL', 'JIRA_API_TOKEN'];
  const missingVars = requiredEnvVars.filter(v => !process.env[v]);

  if (missingVars.length > 0) {
    logger.error('Missing required environment variables', { missing: missingVars });
    console.error(`Error: Missing required environment variables: ${missingVars.join(', ')}`);
    console.error('Please set these variables in your .env file or environment.');
    process.exit(1);
  }

  // Check if running in stdio mode (for MCP client connections)
  const isStdioMode = process.argv.includes('--stdio');

  if (isStdioMode) {
    logger.info('Running in stdio mode for MCP client connections');
    await runStdioServer();
  } else {
    // Start HTTP server for health checks and monitoring
    await startHttpServer();

    logger.info('Jira MCP server started successfully');
    logger.info('Use --stdio flag to run in MCP stdio mode');
  }
}

// Handle graceful shutdown
process.on('SIGTERM', () => {
  logger.info('Received SIGTERM, shutting down gracefully');
  resetJiraClient();
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('Received SIGINT, shutting down gracefully');
  resetJiraClient();
  process.exit(0);
});

main().catch((error) => {
  logger.error('Failed to start server', { error: error.message });
  console.error('Failed to start server:', error);
  process.exit(1);
});
