import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { getHubSpotConnector } from '../connectors/hubspot';
import logger from '../utils/logger';

export function registerMarketingTools(server: McpServer): void {
  // Tool: list_campaigns
  server.tool(
    'list_campaigns',
    'List marketing email campaigns from HubSpot',
    {},
    async () => {
      try {
        const connector = getHubSpotConnector();
        const campaigns = await connector.listCampaigns();

        const formattedCampaigns = campaigns.map((campaign: any) => ({
          id: campaign.id,
          name: campaign.name,
          subject: campaign.subject,
          state: campaign.state,
          type: campaign.type,
          created: campaign.createdAt,
          updated: campaign.updatedAt,
          stats: {
            sent: campaign.stats?.sent || 0,
            delivered: campaign.stats?.delivered || 0,
            opens: campaign.stats?.opens || 0,
            clicks: campaign.stats?.clicks || 0,
            bounces: campaign.stats?.bounces || 0,
            unsubscribes: campaign.stats?.unsubscribes || 0
          }
        }));

        logger.info('Listed campaigns successfully', { count: formattedCampaigns.length });

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                total: formattedCampaigns.length,
                campaigns: formattedCampaigns
              }, null, 2)
            }
          ]
        };
      } catch (error: any) {
        logger.error('Error listing campaigns', { error: error.message });
        return {
          content: [
            {
              type: 'text',
              text: `Error listing campaigns: ${error.message}`
            }
          ],
          isError: true
        };
      }
    }
  );

  // Tool: get_campaign_stats
  server.tool(
    'get_campaign_stats',
    'Get detailed performance statistics for a specific marketing campaign including opens, clicks, and conversions',
    {
      campaign_id: z.string().describe('The HubSpot marketing email/campaign ID')
    },
    async ({ campaign_id }) => {
      try {
        const connector = getHubSpotConnector();
        const stats = await connector.getCampaignStats(campaign_id);

        const formattedStats = {
          id: stats.id,
          name: stats.name,
          subject: stats.subject,
          state: stats.state,
          type: stats.type,
          statistics: {
            sent: stats.stats?.sent || 0,
            delivered: stats.stats?.delivered || 0,
            opens: stats.stats?.opens || 0,
            uniqueOpens: stats.stats?.uniqueOpens || 0,
            openRate: stats.stats?.delivered > 0
              ? ((stats.stats?.uniqueOpens || 0) / stats.stats.delivered * 100).toFixed(2) + '%'
              : '0%',
            clicks: stats.stats?.clicks || 0,
            uniqueClicks: stats.stats?.uniqueClicks || 0,
            clickRate: stats.stats?.delivered > 0
              ? ((stats.stats?.uniqueClicks || 0) / stats.stats.delivered * 100).toFixed(2) + '%'
              : '0%',
            clickToOpenRate: stats.stats?.uniqueOpens > 0
              ? ((stats.stats?.uniqueClicks || 0) / stats.stats.uniqueOpens * 100).toFixed(2) + '%'
              : '0%',
            bounces: stats.stats?.bounces || 0,
            hardBounces: stats.stats?.hardBounces || 0,
            softBounces: stats.stats?.softBounces || 0,
            bounceRate: stats.stats?.sent > 0
              ? ((stats.stats?.bounces || 0) / stats.stats.sent * 100).toFixed(2) + '%'
              : '0%',
            unsubscribes: stats.stats?.unsubscribes || 0,
            unsubscribeRate: stats.stats?.delivered > 0
              ? ((stats.stats?.unsubscribes || 0) / stats.stats.delivered * 100).toFixed(2) + '%'
              : '0%',
            spamReports: stats.stats?.spamReports || 0,
            replies: stats.stats?.replies || 0
          },
          createdAt: stats.createdAt,
          updatedAt: stats.updatedAt
        };

        logger.info('Retrieved campaign stats successfully', { id: campaign_id });

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(formattedStats, null, 2)
            }
          ]
        };
      } catch (error: any) {
        logger.error('Error getting campaign stats', { error: error.message });
        return {
          content: [
            {
              type: 'text',
              text: `Error getting campaign stats: ${error.message}`
            }
          ],
          isError: true
        };
      }
    }
  );

  // Tool: list_forms
  server.tool(
    'list_forms',
    'List marketing forms from HubSpot with submission counts',
    {},
    async () => {
      try {
        const connector = getHubSpotConnector();
        const forms = await connector.listForms();

        const formattedForms = forms.map((form: any) => ({
          id: form.id,
          name: form.name,
          formType: form.formType,
          createdAt: form.createdAt,
          updatedAt: form.updatedAt,
          archived: form.archived,
          fieldGroups: form.fieldGroups?.length || 0,
          configuration: {
            language: form.configuration?.language,
            cloneable: form.configuration?.cloneable,
            editable: form.configuration?.editable
          }
        }));

        logger.info('Listed forms successfully', { count: formattedForms.length });

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                total: formattedForms.length,
                forms: formattedForms
              }, null, 2)
            }
          ]
        };
      } catch (error: any) {
        logger.error('Error listing forms', { error: error.message });
        return {
          content: [
            {
              type: 'text',
              text: `Error listing forms: ${error.message}`
            }
          ],
          isError: true
        };
      }
    }
  );

  logger.info('Marketing tools registered');
}
