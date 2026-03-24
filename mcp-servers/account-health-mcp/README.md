# Account Health MCP Server

A **cross-system aggregator** MCP server that combines data from multiple enterprise systems (CRM, Finance, Support) to provide comprehensive account health insights through the Model Context Protocol.

## Overview

This server demonstrates the power of **Option 05 - Cross-System Integration** by:

- Pulling account data from your CRM (Salesforce or Dynamics 365)
- Retrieving financial data from your accounting system (QuickBooks or D365 Finance)
- Gathering support metrics from your help desk (Zendesk or ServiceNow)
- Calculating unified health scores using a weighted algorithm
- Providing actionable insights and recommendations

```
┌─────────────────────────────────────────────────────────────────┐
│                    Account Health MCP Server                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────┐   ┌──────────┐   ┌──────────┐                    │
│  │   CRM    │   │ Finance  │   │ Support  │                    │
│  │Connector │   │Connector │   │Connector │                    │
│  └────┬─────┘   └────┬─────┘   └────┬─────┘                    │
│       │              │              │                           │
│       │   Salesforce │   QuickBooks │   Zendesk                │
│       │   Dynamics   │   D365 Fin   │   ServiceNow             │
│       └──────────────┴──────────────┘                           │
│                      │                                          │
│              ┌───────▼───────┐                                  │
│              │    Health     │                                  │
│              │  Calculator   │                                  │
│              └───────┬───────┘                                  │
│                      │                                          │
│  ┌───────────────────┼───────────────────┐                     │
│  │                   │                   │                      │
│  ▼                   ▼                   ▼                      │
│ Health            Revenue           Engagement                  │
│ Tools             Tools             Tools                       │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Data Sources

Copy the example environment file and configure your credentials:

```bash
cp .env.example .env
```

Edit `.env` to configure at least one system from each category:

**CRM (choose one):**
- Salesforce - Set `CRM_PROVIDER=salesforce` and `SF_*` variables
- Dynamics 365 - Set `CRM_PROVIDER=dynamics365` and `D365_*` variables

**Finance (choose one):**
- QuickBooks Online - Set `FINANCE_PROVIDER=quickbooks` and `QB_*` variables
- D365 Finance - Set `FINANCE_PROVIDER=dynamics365_finance` and `D365_FINANCE_*` variables

**Support (choose one):**
- Zendesk - Set `SUPPORT_PROVIDER=zendesk` and `ZENDESK_*` variables
- ServiceNow - Set `SUPPORT_PROVIDER=servicenow` and `SERVICENOW_*` variables

### 3. Build and Run

```bash
# Development
npm run dev

# Production
npm run build
npm start
```

### 4. Verify

Check the server is running:

```bash
curl http://localhost:8000/health
```

## Available Tools

### Health Analysis

| Tool | Description |
|------|-------------|
| `get_account_health` | Get comprehensive health score for an account including revenue trend, support tickets, payment status, and engagement |
| `get_top_accounts_health` | Get health summary for top N accounts by revenue |
| `get_at_risk_accounts` | Identify accounts with declining health scores or high-risk indicators |
| `get_health_factors` | Explain what factors contribute to an account's health score with recommendations |

### Revenue Analysis

| Tool | Description |
|------|-------------|
| `get_account_revenue` | Get revenue history for an account over a specified period (3m, 6m, 12m, 24m, ytd, all) |
| `get_revenue_trend` | Compare revenue between time periods to identify growth or decline |

### Engagement Tracking

| Tool | Description |
|------|-------------|
| `get_account_activity` | Get recent activity across all systems (CRM, Support, Finance) |
| `get_last_contact` | Find when an account was last contacted and by whom |

### System

| Tool | Description |
|------|-------------|
| `get_connector_status` | Check the connection status of all data source connectors |

## Health Score Algorithm

The health score is calculated using a weighted algorithm that considers four factors:

| Factor | Default Weight | Description |
|--------|---------------|-------------|
| Revenue | 30% | Revenue trend, growth rate, pipeline value |
| Payment | 25% | Payment timeliness, outstanding balance, overdue amounts |
| Support | 25% | Open tickets, priority distribution, resolution time, satisfaction |
| Engagement | 20% | Activity recency, frequency, touchpoint diversity |

You can customize these weights via environment variables:

```env
HEALTH_WEIGHT_REVENUE=0.30
HEALTH_WEIGHT_PAYMENT=0.25
HEALTH_WEIGHT_SUPPORT=0.25
HEALTH_WEIGHT_ENGAGEMENT=0.20
```

### Risk Levels

| Level | Score Range | Description |
|-------|-------------|-------------|
| Low | 70-100 | Account is healthy |
| Medium | 60-69 | Account needs attention |
| High | 40-59 | Account at risk, action required |
| Critical | 0-39 | Immediate intervention needed |

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Basic health check |
| `/status` | GET | Detailed status with connector info |
| `/sse` | GET | SSE endpoint for MCP clients |
| `/messages` | POST | Message endpoint for MCP protocol |

## Docker Deployment

Build and run the container:

```bash
# Build
docker build -t account-health-mcp .

