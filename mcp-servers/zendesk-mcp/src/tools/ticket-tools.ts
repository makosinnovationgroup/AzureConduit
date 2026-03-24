import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { getZendeskConnector } from '../connectors/zendesk';
import logger from '../utils/logger';

export function registerTicketTools(server: McpServer): void {
  // Tool: list_tickets
  server.tool(
    'list_tickets',
    'List Zendesk support tickets with optional filtering by status, priority, assignee, or requester',
    {
      status: z
        .enum(['new', 'open', 'pending', 'hold', 'solved', 'closed'])
        .optional()
        .describe('Filter by ticket status'),
      priority: z
        .enum(['low', 'normal', 'high', 'urgent'])
        .optional()
        .describe('Filter by ticket priority'),
      assignee_id: z
        .number()
        .optional()
        .describe('Filter by assignee user ID'),
      requester_id: z
        .number()
        .optional()
        .describe('Filter by requester user ID'),
      per_page: z
        .number()
        .min(1)
        .max(100)
        .optional()
        .describe('Number of results per page (default: 25, max: 100)'),
    },
    async ({ status, priority, assignee_id, requester_id, per_page }) => {
      try {
        logger.info('Executing list_tickets tool', { status, priority, assignee_id, requester_id });
        const connector = getZendeskConnector();

        const result = await connector.listTickets({
          status,
          priority,
          assignee_id,
          requester_id,
          per_page,
        });

        const formattedTickets = result.tickets.map((ticket) => ({
          id: ticket.id,
          subject: ticket.subject,
          status: ticket.status,
          priority: ticket.priority,
          requester_id: ticket.requester_id,
          assignee_id: ticket.assignee_id,
          created_at: ticket.created_at,
          updated_at: ticket.updated_at,
          tags: ticket.tags,
        }));

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  tickets: formattedTickets,
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
        logger.error('Error in list_tickets', { error });
        return {
          content: [
            {
              type: 'text',
              text: `Error listing tickets: ${error instanceof Error ? error.message : 'Unknown error'}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  // Tool: get_ticket
  server.tool(
    'get_ticket',
    'Get detailed information about a specific Zendesk ticket including all comments/conversation history',
    {
      ticket_id: z.number().describe('The ID of the ticket to retrieve'),
    },
    async ({ ticket_id }) => {
      try {
        logger.info('Executing get_ticket tool', { ticket_id });
        const connector = getZendeskConnector();

        const { ticket, comments } = await connector.getTicketWithComments(ticket_id);

        const formattedComments = comments.map((comment) => ({
          id: comment.id,
          author_id: comment.author_id,
          body: comment.plain_body || comment.body,
          public: comment.public,
          created_at: comment.created_at,
        }));

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  ticket: {
                    id: ticket.id,
                    subject: ticket.subject,
                    description: ticket.description,
                    status: ticket.status,
                    priority: ticket.priority,
                    requester_id: ticket.requester_id,
                    assignee_id: ticket.assignee_id,
                    group_id: ticket.group_id,
                    created_at: ticket.created_at,
                    updated_at: ticket.updated_at,
                    tags: ticket.tags,
                    via: ticket.via.channel,
                  },
                  comments: formattedComments,
                  comment_count: comments.length,
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (error) {
        logger.error('Error in get_ticket', { error });
        return {
          content: [
            {
              type: 'text',
              text: `Error getting ticket: ${error instanceof Error ? error.message : 'Unknown error'}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  // Tool: search_tickets
  server.tool(
    'search_tickets',
    'Search Zendesk tickets using Zendesk search syntax. Supports keywords, field searches (e.g., subject:billing), and operators',
    {
      query: z
        .string()
        .describe(
          'Search query using Zendesk search syntax. Examples: "billing issue", "subject:password", "status:open priority:urgent"'
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
        logger.info('Executing search_tickets tool', { query });
        const connector = getZendeskConnector();

        const result = await connector.searchTickets(query, per_page || 25);

        const formattedResults = result.results.map((ticket) => ({
          id: ticket.id,
          subject: ticket.subject,
          status: ticket.status,
          priority: ticket.priority,
          requester_id: ticket.requester_id,
          assignee_id: ticket.assignee_id,
          created_at: ticket.created_at,
          updated_at: ticket.updated_at,
        }));

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  results: formattedResults,
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
        logger.error('Error in search_tickets', { error });
        return {
          content: [
            {
              type: 'text',
              text: `Error searching tickets: ${error instanceof Error ? error.message : 'Unknown error'}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  // Tool: get_ticket_metrics
  server.tool(
    'get_ticket_metrics',
    'Get SLA and performance metrics for a specific ticket including response times, resolution times, and wait times',
    {
      ticket_id: z.number().describe('The ID of the ticket to get metrics for'),
    },
    async ({ ticket_id }) => {
      try {
        logger.info('Executing get_ticket_metrics tool', { ticket_id });
        const connector = getZendeskConnector();

        const metrics = await connector.getTicketMetrics(ticket_id);

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  ticket_id: metrics.ticket_id,
                  metrics: {
                    reopens: metrics.reopens,
                    replies: metrics.replies,
                    group_stations: metrics.group_stations,
                    assignee_stations: metrics.assignee_stations,
                    reply_time_minutes: metrics.reply_time_in_minutes,
                    first_resolution_time_minutes: metrics.first_resolution_time_in_minutes,
                    full_resolution_time_minutes: metrics.full_resolution_time_in_minutes,
                    agent_wait_time_minutes: metrics.agent_wait_time_in_minutes,
                    requester_wait_time_minutes: metrics.requester_wait_time_in_minutes,
                  },
                  timestamps: {
                    created_at: metrics.created_at,
                    solved_at: metrics.solved_at,
                    initially_assigned_at: metrics.initially_assigned_at,
                    latest_comment_added_at: metrics.latest_comment_added_at,
                  },
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (error) {
        logger.error('Error in get_ticket_metrics', { error });
        return {
          content: [
            {
              type: 'text',
              text: `Error getting ticket metrics: ${error instanceof Error ? error.message : 'Unknown error'}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  logger.info('Ticket tools registered');
}
