import { z } from 'zod';
import { getSalesforceConnector } from '../connectors/salesforce';
import { logger } from '../server';

// Schema definitions
export const ListContactsSchema = z.object({
  limit: z.number().min(1).max(200).optional().default(50),
  account_id: z.string().optional(),
});

export const GetContactSchema = z.object({
  contact_id: z.string().min(1).describe('Salesforce Contact ID'),
});

export const SearchContactsSchema = z.object({
  search_term: z.string().min(1).describe('Search term for contact name or email'),
});

// Types
export interface Contact {
  Id: string;
  FirstName?: string;
  LastName: string;
  Name: string;
  Email?: string;
  Phone?: string;
  MobilePhone?: string;
  Title?: string;
  Department?: string;
  AccountId?: string;
  AccountName?: string;
  MailingCity?: string;
  MailingState?: string;
  MailingCountry?: string;
  OwnerId?: string;
  CreatedDate?: string;
  LastModifiedDate?: string;
  Description?: string;
}

export interface ContactWithAccount extends Contact {
  Account?: {
    Name: string;
  };
}

// Tool implementations
export async function listContacts(
  params: z.infer<typeof ListContactsSchema>
): Promise<ContactWithAccount[]> {
  const connector = getSalesforceConnector();
  const { limit, account_id } = params;

  logger.info('Listing contacts', { limit, account_id });

  let whereClause = '';
  if (account_id) {
    whereClause = `WHERE AccountId = '${account_id.replace(/'/g, "\\'")}'`;
  }

  const soql = `
    SELECT Id, FirstName, LastName, Name, Email, Phone, MobilePhone, Title, Department,
           AccountId, Account.Name, MailingCity, MailingState, MailingCountry,
           OwnerId, CreatedDate, LastModifiedDate, Description
    FROM Contact
    ${whereClause}
    ORDER BY LastName ASC, FirstName ASC
    LIMIT ${limit}
  `;

  const contacts = await connector.query<ContactWithAccount>(soql);
  logger.info('Retrieved contacts', { count: contacts.length });

  return contacts;
}

export async function getContact(
  params: z.infer<typeof GetContactSchema>
): Promise<ContactWithAccount | null> {
  const connector = getSalesforceConnector();
  const { contact_id } = params;

  logger.info('Getting contact details', { contact_id });

  const soql = `
    SELECT Id, FirstName, LastName, Name, Email, Phone, MobilePhone, Title, Department,
           AccountId, Account.Name, MailingCity, MailingState, MailingCountry,
           OwnerId, CreatedDate, LastModifiedDate, Description
    FROM Contact
    WHERE Id = '${contact_id.replace(/'/g, "\\'")}'
  `;

  const contact = await connector.queryOne<ContactWithAccount>(soql);

  if (!contact) {
    logger.warn('Contact not found', { contact_id });
  } else {
    logger.info('Retrieved contact', { contact_id, name: contact.Name });
  }

  return contact;
}

export async function searchContacts(
  params: z.infer<typeof SearchContactsSchema>
): Promise<Contact[]> {
  const connector = getSalesforceConnector();
  const { search_term } = params;

  logger.info('Searching contacts', { search_term });

  // Use SOSL for full-text search across name and email
  const conn = await connector.getConnection();
  const searchResult = await conn.search(
    `FIND {${search_term.replace(/[{}]/g, '')}} IN ALL FIELDS RETURNING Contact(Id, FirstName, LastName, Name, Email, Phone, Title, Department, AccountId, Account.Name)`
  );

  const contacts = (searchResult.searchRecords || []) as Contact[];
  logger.info('Search completed', { search_term, count: contacts.length });

  return contacts;
}

// Tool definitions for MCP registration
export const contactTools = [
  {
    name: 'list_contacts',
    description: 'List Salesforce contacts with optional filter by account',
    inputSchema: {
      type: 'object' as const,
      properties: {
        limit: {
          type: 'number',
          description: 'Maximum number of contacts to return (1-200, default 50)',
        },
        account_id: {
          type: 'string',
          description: 'Filter contacts by Salesforce Account ID',
        },
      },
    },
    handler: listContacts,
    schema: ListContactsSchema,
  },
  {
    name: 'get_contact',
    description: 'Get detailed information about a specific Salesforce contact',
    inputSchema: {
      type: 'object' as const,
      properties: {
        contact_id: {
          type: 'string',
          description: 'The Salesforce Contact ID',
        },
      },
      required: ['contact_id'],
    },
    handler: getContact,
    schema: GetContactSchema,
  },
  {
    name: 'search_contacts',
    description: 'Search for Salesforce contacts by name or email using full-text search',
    inputSchema: {
      type: 'object' as const,
      properties: {
        search_term: {
          type: 'string',
          description: 'Search term to find in contact names or email addresses',
        },
      },
      required: ['search_term'],
    },
    handler: searchContacts,
    schema: SearchContactsSchema,
  },
];
