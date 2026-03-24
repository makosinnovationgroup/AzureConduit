# Claude Code Prompt — AzureConduit Custom MCP Server

Use this prompt in Claude Code to scaffold the custom MCP server application that runs inside the AzureConduit Container App. Run this **after** the infrastructure is deployed with the Terraform module.

This prompt is for the **server code only** — the infrastructure (Container Apps, APIM, Entra) is handled separately by `CLAUDE_CODE_PROMPT.md`.

---

## Prompt

```
Build a production-ready custom MCP server called `azureconduit-server` using the 
official MCP TypeScript SDK. This server will run inside an Azure Container App 
secured by Azure API Management and Entra ID (already deployed via Terraform). 
It connects to one or more client data sources and exposes them as MCP tools 
for Claude to call.

## Runtime Context

- Transport: Streamable HTTP (not stdio — this runs as a remote server)
- Auth: Entra ID tokens arrive pre-validated by APIM. The server receives the 
  validated user token in the Authorization header and uses it for OBO flows.
- Secrets: All credentials retrieved from Azure Key Vault at startup via 
  Managed Identity — no secrets in environment variables or code.
- Health: Expose GET /health endpoint returning 200 for Container App probes.

## Project Structure

```
azureconduit-server/
├── src/
│   ├── index.ts              # Entry point — creates server, registers tools, starts HTTP listener
│   ├── server.ts             # MCP server setup and tool registration
│   ├── auth/
│   │   ├── obo.ts            # On-Behalf-Of token exchange for Microsoft APIs
│   │   └── keyvault.ts       # Key Vault secret retrieval via Managed Identity
│   ├── connectors/
│   │   ├── sql.ts            # SQL Server / Azure SQL connector with connection pooling
│   │   ├── graph.ts          # Microsoft Graph API connector (uses OBO flow)
│   │   ├── d365.ts           # Dynamics 365 connector (uses OBO flow)
│   │   └── generic-api.ts    # Generic REST API connector for third-party systems
│   ├── tools/
│   │   ├── index.ts          # Registers all tools on the MCP server
│   │   └── [tool files]      # One file per logical tool group
│   └── utils/
│       ├── logger.ts         # Structured JSON logging for Azure Monitor
│       └── errors.ts         # Error handling and safe error responses
├── Dockerfile                # Multi-stage build, non-root user, health check
├── .dockerignore
├── package.json
├── tsconfig.json
└── README.md                 # How to add tools, run locally, deploy to ACR
```

## Core Dependencies

```json
{
  "@modelcontextprotocol/sdk": "latest",
  "@azure/identity": "latest",
  "@azure/keyvault-secrets": "latest",
  "@microsoft/microsoft-graph-client": "latest",
  "mssql": "latest",
  "axios": "latest",
  "zod": "latest",
  "winston": "latest"
}
```

## Auth Implementation

### OBO Flow (src/auth/obo.ts)
Implement the On-Behalf-Of token exchange. The incoming user token (from the 
Authorization header, pre-validated by APIM) is exchanged for a downstream token 
that calls Microsoft Graph, D365, or other Entra-protected APIs as the user:

```typescript
export async function getOBOToken(
  userAccessToken: string,
  targetScope: string
): Promise<string>
```

Use `@azure/identity` ConfidentialClientApplication with the app registration 
credentials fetched from Key Vault.

### Key Vault (src/auth/keyvault.ts)
On startup, fetch all required secrets from Key Vault using the Container App's 
Managed Identity (DefaultAzureCredential). Cache them in memory for the process lifetime:

```typescript
export async function loadSecrets(): Promise<SecretsStore>
// SecretsStore contains: sqlConnectionString, appClientId, appClientSecret, 
// any third-party API keys defined in config
```

## Connector Implementations

### SQL Connector (src/connectors/sql.ts)
- Use `mssql` with connection pooling (min 2, max 10 connections)
- Connection string loaded from Key Vault on startup
- Expose a `query(sql: string, params: Record<string, any>)` function
- Always use parameterized queries — never string concatenation
- Implement query timeout (30 seconds default)
- Return typed results with column names preserved

### Graph Connector (src/connectors/graph.ts)
- Accept a user access token, exchange via OBO for Graph scope
- Expose typed methods for common Graph operations:
  - `getMyEmails(token, filter?, top?)` → Mail messages
  - `getMyCalendarEvents(token, startDate, endDate)` → Calendar events
  - `searchContent(token, query)` → Microsoft Search across M365

### D365 Connector (src/connectors/d365.ts)
- Accept a user access token, exchange via OBO for D365 scope
- Expose a generic `oDataQuery(token, entity, filter?, select?, top?)` function
- Implement pagination handling automatically
- Parse and flatten OData response envelopes

## Tool Implementation Pattern

Each tool file should follow this pattern:

```typescript
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

export function registerSalesTools(server: McpServer, connectors: Connectors) {
  
  server.tool(
    "get_open_opportunities",
    "Returns open sales opportunities from Dynamics 365, optionally filtered by owner or stage",
    {
      owner_email: z.string().email().optional(),
      stage: z.string().optional(),
      limit: z.number().min(1).max(100).default(25)
    },
    async ({ owner_email, stage, limit }, context) => {
      // Extract user token from MCP request context
      const userToken = context.requestContext?.headers?.authorization?.replace("Bearer ", "");
      
      const results = await connectors.d365.oDataQuery(
        userToken,
        "opportunities",
        buildFilter({ owner_email, stage }),
        "opportunityid,name,estimatedvalue,stagename,ownerid",
        limit
      );
      
      return {
        content: [{
          type: "text",
          text: JSON.stringify(results, null, 2)
        }]
      };
    }
  );
}
```

## Example Tool Groups to Scaffold

Create placeholder tool files for these common groups — implement the first tool 
in each group fully, stub the rest with clear TODO comments:

1. **sql-tools.ts** — direct SQL query tools (reporting, custom queries)
2. **crm-tools.ts** — D365 Sales: opportunities, accounts, contacts, activities  
3. **finance-tools.ts** — D365 Finance: invoices, purchase orders, GL entries
4. **m365-tools.ts** — email summary, calendar, document search via Graph
5. **admin-tools.ts** — a `list_available_tools` meta-tool describing what's available

## Dockerfile

Multi-stage build:
- Stage 1: node:20-alpine, install deps, compile TypeScript
- Stage 2: node:20-alpine, copy compiled output only, run as non-root user
- EXPOSE 8000
- HEALTHCHECK: `curl -f http://localhost:8000/health || exit 1`
- CMD: `node dist/index.js`

## Error Handling Requirements

- Never return raw error messages or stack traces to Claude — these could expose 
  internal system details
- Log full errors with Winston (structured JSON) to stdout for Azure Monitor
- Return user-friendly error messages: "Unable to retrieve opportunities at this time"
- Implement retry logic (3 attempts, exponential backoff) for transient failures
- Token expiry errors should return a specific error type that APIM can handle

## README Requirements

Include:
1. How to add a new tool (step by step)
2. How to add a new connector (SQL, REST API)
3. How to run locally with a `.env` file (for dev — Key Vault not available locally)
4. How to build the Docker image and push to ACR
5. How to update the running Container App with a new image version
6. Environment variables reference (for local dev)

## Local Development Setup

For local dev without Key Vault, read secrets from a `.env` file:
```
SQL_CONNECTION_STRING=Server=...
APP_CLIENT_ID=...
APP_CLIENT_SECRET=...
AZURE_TENANT_ID=...
D365_BASE_URL=https://org.crm.dynamics.com
```

Use `dotenv` in development only — detect via `NODE_ENV !== 'production'`.
```
