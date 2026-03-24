import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { getHubSpotConnector } from '../connectors/hubspot';
import logger from '../utils/logger';

export function registerContactTools(server: McpServer): void {
  // Tool: list_contacts
  server.tool(
    'list_contacts',
    'List contacts from HubSpot CRM with optional filtering by lifecycle stage',
    {
      limit: z.number().optional().default(100).describe('Maximum number of contacts to return (default: 100)'),
      lifecycle_stage: z.string().optional().describe('Filter by lifecycle stage (e.g., lead, subscriber, marketingqualifiedlead, salesqualifiedlead, opportunity, customer, evangelist, other)')
    },
    async ({ limit, lifecycle_stage }) => {
      try {
        const connector = getHubSpotConnector();
        const contacts = await connector.listContacts(limit, lifecycle_stage);

        const formattedContacts = contacts.map(contact => ({
          id: contact.id,
          email: contact.properties.email,
          firstName: contact.properties.firstname,
          lastName: contact.properties.lastname,
          phone: contact.properties.phone,
          company: contact.properties.company,
          lifecycleStage: contact.properties.lifecyclestage,
          leadStatus: contact.properties.hs_lead_status,
          createdAt: contact.properties.createdate,
          updatedAt: contact.properties.lastmodifieddate
        }));

        logger.info('Listed contacts successfully', { count: formattedContacts.length });

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                total: formattedContacts.length,
                contacts: formattedContacts
              }, null, 2)
            }
          ]
        };
      } catch (error: any) {
        logger.error('Error listing contacts', { error: error.message });
        return {
          content: [
            {
              type: 'text',
              text: `Error listing contacts: ${error.message}`
            }
          ],
          isError: true
        };
      }
    }
  );

  // Tool: get_contact
  server.tool(
    'get_contact',
    'Get detailed information about a specific contact by ID or email address',
    {
      contact_id: z.string().optional().describe('The HubSpot contact ID'),
      email: z.string().optional().describe('The contact email address')
    },
    async ({ contact_id, email }) => {
      try {
        if (!contact_id && !email) {
          return {
            content: [
              {
                type: 'text',
                text: 'Error: Either contact_id or email must be provided'
              }
            ],
            isError: true
          };
        }

        const connector = getHubSpotConnector();
        const identifier = contact_id || email!;
        const contact = await connector.getContact(identifier);

        const formattedContact = {
          id: contact.id,
          properties: contact.properties,
          createdAt: contact.createdAt,
          updatedAt: contact.updatedAt
        };

        logger.info('Retrieved contact successfully', { id: contact.id });

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(formattedContact, null, 2)
            }
          ]
        };
      } catch (error: any) {
        logger.error('Error getting contact', { error: error.message });
        return {
          content: [
            {
              type: 'text',
              text: `Error getting contact: ${error.message}`
            }
          ],
          isError: true
        };
      }
    }
  );

  // Tool: search_contacts
  server.tool(
    'search_contacts',
    'Search contacts by name, email, company, or other text fields',
    {
      query: z.string().describe('Search query to match against contact fields')
    },
    async ({ query }) => {
      try {
        const connector = getHubSpotConnector();
        const contacts = await connector.searchContacts(query);

        const formattedContacts = contacts.map(contact => ({
          id: contact.id,
          email: contact.properties.email,
          firstName: contact.properties.firstname,
          lastName: contact.properties.lastname,
          phone: contact.properties.phone,
          company: contact.properties.company,
          lifecycleStage: contact.properties.lifecyclestage,
          createdAt: contact.properties.createdate
        }));

        logger.info('Searched contacts successfully', { query, count: formattedContacts.length });

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                query,
                total: formattedContacts.length,
                contacts: formattedContacts
              }, null, 2)
            }
          ]
        };
      } catch (error: any) {
        logger.error('Error searching contacts', { error: error.message });
        return {
          content: [
            {
              type: 'text',
              text: `Error searching contacts: ${error.message}`
            }
          ],
          isError: true
        };
      }
    }
  );

  logger.info('Contact tools registered');
}
