import { createLogger, format, transports } from 'winston';

const logger = createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: format.combine(
    format.timestamp(),
    format.json()
  ),
  transports: [new transports.Console()]
});

export interface JiraConfig {
  host: string;
  email: string;
  apiToken: string;
}

export interface JiraIssue {
  key: string;
  id: string;
  fields: {
    summary: string;
    description: string | null;
    status: { name: string; id: string };
    priority: { name: string; id: string } | null;
    assignee: { displayName: string; emailAddress: string } | null;
    reporter: { displayName: string; emailAddress: string } | null;
    created: string;
    updated: string;
    project: { key: string; name: string };
    issuetype: { name: string; id: string };
    labels: string[];
    comment?: {
      comments: JiraComment[];
      total: number;
    };
    [key: string]: unknown;
  };
}

export interface JiraComment {
  id: string;
  author: { displayName: string; emailAddress: string };
  body: string;
  created: string;
  updated: string;
}

export interface JiraProject {
  id: string;
  key: string;
  name: string;
  description: string | null;
  lead: { displayName: string; emailAddress: string } | null;
  projectTypeKey: string;
  style: string;
}

export interface JiraSprint {
  id: number;
  name: string;
  state: string;
  startDate: string | null;
  endDate: string | null;
  completeDate: string | null;
  originBoardId: number;
  goal: string | null;
}

export interface JiraBoard {
  id: number;
  name: string;
  type: string;
  location?: {
    projectId: number;
    projectKey: string;
    projectName: string;
  };
}

export interface JiraUser {
  accountId: string;
  emailAddress: string;
  displayName: string;
  active: boolean;
}

export interface SearchResult {
  issues: JiraIssue[];
  total: number;
  startAt: number;
  maxResults: number;
}

export class JiraClient {
  private baseUrl: string;
  private authHeader: string;
  private email: string;

