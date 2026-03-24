import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { initializeHubSpotConnector } from './connectors/hubspot';
import { registerContactTools } from './tools/contact-tools';
import { registerDealTools } from './tools/deal-tools';
import { registerCompanyTools } from './tools/company-tools';
import { registerMarketingTools } from './tools/marketing-tools';
import logger from './utils/logger';

/**
 * Creates and configures the MCP server with HubSpot CRM and Marketing tools
 */
export function createMcpServer(): McpServer {
  // Validate required environment variables
  const accessToken = process.env.HUBSPOT_ACCESS_TOKEN;
  if (!accessToken) {
    throw new Error('HUBSPOT_ACCESS_TOKEN environment variable is required');
  }

  // Initialize HubSpot connector
  initializeHubSpotConnector({ accessToken });
  logger.info('HubSpot connector initialized');

  // Create MCP server
  const server = new McpServer({
    name: 'hubspot-mcp',
    version: '1.0.0',
  });

  // Register all tools
  registerContactTools(server);
  registerDealTools(server);
  registerCompanyTools(server);
  registerMarketingTools(server);

  logger.info('HubSpot MCP server created with all tools registered');

  return server;
}
