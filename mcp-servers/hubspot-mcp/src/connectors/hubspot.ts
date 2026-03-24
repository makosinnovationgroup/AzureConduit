import { Client } from '@hubspot/api-client';
import logger from '../utils/logger';

export interface HubSpotConfig {
  accessToken: string;
}

export class HubSpotConnector {
  private client: Client;
  private config: HubSpotConfig;

  constructor(config: HubSpotConfig) {
    this.config = config;
    this.client = new Client({ accessToken: config.accessToken });
    logger.info('HubSpot connector initialized');
  }

  getClient(): Client {
    return this.client;
  }

  // Contact methods
  async listContacts(limit: number = 100, lifecycleStage?: string) {
    logger.info('Listing contacts', { limit, lifecycleStage });

    const properties = [
      'firstname', 'lastname', 'email', 'phone', 'company',
      'lifecyclestage', 'hs_lead_status', 'createdate', 'lastmodifieddate'
    ];

    let filterGroups: any[] = [];
    if (lifecycleStage) {
      filterGroups = [{
        filters: [{
          propertyName: 'lifecyclestage',
          operator: 'EQ',
          value: lifecycleStage
        }]
      }];
    }

    const response = await this.client.crm.contacts.searchApi.doSearch({
      filterGroups,
      properties,
      limit,
      after: '0',
      sorts: ['-createdate']
    });

    return response.results;
  }

  async getContact(identifier: string) {
    logger.info('Getting contact', { identifier });

    const properties = [
      'firstname', 'lastname', 'email', 'phone', 'company',
      'lifecyclestage', 'hs_lead_status', 'jobtitle', 'website',
      'address', 'city', 'state', 'zip', 'country',
      'createdate', 'lastmodifieddate', 'notes_last_updated',
      'num_associated_deals', 'hs_analytics_source', 'hs_analytics_source_data_1'
    ];

    // Check if identifier is an email or contact ID
    if (identifier.includes('@')) {
      const response = await this.client.crm.contacts.searchApi.doSearch({
        filterGroups: [{
          filters: [{
            propertyName: 'email',
            operator: 'EQ',
            value: identifier
          }]
        }],
        properties,
        limit: 1,
        after: '0',
        sorts: []
      });

      if (response.results.length === 0) {
        throw new Error(`Contact not found with email: ${identifier}`);
      }
      return response.results[0];
    } else {
      return await this.client.crm.contacts.basicApi.getById(
        identifier,
        properties
      );
    }
  }

  async searchContacts(query: string) {
    logger.info('Searching contacts', { query });

    const properties = [
      'firstname', 'lastname', 'email', 'phone', 'company',
      'lifecyclestage', 'createdate'
    ];

    const response = await this.client.crm.contacts.searchApi.doSearch({
      query,
      properties,
      limit: 50,
      after: '0',
      sorts: []
    });

    return response.results;
  }

  // Deal methods
  async listDeals(stage?: string, ownerId?: string, limit: number = 100) {
    logger.info('Listing deals', { stage, ownerId, limit });

    const properties = [
      'dealname', 'amount', 'dealstage', 'pipeline', 'closedate',
      'hubspot_owner_id', 'createdate', 'hs_lastmodifieddate'
    ];

    const filters: any[] = [];
    if (stage) {
      filters.push({
        propertyName: 'dealstage',
        operator: 'EQ',
        value: stage
      });
    }
    if (ownerId) {
      filters.push({
        propertyName: 'hubspot_owner_id',
        operator: 'EQ',
        value: ownerId
      });
    }

    const filterGroups = filters.length > 0 ? [{ filters }] : [];

    const response = await this.client.crm.deals.searchApi.doSearch({
      filterGroups,
      properties,
      limit,
      after: '0',
      sorts: ['-createdate']
    });

    return response.results;
  }

