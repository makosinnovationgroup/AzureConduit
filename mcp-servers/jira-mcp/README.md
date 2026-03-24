# Jira MCP Server

An MCP (Model Context Protocol) server that provides tools for interacting with Jira Cloud API. This server enables AI assistants to query issues, projects, and sprints from your Jira instance.

## Features

- **Issue Management**: List, search, and get detailed issue information including comments
- **Project Tools**: List projects, get project details and statistics
- **Sprint Tools**: Track sprints, get burndown data, and monitor active sprints

## Prerequisites

- Node.js 18 or higher
- A Jira Cloud instance
- Jira API token with appropriate permissions

## API Token Setup

1. **Generate an API Token**:
   - Go to [Atlassian Account Settings](https://id.atlassian.com/manage-profile/security/api-tokens)
   - Click "Create API token"
   - Give it a descriptive label (e.g., "MCP Server")
   - Copy the generated token immediately (you won't be able to see it again)

2. **Required Permissions**:
   Your Jira account needs the following permissions:
   - **Browse Projects**: To list and view projects
   - **Browse Issues**: To search and view issues
   - **View Read-Only Workflow**: To see issue statuses
   - **View Voters and Watchers**: For complete issue information
   - For Agile/Sprint features:
     - **Manage Sprints**: To view sprint information
     - **Browse Boards**: To list and access boards

3. **Configure Environment Variables**:
   ```bash
   cp .env.example .env
   ```

   Edit `.env` with your credentials:
   ```
   JIRA_HOST=https://your-domain.atlassian.net
   JIRA_EMAIL=your-email@example.com
   JIRA_API_TOKEN=your-api-token-here
   ```

## Installation

```bash
# Install dependencies
npm install

# Build the project
npm run build

# Start the server
npm start
```

## Running Modes

### HTTP Server Mode (Default)
Starts an HTTP server with health check endpoints:

```bash
npm start
```

Endpoints:
- `GET /health` - Full health check with Jira connectivity
- `GET /ready` - Kubernetes readiness probe
- `GET /live` - Kubernetes liveness probe
- `GET /info` - Server information and available tools

### MCP Stdio Mode
For direct MCP client connections:

```bash
npm start -- --stdio
```

## Available Tools

### Issue Tools

| Tool | Description | Parameters |
|------|-------------|------------|
| `list_issues` | List issues with optional filters | `project?`, `assignee?`, `status?`, `jql?`, `maxResults?` |
| `get_issue` | Get issue details with comments | `issue_key` |
| `search_issues` | Full-text search across issues | `text`, `maxResults?` |
| `get_my_issues` | Get issues assigned to current user | `maxResults?` |

### Project Tools

| Tool | Description | Parameters |
|------|-------------|------------|
| `list_projects` | List all accessible projects | `maxResults?` |
| `get_project` | Get project details and boards | `project_key` |
| `get_project_stats` | Get issue counts by status | `project_key` |

### Sprint Tools

| Tool | Description | Parameters |
|------|-------------|------------|
| `list_sprints` | List sprints for a board | `board_id`, `state?` |
| `get_sprint` | Get sprint details with issues | `sprint_id` |
| `get_active_sprint` | Get current active sprint | `board_id` |
| `get_sprint_burndown` | Get sprint burndown data | `sprint_id` |

## Usage Examples

### List Issues with JQL
```json
{
  "tool": "list_issues",
  "arguments": {
    "jql": "project = PROJ AND status = 'In Progress' ORDER BY priority DESC"
  }
}
```

### Get Issue with Comments
```json
{
  "tool": "get_issue",
  "arguments": {
    "issue_key": "PROJ-123"
  }
}
```

### Search Issues
```json
{
  "tool": "search_issues",
  "arguments": {
    "text": "login authentication bug"
  }
}
```

### Get Sprint Burndown
```json
{
  "tool": "get_sprint_burndown",
  "arguments": {
    "sprint_id": 42
  }
}
```

## Docker

### Build the Image
```bash
docker build -t jira-mcp .
```

### Run the Container
```bash
docker run -d \
  --name jira-mcp \
  -p 8000:8000 \
  -e JIRA_HOST=https://your-domain.atlassian.net \
  -e JIRA_EMAIL=your-email@example.com \
  -e JIRA_API_TOKEN=your-api-token \
  jira-mcp
```

## MCP Client Configuration

Add to your MCP client configuration (e.g., Claude Desktop):

```json
{
  "mcpServers": {
    "jira": {
      "command": "node",
      "args": ["/path/to/jira-mcp/dist/index.js", "--stdio"],
      "env": {
        "JIRA_HOST": "https://your-domain.atlassian.net",
        "JIRA_EMAIL": "your-email@example.com",
        "JIRA_API_TOKEN": "your-api-token"
      }
    }
  }
}
```

## Troubleshooting

### Authentication Errors
- Verify your API token is correct and hasn't expired
- Ensure the email matches your Atlassian account
- Check that your account has the required permissions

### Rate Limiting
Jira Cloud has rate limits. If you encounter 429 errors:
- Reduce the frequency of requests
- Use smaller `maxResults` values
- Consider implementing request queuing

### Sprint/Board Errors
- Sprint features require Jira Software (not just Jira Work Management)
- Ensure you have access to the specific board
- Some board types may not support all sprint features

## Development

```bash
# Run in development mode
npm run dev

# Lint code
npm run lint

# Clean build artifacts
npm run clean
```

## License

MIT
