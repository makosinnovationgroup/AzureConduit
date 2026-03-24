# Legal Matter MCP Server

A Model Context Protocol (MCP) server for legal practice management, providing AI assistants with access to matter management, time tracking, billing, and document management systems.

## Industry Focus: Law Firms & Legal Departments

This MCP server is designed specifically for legal practice environments and integrates with popular legal practice management platforms:

- **Clio** - Cloud-based legal practice management
- **PracticePanther** - Legal software for small to mid-sized firms
- **Custom** - Any legal management system with a REST API

## Features

### Matter Management
- List and search legal matters
- Get detailed matter information
- Track matter timelines, deadlines, and key dates
- View active matter portfolios by attorney or practice area

### Time Tracking
- Retrieve time entries for matters
- Track unbilled time across the firm
- Calculate attorney utilization and billable hours
- Generate time summaries by period

### Billing & Accounts Receivable
- Matter billing summaries (billed, collected, outstanding)
- Accounts receivable aging reports
- Work in progress (WIP) tracking
- Financial health indicators

### Document Management
- Search documents across matters
- Access recent documents
- Filter by document type and metadata

## Available Tools

| Tool | Description |
|------|-------------|
| `list_matters` | List matters with filters for client, status, attorney, practice area |
| `get_matter` | Get detailed information about a specific matter |
| `search_matters` | Full-text search across matters |
| `get_matter_timeline` | Key dates, deadlines, hearings for a matter |
| `get_active_matters` | All currently active matters with summaries |
| `get_matter_time` | Time entries for a specific matter |
| `get_unbilled_time` | Unbilled time by matter or attorney |
| `get_attorney_utilization` | Billable hours vs available hours |
| `get_time_summary` | Time summary for date range |
| `get_matter_billing` | Billing summary (billed, collected, outstanding) |
| `get_ar_by_client` | Accounts receivable aging by client |
| `get_wip` | Work in progress not yet billed |
| `search_documents` | Search matter documents |
| `get_recent_documents` | Recent documents for a matter |

## Setup

### 1. Clone and Install Dependencies

```bash
cd legal-matter-mcp
npm install
```

### 2. Configure Environment

Copy the example environment file and configure your settings:

```bash
cp .env.example .env
```

Edit `.env` with your matter management platform credentials.

### 3. Obtain API Credentials

#### For Clio:

1. Log in to Clio and navigate to Settings > API
2. Create a new API application
3. Note your Client ID and Client Secret
4. Implement OAuth2 flow to obtain access token
5. Configure `MATTER_BASE_URL=https://app.clio.com`

#### For PracticePanther:

1. Contact PracticePanther support for API access
2. Obtain OAuth2 credentials
3. Configure `MATTER_BASE_URL=https://app.practicepanther.com`

### 4. Build and Run

```bash
# Build TypeScript
npm run build

# Start server
npm start

# Or for development
npm run dev
```

### 5. Verify

```bash
curl http://localhost:8000/health
```

## Docker Deployment

```bash
# Build image
docker build -t legal-matter-mcp .

# Run container
docker run -d \
  --name legal-matter-mcp \
  -p 8000:8000 \
  --env-file .env \
  legal-matter-mcp
```

## Ethical Considerations for Legal AI

### Attorney-Client Privilege

This server handles privileged legal information. Consider these safeguards:

1. **Access Control**: Ensure only authorized personnel can access the MCP server
2. **Audit Logging**: Enable `AUDIT_LOGGING_ENABLED=true` to track all data access
3. **Data Minimization**: Request only necessary information in AI queries
4. **No External Transmission**: Ensure AI responses containing privileged data are not transmitted outside the firm

### Confidentiality

- **Client Data Protection**: All matter and client information is confidential
- **Conflict Checking**: This server does not perform conflict checks - maintain separate conflict processes
- **Data Retention**: Follow your jurisdiction's data retention requirements

### Professional Responsibility

- **Supervision**: AI-generated insights should be reviewed by licensed attorneys
- **Competence**: Understand the limitations of AI analysis for legal matters
- **Billing Accuracy**: Verify time and billing data before client invoicing
- **Unauthorized Practice**: Ensure AI usage doesn't constitute unauthorized practice of law

### Regulatory Compliance

Consider compliance with:
- **ABA Model Rules** - Rules 1.1 (Competence), 1.6 (Confidentiality), 5.3 (Supervision)
- **State Bar Rules** - Check your jurisdiction's rules on technology use
- **GDPR/CCPA** - If handling personal data of EU/California residents
- **HIPAA** - If handling health-related legal matters

## Security Best Practices

1. **Network Security**: Deploy behind a VPN or private network
2. **TLS**: Always use HTTPS in production
3. **Token Rotation**: Rotate API tokens regularly
4. **Least Privilege**: Use API credentials with minimal required permissions
5. **Monitoring**: Monitor for unusual access patterns

## Example Queries

### Get Active Litigation Matters

```
"Show me all active litigation matters"
```

### Check Attorney Utilization

```
"What is the utilization rate for all attorneys this month?"
```

### Review Outstanding AR

```
"Which clients have outstanding invoices over 60 days?"
```

### Find Related Documents

```
"Search for all documents related to the Johnson contract dispute"
```

## API Endpoints

- `GET /health` - Health check endpoint
- `GET /sse` - Server-Sent Events endpoint for MCP connection
- `POST /messages` - Message handling for MCP protocol

## Troubleshooting

### Connection Issues

1. Verify API credentials in `.env`
2. Check network connectivity to matter management platform
3. Ensure OAuth tokens are not expired

### Rate Limiting

If receiving rate limit errors:
1. Reduce `API_RATE_LIMIT` in configuration
2. Add delays between requests in high-volume queries

### Missing Data

1. Check user permissions in the matter management platform
2. Verify the matter/client exists and is accessible
3. Review API logs for error details

## License

Proprietary - For internal use only.

## Support

Contact the IT department for support with this MCP server.
