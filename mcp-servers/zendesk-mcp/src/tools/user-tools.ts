import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { getZendeskConnector } from '../connectors/zendesk';
import logger from '../utils/logger';

export function registerUserTools(server: McpServer): void {
  // Tool: list_agents
  server.tool(
    'list_agents',
    'List all support agents and admins in Zendesk who can handle tickets',
    {},
    async () => {
      try {
        logger.info('Executing list_agents tool');
        const connector = getZendeskConnector();

        const agents = await connector.listAgents();

        const formattedAgents = agents.map((agent) => ({
          id: agent.id,
          name: agent.name,
          email: agent.email,
          role: agent.role,
          active: agent.active,
          verified: agent.verified,
          created_at: agent.created_at,
        }));

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  agents: formattedAgents,
                  total_count: formattedAgents.length,
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (error) {
        logger.error('Error in list_agents', { error });
        return {
          content: [
            {
              type: 'text',
              text: `Error listing agents: ${error instanceof Error ? error.message : 'Unknown error'}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  // Tool: get_user
  server.tool(
    'get_user',
    'Get detailed information about a specific Zendesk user (can be an agent, admin, or end-user)',
    {
      user_id: z.number().describe('The ID of the user to retrieve'),
    },
    async ({ user_id }) => {
      try {
        logger.info('Executing get_user tool', { user_id });
        const connector = getZendeskConnector();

        const user = await connector.getUser(user_id);

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  user: {
                    id: user.id,
                    name: user.name,
                    email: user.email,
                    role: user.role,
                    active: user.active,
                    verified: user.verified,
                    suspended: user.suspended,
                    phone: user.phone,
                    organization_id: user.organization_id,
                    tags: user.tags,
                    created_at: user.created_at,
                    updated_at: user.updated_at,
                  },
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (error) {
        logger.error('Error in get_user', { error });
        return {
          content: [
            {
              type: 'text',
              text: `Error getting user: ${error instanceof Error ? error.message : 'Unknown error'}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  // Tool: search_users
  server.tool(
    'search_users',
    'Search Zendesk users by email, name, or other criteria using Zendesk search syntax',
    {
      query: z
        .string()
        .describe(
          'Search query. Can be an email address, name, or Zendesk search syntax (e.g., "email:john@example.com", "role:agent")'
        ),
      per_page: z
        .number()
        .min(1)
        .max(100)
        .optional()
        .describe('Number of results to return (default: 25, max: 100)'),
    },
    async ({ query, per_page }) => {
      try {
        logger.info('Executing search_users tool', { query });
        const connector = getZendeskConnector();

        const result = await connector.searchUsers(query, per_page || 25);

        const formattedUsers = result.results.map((user) => ({
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          active: user.active,
          verified: user.verified,
          organization_id: user.organization_id,
        }));

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  users: formattedUsers,
                  total_count: result.count,
                  has_more: result.next_page !== null,
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (error) {
        logger.error('Error in search_users', { error });
        return {
          content: [
            {
              type: 'text',
              text: `Error searching users: ${error instanceof Error ? error.message : 'Unknown error'}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  logger.info('User tools registered');
}
