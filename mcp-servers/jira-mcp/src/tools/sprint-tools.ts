import { z } from 'zod';
import { getJiraClient } from '../connectors/jira';

// Schema definitions
export const listSprintsSchema = z.object({
  board_id: z.number().describe('The ID of the Jira board'),
  state: z.enum(['active', 'closed', 'future']).optional().describe('Filter sprints by state')
});

export const getSprintSchema = z.object({
  sprint_id: z.number().describe('The ID of the sprint')
});

export const getActiveSprintSchema = z.object({
  board_id: z.number().describe('The ID of the Jira board')
});

export const getSprintBurndownSchema = z.object({
  sprint_id: z.number().describe('The ID of the sprint')
});

// Tool implementations
export async function listSprints(params: z.infer<typeof listSprintsSchema>) {
  const client = getJiraClient();

  const result = await client.listSprints(params.board_id, params.state);

  return {
    boardId: params.board_id,
    total: result.total,
    sprints: result.values.map(sprint => ({
      id: sprint.id,
      name: sprint.name,
      state: sprint.state,
      startDate: sprint.startDate,
      endDate: sprint.endDate,
      completeDate: sprint.completeDate,
      goal: sprint.goal
    }))
  };
}

export async function getSprint(params: z.infer<typeof getSprintSchema>) {
  const client = getJiraClient();

  const sprint = await client.getSprint(params.sprint_id);
  const issuesResult = await client.getSprintIssues(params.sprint_id);

  // Calculate sprint progress
  let totalIssues = issuesResult.issues.length;
  let completedIssues = 0;
  const issuesByStatus: Record<string, number> = {};

  for (const issue of issuesResult.issues) {
    const statusName = issue.fields.status.name;
    issuesByStatus[statusName] = (issuesByStatus[statusName] || 0) + 1;

    if (statusName.toLowerCase() === 'done' || statusName.toLowerCase() === 'closed') {
      completedIssues++;
    }
  }

  return {
    id: sprint.id,
    name: sprint.name,
    state: sprint.state,
    startDate: sprint.startDate,
    endDate: sprint.endDate,
    completeDate: sprint.completeDate,
    goal: sprint.goal,
    progress: {
      totalIssues,
      completedIssues,
      remainingIssues: totalIssues - completedIssues,
      completionPercentage: totalIssues > 0
        ? Math.round((completedIssues / totalIssues) * 100)
        : 0
    },
    issuesByStatus,
    issues: issuesResult.issues.map(issue => ({
      key: issue.key,
      summary: issue.fields.summary,
      status: issue.fields.status.name,
      priority: issue.fields.priority?.name || 'None',
      assignee: issue.fields.assignee?.displayName || 'Unassigned',
      type: issue.fields.issuetype.name
    }))
  };
}

