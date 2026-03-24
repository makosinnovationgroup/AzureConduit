import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { initializeZendeskConnector } from './connectors/zendesk';
import { registerTicketTools } from './tools/ticket-tools';
import { registerUserTools } from './tools/user-tools';
import { registerAnalyticsTools } from './tools/analytics-tools';
import logger from './utils/logger';

/**
 * Creates and configures the MCP server for Zendesk integration.
 *
 * Available tools:
 *
 * Ticket Tools:
 * - list_tickets: List tickets with optional filtering
 * - get_ticket: Get ticket details with comments
 * - search_tickets: Search tickets using Zendesk search syntax
 * - get_ticket_metrics: Get SLA and response time metrics
 *
 * User Tools:
 * - list_agents: List all support agents
 * - get_user: Get user details
 * - search_users: Search users by email/name
 *
 * Analytics Tools:
 * - get_ticket_stats: Get ticket counts by status
 * - get_sla_compliance: Get SLA compliance percentages
 * - get_agent_workload: Get tickets per agent distribution
 */
export function createMcpServer(): McpServer {
  // Validate required environment variables
  const subdomain = process.env.ZENDESK_SUBDOMAIN;
  const email = process.env.ZENDESK_EMAIL;
  const apiToken = process.env.ZENDESK_API_TOKEN;

  if (!subdomain || !email || !apiToken) {
    const missing = [];
    if (!subdomain) missing.push('ZENDESK_SUBDOMAIN');
    if (!email) missing.push('ZENDESK_EMAIL');
    if (!apiToken) missing.push('ZENDESK_API_TOKEN');

    logger.error('Missing required environment variables', { missing });
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }

  // Initialize Zendesk connector
  initializeZendeskConnector({
    subdomain,
    email,
    apiToken,
  });

  logger.info('Creating Zendesk MCP server');

  const server = new McpServer({
    name: 'zendesk-mcp',
    version: '1.0.0',
  });

  // Register all tools
  registerTicketTools(server);
  registerUserTools(server);
  registerAnalyticsTools(server);

  logger.info('Zendesk MCP server created with all tools registered');

  return server;
}
