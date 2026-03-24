import { z } from 'zod';
import { getCrmConnector, Opportunity } from '../connectors/crm';
import { logger } from '../server';

// ============================================
// Schema Definitions
// ============================================

export const GetPipelineSummarySchema = z.object({
  include_closed: z.boolean().optional().default(false).describe('Include closed deals in summary'),
});

export const GetPipelineByRepSchema = z.object({
  rep_id: z.string().optional().describe('Filter by specific rep ID'),
  rep_email: z.string().email().optional().describe('Filter by rep email'),
  include_closed: z.boolean().optional().default(false).describe('Include closed deals'),
});

export const GetPipelineBySegmentSchema = z.object({
  group_by: z
    .enum(['segment', 'region', 'type'])
    .optional()
    .default('segment')
    .describe('Group pipeline by segment, region, or type'),
  include_closed: z.boolean().optional().default(false).describe('Include closed deals'),
});

export const GetPipelineChangesSchema = z.object({
  days: z.number().min(1).max(90).optional().default(7).describe('Number of days to look back'),
});

// ============================================
// Types
// ============================================

export interface StageSummary {
  stage: string;
  count: number;
  totalAmount: number;
  avgAmount: number;
  avgProbability: number;
  weightedAmount: number;
}

export interface PipelineSummary {
  stages: StageSummary[];
  totalOpportunities: number;
  totalPipelineValue: number;
  weightedPipelineValue: number;
  avgDealSize: number;
  generatedAt: string;
}

export interface RepPipeline {
  repId: string;
  repName: string;
  repEmail?: string;
  totalOpportunities: number;
  totalPipelineValue: number;
  weightedPipelineValue: number;
  avgDealSize: number;
  stages: StageSummary[];
}

export interface SegmentPipeline {
  segment: string;
  totalOpportunities: number;
  totalPipelineValue: number;
  weightedPipelineValue: number;
  avgDealSize: number;
}

export interface PipelineChange {
  type: 'added' | 'removed' | 'stage_change' | 'amount_change';
  opportunity: {
    id: string;
    name: string;
    amount: number;
    stage: string;
    ownerName: string;
  };
  previousStage?: string;
  previousAmount?: number;
  changedAt: string;
}

export interface PipelineChangesResult {
  period: {
    startDate: string;
    endDate: string;
    days: number;
  };
  added: {
    count: number;
    totalAmount: number;
    opportunities: PipelineChange['opportunity'][];
  };
  closedWon: {
    count: number;
    totalAmount: number;
    opportunities: PipelineChange['opportunity'][];
  };
  closedLost: {
    count: number;
    totalAmount: number;
    opportunities: PipelineChange['opportunity'][];
  };
  stageChanges: {
    count: number;
    details: Array<{
      opportunity: PipelineChange['opportunity'];
      fromStage: string;
      toStage: string;
    }>;
  };
  netChange: number;
  generatedAt: string;
}

// ============================================
// Tool Implementations
// ============================================

export async function getPipelineSummary(
  params: z.infer<typeof GetPipelineSummarySchema>
): Promise<PipelineSummary> {
  const connector = getCrmConnector();
  const { include_closed } = params;

  logger.info('Getting pipeline summary', { include_closed });

  const opportunities = await connector.getOpportunities({
    isClosed: include_closed ? undefined : false,
  });

  const stageMap = new Map<
    string,
    { count: number; totalAmount: number; totalProbability: number }
  >();

  for (const opp of opportunities) {
    if (!stageMap.has(opp.stage)) {
      stageMap.set(opp.stage, { count: 0, totalAmount: 0, totalProbability: 0 });
    }
    const stage = stageMap.get(opp.stage)!;
    stage.count += 1;
    stage.totalAmount += opp.amount;
    stage.totalProbability += opp.probability;
  }

  const stages: StageSummary[] = Array.from(stageMap.entries())
    .map(([stage, data]) => ({
      stage,
      count: data.count,
      totalAmount: data.totalAmount,
      avgAmount: data.count > 0 ? data.totalAmount / data.count : 0,
      avgProbability: data.count > 0 ? data.totalProbability / data.count : 0,
      weightedAmount: data.totalAmount * ((data.totalProbability / data.count) / 100),
    }))
    .sort((a, b) => b.totalAmount - a.totalAmount);

  const totalOpportunities = opportunities.length;
  const totalPipelineValue = opportunities.reduce((sum, o) => sum + o.amount, 0);
  const weightedPipelineValue = opportunities.reduce(
    (sum, o) => sum + o.amount * (o.probability / 100),
    0
  );
  const avgDealSize = totalOpportunities > 0 ? totalPipelineValue / totalOpportunities : 0;

  const result: PipelineSummary = {
    stages,
    totalOpportunities,
    totalPipelineValue,
    weightedPipelineValue,
    avgDealSize,
    generatedAt: new Date().toISOString(),
  };

  logger.info('Pipeline summary generated', {
    totalOpportunities,
    totalPipelineValue,
    stageCount: stages.length,
  });

  return result;
}

