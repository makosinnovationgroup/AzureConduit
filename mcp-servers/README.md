# AzureConduit MCP Server Library

**19 pre-built MCP servers ready to deploy with AzureConduit.**

This library provides production-ready MCP (Model Context Protocol) servers for common business systems. Each server can be deployed to Azure Container Apps using the AzureConduit Terraform module, giving Claude access to your business data through natural language.

---

## Quick Start

```bash
# 1. Choose a server
cd salesforce-mcp

# 2. Configure credentials
cp .env.example .env
# Edit .env with your credentials

# 3. Build and run locally
npm install
npm run build
npm start

# 4. Or build Docker image
docker build -t salesforce-mcp .
docker run -p 8000:8000 --env-file .env salesforce-mcp

# 5. Deploy to Azure with Terraform
# Set mcp_image to your ACR image in terraform.tfvars
```

---

## Server Catalog

### Starter Templates

For learning MCP basics or building custom integrations.

| Server | Description | Tools | Use Case |
|--------|-------------|-------|----------|
| [hello-world-mcp](./hello-world-mcp) | Minimal MCP server example | 2 | Learning, testing |
| [sql-database-mcp](./sql-database-mcp) | Connect to any SQL database | 4 | On-prem databases, data warehouses |
| [rest-api-mcp](./rest-api-mcp) | Generic REST API connector | 7 | Any system with a REST API |

---

### Business System Connectors

Connect Claude to popular platforms not covered by Microsoft's MCP servers.

| Server | Description | Tools | Example Questions |
|--------|-------------|-------|-------------------|
| [salesforce-mcp](./salesforce-mcp) | Salesforce CRM | 11 | "What opportunities are closing this month?" |
| [quickbooks-mcp](./quickbooks-mcp) | QuickBooks Online accounting | 11 | "Show me our P&L for Q3" |
| [zendesk-mcp](./zendesk-mcp) | Zendesk support tickets | 10 | "How many tickets are overdue on SLA?" |
| [hubspot-mcp](./hubspot-mcp) | HubSpot CRM & marketing | 11 | "What's our deal pipeline by stage?" |
| [jira-mcp](./jira-mcp) | Jira issue tracking | 11 | "What's left in the current sprint?" |

---

### Cross-System Aggregators

The real power of custom MCP — combine data from multiple sources into unified insights.

| Server | Combines | Tools | Example Questions |
|--------|----------|-------|-------------------|
| [account-health-mcp](./account-health-mcp) | CRM + Finance + Support | 8 | "Which accounts are at risk of churning?" |
| [employee-360-mcp](./employee-360-mcp) | HR + Azure AD + Intune | 10 | "Show me everything about John Smith" |
| [order-status-mcp](./order-status-mcp) | ERP + Shipping + Inventory | 10 | "Where is order #12345 and when will it arrive?" |
| [vendor-management-mcp](./vendor-management-mcp) | AP + Contracts + Performance | 13 | "Which vendors are underperforming?" |

---

### Industry-Specific Solutions

Built for regulated industries with compliance requirements.

| Server | Industry | Tools | Compliance Features |
|--------|----------|-------|---------------------|
| [legal-matter-mcp](./legal-matter-mcp) | Law Firms | 14 | Attorney-client privilege guidance |
| [patient-portal-mcp](./patient-portal-mcp) | Healthcare | 12 | HIPAA audit logging, PHI access controls |
| [property-management-mcp](./property-management-mcp) | Real Estate | 19 | Multi-property, tenant, lease management |
| [manufacturing-floor-mcp](./manufacturing-floor-mcp) | Manufacturing | 16 | MES integration, OEE metrics, quality tracking |

---

### Pre-Built Executive Dashboards

Curated KPIs for leadership — no raw data, just insights.

| Server | Audience | Tools | Key Metrics |
|--------|----------|-------|-------------|
| [finance-dashboard-mcp](./finance-dashboard-mcp) | CFO | 18 | AR aging, cash runway, budget vs actual |
| [sales-pipeline-mcp](./sales-pipeline-mcp) | CRO | 19 | Pipeline coverage, forecast, win rates |
| [it-assets-mcp](./it-assets-mcp) | CIO | 19 | Device compliance, license costs, security posture |