export async function getActiveSprint(params: z.infer<typeof getActiveSprintSchema>) {
  const client = getJiraClient();

  const sprint = await client.getActiveSprint(params.board_id);

  if (!sprint) {
    return {
      boardId: params.board_id,
      activeSprint: null,
      message: 'No active sprint found for this board'
    };
  }

  // Get sprint issues for progress
  const issuesResult = await client.getSprintIssues(sprint.id);

  let totalIssues = issuesResult.issues.length;
  let completedIssues = 0;
  const issuesByStatus: Record<string, number> = {};

  for (const issue of issuesResult.issues) {
    const statusName = issue.fields.status.name;
    issuesByStatus[statusName] = (issuesByStatus[statusName] || 0) + 1;

    if (statusName.toLowerCase() === 'done' || statusName.toLowerCase() === 'closed') {
      completedIssues++;
    }
  }

  // Calculate days remaining
  let daysRemaining: number | null = null;
  if (sprint.endDate) {
    const endDate = new Date(sprint.endDate);
    const now = new Date();
    const diffTime = endDate.getTime() - now.getTime();
    daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  return {
    boardId: params.board_id,
    activeSprint: {
      id: sprint.id,
      name: sprint.name,
      state: sprint.state,
      startDate: sprint.startDate,
      endDate: sprint.endDate,
      goal: sprint.goal,
      daysRemaining,
      progress: {
        totalIssues,
        completedIssues,
        remainingIssues: totalIssues - completedIssues,
        completionPercentage: totalIssues > 0
          ? Math.round((completedIssues / totalIssues) * 100)
          : 0
      },
      issuesByStatus
    }
  };
}

export async function getSprintBurndown(params: z.infer<typeof getSprintBurndownSchema>) {
  const client = getJiraClient();

  const burndown = await client.getSprintBurndown(params.sprint_id);

  // Calculate days elapsed and remaining
  let daysElapsed: number | null = null;
  let daysRemaining: number | null = null;
  let totalDays: number | null = null;

  if (burndown.sprint.startDate) {
    const startDate = new Date(burndown.sprint.startDate);
    const now = new Date();
    daysElapsed = Math.floor((now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));

    if (burndown.sprint.endDate) {
      const endDate = new Date(burndown.sprint.endDate);
      totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
      daysRemaining = Math.max(0, Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
    }
  }

  // Calculate ideal burndown rate
  let idealDailyRate: number | null = null;
  let actualBurnRate: number | null = null;
  let projectedCompletion: string | null = null;

  if (totalDays && totalDays > 0) {
    idealDailyRate = burndown.totalPoints / totalDays;

    if (daysElapsed && daysElapsed > 0) {
      actualBurnRate = burndown.completedPoints / daysElapsed;

      // Project completion based on actual rate
      if (actualBurnRate > 0) {
        const daysToComplete = burndown.remainingPoints / actualBurnRate;
        const projectedDate = new Date();
        projectedDate.setDate(projectedDate.getDate() + Math.ceil(daysToComplete));
        projectedCompletion = projectedDate.toISOString().split('T')[0];
      }
    }
  }

  return {
    sprint: {
      id: burndown.sprint.id,
      name: burndown.sprint.name,
      state: burndown.sprint.state,
      startDate: burndown.sprint.startDate,
      endDate: burndown.sprint.endDate,
      goal: burndown.sprint.goal
    },
    points: {
      total: burndown.totalPoints,
      completed: burndown.completedPoints,
      remaining: burndown.remainingPoints,
      completionPercentage: burndown.totalPoints > 0
        ? Math.round((burndown.completedPoints / burndown.totalPoints) * 100)
        : 0
    },
    timeline: {
      totalDays,
      daysElapsed,
      daysRemaining
    },
    burnRate: {
      idealDailyRate: idealDailyRate ? Math.round(idealDailyRate * 10) / 10 : null,
      actualDailyRate: actualBurnRate ? Math.round(actualBurnRate * 10) / 10 : null,
      projectedCompletion,
      onTrack: actualBurnRate !== null && idealDailyRate !== null
        ? actualBurnRate >= idealDailyRate
        : null
    },
    issuesByStatus: Object.entries(burndown.issuesByStatus).map(([status, data]) => ({
      status,
      count: data.count,
      points: data.points
    })).sort((a, b) => b.points - a.points)
  };
}

// Tool definitions for MCP registration
export const sprintToolDefinitions = [
  {
    name: 'list_sprints',
    description: 'List all sprints for a Jira board. Can filter by sprint state (active, closed, future).',
    inputSchema: listSprintsSchema
  },
  {
    name: 'get_sprint',
    description: 'Get detailed information about a specific sprint including all issues and progress statistics.',
    inputSchema: getSprintSchema
  },
  {
    name: 'get_active_sprint',
    description: 'Get the currently active sprint for a board with progress information and days remaining.',
    inputSchema: getActiveSprintSchema
  },
  {
    name: 'get_sprint_burndown',
    description: 'Get burndown data for a sprint including points tracking, burn rate, and projected completion.',
    inputSchema: getSprintBurndownSchema
  }
];

export const sprintToolHandlers: Record<string, (params: unknown) => Promise<unknown>> = {
  list_sprints: (params) => listSprints(listSprintsSchema.parse(params)),
  get_sprint: (params) => getSprint(getSprintSchema.parse(params)),
  get_active_sprint: (params) => getActiveSprint(getActiveSprintSchema.parse(params)),
  get_sprint_burndown: (params) => getSprintBurndown(getSprintBurndownSchema.parse(params))
};
