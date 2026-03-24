# Sales Pipeline MCP Server

A Model Context Protocol (MCP) server providing pre-built sales pipeline reports and KPIs. Wraps D365 Sales, Salesforce, or generic CRM systems with curated sales metrics for AI-powered sales analytics.

## Overview

This MCP server gives AI assistants direct access to critical sales data without requiring custom queries or complex integrations. It provides 19 pre-built tools covering:

- **Pipeline Analysis** - Understand pipeline health by stage, rep, and segment
- **Forecasting** - Commit, most likely, and best case forecasts vs quota
- **Deal Management** - Track closing deals, stalled opportunities, and at-risk accounts
- **Activity Tracking** - Monitor calls, emails, meetings by rep
- **Performance Metrics** - Win rates, sales cycles, leaderboards, and quota attainment

## Sales Leader Use Cases

### Weekly Forecast Call Preparation

```
"Show me pipeline changes from the last 7 days and deals closing this month"

Tools used:
- get_pipeline_changes (days: 7)
- get_closing_this_month
- get_at_risk_deals
```

### Quarter-End Pipeline Review

```
"Give me forecast vs quota for Q1 2024 and identify who's behind"

Tools used:
- get_forecast_vs_quota (period: "2024-Q1")
- get_quota_attainment (period: "2024-Q1")
- get_coverage_ratio (period: "2024-Q1")
```

### Rep Coaching Session

```
"Show me John's pipeline, activity this week, and win rate comparison"

Tools used:
- get_pipeline_by_rep (rep_email: "john@company.com")
- get_activity_by_rep (days: 7)
- get_win_rate (group_by: "rep")
```

### Deal Review / Inspection

```
"What are our top 20 deals and which ones are stalled?"

Tools used:
- get_largest_deals (limit: 20)
- get_stalled_deals (days: 14)
- get_at_risk_deals
```

### Territory/Segment Analysis

```
"Break down pipeline and win rate by customer segment"

Tools used:
- get_pipeline_by_segment (group_by: "segment")
- get_win_rate (group_by: "segment")
- get_sales_cycle (group_by: "segment")
```

### Sales Team Meeting

```
"Show me the leaderboard, team activity summary, and accounts needing attention"

Tools used:
- get_leaderboard (metric: "bookings")
- get_activity_summary (days: 7)
- get_accounts_without_activity (days: 30)
```

## Available Tools

### Pipeline Tools

| Tool | Description |
|------|-------------|
| `get_pipeline_summary` | Total pipeline by stage with amounts, weighted values, and averages |
| `get_pipeline_by_rep` | Pipeline breakdown by sales rep with stage distribution |
| `get_pipeline_by_segment` | Pipeline grouped by customer segment, region, or deal type |
| `get_pipeline_changes` | What moved in/out of pipeline (added, closed won, closed lost) |

### Forecast Tools

| Tool | Description |
|------|-------------|
| `get_forecast` | Sales forecast for a period (commit, most likely, best case) |
| `get_forecast_vs_quota` | Forecast compared to quota by rep or team |
| `get_commit_vs_best_case` | Breakdown of commit, most likely, and best case amounts |
| `get_coverage_ratio` | Pipeline coverage vs quota (e.g., 3x coverage target) |

### Deal Tools

| Tool | Description |
|------|-------------|
| `get_closing_this_month` | Deals expected to close this month, grouped by week |
| `get_stalled_deals` | Deals with no activity in N days |
| `get_at_risk_deals` | Deals flagged as at risk based on multiple criteria |
| `get_largest_deals` | Top deals by amount |

### Activity Tools

| Tool | Description |
|------|-------------|
| `get_activity_summary` | Calls, emails, meetings summary with daily breakdown |
| `get_activity_by_rep` | Activity metrics by rep with team comparison |
| `get_accounts_without_activity` | Accounts with open opportunities lacking recent touch |

### Performance Tools

| Tool | Description |
|------|-------------|
| `get_win_rate` | Win rate by rep, team, segment, or stage |
| `get_sales_cycle` | Average sales cycle length by rep, segment, or deal size |
| `get_leaderboard` | Rep rankings by bookings, deals, deal size, or win rate |
| `get_quota_attainment` | Quota attainment by rep with forecast projections |

## Metric Definitions

### Pipeline Metrics