---

## Architecture

Each MCP server follows the same structure:

```
server-name-mcp/
├── src/
│   ├── index.ts          # HTTP server entry point (port 8000)
│   ├── server.ts         # MCP server setup and tool registration
│   ├── connectors/       # API clients for external systems
│   ├── tools/            # MCP tool implementations
│   └── utils/            # Logging, helpers
├── package.json          # Dependencies
├── tsconfig.json         # TypeScript config
├── Dockerfile            # Multi-stage Docker build
├── .env.example          # Environment variable template
└── README.md             # Server-specific documentation
```

### Common Patterns

- **Port 8000**: All servers expose HTTP on port 8000
- **Health endpoint**: `GET /health` for container health checks
- **SSE transport**: MCP communication via Server-Sent Events at `/sse`
- **Zod validation**: All tool inputs validated with Zod schemas
- **Winston logging**: JSON logs compatible with Azure Monitor
- **Non-root user**: Docker containers run as non-root for security

---

## Deployment to AzureConduit

### 1. Build and Push to ACR

```bash
# Login to your Azure Container Registry
az acr login --name myregistry

# Build and tag
docker build -t myregistry.azurecr.io/salesforce-mcp:v1.0 ./salesforce-mcp

# Push
docker push myregistry.azurecr.io/salesforce-mcp:v1.0
```

### 2. Deploy with Terraform

```hcl
module "azureconduit" {
  source = "../terraform/azureconduit-mcp-infra"

  client_name          = "acmecorp"
  tenant_id            = "xxx"
  subscription_id      = "xxx"
  claude_client_id     = "xxx"
  entra_admin_group_id = "xxx"

  # Your MCP server image
  mcp_image    = "myregistry.azurecr.io/salesforce-mcp:v1.0"
  compute_type = "container_apps"
  use_acr      = true
}
```

### 3. Configure Secrets in Key Vault

For servers that need credentials, store them in the deployed Key Vault:

```bash
az keyvault secret set \
  --vault-name acd-acmecorp-kv-xxx \
  --name SF-CLIENT-ID \
  --value "your-salesforce-client-id"
```

---

## Customization

### Adding a New Tool

1. Create a new file in `src/tools/`:

```typescript
import { z } from 'zod';

export const myToolSchema = z.object({
  param1: z.string().describe('Description for Claude'),
});

export async function myTool(params: z.infer<typeof myToolSchema>) {
  // Implementation
  return {
    content: [{ type: 'text', text: JSON.stringify(result) }]
  };
}
```

2. Register in `src/server.ts`:

```typescript
server.tool('my_tool', 'Description for Claude', myToolSchema, myTool);
```

### Adding a New Connector

1. Create `src/connectors/myservice.ts`
2. Implement authentication and API methods
3. Use environment variables for credentials
4. Add to `.env.example`

### Forking a Server

The easiest way to create a custom server:

1. Copy the closest existing server
2. Modify connectors for your systems
3. Add/remove tools as needed
4. Update README and .env.example

---

## Server Details

| Server | Port | Health Check | Transport |
|--------|------|--------------|-----------|
| All servers | 8000 | `GET /health` | SSE (`/sse` + `/messages`) |

### Dependencies (Common)

| Package | Purpose |
|---------|---------|
| `@modelcontextprotocol/sdk` | MCP protocol implementation |
| `express` | HTTP server |
| `zod` | Input validation |
| `winston` | Logging |
| `dotenv` | Environment configuration |
| `axios` | HTTP client (most servers) |

---

## Security Considerations

- **Credentials**: Never commit `.env` files. Use Key Vault in production.
- **Network**: Deploy in a VNet for on-prem database access.
- **Auth**: All servers expect APIM to validate Entra tokens before requests arrive.
- **Logging**: Sensitive data is redacted from logs by default.
- **Docker**: All containers run as non-root users.

---

## Support

For issues with these MCP servers, check the individual server's README first, then open an issue in the repository.

For AzureConduit infrastructure questions, see the [main documentation](../docs/).
