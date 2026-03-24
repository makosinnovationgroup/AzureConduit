import { z } from 'zod';
import { getCrmConnector } from '../connectors/crm';
import { logger } from '../server';

// ============================================
// Schema Definitions
// ============================================

export const GetForecastSchema = z.object({
  period: z
    .string()
    .regex(/^\d{4}(-Q[1-4]|-\d{2})?$/)
    .describe('Forecast period (e.g., "2024-Q1", "2024-03", or "2024")'),
  rep_id: z.string().optional().describe('Filter by specific rep ID'),
  team: z.string().optional().describe('Filter by team name'),
});

export const GetForecastVsQuotaSchema = z.object({
  period: z
    .string()
    .regex(/^\d{4}(-Q[1-4]|-\d{2})?$/)
    .describe('Forecast period (e.g., "2024-Q1", "2024-03", or "2024")'),
  group_by: z
    .enum(['rep', 'team'])
    .optional()
    .default('rep')
    .describe('Group results by rep or team'),
});

export const GetCommitVsBestCaseSchema = z.object({
  period: z
    .string()
    .regex(/^\d{4}(-Q[1-4]|-\d{2})?$/)
    .describe('Forecast period (e.g., "2024-Q1", "2024-03", or "2024")'),
  rep_id: z.string().optional().describe('Filter by specific rep ID'),
});

export const GetCoverageRatioSchema = z.object({
  period: z
    .string()
    .regex(/^\d{4}(-Q[1-4]|-\d{2})?$/)
    .describe('Forecast period (e.g., "2024-Q1", "2024-03", or "2024")'),
  target_ratio: z
    .number()
    .min(1)
    .max(10)
    .optional()
    .default(3)
    .describe('Target pipeline coverage ratio (e.g., 3x quota)'),
});

// ============================================
// Types
// ============================================

export interface ForecastSummary {
  period: string;
  periodType: 'quarter' | 'month' | 'year';
  totalCommit: number;
  totalMostLikely: number;
  totalBestCase: number;
  totalClosed: number;
  totalQuota: number;
  forecastVsQuota: number;
  closedVsQuota: number;
  byRep: RepForecast[];
  generatedAt: string;
}

export interface RepForecast {
  repId: string;
  repName: string;
  commit: number;
  mostLikely: number;
  bestCase: number;
  closed: number;
  quota: number;
  forecastVsQuota: number;
  closedVsQuota: number;
}

export interface ForecastVsQuotaResult {
  period: string;
  summary: {
    totalForecast: number;
    totalQuota: number;
    totalClosed: number;
    overallAttainment: number;
    overallForecastAttainment: number;
  };
  details: Array<{
    id: string;
    name: string;
    forecast: number;
    quota: number;
    closed: number;
    attainment: number;
    forecastAttainment: number;
    gap: number;
    status: 'on_track' | 'at_risk' | 'behind';
  }>;
  generatedAt: string;
}

export interface CommitVsBestCaseResult {
  period: string;
  summary: {
    totalCommit: number;
    totalMostLikely: number;
    totalBestCase: number;
    totalClosed: number;
    remainingToCommit: number;
    upside: number;
  };
  byRep: Array<{
    repId: string;
    repName: string;
    commit: number;
    mostLikely: number;
    bestCase: number;
    closed: number;
    remainingToCommit: number;
    upside: number;
  }>;
  generatedAt: string;
}

export interface CoverageRatioResult {
  period: string;
  targetRatio: number;
  summary: {
    totalPipeline: number;
    totalQuota: number;
    actualRatio: number;
    coverageStatus: 'healthy' | 'adequate' | 'at_risk' | 'critical';
    requiredPipeline: number;
    pipelineGap: number;
  };
  byRep: Array<{
    repId: string;
    repName: string;
    pipeline: number;
    quota: number;
    ratio: number;
    status: 'healthy' | 'adequate' | 'at_risk' | 'critical';
    gap: number;
  }>;
  generatedAt: string;
}