export async function getPipelineByRep(
  params: z.infer<typeof GetPipelineByRepSchema>
): Promise<RepPipeline[]> {
  const connector = getCrmConnector();
  const { rep_id, rep_email, include_closed } = params;

  logger.info('Getting pipeline by rep', { rep_id, rep_email, include_closed });

  const opportunities = await connector.getOpportunities({
    ownerId: rep_id,
    ownerEmail: rep_email,
    isClosed: include_closed ? undefined : false,
  });

  // Group by rep
  const repMap = new Map<
    string,
    {
      name: string;
      email?: string;
      opportunities: Opportunity[];
    }
  >();

  for (const opp of opportunities) {
    if (!repMap.has(opp.ownerId)) {
      repMap.set(opp.ownerId, {
        name: opp.ownerName,
        email: opp.ownerEmail,
        opportunities: [],
      });
    }
    repMap.get(opp.ownerId)!.opportunities.push(opp);
  }

  const result: RepPipeline[] = [];

  for (const [repId, data] of repMap.entries()) {
    const opps = data.opportunities;

    // Calculate stage breakdown
    const stageMap = new Map<
      string,
      { count: number; totalAmount: number; totalProbability: number }
    >();

    for (const opp of opps) {
      if (!stageMap.has(opp.stage)) {
        stageMap.set(opp.stage, { count: 0, totalAmount: 0, totalProbability: 0 });
      }
      const stage = stageMap.get(opp.stage)!;
      stage.count += 1;
      stage.totalAmount += opp.amount;
      stage.totalProbability += opp.probability;
    }

    const stages: StageSummary[] = Array.from(stageMap.entries()).map(([stage, sdata]) => ({
      stage,
      count: sdata.count,
      totalAmount: sdata.totalAmount,
      avgAmount: sdata.count > 0 ? sdata.totalAmount / sdata.count : 0,
      avgProbability: sdata.count > 0 ? sdata.totalProbability / sdata.count : 0,
      weightedAmount: sdata.totalAmount * ((sdata.totalProbability / sdata.count) / 100),
    }));

    const totalPipelineValue = opps.reduce((sum, o) => sum + o.amount, 0);
    const weightedPipelineValue = opps.reduce(
      (sum, o) => sum + o.amount * (o.probability / 100),
      0
    );

    result.push({
      repId,
      repName: data.name,
      repEmail: data.email,
      totalOpportunities: opps.length,
      totalPipelineValue,
      weightedPipelineValue,
      avgDealSize: opps.length > 0 ? totalPipelineValue / opps.length : 0,
      stages,
    });
  }

  // Sort by total pipeline value descending
  result.sort((a, b) => b.totalPipelineValue - a.totalPipelineValue);

  logger.info('Pipeline by rep generated', { repCount: result.length });

  return result;
}

export async function getPipelineBySegment(
  params: z.infer<typeof GetPipelineBySegmentSchema>
): Promise<SegmentPipeline[]> {
  const connector = getCrmConnector();
  const { group_by, include_closed } = params;

  logger.info('Getting pipeline by segment', { group_by, include_closed });

  const opportunities = await connector.getOpportunities({
    isClosed: include_closed ? undefined : false,
  });

  // Group by the selected dimension
  const segmentMap = new Map<
    string,
    { count: number; totalAmount: number; totalProbability: number }
  >();

  for (const opp of opportunities) {
    let key: string;
    switch (group_by) {
      case 'region':
        key = opp.region || 'Unknown Region';
        break;
      case 'type':
        key = opp.type || 'Unknown Type';
        break;
      default:
        key = opp.segment || 'Unknown Segment';
    }

    if (!segmentMap.has(key)) {
      segmentMap.set(key, { count: 0, totalAmount: 0, totalProbability: 0 });
    }
    const segment = segmentMap.get(key)!;
    segment.count += 1;
    segment.totalAmount += opp.amount;
    segment.totalProbability += opp.probability;
  }

  const result: SegmentPipeline[] = Array.from(segmentMap.entries())
    .map(([segment, data]) => ({
      segment,
      totalOpportunities: data.count,
      totalPipelineValue: data.totalAmount,
      weightedPipelineValue: data.totalAmount * ((data.totalProbability / data.count) / 100),
      avgDealSize: data.count > 0 ? data.totalAmount / data.count : 0,
    }))
    .sort((a, b) => b.totalPipelineValue - a.totalPipelineValue);

  logger.info('Pipeline by segment generated', { segmentCount: result.length, group_by });

  return result;
}