| Metric | Definition |
|--------|------------|
| **Total Pipeline Value** | Sum of amounts for all open opportunities |
| **Weighted Pipeline Value** | Sum of (amount x probability) for each opportunity |
| **Average Deal Size** | Total pipeline value / number of opportunities |
| **Pipeline Coverage** | Total pipeline value / quota target (ideal: 3-4x) |

### Forecast Categories

| Category | Definition |
|----------|------------|
| **Commit** | Deals highly likely to close (90%+ probability or explicitly committed) |
| **Most Likely** | Weighted forecast based on probability (sum of amount x probability) |
| **Best Case** | All deals that could potentially close (commit + upside) |
| **Closed** | Revenue already booked in the period |

### Deal Status Definitions

| Status | Definition |
|--------|------------|
| **Stalled** | No activity (calls, emails, meetings) in X days (default: 14) |
| **At Risk** | Flagged based on: past close date, low probability for stage, no activity, or manual flag |
| **Past Due** | Close date has passed but deal is still open |

### Performance Metrics

| Metric | Definition |
|--------|------------|
| **Win Rate** | (Closed Won) / (Closed Won + Closed Lost) x 100 |
| **Sales Cycle** | Days from opportunity creation to close date |
| **Quota Attainment** | (Closed Revenue) / (Quota) x 100 |
| **Forecast Attainment** | (Closed + Commit) / (Quota) x 100 |

### Activity Types

| Type | Examples |
|------|----------|
| **Call** | Phone calls, video calls logged in CRM |
| **Email** | Tracked/logged emails |
| **Meeting** | Calendar events linked to accounts/opportunities |
| **Task** | Other activities (follow-ups, research, etc.) |

## Installation

```bash
# Clone or copy the project
cd sales-pipeline-mcp

# Install dependencies
npm install

# Copy environment template
cp .env.example .env

# Configure CRM credentials in .env
# See .env.example for options

# Build the project
npm run build

# Start the server
npm start
```

## Configuration

### Salesforce

```env
CRM_PROVIDER=salesforce
SF_LOGIN_URL=https://login.salesforce.com
SF_CLIENT_ID=your_client_id
SF_CLIENT_SECRET=your_client_secret
SF_USERNAME=your_username
SF_PASSWORD=your_password_with_token
```

### Dynamics 365 Sales

```env
CRM_PROVIDER=d365
D365_TENANT_ID=your_tenant_id
D365_CLIENT_ID=your_client_id
D365_CLIENT_SECRET=your_client_secret
D365_RESOURCE_URL=https://your-org.crm.dynamics.com
```

### Generic CRM

```env
CRM_PROVIDER=generic
GENERIC_API_BASE_URL=https://your-crm-api.example.com
GENERIC_API_KEY=your_api_key
GENERIC_API_SECRET=your_api_secret
```

## Docker Deployment

```bash
# Build the image
docker build -t sales-pipeline-mcp .

# Run with environment file
docker run -d --env-file .env -p 8000:8000 sales-pipeline-mcp
```

## Health Check

The server exposes a health endpoint at `GET /health`:

```json
{
  "status": "healthy",
  "service": "sales-pipeline-mcp",
  "crm": {
    "provider": "salesforce",
    "connected": true
  },
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

## Architecture

```
sales-pipeline-mcp/
├── src/
│   ├── index.ts              # Entry point, HTTP server
│   ├── server.ts             # MCP server setup
│   ├── connectors/
│   │   └── crm.ts            # CRM connector (SF, D365, generic)
│   └── tools/
│       ├── pipeline-tools.ts  # Pipeline analysis tools
│       ├── forecast-tools.ts  # Forecasting tools
│       ├── deal-tools.ts      # Deal management tools
│       ├── activity-tools.ts  # Activity tracking tools
│       └── performance-tools.ts # Performance metrics
├── package.json
├── tsconfig.json
├── Dockerfile
├── .env.example
└── README.md
```

## Extending

### Adding a New CRM Provider

1. Implement the `CrmConnector` abstract class in `src/connectors/crm.ts`
2. Add provider initialization in the factory function
3. Update environment validation in `src/index.ts`

### Adding Custom Metrics

1. Create a new tool file in `src/tools/`
2. Define Zod schemas, types, and tool implementations
3. Export the tools array
4. Import and add to `allTools` in `src/server.ts`

## Security Notes

- Never commit `.env` files with real credentials
- Use environment variables or secrets management in production
- The health endpoint does not expose sensitive data
- CRM queries are read-only; no data modification capabilities

## License

MIT
