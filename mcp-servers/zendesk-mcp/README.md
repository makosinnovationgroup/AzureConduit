# Zendesk MCP Server

An MCP (Model Context Protocol) server that provides tools for interacting with Zendesk Support API. This server enables AI assistants to query tickets, users, and analytics data from your Zendesk instance.

## Features

### Ticket Tools
- **list_tickets** - List tickets with optional filtering by status, priority, assignee, or requester
- **get_ticket** - Get detailed ticket information including all comments/conversation history
- **search_tickets** - Search tickets using Zendesk search syntax
- **get_ticket_metrics** - Get SLA and performance metrics for a specific ticket

### User Tools
- **list_agents** - List all support agents and admins
- **get_user** - Get detailed information about any user
- **search_users** - Search users by email, name, or other criteria

### Analytics Tools
- **get_ticket_stats** - Get ticket counts by status (new, open, pending, hold, solved, closed)
- **get_sla_compliance** - Get SLA compliance metrics based on response and resolution times
- **get_agent_workload** - Get workload distribution showing tickets per agent

## Prerequisites

- Node.js 18 or higher
- A Zendesk Support account with API access
- An API token generated from Zendesk Admin

## Zendesk API Token Setup

1. Log in to your Zendesk Admin Center
2. Navigate to **Apps and integrations** > **APIs** > **Zendesk API**
3. Click the **Settings** tab
4. Enable **Token Access** if not already enabled
5. Click **Add API token**
6. Give your token a description (e.g., "MCP Server")
7. Click **Copy** to copy the token - you won't be able to see it again!
8. Click **Save**

## Required Permissions

The API token inherits the permissions of the user it's associated with. For full functionality, the user should have:

- **Agent** or **Admin** role (to view and manage tickets)
- Access to all groups (or specific groups as needed)
- Permission to view user profiles

Minimum permissions needed:
- `tickets:read` - View tickets and ticket metrics
- `users:read` - View user profiles and search users

## Configuration

Create a `.env` file based on `.env.example`:

```bash
# Your Zendesk subdomain
# If your URL is https://mycompany.zendesk.com, use 'mycompany'
ZENDESK_SUBDOMAIN=your_subdomain

# The email address of the user who owns the API token
ZENDESK_EMAIL=your_email@company.com

# The API token you generated
ZENDESK_API_TOKEN=your_api_token

# Server configuration
PORT=8000
LOG_LEVEL=info
```

## Installation

```bash
# Install dependencies
npm install

# Build the TypeScript
npm run build

# Start the server
npm start
```

## Development

```bash
# Run in development mode
npm run dev
```

## Docker

```bash
# Build the image
docker build -t zendesk-mcp .

# Run the container
docker run -p 8000:8000 \
  -e ZENDESK_SUBDOMAIN=your_subdomain \
  -e ZENDESK_EMAIL=your_email@company.com \
  -e ZENDESK_API_TOKEN=your_api_token \
  zendesk-mcp
```

## Endpoints

- `GET /health` - Health check endpoint
- `GET /sse` - SSE endpoint for MCP clients
- `POST /messages` - Message handling for MCP protocol

## Usage Examples

Once connected to an MCP client, you can use natural language to:

- "List all open tickets assigned to me"
- "Show me ticket #12345 with all comments"
- "Search for tickets about billing issues"
- "Get SLA metrics for ticket #12345"
- "Show me the current ticket statistics"
- "Who are all the agents in our Zendesk?"
- "Find the user with email john@example.com"
- "Show agent workload distribution"

## Zendesk Search Syntax

The `search_tickets` and `search_users` tools support Zendesk's powerful search syntax:

```
# Status filters
status:open
status:pending
status<solved (open, pending, or hold)

# Priority filters
priority:urgent
priority:high

# Field searches
subject:billing
description:refund
tags:vip

# User searches
requester:john@example.com
assignee:agent@company.com

# Date filters
created>2024-01-01
updated<1week

# Combined
status:open priority:urgent tags:escalated
```

## API Rate Limits

Zendesk has API rate limits. This server handles rate limiting gracefully, but be aware:
- Standard plans: 200 requests per minute
- Professional and Enterprise: 400 requests per minute
- High Volume Add-on: 700 requests per minute

## Troubleshooting

### "Unauthorized" errors
- Verify your API token is correct and hasn't been revoked
- Ensure the email matches the user who created the token
- Check that Token Access is enabled in Zendesk API settings

### "Forbidden" errors
- The user associated with the token may not have the required permissions
- Check that the user has Agent or Admin role

### Connection issues
- Verify your subdomain is correct (without .zendesk.com)
- Check your network allows connections to *.zendesk.com

## License

MIT
