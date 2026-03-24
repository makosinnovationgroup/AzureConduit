import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { getHubSpotConnector } from '../connectors/hubspot';
import logger from '../utils/logger';

export function registerDealTools(server: McpServer): void {
  // Tool: list_deals
  server.tool(
    'list_deals',
    'List deals from HubSpot CRM with optional filtering by stage and owner',
    {
      stage: z.string().optional().describe('Filter by deal stage ID'),
      owner: z.string().optional().describe('Filter by HubSpot owner ID'),
      limit: z.number().optional().default(100).describe('Maximum number of deals to return (default: 100)')
    },
    async ({ stage, owner, limit }) => {
      try {
        const connector = getHubSpotConnector();
        const deals = await connector.listDeals(stage, owner, limit);

        const formattedDeals = deals.map(deal => ({
          id: deal.id,
          name: deal.properties.dealname,
          amount: deal.properties.amount ? parseFloat(deal.properties.amount) : null,
          stage: deal.properties.dealstage,
          pipeline: deal.properties.pipeline,
          closeDate: deal.properties.closedate,
          ownerId: deal.properties.hubspot_owner_id,
          createdAt: deal.properties.createdate,
          updatedAt: deal.properties.hs_lastmodifieddate
        }));

        const totalAmount = formattedDeals.reduce(
          (sum, deal) => sum + (deal.amount || 0),
          0
        );

        logger.info('Listed deals successfully', { count: formattedDeals.length });

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                total: formattedDeals.length,
                totalAmount,
                deals: formattedDeals
              }, null, 2)
            }
          ]
        };
      } catch (error: any) {
        logger.error('Error listing deals', { error: error.message });
        return {
          content: [
            {
              type: 'text',
              text: `Error listing deals: ${error.message}`
            }
          ],
          isError: true
        };
      }
    }
  );

  // Tool: get_deal
  server.tool(
    'get_deal',
    'Get detailed information about a specific deal including associated contacts and companies',
    {
      deal_id: z.string().describe('The HubSpot deal ID')
    },
    async ({ deal_id }) => {
      try {
        const connector = getHubSpotConnector();
        const deal = await connector.getDeal(deal_id);

        const formattedDeal = {
          id: deal.id,
          properties: {
            name: deal.properties.dealname,
            amount: deal.properties.amount ? parseFloat(deal.properties.amount) : null,
            stage: deal.properties.dealstage,
            pipeline: deal.properties.pipeline,
            closeDate: deal.properties.closedate,
            ownerId: deal.properties.hubspot_owner_id,
            description: deal.properties.description,
            probability: deal.properties.hs_deal_stage_probability,
            projectedAmount: deal.properties.hs_projected_amount,
            closedAmount: deal.properties.hs_closed_amount,
            associatedContacts: deal.properties.num_associated_contacts,
            source: deal.properties.hs_analytics_source
          },
          associations: deal.associations,
          createdAt: deal.createdAt,
          updatedAt: deal.updatedAt
        };

        logger.info('Retrieved deal successfully', { id: deal.id });

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(formattedDeal, null, 2)
            }
          ]
        };
      } catch (error: any) {
        logger.error('Error getting deal', { error: error.message });
        return {
          content: [
            {
              type: 'text',
              text: `Error getting deal: ${error.message}`
            }
          ],
          isError: true
        };
      }
    }
  );

  // Tool: get_pipeline_summary
  server.tool(
    'get_pipeline_summary',
    'Get a summary of all deals grouped by pipeline stage with total amounts',
    {},
    async () => {
      try {
        const connector = getHubSpotConnector();
        const summary = await connector.getPipelineSummary();

        logger.info('Retrieved pipeline summary successfully');

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(summary, null, 2)
            }
          ]
        };
      } catch (error: any) {
        logger.error('Error getting pipeline summary', { error: error.message });
        return {
          content: [
            {
              type: 'text',
              text: `Error getting pipeline summary: ${error.message}`
            }
          ],
          isError: true
        };
      }
    }
  );

  logger.info('Deal tools registered');
}