# Run with environment file
docker run -p 8000:8000 --env-file .env account-health-mcp

# Or with individual variables
docker run -p 8000:8000 \
  -e CRM_PROVIDER=salesforce \
  -e SF_CLIENT_ID=xxx \
  -e SF_CLIENT_SECRET=xxx \
  -e SF_USERNAME=xxx \
  -e SF_PASSWORD=xxx \
  account-health-mcp
```

## Project Structure

```
account-health-mcp/
├── src/
│   ├── index.ts              # Entry point, HTTP server
│   ├── server.ts             # MCP server setup, connector init
│   ├── connectors/
│   │   ├── crm.ts            # Salesforce/D365 connector
│   │   ├── finance.ts        # QuickBooks/D365 Finance connector
│   │   └── support.ts        # Zendesk/ServiceNow connector
│   ├── services/
│   │   └── health-calculator.ts  # Health score algorithm
│   └── tools/
│       ├── health-tools.ts   # Health analysis tools
│       ├── revenue-tools.ts  # Revenue analysis tools
│       └── engagement-tools.ts # Engagement tracking tools
├── package.json
├── tsconfig.json
├── Dockerfile
├── .env.example
└── README.md
```

## Example Usage

### Get Account Health

```json
{
  "tool": "get_account_health",
  "arguments": {
    "account_id": "001ABC123"
  }
}
```

Response includes:
- Overall health score (0-100)
- Component scores (revenue, payment, support, engagement)
- Risk level and trend
- Detailed metrics from each system

### Find At-Risk Accounts

```json
{
  "tool": "get_at_risk_accounts",
  "arguments": {}
}
```

Returns accounts sorted by risk level with specific risk factors identified.

### Analyze Revenue Trend

```json
{
  "tool": "get_revenue_trend",
  "arguments": {
    "account_id": "001ABC123",
    "comparison_periods": 6
  }
}
```

Compares the last 6 months to the previous 6 months with growth analysis.

## Troubleshooting

### Connector Not Connected

Check the `/status` endpoint to see which connectors are failing:

```bash
curl http://localhost:8000/status | jq '.connectors'
```

Common issues:
- Missing or invalid credentials
- Network/firewall blocking API calls
- OAuth tokens expired (especially for QuickBooks)

### Health Score Seems Off

Use `get_health_factors` to understand what's influencing the score:

```json
{
  "tool": "get_health_factors",
  "arguments": {
    "account_id": "001ABC123"
  }
}
```

This shows the contribution of each factor and specific recommendations.

## Security Considerations

- Store credentials in environment variables or a secrets manager
- Use the non-root user in the Docker container (enabled by default)
- All API connections use HTTPS
- OAuth tokens are not logged or exposed

## License

MIT