// ============================================
// Helper Functions
// ============================================

function getPeriodType(period: string): 'quarter' | 'month' | 'year' {
  if (period.includes('Q')) return 'quarter';
  if (period.length === 7) return 'month';
  return 'year';
}

function getCoverageStatus(ratio: number, target: number): 'healthy' | 'adequate' | 'at_risk' | 'critical' {
  const percentage = ratio / target;
  if (percentage >= 1) return 'healthy';
  if (percentage >= 0.8) return 'adequate';
  if (percentage >= 0.5) return 'at_risk';
  return 'critical';
}

function getAttainmentStatus(attainment: number): 'on_track' | 'at_risk' | 'behind' {
  if (attainment >= 90) return 'on_track';
  if (attainment >= 70) return 'at_risk';
  return 'behind';
}

// ============================================
// Tool Implementations
// ============================================

export async function getForecast(
  params: z.infer<typeof GetForecastSchema>
): Promise<ForecastSummary> {
  const connector = getCrmConnector();
  const { period, rep_id, team } = params;

  logger.info('Getting forecast', { period, rep_id, team });

  const forecasts = await connector.getForecasts(period);

  // Filter if needed
  let filteredForecasts = forecasts;
  if (rep_id) {
    filteredForecasts = forecasts.filter((f) => f.repId === rep_id);
  }

  // Calculate totals
  const totalCommit = filteredForecasts.reduce((sum, f) => sum + f.commit, 0);
  const totalMostLikely = filteredForecasts.reduce((sum, f) => sum + f.mostLikely, 0);
  const totalBestCase = filteredForecasts.reduce((sum, f) => sum + f.bestCase, 0);
  const totalClosed = filteredForecasts.reduce((sum, f) => sum + f.closed, 0);
  const totalQuota = filteredForecasts.reduce((sum, f) => sum + f.quota, 0);

  const byRep: RepForecast[] = filteredForecasts.map((f) => ({
    repId: f.repId,
    repName: f.repName,
    commit: f.commit,
    mostLikely: f.mostLikely,
    bestCase: f.bestCase,
    closed: f.closed,
    quota: f.quota,
    forecastVsQuota: f.quota > 0 ? ((f.commit + f.closed) / f.quota) * 100 : 0,
    closedVsQuota: f.quota > 0 ? (f.closed / f.quota) * 100 : 0,
  }));

  const result: ForecastSummary = {
    period,
    periodType: getPeriodType(period),
    totalCommit,
    totalMostLikely,
    totalBestCase,
    totalClosed,
    totalQuota,
    forecastVsQuota: totalQuota > 0 ? ((totalCommit + totalClosed) / totalQuota) * 100 : 0,
    closedVsQuota: totalQuota > 0 ? (totalClosed / totalQuota) * 100 : 0,
    byRep,
    generatedAt: new Date().toISOString(),
  };

  logger.info('Forecast generated', {
    period,
    totalCommit,
    totalClosed,
    repCount: byRep.length,
  });

  return result;
}

