# Finance Dashboard MCP Server

A pre-built reports server that wraps D365 Finance, QuickBooks, or generic finance systems with curated KPIs and financial dashboards. Designed for CFOs and finance teams to get instant insights through natural language queries.

## Features

- **Multi-System Support**: Connect to Microsoft Dynamics 365 Finance, QuickBooks, or any generic finance API
- **Curated KPIs**: Pre-built financial metrics with trend indicators
- **Executive Dashboards**: Quick snapshots of financial health
- **AR/AP Management**: Detailed aging reports and collection forecasts
- **Cash Management**: Cash position, flow forecasts, and runway analysis
- **Budget Tracking**: Budget vs. actual with variance analysis
- **Revenue Analytics**: Trend analysis, segmentation, and MRR metrics

## CFO Use Cases

### Daily Morning Briefing
```
"Give me today's financial summary"
"What's our cash position across all accounts?"
"Show me any significant budget variances"
```

### Cash Flow Management
```
"What's our cash runway at current burn rate?"
"Show me the 6-month cash flow forecast"
"What payments are due this week?"
```

### Collections & Receivables
```
"What's our DSO and how does it trend?"
"Show me the top 10 outstanding receivables"
"What collections do we expect this month?"
```

### Budget Reviews
```
"How is Marketing tracking against budget?"
"Show me all departments over 90% budget utilization"
"Compare Q1 vs Q2 spending"
```

### Revenue Analysis
```
"What's our MRR and growth rate?"
"Show revenue by business segment"
"What's the revenue trend over the last 12 months?"
```

### Board Reporting
```
"Compare this month's financials to last month"
"Give me all KPIs with trends"
"What's our gross margin and how is it trending?"
```

## KPI Definitions

### Profitability KPIs
| KPI | Definition | Good Target |
|-----|------------|-------------|
| **Gross Margin** | (Revenue - COGS) / Revenue x 100 | Industry dependent, typically 30-70% |
| **Net Margin** | Net Profit / Revenue x 100 | 10-20% for healthy business |
| **EBITDA** | Earnings Before Interest, Taxes, Depreciation, Amortization | Positive and growing |

### Liquidity KPIs
| KPI | Definition | Good Target |
|-----|------------|-------------|
| **Current Ratio** | Current Assets / Current Liabilities | 1.5-3.0 |
| **Quick Ratio** | (Current Assets - Inventory) / Current Liabilities | > 1.0 |
| **Working Capital** | Current Assets - Current Liabilities | Positive and stable |

### Efficiency KPIs
| KPI | Definition | Good Target |
|-----|------------|-------------|
| **DSO** (Days Sales Outstanding) | (Accounts Receivable / Revenue) x 365 | 30-45 days |
| **DPO** (Days Payable Outstanding) | (Accounts Payable / COGS) x 365 | 30-60 days |
| **Cash Conversion Cycle** | DSO + DIO - DPO | Lower is better |

### SaaS/Subscription KPIs
| KPI | Definition | Good Target |
|-----|------------|-------------|
| **MRR** (Monthly Recurring Revenue) | Sum of monthly subscription revenue | Growing month-over-month |
| **ARR** (Annual Recurring Revenue) | MRR x 12 | Growing year-over-year |
| **Net Revenue Retention** | (Starting MRR + Expansion - Contraction - Churn) / Starting MRR | > 100% |
| **Churn Rate** | Lost MRR / Starting MRR x 100 | < 5% monthly |

## Available Tools

### KPI Tools
- `get_financial_summary` - Key metrics snapshot (revenue, expenses, profit, cash)
- `get_kpi_dashboard` - All KPIs with trend indicators
- `compare_periods` - Compare two periods (params: period1, period2)

### Accounts Receivable Tools
- `get_ar_summary` - AR total, aging buckets, DSO
- `get_ar_aging` - Detailed aging report
- `get_top_receivables` - Largest outstanding receivables
- `get_collection_forecast` - Expected collections by week

### Accounts Payable Tools
- `get_ap_summary` - AP total, aging, DPO
- `get_ap_aging` - Detailed AP aging
- `get_upcoming_payments` - Payments due this week/month

### Cash Management Tools
- `get_cash_position` - Current cash across accounts
- `get_cash_flow_forecast` - Projected cash flow
- `get_cash_runway` - Months of runway at current burn

### Budget Tools
- `get_budget_vs_actual` - Budget vs actual by category
- `get_variance_report` - Significant variances
- `get_department_spending` - Spending by department

### Revenue Tools
- `get_revenue_trend` - Revenue by month/quarter
- `get_revenue_by_segment` - Revenue breakdown
- `get_mrr` - Monthly recurring revenue (if applicable)

## Installation

```bash
npm install
npm run build
```

## Configuration

Copy `.env.example` to `.env` and configure for your finance system:

### For D365 Finance
```env
FINANCE_SYSTEM=d365
D365_TENANT_ID=your-tenant-id
D365_CLIENT_ID=your-client-id
D365_CLIENT_SECRET=your-client-secret
D365_RESOURCE=https://your-instance.operations.dynamics.com
D365_ENVIRONMENT=your-environment
```

### For QuickBooks
```env
FINANCE_SYSTEM=quickbooks
QB_CLIENT_ID=your-client-id
QB_CLIENT_SECRET=your-client-secret
QB_REALM_ID=your-realm-id
QB_REFRESH_TOKEN=your-refresh-token
QB_ENVIRONMENT=sandbox
```

### For Generic API
```env
FINANCE_SYSTEM=generic
FINANCE_API_URL=https://your-finance-api.com
FINANCE_API_KEY=your-api-key
```

## Running

### Development
```bash
npm run dev
```

### Production
```bash
npm start
```

### Docker
```bash
docker build -t finance-dashboard-mcp .
docker run -p 8000:8000 --env-file .env finance-dashboard-mcp
```

## API Endpoints

- `GET /health` - Health check with connected systems status
- `GET /sse` - Server-Sent Events endpoint for MCP communication
- `POST /messages` - Message handling for SSE transport

## Integration Examples

### Ask for Executive Summary
```json
{
  "tool": "get_financial_summary"
}
```
Response:
```json
{
  "summary": {
    "revenue": 1250000,
    "expenses": 875000,
    "grossProfit": 500000,
    "netProfit": 375000,
    "grossMargin": 40.0,
    "netMargin": 30.0,
    "cash": 2150000
  },
  "asOfDate": "2024-03-01",
  "currency": "USD"
}
```

### Get Cash Runway
```json
{
  "tool": "get_cash_runway"
}
```
Response:
```json
{
  "currentCash": 2150000,
  "averageMonthlyBurn": 875000,
  "runwayMonths": 2,
  "runwayEndDate": "2024-05-01",
  "currency": "USD",
  "burnTrend": "stable",
  "analysis": "At current burn rate of 875,000 USD/month, cash runway is approximately 2 months (until 2024-05-01). Burn rate has been stable."
}
```

### Compare Periods
```json
{
  "tool": "compare_periods",
  "arguments": {
    "period1": "2024-02",
    "period2": "2024-01"
  }
}
```

## Security Considerations

- Store credentials in environment variables, never in code
- Use read-only API permissions where possible
- Implement rate limiting for production deployments
- Consider data masking for sensitive financial information
- Audit log all data access

## License

Proprietary - AlphaByte Solutions
