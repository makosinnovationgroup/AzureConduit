import { z } from 'zod';
import { getSalesforceConnector } from '../connectors/salesforce';
import { logger } from '../server';

// Schema definitions
export const ListCasesSchema = z.object({
  status: z.string().optional(),
  priority: z.string().optional(),
  account_id: z.string().optional(),
});

export const GetCaseSchema = z.object({
  case_id: z.string().min(1).describe('Salesforce Case ID'),
});

// Types
export interface Case {
  Id: string;
  CaseNumber: string;
  Subject?: string;
  Description?: string;
  Status: string;
  Priority?: string;
  Origin?: string;
  Type?: string;
  Reason?: string;
  AccountId?: string;
  ContactId?: string;
  OwnerId?: string;
  CreatedDate?: string;
  ClosedDate?: string;
  LastModifiedDate?: string;
  IsClosed?: boolean;
  IsEscalated?: boolean;
}

export interface CaseWithRelations extends Case {
  Account?: {
    Name: string;
  };
  Contact?: {
    Name: string;
    Email: string;
  };
  Owner?: {
    Name: string;
  };
}

// Tool implementations
export async function listCases(
  params: z.infer<typeof ListCasesSchema>
): Promise<CaseWithRelations[]> {
  const connector = getSalesforceConnector();
  const { status, priority, account_id } = params;

  logger.info('Listing cases', { status, priority, account_id });

  const conditions: string[] = [];

  if (status) {
    conditions.push(`Status = '${status.replace(/'/g, "\\'")}'`);
  }
  if (priority) {
    conditions.push(`Priority = '${priority.replace(/'/g, "\\'")}'`);
  }
  if (account_id) {
    conditions.push(`AccountId = '${account_id.replace(/'/g, "\\'")}'`);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const soql = `
    SELECT Id, CaseNumber, Subject, Description, Status, Priority, Origin, Type, Reason,
           AccountId, Account.Name, ContactId, Contact.Name, Contact.Email,
           OwnerId, Owner.Name, CreatedDate, ClosedDate, LastModifiedDate,
           IsClosed, IsEscalated
    FROM Case
    ${whereClause}
    ORDER BY CreatedDate DESC
    LIMIT 100
  `;

  const cases = await connector.query<CaseWithRelations>(soql);
  logger.info('Retrieved cases', { count: cases.length });

  return cases;
}

export async function getCase(
  params: z.infer<typeof GetCaseSchema>
): Promise<CaseWithRelations | null> {
  const connector = getSalesforceConnector();
  const { case_id } = params;

  logger.info('Getting case details', { case_id });

  const soql = `
    SELECT Id, CaseNumber, Subject, Description, Status, Priority, Origin, Type, Reason,
           AccountId, Account.Name, ContactId, Contact.Name, Contact.Email,
           OwnerId, Owner.Name, CreatedDate, ClosedDate, LastModifiedDate,
           IsClosed, IsEscalated
    FROM Case
    WHERE Id = '${case_id.replace(/'/g, "\\'")}'
  `;

  const caseRecord = await connector.queryOne<CaseWithRelations>(soql);

  if (!caseRecord) {
    logger.warn('Case not found', { case_id });
  } else {
    logger.info('Retrieved case', { case_id, caseNumber: caseRecord.CaseNumber });
  }

  return caseRecord;
}

// Tool definitions for MCP registration
export const caseTools = [
  {
    name: 'list_cases',
    description: 'List Salesforce support cases with optional filters for status, priority, and account',
    inputSchema: {
      type: 'object' as const,
      properties: {
        status: {
          type: 'string',
          description: 'Filter by case status (e.g., New, Working, Escalated, Closed)',
        },
        priority: {
          type: 'string',
          description: 'Filter by case priority (e.g., High, Medium, Low)',
        },
        account_id: {
          type: 'string',
          description: 'Filter cases by Salesforce Account ID',
        },
      },
    },
    handler: listCases,
    schema: ListCasesSchema,
  },
  {
    name: 'get_case',
    description: 'Get detailed information about a specific Salesforce support case',
    inputSchema: {
      type: 'object' as const,
      properties: {
        case_id: {
          type: 'string',
          description: 'The Salesforce Case ID',
        },
      },
      required: ['case_id'],
    },
    handler: getCase,
    schema: GetCaseSchema,
  },
];
