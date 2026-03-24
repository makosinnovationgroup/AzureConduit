import { z } from 'zod';
import { getJiraClient } from '../connectors/jira';

// Schema definitions
export const listIssuesSchema = z.object({
  project: z.string().optional().describe('Project key to filter issues (e.g., "PROJ")'),
  assignee: z.string().optional().describe('Assignee username or email to filter issues'),
  status: z.string().optional().describe('Status name to filter issues (e.g., "In Progress", "Done")'),
  jql: z.string().optional().describe('Custom JQL query (overrides other filters if provided)'),
  maxResults: z.number().optional().default(50).describe('Maximum number of results to return')
});

export const getIssueSchema = z.object({
  issue_key: z.string().describe('The Jira issue key (e.g., "PROJ-123")')
});

export const searchIssuesSchema = z.object({
  text: z.string().describe('Text to search for in issue summary, description, and comments'),
  maxResults: z.number().optional().default(50).describe('Maximum number of results to return')
});

export const getMyIssuesSchema = z.object({
  maxResults: z.number().optional().default(50).describe('Maximum number of results to return')
});

// Tool implementations
export async function listIssues(params: z.infer<typeof listIssuesSchema>) {
  const client = getJiraClient();

  let jql = params.jql;

  if (!jql) {
    const conditions: string[] = [];

    if (params.project) {
      conditions.push(`project = "${params.project}"`);
    }
    if (params.assignee) {
      conditions.push(`assignee = "${params.assignee}"`);
    }
    if (params.status) {
      conditions.push(`status = "${params.status}"`);
    }

    jql = conditions.length > 0
      ? `${conditions.join(' AND ')} ORDER BY updated DESC`
      : 'ORDER BY updated DESC';
  }

  const result = await client.searchIssues(jql, params.maxResults || 50);

  return {
    total: result.total,
    issues: result.issues.map(issue => ({
      key: issue.key,
      summary: issue.fields.summary,
      status: issue.fields.status.name,
      priority: issue.fields.priority?.name || 'None',
      assignee: issue.fields.assignee?.displayName || 'Unassigned',
      reporter: issue.fields.reporter?.displayName || 'Unknown',
      project: issue.fields.project.key,
      type: issue.fields.issuetype.name,
      created: issue.fields.created,
      updated: issue.fields.updated,
      labels: issue.fields.labels
    }))
  };
}

export async function getIssue(params: z.infer<typeof getIssueSchema>) {
  const client = getJiraClient();

  const issue = await client.getIssue(params.issue_key, ['changelog', 'renderedFields']);
  const commentsResult = await client.getIssueComments(params.issue_key);

  return {
    key: issue.key,
    id: issue.id,
    summary: issue.fields.summary,
    description: issue.fields.description,
    status: issue.fields.status.name,
    priority: issue.fields.priority?.name || 'None',
    assignee: issue.fields.assignee ? {
      name: issue.fields.assignee.displayName,
      email: issue.fields.assignee.emailAddress
    } : null,
    reporter: issue.fields.reporter ? {
      name: issue.fields.reporter.displayName,
      email: issue.fields.reporter.emailAddress
    } : null,
    project: {
      key: issue.fields.project.key,
      name: issue.fields.project.name
    },
    type: issue.fields.issuetype.name,
    created: issue.fields.created,
    updated: issue.fields.updated,
    labels: issue.fields.labels,
    comments: commentsResult.comments.map(comment => ({
      id: comment.id,
      author: comment.author.displayName,
      body: comment.body,
      created: comment.created,
      updated: comment.updated
    })),
    totalComments: commentsResult.total
  };
}

export async function searchIssues(params: z.infer<typeof searchIssuesSchema>) {
  const client = getJiraClient();

  const result = await client.textSearchIssues(params.text, params.maxResults || 50);

  return {
    total: result.total,
    searchQuery: params.text,
    issues: result.issues.map(issue => ({
      key: issue.key,
      summary: issue.fields.summary,
      status: issue.fields.status.name,
      priority: issue.fields.priority?.name || 'None',
      assignee: issue.fields.assignee?.displayName || 'Unassigned',
      project: issue.fields.project.key,
      type: issue.fields.issuetype.name,
      updated: issue.fields.updated
    }))
  };
}

export async function getMyIssues(params: z.infer<typeof getMyIssuesSchema>) {
  const client = getJiraClient();

  const result = await client.getMyIssues(params.maxResults || 50);
  const currentUser = await client.getCurrentUser();

  return {
    user: {
      name: currentUser.displayName,
      email: currentUser.emailAddress
    },
    total: result.total,
    issues: result.issues.map(issue => ({
      key: issue.key,
      summary: issue.fields.summary,
      status: issue.fields.status.name,
      priority: issue.fields.priority?.name || 'None',
      project: issue.fields.project.key,
      type: issue.fields.issuetype.name,
      created: issue.fields.created,
      updated: issue.fields.updated,
      labels: issue.fields.labels
    }))
  };
}

// Tool definitions for MCP registration
export const issueToolDefinitions = [
  {
    name: 'list_issues',
    description: 'List Jira issues with optional filters. Can filter by project, assignee, status, or provide a custom JQL query.',
    inputSchema: listIssuesSchema
  },
  {
    name: 'get_issue',
    description: 'Get detailed information about a specific Jira issue including its description, status, assignee, and all comments.',
    inputSchema: getIssueSchema
  },
  {
    name: 'search_issues',
    description: 'Search for Jira issues using text search. Searches in issue summary, description, and comments.',
    inputSchema: searchIssuesSchema
  },
  {
    name: 'get_my_issues',
    description: 'Get all unresolved issues assigned to the current user, ordered by last update.',
    inputSchema: getMyIssuesSchema
  }
];

export const issueToolHandlers: Record<string, (params: unknown) => Promise<unknown>> = {
  list_issues: (params) => listIssues(listIssuesSchema.parse(params)),
  get_issue: (params) => getIssue(getIssueSchema.parse(params)),
  search_issues: (params) => searchIssues(searchIssuesSchema.parse(params)),
  get_my_issues: (params) => getMyIssues(getMyIssuesSchema.parse(params))
};
