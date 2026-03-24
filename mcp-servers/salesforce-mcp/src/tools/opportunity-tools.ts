import { z } from 'zod';
import { getSalesforceConnector } from '../connectors/salesforce';
import { logger } from '../server';

// Schema definitions
export const ListOpportunitiesSchema = z.object({
  limit: z.number().min(1).max(200).optional().default(50),
  stage: z.string().optional(),
  owner_email: z.string().email().optional(),
});

export const GetOpportunitySchema = z.object({
  opportunity_id: z.string().min(1).describe('Salesforce Opportunity ID'),
});

export const GetPipelineSummarySchema = z.object({});

// Types
export interface Opportunity {
  Id: string;
  Name: string;
  StageName: string;
  Amount?: number;
  CloseDate: string;
  Probability?: number;
  Type?: string;
  LeadSource?: string;
  Description?: string;
  AccountId?: string;
  AccountName?: string;
  OwnerId?: string;
  OwnerName?: string;
  CreatedDate?: string;
  LastModifiedDate?: string;
  IsClosed?: boolean;
  IsWon?: boolean;
}

export interface OpportunityWithAccount extends Opportunity {
  Account?: {
    Name: string;
  };
  Owner?: {
    Name: string;
    Email: string;
  };
}

export interface PipelineStageSummary {
  stage: string;
  count: number;
  totalAmount: number;
  avgProbability: number;
}

export interface PipelineSummary {
  stages: PipelineStageSummary[];
  totalOpportunities: number;
  totalPipelineValue: number;
  weightedPipelineValue: number;
}

// Tool implementations
export async function listOpportunities(
  params: z.infer<typeof ListOpportunitiesSchema>
): Promise<OpportunityWithAccount[]> {
  const connector = getSalesforceConnector();
  const { limit, stage, owner_email } = params;

  logger.info('Listing opportunities', { limit, stage, owner_email });

  let whereClause = '';
  const conditions: string[] = [];

  if (stage) {
    conditions.push(`StageName = '${stage.replace(/'/g, "\\'")}'`);
  }
  if (owner_email) {
    conditions.push(`Owner.Email = '${owner_email.replace(/'/g, "\\'")}'`);
  }

  if (conditions.length > 0) {
    whereClause = `WHERE ${conditions.join(' AND ')}`;
  }

  const soql = `
    SELECT Id, Name, StageName, Amount, CloseDate, Probability, Type, LeadSource,
           Description, AccountId, Account.Name, OwnerId, Owner.Name, Owner.Email,
           CreatedDate, LastModifiedDate, IsClosed, IsWon
    FROM Opportunity
    ${whereClause}
    ORDER BY CloseDate ASC
    LIMIT ${limit}
  `;

  const opportunities = await connector.query<OpportunityWithAccount>(soql);
  logger.info('Retrieved opportunities', { count: opportunities.length });

  return opportunities;
}

export async function getOpportunity(
  params: z.infer<typeof GetOpportunitySchema>
): Promise<OpportunityWithAccount | null> {
  const connector = getSalesforceConnector();
  const { opportunity_id } = params;

  logger.info('Getting opportunity details', { opportunity_id });

  const soql = `
    SELECT Id, Name, StageName, Amount, CloseDate, Probability, Type, LeadSource,
           Description, AccountId, Account.Name, OwnerId, Owner.Name, Owner.Email,
           CreatedDate, LastModifiedDate, IsClosed, IsWon
    FROM Opportunity
    WHERE Id = '${opportunity_id.replace(/'/g, "\\'")}'
  `;

  const opportunity = await connector.queryOne<OpportunityWithAccount>(soql);

  if (!opportunity) {
    logger.warn('Opportunity not found', { opportunity_id });
  } else {
    logger.info('Retrieved opportunity', { opportunity_id, name: opportunity.Name });
  }

  return opportunity;
}

export async function getPipelineSummary(): Promise<PipelineSummary> {
  const connector = getSalesforceConnector();

  logger.info('Getting pipeline summary');

  // Get all open opportunities grouped by stage
  const soql = `
    SELECT StageName, COUNT(Id) OpportunityCount, SUM(Amount) TotalAmount, AVG(Probability) AvgProbability
    FROM Opportunity
    WHERE IsClosed = false
    GROUP BY StageName
    ORDER BY StageName
  `;

  interface StageAggregate {
    StageName: string;
    OpportunityCount: number;
    TotalAmount: number;
    AvgProbability: number;
  }

  const stageData = await connector.query<StageAggregate>(soql);

  const stages: PipelineStageSummary[] = stageData.map((record) => ({
    stage: record.StageName,
    count: record.OpportunityCount || 0,
    totalAmount: record.TotalAmount || 0,
    avgProbability: record.AvgProbability || 0,
  }));

  const totalOpportunities = stages.reduce((sum, s) => sum + s.count, 0);
  const totalPipelineValue = stages.reduce((sum, s) => sum + s.totalAmount, 0);
  const weightedPipelineValue = stages.reduce(
    (sum, s) => sum + s.totalAmount * (s.avgProbability / 100),
    0
  );

  const summary: PipelineSummary = {
    stages,
    totalOpportunities,
    totalPipelineValue,
    weightedPipelineValue,
  };

  logger.info('Retrieved pipeline summary', {
    stageCount: stages.length,
    totalOpportunities,
    totalPipelineValue,
  });

  return summary;
}

// Tool definitions for MCP registration
export const opportunityTools = [
  {
    name: 'list_opportunities',
    description: 'List Salesforce opportunities with optional filters for stage and owner',
    inputSchema: {
      type: 'object' as const,
      properties: {
        limit: {
          type: 'number',
          description: 'Maximum number of opportunities to return (1-200, default 50)',
        },
        stage: {
          type: 'string',
          description:
            'Filter by opportunity stage (e.g., Prospecting, Qualification, Proposal, Closed Won)',
        },
        owner_email: {
          type: 'string',
          description: 'Filter by opportunity owner email address',
        },
      },
    },
    handler: listOpportunities,
    schema: ListOpportunitiesSchema,
  },
  {
    name: 'get_opportunity',
    description: 'Get detailed information about a specific Salesforce opportunity',
    inputSchema: {
      type: 'object' as const,
      properties: {
        opportunity_id: {
          type: 'string',
          description: 'The Salesforce Opportunity ID',
        },
      },
      required: ['opportunity_id'],
    },
    handler: getOpportunity,
    schema: GetOpportunitySchema,
  },
  {
    name: 'get_pipeline_summary',
    description:
      'Get a summary of the sales pipeline grouped by stage with totals and weighted values',
    inputSchema: {
      type: 'object' as const,
      properties: {},
    },
    handler: getPipelineSummary,
    schema: GetPipelineSummarySchema,
  },
];