export async function getPipelineChanges(
  params: z.infer<typeof GetPipelineChangesSchema>
): Promise<PipelineChangesResult> {
  const connector = getCrmConnector();
  const { days } = params;

  logger.info('Getting pipeline changes', { days });

  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  // Get all opportunities modified in the period
  const allOpportunities = await connector.getOpportunities({});

  // Filter to those modified in the period
  const modifiedOpps = allOpportunities.filter(
    (o) => o.lastModifiedDate >= startDate && o.lastModifiedDate <= endDate
  );

  // Categorize changes
  const added: PipelineChange['opportunity'][] = [];
  const closedWon: PipelineChange['opportunity'][] = [];
  const closedLost: PipelineChange['opportunity'][] = [];

  // Track opportunities created in the period (new to pipeline)
  const createdInPeriod = modifiedOpps.filter(
    (o) => o.createdDate >= startDate && o.createdDate <= endDate && !o.isClosed
  );

  for (const opp of createdInPeriod) {
    added.push({
      id: opp.id,
      name: opp.name,
      amount: opp.amount,
      stage: opp.stage,
      ownerName: opp.ownerName,
    });
  }

  // Track closed won/lost in period
  const closedInPeriod = modifiedOpps.filter(
    (o) => o.isClosed && o.lastModifiedDate >= startDate
  );

  for (const opp of closedInPeriod) {
    const oppData = {
      id: opp.id,
      name: opp.name,
      amount: opp.amount,
      stage: opp.stage,
      ownerName: opp.ownerName,
    };

    if (opp.isWon) {
      closedWon.push(oppData);
    } else {
      closedLost.push(oppData);
    }
  }

  // Calculate net change
  const addedAmount = added.reduce((sum, o) => sum + o.amount, 0);
  const closedWonAmount = closedWon.reduce((sum, o) => sum + o.amount, 0);
  const closedLostAmount = closedLost.reduce((sum, o) => sum + o.amount, 0);
  const netChange = addedAmount - closedWonAmount - closedLostAmount;

  const result: PipelineChangesResult = {
    period: {
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0],
      days,
    },
    added: {
      count: added.length,
      totalAmount: addedAmount,
      opportunities: added,
    },
    closedWon: {
      count: closedWon.length,
      totalAmount: closedWonAmount,
      opportunities: closedWon,
    },
    closedLost: {
      count: closedLost.length,
      totalAmount: closedLostAmount,
      opportunities: closedLost,
    },
    stageChanges: {
      count: 0, // Would require tracking historical stage changes
      details: [],
    },
    netChange,
    generatedAt: new Date().toISOString(),
  };

  logger.info('Pipeline changes generated', {
    days,
    addedCount: added.length,
    closedWonCount: closedWon.length,
    closedLostCount: closedLost.length,
  });

  return result;
}

// ============================================
// Tool Definitions for MCP Registration
// ============================================

export const pipelineTools = [
  {
    name: 'get_pipeline_summary',
    description:
      'Get a comprehensive summary of the sales pipeline broken down by stage. Shows total amounts, weighted pipeline value, deal counts, and averages for each stage. Use this to understand pipeline health at a glance.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        include_closed: {
          type: 'boolean',
          description: 'Include closed deals in the summary (default: false)',
        },
      },
    },
    handler: getPipelineSummary,
    schema: GetPipelineSummarySchema,
  },
  {
    name: 'get_pipeline_by_rep',
    description:
      'Get pipeline breakdown by sales representative. Shows each rep\'s total pipeline value, weighted value, deal count, and stage distribution. Useful for comparing rep performance and identifying coaching opportunities.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        rep_id: {
          type: 'string',
          description: 'Filter by specific rep ID (optional)',
        },
        rep_email: {
          type: 'string',
          description: 'Filter by rep email address (optional)',
        },
        include_closed: {
          type: 'boolean',
          description: 'Include closed deals in the breakdown (default: false)',
        },
      },
    },
    handler: getPipelineByRep,
    schema: GetPipelineByRepSchema,
  },
  {
    name: 'get_pipeline_by_segment',
    description:
      'Get pipeline breakdown by customer segment, region, or deal type. Helps identify which market segments or regions have the strongest pipeline coverage.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        group_by: {
          type: 'string',
          enum: ['segment', 'region', 'type'],
          description: 'Dimension to group pipeline by (default: segment)',
        },
        include_closed: {
          type: 'boolean',
          description: 'Include closed deals in the breakdown (default: false)',
        },
      },
    },
    handler: getPipelineBySegment,
    schema: GetPipelineBySegmentSchema,
  },
  {
    name: 'get_pipeline_changes',
    description:
      'Get a summary of what moved in and out of the pipeline over a specified period. Shows new opportunities added, deals closed (won and lost), and the net change in pipeline value. Essential for pipeline momentum analysis.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        days: {
          type: 'number',
          description: 'Number of days to look back (1-90, default: 7)',
        },
      },
    },
    handler: getPipelineChanges,
    schema: GetPipelineChangesSchema,
  },
];
