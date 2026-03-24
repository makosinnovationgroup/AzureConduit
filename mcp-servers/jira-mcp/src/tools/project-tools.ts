import { z } from 'zod';
import { getJiraClient } from '../connectors/jira';

// Schema definitions
export const listProjectsSchema = z.object({
  maxResults: z.number().optional().default(50).describe('Maximum number of projects to return')
});

export const getProjectSchema = z.object({
  project_key: z.string().describe('The project key (e.g., "PROJ")')
});

export const getProjectStatsSchema = z.object({
  project_key: z.string().describe('The project key (e.g., "PROJ")')
});

// Tool implementations
export async function listProjects(params: z.infer<typeof listProjectsSchema>) {
  const client = getJiraClient();

  const result = await client.listProjects(params.maxResults || 50);

  return {
    total: result.total,
    projects: result.values.map(project => ({
      key: project.key,
      name: project.name,
      description: project.description,
      lead: project.lead?.displayName || 'Unknown',
      projectType: project.projectTypeKey,
      style: project.style
    }))
  };
}

export async function getProject(params: z.infer<typeof getProjectSchema>) {
  const client = getJiraClient();

  const project = await client.getProject(params.project_key);

  // Get boards associated with this project for additional context
  let boards: Array<{ id: number; name: string; type: string }> = [];
  try {
    const boardsResult = await client.listBoards(params.project_key);
    boards = boardsResult.values.map(board => ({
      id: board.id,
      name: board.name,
      type: board.type
    }));
  } catch (error) {
    // Boards might not be available for all project types
    boards = [];
  }

  return {
    id: project.id,
    key: project.key,
    name: project.name,
    description: project.description,
    lead: project.lead ? {
      name: project.lead.displayName,
      email: project.lead.emailAddress
    } : null,
    projectType: project.projectTypeKey,
    style: project.style,
    boards
  };
}

export async function getProjectStats(params: z.infer<typeof getProjectStatsSchema>) {
  const client = getJiraClient();

  // Get issue counts by status
  const statusCounts = await client.getProjectStatuses(params.project_key);

  // Calculate totals
  const totalIssues = statusCounts.reduce((sum, status) => sum + status.count, 0);

  // Categorize statuses (common status names - adjust based on your workflow)
  const todoStatuses = ['To Do', 'Open', 'Backlog', 'New'];
  const inProgressStatuses = ['In Progress', 'In Review', 'In Development', 'Testing'];
  const doneStatuses = ['Done', 'Closed', 'Resolved', 'Complete'];

  let todoCount = 0;
  let inProgressCount = 0;
  let doneCount = 0;
  let otherCount = 0;

  for (const status of statusCounts) {
    if (todoStatuses.some(s => status.name.toLowerCase().includes(s.toLowerCase()))) {
      todoCount += status.count;
    } else if (inProgressStatuses.some(s => status.name.toLowerCase().includes(s.toLowerCase()))) {
      inProgressCount += status.count;
    } else if (doneStatuses.some(s => status.name.toLowerCase().includes(s.toLowerCase()))) {
      doneCount += status.count;
    } else {
      otherCount += status.count;
    }
  }

  return {
    projectKey: params.project_key,
    totalIssues,
    summary: {
      todo: todoCount,
      inProgress: inProgressCount,
      done: doneCount,
      other: otherCount
    },
    byStatus: statusCounts.sort((a, b) => b.count - a.count),
    completionRate: totalIssues > 0
      ? Math.round((doneCount / totalIssues) * 100)
      : 0
  };
}

// Tool definitions for MCP registration
export const projectToolDefinitions = [
  {
    name: 'list_projects',
    description: 'List all Jira projects accessible to the current user.',
    inputSchema: listProjectsSchema
  },
  {
    name: 'get_project',
    description: 'Get detailed information about a specific Jira project including its lead, type, and associated boards.',
    inputSchema: getProjectSchema
  },
  {
    name: 'get_project_stats',
    description: 'Get issue statistics for a project including counts by status and completion rate.',
    inputSchema: getProjectStatsSchema
  }
];

export const projectToolHandlers: Record<string, (params: unknown) => Promise<unknown>> = {
  list_projects: (params) => listProjects(listProjectsSchema.parse(params)),
  get_project: (params) => getProject(getProjectSchema.parse(params)),
  get_project_stats: (params) => getProjectStats(getProjectStatsSchema.parse(params))
};