export async function getForecastVsQuota(
  params: z.infer<typeof GetForecastVsQuotaSchema>
): Promise<ForecastVsQuotaResult> {
  const connector = getCrmConnector();
  const { period, group_by } = params;

  logger.info('Getting forecast vs quota', { period, group_by });

  const forecasts = await connector.getForecasts(period);

  // Calculate totals
  const totalForecast = forecasts.reduce((sum, f) => sum + f.commit + f.closed, 0);
  const totalQuota = forecasts.reduce((sum, f) => sum + f.quota, 0);
  const totalClosed = forecasts.reduce((sum, f) => sum + f.closed, 0);

  const details = forecasts.map((f) => {
    const forecast = f.commit + f.closed;
    const attainment = f.quota > 0 ? (f.closed / f.quota) * 100 : 0;
    const forecastAttainment = f.quota > 0 ? (forecast / f.quota) * 100 : 0;
    const gap = f.quota - forecast;

    return {
      id: f.repId,
      name: f.repName,
      forecast,
      quota: f.quota,
      closed: f.closed,
      attainment,
      forecastAttainment,
      gap,
      status: getAttainmentStatus(forecastAttainment),
    };
  });

  // Sort by attainment descending
  details.sort((a, b) => b.attainment - a.attainment);

  const result: ForecastVsQuotaResult = {
    period,
    summary: {
      totalForecast,
      totalQuota,
      totalClosed,
      overallAttainment: totalQuota > 0 ? (totalClosed / totalQuota) * 100 : 0,
      overallForecastAttainment: totalQuota > 0 ? (totalForecast / totalQuota) * 100 : 0,
    },
    details,
    generatedAt: new Date().toISOString(),
  };

  logger.info('Forecast vs quota generated', {
    period,
    totalForecast,
    totalQuota,
    overallAttainment: result.summary.overallAttainment,
  });

  return result;
}

export async function getCommitVsBestCase(
  params: z.infer<typeof GetCommitVsBestCaseSchema>
): Promise<CommitVsBestCaseResult> {
  const connector = getCrmConnector();
  const { period, rep_id } = params;

  logger.info('Getting commit vs best case', { period, rep_id });

  let forecasts = await connector.getForecasts(period);

  if (rep_id) {
    forecasts = forecasts.filter((f) => f.repId === rep_id);
  }

  const totalCommit = forecasts.reduce((sum, f) => sum + f.commit, 0);
  const totalMostLikely = forecasts.reduce((sum, f) => sum + f.mostLikely, 0);
  const totalBestCase = forecasts.reduce((sum, f) => sum + f.bestCase, 0);
  const totalClosed = forecasts.reduce((sum, f) => sum + f.closed, 0);

  const byRep = forecasts.map((f) => ({
    repId: f.repId,
    repName: f.repName,
    commit: f.commit,
    mostLikely: f.mostLikely,
    bestCase: f.bestCase,
    closed: f.closed,
    remainingToCommit: Math.max(0, f.commit - f.closed),
    upside: f.bestCase - f.commit,
  }));

  // Sort by best case descending
  byRep.sort((a, b) => b.bestCase - a.bestCase);

  const result: CommitVsBestCaseResult = {
    period,
    summary: {
      totalCommit,
      totalMostLikely,
      totalBestCase,
      totalClosed,
      remainingToCommit: Math.max(0, totalCommit - totalClosed),
      upside: totalBestCase - totalCommit,
    },
    byRep,
    generatedAt: new Date().toISOString(),
  };

  logger.info('Commit vs best case generated', {
    period,
    totalCommit,
    totalBestCase,
    upside: result.summary.upside,
  });

  return result;
}

