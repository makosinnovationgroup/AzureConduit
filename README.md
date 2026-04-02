# AzureConduit — Microsoft AI Intelligence Platform

**Connect your Microsoft ecosystem to AI intelligence.**

AzureConduit connects Microsoft's enterprise ecosystem (Azure, Dynamics 365, Microsoft 365, Fabric, Sentinel) to Claude via the Model Context Protocol (MCP), giving non-technical business users natural language access to their own data — secured entirely by their existing Entra ID and Azure RBAC roles.

---

## What It Does

A AzureConduit deployment lets a business user open claude.ai, log in with their Microsoft account, and ask:

> *"What are our top 10 open purchase orders this week?"*
> *"Summarize emails from our biggest customer in the last 7 days."*
> *"Show me last month's revenue by region from D365."*
> *"Are there any critical alerts in Sentinel right now?"*

Claude answers using live data from their Microsoft systems — scoped to exactly what that user is allowed to see based on their existing AD roles. No new permissions model. No training required. No IT tickets for reports.

---

## Deployment Options

**Start with the [Decision Guide](./docs/00-decision-guide.md)** — it routes every client engagement to the right option based on where their data lives and what systems they use.

| Option | Infrastructure Needed | Custom Code | Best For |
|---|---|---|---|
| [00 — Decision Guide](./docs/00-decision-guide.md) | — | — | Start here |
| [01 — Cloud-Hosted MCPs](./docs/01-cloud-hosted.md) | None | None | Pure M365/Foundry/Power Platform |
| [02 — Self-Hosted: Container Apps](./docs/02-self-hosted-aca.md) | Azure Container Apps + APIM | None | Production, must stay in client tenant |
| [03 — Self-Hosted: Azure Functions](./docs/03-self-hosted-functions.md) | Azure Functions + APIM | None | Low-cost, pilot deployments |
| [04 — Self-Hosted: App Service](./docs/04-self-hosted-app-service.md) | App Service + Easy Auth | None | Simplest auth setup |
| [05 — Custom MCP Server](./docs/05-custom-mcp-server.md) | Same as 02/03/04 | ✅ MCP server code | Non-Microsoft systems, on-prem, cross-system logic |

---

## Microsoft MCP Servers with OBO Authentication

AzureConduit includes **117 pre-built MCP tools** for Microsoft services with On-Behalf-Of (OBO) authentication — ensuring each user sees only what their AD roles permit.

| MCP Server | Tools | What It Connects To |
|------------|-------|---------------------|
| **Azure** | 42 | Subscriptions, Storage, Key Vault, Cosmos DB, SQL, AKS, Functions, Event Hubs, Service Bus, and 10 more categories |
| **D365** | 34 | Dynamics 365 F&O with generic Data/Action/Form tools |
| **Dataverse** | 13 | Power Platform tables, records, schema management, FetchXML |
| **Fabric** | 28 | Workspaces, Lakehouses, Warehouses, Pipelines, OneLake files |

**Modular deployment** — deploy only what you need. See [AzureConduit-mcp Setup Guide](./docs/06-azureconduit-mcp-setup.md).

---

## Security Model

- **Authentication**: Microsoft Entra ID (OAuth 2.1). Users authenticate with their existing Microsoft account.
- **Authorization**: Azure RBAC + OBO. What a user can access through Claude is identical to what they can access in the native Microsoft apps.
- **Conditional Access**: Entra Conditional Access policies apply — MFA, device compliance, location restrictions all honored.
- **Data path**: Data flows from Microsoft systems → MCP server → Claude's context window → response. No data is stored by AzureConduit infrastructure.
- **Token handling**: OBO token exchange happens server-side. User tokens are exchanged for downstream API tokens scoped to the specific user's permissions.

---

## Claude Plan Requirements

| Client Plan | Remote MCP Support | Admin Control |
|---|---|---|
| Pro | ✅ | Per-user setup |
| Max | ✅ | Per-user setup |
| **Team** ⭐ | ✅ | **Admin configures once for all users** |
| **Enterprise** ⭐ | ✅ | **Admin-controlled + SSO + audit logs** |

For business deployments, **Team or Enterprise** is the target plan. The AzureConduit integration is configured once by an admin and rolls out to all users automatically.

---

## Deliverables Per Client Engagement

1. **Terraform deployment** of the appropriate infrastructure stack into their Azure tenant
2. **Entra app registration** with correct scopes and pre-authorized Claude client IDs
3. **Claude integration URL** registered in their Claude Team/Enterprise org settings
4. **Claude Project** with a custom system prompt scoping Claude's behavior to their business context
5. **User onboarding guide** (1 page) — how to connect and what to ask

---

## Repository Structure

```
azureconduit/
├── README.md                             ← this file
├── prds/
│   ├── CLAUDE_CODE_PROMPT.md            ← prompt: scaffold Terraform infra with Claude Code
│   ├── CLAUDE_CODE_PROMPT_CUSTOM.md     ← prompt: scaffold custom MCP server code with Claude Code
│   └── OBO_IMPLEMENTATION.md            ← On-Behalf-Of authentication design
├── docs/
│   ├── 00-decision-guide.md             ← start here — routes to the right option
│   ├── 01-cloud-hosted.md               ← zero-infra Microsoft cloud-hosted MCPs
│   ├── 02-self-hosted-aca.md            ← Container Apps deployment (recommended)
│   ├── 03-self-hosted-functions.md      ← Azure Functions deployment (lowest cost)
│   ├── 04-self-hosted-app-service.md    ← App Service deployment (simplest auth)
│   ├── 05-custom-mcp-server.md          ← custom server for non-Microsoft/on-prem systems
│   └── 06-azureconduit-mcp-setup.md     ← setup guide for OBO-enabled Microsoft MCPs
├── mcp-servers/
│   ├── AzureConduit-mcp/                ← ⭐ 117 OBO-enabled Microsoft tools (Azure, D365, Dataverse, Fabric)
│   └── [19 other MCP servers]           ← Salesforce, QuickBooks, Jira, industry solutions, etc.
└── terraform/
    └── azureconduit-mcp-infra/          ← generated by Claude Code using the infra prompt
```
