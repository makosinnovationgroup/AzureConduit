import { z } from 'zod';
import { getMatterConnector } from '../connectors/matter-management';
import { logger } from '../server';

// Schema definitions
export const ListMattersSchema = z.object({
  client_id: z.string().optional().describe('Filter by client ID'),
  status: z.enum(['active', 'pending', 'closed', 'archived']).optional().describe('Filter by matter status'),
  attorney: z.string().optional().describe('Filter by responsible attorney ID or name'),
  practice_area: z.string().optional().describe('Filter by practice area (e.g., Litigation, Corporate, Family Law)'),
  limit: z.number().min(1).max(200).optional().default(50).describe('Maximum number of matters to return'),
});

export const GetMatterSchema = z.object({
  matter_id: z.string().min(1).describe('The unique matter ID'),
});

export const SearchMattersSchema = z.object({
  query: z.string().min(1).describe('Search query - searches matter names, numbers, client names, and descriptions'),
});

export const GetMatterTimelineSchema = z.object({
  matter_id: z.string().min(1).describe('The matter ID to get timeline for'),
});

export const GetActiveMattersSchema = z.object({
  attorney: z.string().optional().describe('Filter active matters by responsible attorney'),
  practice_area: z.string().optional().describe('Filter active matters by practice area'),
});

// Tool implementations
export async function listMatters(params: z.infer<typeof ListMattersSchema>) {
  const connector = getMatterConnector();

  logger.info('Listing matters with filters', params);

  try {
    const matters = await connector.listMatters({
      client_id: params.client_id,
      status: params.status,
      attorney: params.attorney,
      practice_area: params.practice_area,
      limit: params.limit,
    });

    logger.info('Retrieved matters', { count: matters.length });

    return {
      success: true,
      count: matters.length,
      matters: matters.map(m => ({
        id: m.id,
        number: m.number,
        name: m.name,
        status: m.status,
        client_name: m.client_name,
        practice_area: m.practice_area,
        responsible_attorney: m.responsible_attorney_name,
        billing_method: m.billing_method,
        open_date: m.open_date,
      })),
    };
  } catch (error: any) {
    logger.error('Failed to list matters', { error: error.message });
    return {
      success: false,
      error: error.message || 'Failed to list matters',
    };
  }
}

export async function getMatter(params: z.infer<typeof GetMatterSchema>) {
  const connector = getMatterConnector();

  logger.info('Getting matter details', { matter_id: params.matter_id });

  try {
    const matter = await connector.getMatter(params.matter_id);

    if (!matter) {
      return {
        success: false,
        error: `Matter not found: ${params.matter_id}`,
      };
    }

    logger.info('Retrieved matter', { matter_id: params.matter_id, name: matter.name });

    return {
      success: true,
      matter: {
        id: matter.id,
        number: matter.number,
        name: matter.name,
        description: matter.description,
        status: matter.status,
        client: {
          id: matter.client_id,
          name: matter.client_name,
        },
        practice_area: matter.practice_area,
        attorneys: {
          responsible: {
            id: matter.responsible_attorney_id,
            name: matter.responsible_attorney_name,
          },
          originating: {
            id: matter.originating_attorney_id,
          },
        },
        billing: {
          method: matter.billing_method,
        },
        dates: {
          opened: matter.open_date,
          closed: matter.close_date,
          statute_of_limitations: matter.statute_of_limitations,
        },
        court: {
          name: matter.court_name,
          case_number: matter.case_number,
        },
        opposing_counsel: matter.opposing_counsel,
        custom_fields: matter.custom_fields,
        timestamps: {
          created_at: matter.created_at,
          updated_at: matter.updated_at,
        },
      },
    };
  } catch (error: any) {
    logger.error('Failed to get matter', { error: error.message, matter_id: params.matter_id });
    return {
      success: false,
      error: error.message || 'Failed to get matter details',
    };
  }
}

export async function searchMatters(params: z.infer<typeof SearchMattersSchema>) {
  const connector = getMatterConnector();

  logger.info('Searching matters', { query: params.query });

  try {
    const matters = await connector.searchMatters(params.query);

    logger.info('Search completed', { query: params.query, count: matters.length });

    return {
      success: true,
      query: params.query,
      count: matters.length,
      results: matters.map(m => ({
        id: m.id,
        number: m.number,
        name: m.name,
        status: m.status,
        client_name: m.client_name,
        practice_area: m.practice_area,
        responsible_attorney: m.responsible_attorney_name,
      })),
    };
  } catch (error: any) {
    logger.error('Failed to search matters', { error: error.message, query: params.query });
    return {
      success: false,
      error: error.message || 'Failed to search matters',
    };
  }
}

