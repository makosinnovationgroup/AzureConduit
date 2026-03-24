import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { getHubSpotConnector } from '../connectors/hubspot';
import logger from '../utils/logger';

export function registerCompanyTools(server: McpServer): void {
  // Tool: list_companies
  server.tool(
    'list_companies',
    'List companies from HubSpot CRM',
    {
      limit: z.number().optional().default(100).describe('Maximum number of companies to return (default: 100)')
    },
    async ({ limit }) => {
      try {
        const connector = getHubSpotConnector();
        const companies = await connector.listCompanies(limit);

        const formattedCompanies = companies.map(company => ({
          id: company.id,
          name: company.properties.name,
          domain: company.properties.domain,
          industry: company.properties.industry,
          phone: company.properties.phone,
          city: company.properties.city,
          state: company.properties.state,
          country: company.properties.country,
          employees: company.properties.numberofemployees ? parseInt(company.properties.numberofemployees) : null,
          annualRevenue: company.properties.annualrevenue ? parseFloat(company.properties.annualrevenue) : null,
          createdAt: company.properties.createdate,
          updatedAt: company.properties.hs_lastmodifieddate
        }));

        logger.info('Listed companies successfully', { count: formattedCompanies.length });

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                total: formattedCompanies.length,
                companies: formattedCompanies
              }, null, 2)
            }
          ]
        };
      } catch (error: any) {
        logger.error('Error listing companies', { error: error.message });
        return {
          content: [
            {
              type: 'text',
              text: `Error listing companies: ${error.message}`
            }
          ],
          isError: true
        };
      }
    }
  );

  // Tool: get_company
  server.tool(
    'get_company',
    'Get detailed information about a specific company including associated contacts and deals',
    {
      company_id: z.string().describe('The HubSpot company ID')
    },
    async ({ company_id }) => {
      try {
        const connector = getHubSpotConnector();
        const company = await connector.getCompany(company_id);

        const formattedCompany = {
          id: company.id,
          properties: {
            name: company.properties.name,
            domain: company.properties.domain,
            industry: company.properties.industry,
            phone: company.properties.phone,
            website: company.properties.website,
            address: company.properties.address,
            city: company.properties.city,
            state: company.properties.state,
            zip: company.properties.zip,
            country: company.properties.country,
            employees: company.properties.numberofemployees ? parseInt(company.properties.numberofemployees) : null,
            annualRevenue: company.properties.annualrevenue ? parseFloat(company.properties.annualrevenue) : null,
            description: company.properties.description,
            foundedYear: company.properties.founded_year,
            lifecycleStage: company.properties.lifecyclestage,
            leadStatus: company.properties.hs_lead_status,
            associatedContacts: company.properties.num_associated_contacts,
            associatedDeals: company.properties.num_associated_deals,
            source: company.properties.hs_analytics_source
          },
          associations: company.associations,
          createdAt: company.createdAt,
          updatedAt: company.updatedAt
        };

        logger.info('Retrieved company successfully', { id: company.id });

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(formattedCompany, null, 2)
            }
          ]
        };
      } catch (error: any) {
        logger.error('Error getting company', { error: error.message });
        return {
          content: [
            {
              type: 'text',
              text: `Error getting company: ${error.message}`
            }
          ],
          isError: true
        };
      }
    }
  );

  logger.info('Company tools registered');
}