export async function getCoverageRatio(
  params: z.infer<typeof GetCoverageRatioSchema>
): Promise<CoverageRatioResult> {
  const connector = getCrmConnector();
  const { period, target_ratio } = params;

  logger.info('Getting coverage ratio', { period, target_ratio });

  // Get forecasts for quota data
  const forecasts = await connector.getForecasts(period);

  // Get open pipeline
  const opportunities = await connector.getOpportunities({
    isClosed: false,
  });

  // Calculate pipeline by rep
  const repPipelineMap = new Map<string, number>();
  for (const opp of opportunities) {
    const current = repPipelineMap.get(opp.ownerId) || 0;
    repPipelineMap.set(opp.ownerId, current + opp.amount);
  }

  // Build rep details
  const byRep = forecasts.map((f) => {
    const pipeline = repPipelineMap.get(f.repId) || 0;
    const ratio = f.quota > 0 ? pipeline / f.quota : 0;
    const requiredPipeline = f.quota * target_ratio;
    const gap = requiredPipeline - pipeline;

    return {
      repId: f.repId,
      repName: f.repName,
      pipeline,
      quota: f.quota,
      ratio,
      status: getCoverageStatus(ratio, target_ratio),
      gap,
    };
  });

  // Sort by ratio descending
  byRep.sort((a, b) => b.ratio - a.ratio);

  // Calculate totals
  const totalPipeline = Array.from(repPipelineMap.values()).reduce((sum, p) => sum + p, 0);
  const totalQuota = forecasts.reduce((sum, f) => sum + f.quota, 0);
  const actualRatio = totalQuota > 0 ? totalPipeline / totalQuota : 0;
  const requiredPipeline = totalQuota * target_ratio;

  const result: CoverageRatioResult = {
    period,
    targetRatio: target_ratio,
    summary: {
      totalPipeline,
      totalQuota,
      actualRatio,
      coverageStatus: getCoverageStatus(actualRatio, target_ratio),
      requiredPipeline,
      pipelineGap: requiredPipeline - totalPipeline,
    },
    byRep,
    generatedAt: new Date().toISOString(),
  };

  logger.info('Coverage ratio generated', {
    period,
    totalPipeline,
    totalQuota,
    actualRatio,
    targetRatio: target_ratio,
  });

  return result;
}

// ============================================
// Tool Definitions for MCP Registration
// ============================================

export const forecastTools = [
  {
    name: 'get_forecast',
    description:
      'Get sales forecast for a specified period showing commit, most likely, and best case amounts by rep. Includes quota comparison and current closed amounts. Use for forecast calls and planning.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        period: {
          type: 'string',
          description: 'Forecast period in format: "2024-Q1" (quarter), "2024-03" (month), or "2024" (year)',
        },
        rep_id: {
          type: 'string',
          description: 'Filter by specific rep ID (optional)',
        },
        team: {
          type: 'string',
          description: 'Filter by team name (optional)',
        },
      },
      required: ['period'],
    },
    handler: getForecast,
    schema: GetForecastSchema,
  },
  {
    name: 'get_forecast_vs_quota',
    description:
      'Compare forecast against quota by rep or team. Shows attainment percentage, gap to quota, and identifies who is on track, at risk, or behind. Essential for forecast accuracy tracking.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        period: {
          type: 'string',
          description: 'Forecast period in format: "2024-Q1" (quarter), "2024-03" (month), or "2024" (year)',
        },
        group_by: {
          type: 'string',
          enum: ['rep', 'team'],
          description: 'Group results by rep or team (default: rep)',
        },
      },
      required: ['period'],
    },
    handler: getForecastVsQuota,
    schema: GetForecastVsQuotaSchema,
  },
  {
    name: 'get_commit_vs_best_case',
    description:
      'Get breakdown of commit, most likely, and best case forecast amounts. Shows upside potential between commit and best case. Useful for understanding forecast range and sandbagging.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        period: {
          type: 'string',
          description: 'Forecast period in format: "2024-Q1" (quarter), "2024-03" (month), or "2024" (year)',
        },
        rep_id: {
          type: 'string',
          description: 'Filter by specific rep ID (optional)',
        },
      },
      required: ['period'],
    },
    handler: getCommitVsBestCase,
    schema: GetCommitVsBestCaseSchema,
  },
  {
    name: 'get_coverage_ratio',
    description:
      'Calculate pipeline coverage ratio against quota (e.g., 3x coverage). Shows whether each rep and the team overall has sufficient pipeline to hit quota. Critical for pipeline planning.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        period: {
          type: 'string',
          description: 'Forecast period in format: "2024-Q1" (quarter), "2024-03" (month), or "2024" (year)',
        },
        target_ratio: {
          type: 'number',
          description: 'Target pipeline coverage ratio (default: 3 for 3x quota)',
        },
      },
      required: ['period'],
    },
    handler: getCoverageRatio,
    schema: GetCoverageRatioSchema,
  },
];
