import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { getZendeskConnector } from '../connectors/zendesk';
import logger from '../utils/logger';

export function registerAnalyticsTools(server: McpServer): void {
  // Tool: get_ticket_stats
  server.tool(
    'get_ticket_stats',
    'Get ticket statistics showing counts by status (new, open, pending, hold, solved, closed)',
    {},
    async () => {
      try {
        logger.info('Executing get_ticket_stats tool');
        const connector = getZendeskConnector();

        const counts = await connector.getTicketCounts();

        const totalActive = counts.new + counts.open + counts.pending + counts.hold;
        const totalResolved = counts.solved + counts.closed;
        const total = totalActive + totalResolved;

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  by_status: counts,
                  summary: {
                    total_tickets: total,
                    active_tickets: totalActive,
                    resolved_tickets: totalResolved,
                    breakdown: {
                      new: counts.new,
                      open: counts.open,
                      pending: counts.pending,
                      hold: counts.hold,
                      solved: counts.solved,
                      closed: counts.closed,
                    },
                  },
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (error) {
        logger.error('Error in get_ticket_stats', { error });
        return {
          content: [
            {
              type: 'text',
              text: `Error getting ticket stats: ${error instanceof Error ? error.message : 'Unknown error'}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  // Tool: get_sla_compliance
  server.tool(
    'get_sla_compliance',
    'Get SLA compliance metrics based on ticket resolution and response times. Calculates percentage of tickets meeting SLA targets.',
    {},
    async () => {
      try {
        logger.info('Executing get_sla_compliance tool');
        const connector = getZendeskConnector();

        // Get recently solved tickets to analyze SLA compliance
        const result = await connector.searchTickets('status:solved', 100);

        let totalWithMetrics = 0;
        let firstReplyWithinTarget = 0;
        let resolutionWithinTarget = 0;
        const responseTimesSummary: number[] = [];
        const resolutionTimesSummary: number[] = [];

        // Sample metrics from solved tickets
        for (const ticket of result.results.slice(0, 50)) {
          try {
            const metrics = await connector.getTicketMetrics(ticket.id);

            if (metrics.reply_time_in_minutes?.business !== null) {
              totalWithMetrics++;
              const replyTime = metrics.reply_time_in_minutes.business;
              responseTimesSummary.push(replyTime);

              // Default SLA targets (configurable in real implementation)
              // First reply within 60 minutes (business hours)
              if (replyTime <= 60) {
                firstReplyWithinTarget++;
              }
            }

            if (metrics.full_resolution_time_in_minutes?.business !== null) {
              const resolutionTime = metrics.full_resolution_time_in_minutes.business;
              resolutionTimesSummary.push(resolutionTime);

              // Resolution within 480 minutes (8 business hours)
              if (resolutionTime <= 480) {
                resolutionWithinTarget++;
              }
            }
          } catch {
            // Skip tickets where metrics are not available
            continue;
          }
        }

        const firstReplyCompliance =
          totalWithMetrics > 0 ? ((firstReplyWithinTarget / totalWithMetrics) * 100).toFixed(1) : 'N/A';
        const resolutionCompliance =
          resolutionTimesSummary.length > 0
            ? ((resolutionWithinTarget / resolutionTimesSummary.length) * 100).toFixed(1)
            : 'N/A';

        const avgResponseTime =
          responseTimesSummary.length > 0
            ? (responseTimesSummary.reduce((a, b) => a + b, 0) / responseTimesSummary.length).toFixed(1)
            : 'N/A';
        const avgResolutionTime =
          resolutionTimesSummary.length > 0
            ? (resolutionTimesSummary.reduce((a, b) => a + b, 0) / resolutionTimesSummary.length).toFixed(1)
            : 'N/A';

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  sla_compliance: {
                    first_reply_compliance_percent: firstReplyCompliance,
                    resolution_compliance_percent: resolutionCompliance,
                    tickets_analyzed: totalWithMetrics,
                  },
                  average_times: {
                    avg_first_reply_minutes: avgResponseTime,
                    avg_resolution_minutes: avgResolutionTime,
                  },
                  sla_targets_used: {
                    first_reply_target_minutes: 60,
                    resolution_target_minutes: 480,
                    note: 'These are default targets. Actual SLA policies may vary.',
                  },
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (error) {
        logger.error('Error in get_sla_compliance', { error });
        return {
          content: [
            {
              type: 'text',
              text: `Error getting SLA compliance: ${error instanceof Error ? error.message : 'Unknown error'}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  // Tool: get_agent_workload
  server.tool(
    'get_agent_workload',
    'Get workload distribution showing the number of open/pending tickets assigned to each agent',
    {},
    async () => {
      try {
        logger.info('Executing get_agent_workload tool');
        const connector = getZendeskConnector();

        const workload = await connector.getTicketsByAssignee();

        const totalTickets = workload.reduce((sum, agent) => sum + agent.count, 0);
        const avgPerAgent = workload.length > 0 ? (totalTickets / workload.length).toFixed(1) : '0';

        // Identify overloaded and underutilized agents
        const avgCount = totalTickets / (workload.length || 1);
        const overloaded = workload.filter((a) => a.count > avgCount * 1.5);
        const underutilized = workload.filter((a) => a.count < avgCount * 0.5);

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  agent_workload: workload.map((agent) => ({
                    agent_id: agent.assignee_id,
                    name: (agent as { name?: string }).name || 'Unknown',
                    email: (agent as { email?: string }).email || 'Unknown',
                    open_ticket_count: agent.count,
                  })),
                  summary: {
                    total_open_tickets: totalTickets,
                    total_agents_with_tickets: workload.length,
                    average_tickets_per_agent: avgPerAgent,
                  },
                  alerts: {
                    overloaded_agents: overloaded.map((a) => ({
                      name: (a as { name?: string }).name,
                      count: a.count,
                    })),
                    underutilized_agents: underutilized.map((a) => ({
                      name: (a as { name?: string }).name,
                      count: a.count,
                    })),
                  },
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (error) {
        logger.error('Error in get_agent_workload', { error });
        return {
          content: [
            {
              type: 'text',
              text: `Error getting agent workload: ${error instanceof Error ? error.message : 'Unknown error'}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  logger.info('Analytics tools registered');
}