export async function getMatterTimeline(params: z.infer<typeof GetMatterTimelineSchema>) {
  const connector = getMatterConnector();

  logger.info('Getting matter timeline', { matter_id: params.matter_id });

  try {
    const [matter, timeline] = await Promise.all([
      connector.getMatter(params.matter_id),
      connector.getMatterTimeline(params.matter_id),
    ]);

    if (!matter) {
      return {
        success: false,
        error: `Matter not found: ${params.matter_id}`,
      };
    }

    // Separate events by status
    const upcoming = timeline.filter(e => e.status === 'pending').sort((a, b) =>
      new Date(a.due_date).getTime() - new Date(b.due_date).getTime()
    );
    const overdue = timeline.filter(e => e.status === 'overdue').sort((a, b) =>
      new Date(a.due_date).getTime() - new Date(b.due_date).getTime()
    );
    const completed = timeline.filter(e => e.status === 'completed').sort((a, b) =>
      new Date(b.due_date).getTime() - new Date(a.due_date).getTime()
    ).slice(0, 10); // Last 10 completed

    logger.info('Retrieved matter timeline', {
      matter_id: params.matter_id,
      upcoming: upcoming.length,
      overdue: overdue.length,
    });

    return {
      success: true,
      matter: {
        id: matter.id,
        name: matter.name,
        number: matter.number,
      },
      summary: {
        total_events: timeline.length,
        upcoming_count: upcoming.length,
        overdue_count: overdue.length,
        completed_count: completed.length,
      },
      overdue_items: overdue.map(e => ({
        id: e.id,
        title: e.title,
        type: e.type,
        due_date: e.due_date,
        priority: e.priority,
        assigned_to: e.assigned_to,
        days_overdue: Math.floor((new Date().getTime() - new Date(e.due_date).getTime()) / (1000 * 60 * 60 * 24)),
      })),
      upcoming_items: upcoming.slice(0, 20).map(e => ({
        id: e.id,
        title: e.title,
        type: e.type,
        due_date: e.due_date,
        priority: e.priority,
        assigned_to: e.assigned_to,
        days_until: Math.floor((new Date(e.due_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)),
      })),
      recently_completed: completed.map(e => ({
        id: e.id,
        title: e.title,
        type: e.type,
        due_date: e.due_date,
      })),
    };
  } catch (error: any) {
    logger.error('Failed to get matter timeline', { error: error.message, matter_id: params.matter_id });
    return {
      success: false,
      error: error.message || 'Failed to get matter timeline',
    };
  }
}

export async function getActiveMatters(params: z.infer<typeof GetActiveMattersSchema>) {
  const connector = getMatterConnector();

  logger.info('Getting active matters', params);

  try {
    const matters = await connector.listMatters({
      status: 'active',
      attorney: params.attorney,
      practice_area: params.practice_area,
    });

    // Group by practice area
    const byPracticeArea = new Map<string, number>();
    for (const matter of matters) {
      const area = matter.practice_area || 'Unassigned';
      byPracticeArea.set(area, (byPracticeArea.get(area) || 0) + 1);
    }

    // Group by responsible attorney
    const byAttorney = new Map<string, number>();
    for (const matter of matters) {
      const attorney = matter.responsible_attorney_name || 'Unassigned';
      byAttorney.set(attorney, (byAttorney.get(attorney) || 0) + 1);
    }

    logger.info('Retrieved active matters', { count: matters.length });

    return {
      success: true,
      total_active: matters.length,
      by_practice_area: Object.fromEntries(byPracticeArea),
      by_attorney: Object.fromEntries(byAttorney),
      matters: matters.map(m => ({
        id: m.id,
        number: m.number,
        name: m.name,
        client_name: m.client_name,
        practice_area: m.practice_area,
        responsible_attorney: m.responsible_attorney_name,
        open_date: m.open_date,
        billing_method: m.billing_method,
      })),
    };
  } catch (error: any) {
    logger.error('Failed to get active matters', { error: error.message });
    return {
      success: false,
      error: error.message || 'Failed to get active matters',
    };
  }
}

// Tool definitions for MCP registration
export const matterTools = [
  {
    name: 'list_matters',
    description: 'List legal matters with optional filters for client, status, attorney, and practice area. Returns matter summaries.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        client_id: {
          type: 'string',
          description: 'Filter by client ID',
        },
        status: {
          type: 'string',
          enum: ['active', 'pending', 'closed', 'archived'],
          description: 'Filter by matter status',
        },
        attorney: {
          type: 'string',
          description: 'Filter by responsible attorney ID or name',
        },
        practice_area: {
          type: 'string',
          description: 'Filter by practice area (e.g., Litigation, Corporate, Family Law)',
        },
        limit: {
          type: 'number',
          description: 'Maximum number of matters to return (1-200, default 50)',
        },
      },
    },
    handler: listMatters,
    schema: ListMattersSchema,
  },
  {
    name: 'get_matter',
    description: 'Get detailed information about a specific legal matter including client, attorneys, billing, court information, and custom fields.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        matter_id: {
          type: 'string',
          description: 'The unique matter ID',
        },
      },
      required: ['matter_id'],
    },
    handler: getMatter,
    schema: GetMatterSchema,
  },
  {
    name: 'search_matters',
    description: 'Search for legal matters by text query. Searches matter names, numbers, client names, and descriptions.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        query: {
          type: 'string',
          description: 'Search query text',
        },
      },
      required: ['query'],
    },
    handler: searchMatters,
    schema: SearchMattersSchema,
  },
  {
    name: 'get_matter_timeline',
    description: 'Get key dates, deadlines, hearings, and events for a legal matter. Includes overdue items, upcoming deadlines, and recently completed events.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        matter_id: {
          type: 'string',
          description: 'The matter ID to get timeline for',
        },
      },
      required: ['matter_id'],
    },
    handler: getMatterTimeline,
    schema: GetMatterTimelineSchema,
  },
  {
    name: 'get_active_matters',
    description: 'Get all currently active legal matters with summary statistics by practice area and attorney.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        attorney: {
          type: 'string',
          description: 'Filter active matters by responsible attorney',
        },
        practice_area: {
          type: 'string',
          description: 'Filter active matters by practice area',
        },
      },
    },
    handler: getActiveMatters,
    schema: GetActiveMattersSchema,
  },
];