  constructor(config: JiraConfig) {
    this.baseUrl = config.host.replace(/\/$/, '');
    this.email = config.email;
    const credentials = Buffer.from(`${config.email}:${config.apiToken}`).toString('base64');
    this.authHeader = `Basic ${credentials}`;
    logger.info('JiraClient initialized', { host: this.baseUrl });
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    logger.debug('Making Jira API request', { url, method: options.method || 'GET' });

    const response = await fetch(url, {
      ...options,
      headers: {
        'Authorization': this.authHeader,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...options.headers
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error('Jira API error', {
        status: response.status,
        statusText: response.statusText,
        error: errorText
      });
      throw new Error(`Jira API error: ${response.status} ${response.statusText} - ${errorText}`);
    }

    return response.json();
  }

  // Issue Operations
  async searchIssues(jql: string, maxResults = 50, startAt = 0, fields?: string[]): Promise<SearchResult> {
    const defaultFields = [
      'summary', 'description', 'status', 'priority', 'assignee',
      'reporter', 'created', 'updated', 'project', 'issuetype', 'labels'
    ];

    const params = new URLSearchParams({
      jql,
      maxResults: maxResults.toString(),
      startAt: startAt.toString(),
      fields: (fields || defaultFields).join(',')
    });

    return this.request<SearchResult>(`/rest/api/3/search?${params}`);
  }

  async getIssue(issueKey: string, expand?: string[]): Promise<JiraIssue> {
    const params = new URLSearchParams();
    if (expand && expand.length > 0) {
      params.set('expand', expand.join(','));
    }
    params.set('fields', '*all');

    return this.request<JiraIssue>(`/rest/api/3/issue/${issueKey}?${params}`);
  }

  async getIssueComments(issueKey: string): Promise<{ comments: JiraComment[]; total: number }> {
    return this.request<{ comments: JiraComment[]; total: number }>(
      `/rest/api/3/issue/${issueKey}/comment`
    );
  }

  async textSearchIssues(text: string, maxResults = 50): Promise<SearchResult> {
    const jql = `text ~ "${text.replace(/"/g, '\\"')}" ORDER BY updated DESC`;
    return this.searchIssues(jql, maxResults);
  }

  async getMyIssues(maxResults = 50): Promise<SearchResult> {
    const jql = `assignee = currentUser() AND resolution = Unresolved ORDER BY updated DESC`;
    return this.searchIssues(jql, maxResults);
  }

  // Project Operations
  async listProjects(maxResults = 50, startAt = 0): Promise<{ values: JiraProject[]; total: number }> {
    const params = new URLSearchParams({
      maxResults: maxResults.toString(),
      startAt: startAt.toString(),
      expand: 'description,lead'
    });

    return this.request<{ values: JiraProject[]; total: number }>(
      `/rest/api/3/project/search?${params}`
    );
  }

  async getProject(projectKey: string): Promise<JiraProject> {
    return this.request<JiraProject>(`/rest/api/3/project/${projectKey}`);
  }

  async getProjectStatuses(projectKey: string): Promise<{ name: string; count: number }[]> {
    const jql = `project = "${projectKey}"`;
    const result = await this.searchIssues(jql, 0);

    // Get issues grouped by status
    const statusCounts: Record<string, number> = {};
    const allIssues = await this.searchIssues(jql, 1000);

    for (const issue of allIssues.issues) {
      const statusName = issue.fields.status.name;
      statusCounts[statusName] = (statusCounts[statusName] || 0) + 1;
    }

    return Object.entries(statusCounts).map(([name, count]) => ({ name, count }));
  }

  // Board Operations
  async listBoards(projectKeyOrId?: string): Promise<{ values: JiraBoard[]; total: number }> {
    const params = new URLSearchParams({ maxResults: '50' });
    if (projectKeyOrId) {
      params.set('projectKeyOrId', projectKeyOrId);
    }

    return this.request<{ values: JiraBoard[]; total: number }>(
      `/rest/agile/1.0/board?${params}`
    );
  }

  // Sprint Operations
  async listSprints(boardId: number, state?: string): Promise<{ values: JiraSprint[]; total: number }> {
    const params = new URLSearchParams({ maxResults: '50' });
    if (state) {
      params.set('state', state);
    }

    return this.request<{ values: JiraSprint[]; total: number }>(
      `/rest/agile/1.0/board/${boardId}/sprint?${params}`
    );
  }

  async getSprint(sprintId: number): Promise<JiraSprint> {
    return this.request<JiraSprint>(`/rest/agile/1.0/sprint/${sprintId}`);
  }

  async getSprintIssues(sprintId: number, maxResults = 100): Promise<{ issues: JiraIssue[]; total: number }> {
    const params = new URLSearchParams({
      maxResults: maxResults.toString(),
      fields: 'summary,description,status,priority,assignee,reporter,created,updated,project,issuetype,labels,timetracking,customfield_10016'
    });

    return this.request<{ issues: JiraIssue[]; total: number }>(
      `/rest/agile/1.0/sprint/${sprintId}/issue?${params}`
    );
  }

  async getActiveSprint(boardId: number): Promise<JiraSprint | null> {
    const result = await this.listSprints(boardId, 'active');
    return result.values.length > 0 ? result.values[0] : null;
  }

  async getSprintBurndown(sprintId: number): Promise<{
    sprint: JiraSprint;
    totalPoints: number;
    completedPoints: number;
    remainingPoints: number;
    issuesByStatus: Record<string, { count: number; points: number }>;
  }> {
    const sprint = await this.getSprint(sprintId);
    const issuesResult = await this.getSprintIssues(sprintId);

    let totalPoints = 0;
    let completedPoints = 0;
    const issuesByStatus: Record<string, { count: number; points: number }> = {};

    for (const issue of issuesResult.issues) {
      // Story points are often in customfield_10016, but this can vary by Jira instance
      const storyPoints = (issue.fields.customfield_10016 as number) || 0;
      const statusName = issue.fields.status.name;

      totalPoints += storyPoints;

      if (!issuesByStatus[statusName]) {
        issuesByStatus[statusName] = { count: 0, points: 0 };
      }
      issuesByStatus[statusName].count++;
      issuesByStatus[statusName].points += storyPoints;

      // Consider "Done" status as completed (this might need adjustment based on workflow)
      if (statusName.toLowerCase() === 'done' || statusName.toLowerCase() === 'closed') {
        completedPoints += storyPoints;
      }
    }

    return {
      sprint,
      totalPoints,
      completedPoints,
      remainingPoints: totalPoints - completedPoints,
      issuesByStatus
    };
  }

  // User Operations
  async getCurrentUser(): Promise<JiraUser> {
    return this.request<JiraUser>('/rest/api/3/myself');
  }

  // Health check
  async healthCheck(): Promise<boolean> {
    try {
      await this.getCurrentUser();
      return true;
    } catch (error) {
      logger.error('Health check failed', { error });
      return false;
    }
  }
}

let jiraClientInstance: JiraClient | null = null;

export function getJiraClient(): JiraClient {
  if (!jiraClientInstance) {
    const host = process.env.JIRA_HOST;
    const email = process.env.JIRA_EMAIL;
    const apiToken = process.env.JIRA_API_TOKEN;

    if (!host || !email || !apiToken) {
      throw new Error('Missing required Jira configuration. Please set JIRA_HOST, JIRA_EMAIL, and JIRA_API_TOKEN environment variables.');
    }

    jiraClientInstance = new JiraClient({ host, email, apiToken });
  }

  return jiraClientInstance;
}

export function resetJiraClient(): void {
  jiraClientInstance = null;
}