  async getDeal(dealId: string) {
    logger.info('Getting deal', { dealId });

    const properties = [
      'dealname', 'amount', 'dealstage', 'pipeline', 'closedate',
      'hubspot_owner_id', 'description', 'createdate', 'hs_lastmodifieddate',
      'hs_deal_stage_probability', 'hs_projected_amount', 'hs_closed_amount',
      'num_associated_contacts', 'num_contacted_notes', 'hs_analytics_source'
    ];

    const deal = await this.client.crm.deals.basicApi.getById(
      dealId,
      properties,
      undefined,
      ['contacts', 'companies']
    );

    return deal;
  }

  async getPipelineSummary() {
    logger.info('Getting pipeline summary');

    // Get all pipelines and stages first
    const pipelines = await this.client.crm.pipelines.pipelinesApi.getAll('deals');

    // Get all deals
    const properties = ['dealname', 'amount', 'dealstage', 'pipeline'];
    const allDeals: any[] = [];
    let after = '0';

    do {
      const response = await this.client.crm.deals.searchApi.doSearch({
        filterGroups: [],
        properties,
        limit: 100,
        after,
        sorts: []
      });

      allDeals.push(...response.results);
      after = response.paging?.next?.after || '';
    } while (after);

    // Group deals by stage
    const summary: { [key: string]: { count: number; totalAmount: number; deals: string[] } } = {};

    for (const pipeline of pipelines.results) {
      for (const stage of pipeline.stages) {
        const stageKey = `${pipeline.label} - ${stage.label}`;
        const stageDeals = allDeals.filter(
          d => d.properties.dealstage === stage.id && d.properties.pipeline === pipeline.id
        );

        summary[stageKey] = {
          count: stageDeals.length,
          totalAmount: stageDeals.reduce(
            (sum, d) => sum + (parseFloat(d.properties.amount) || 0),
            0
          ),
          deals: stageDeals.map(d => d.properties.dealname)
        };
      }
    }

    return {
      pipelines: pipelines.results.map(p => ({
        id: p.id,
        label: p.label,
        stages: p.stages.map(s => ({ id: s.id, label: s.label }))
      })),
      summary
    };
  }

  // Company methods
  async listCompanies(limit: number = 100) {
    logger.info('Listing companies', { limit });

    const properties = [
      'name', 'domain', 'industry', 'phone', 'city', 'state', 'country',
      'numberofemployees', 'annualrevenue', 'createdate', 'hs_lastmodifieddate'
    ];

    const response = await this.client.crm.companies.searchApi.doSearch({
      filterGroups: [],
      properties,
      limit,
      after: '0',
      sorts: ['-createdate']
    });

    return response.results;
  }

  async getCompany(companyId: string) {
    logger.info('Getting company', { companyId });

    const properties = [
      'name', 'domain', 'industry', 'phone', 'website',
      'city', 'state', 'country', 'address', 'zip',
      'numberofemployees', 'annualrevenue', 'description',
      'founded_year', 'lifecyclestage', 'hs_lead_status',
      'createdate', 'hs_lastmodifieddate', 'num_associated_contacts',
      'num_associated_deals', 'hs_analytics_source'
    ];

    const company = await this.client.crm.companies.basicApi.getById(
      companyId,
      properties,
      undefined,
      ['contacts', 'deals']
    );

    return company;
  }

  // Marketing methods
  async listCampaigns() {
    logger.info('Listing marketing campaigns');

    // Using the marketing emails API as campaigns are accessed differently
    const response = await this.client.marketing.emails.statisticsApi.getPage();
    return response.results;
  }

  async getCampaignStats(campaignId: string) {
    logger.info('Getting campaign stats', { campaignId });

    const stats = await this.client.marketing.emails.statisticsApi.getById(campaignId);
    return stats;
  }

  async listForms() {
    logger.info('Listing forms');

    const response = await this.client.marketing.forms.formsApi.getPage();
    return response.results;
  }
}

let hubspotConnector: HubSpotConnector | null = null;

export function initializeHubSpotConnector(config: HubSpotConfig): HubSpotConnector {
  hubspotConnector = new HubSpotConnector(config);
  return hubspotConnector;
}

export function getHubSpotConnector(): HubSpotConnector {
  if (!hubspotConnector) {
    throw new Error('HubSpot connector not initialized. Call initializeHubSpotConnector first.');
  }
  return hubspotConnector;
}
