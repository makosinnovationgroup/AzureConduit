# AzureConduit — Decision Guide

**Start here. This doc routes every client engagement to the right option.**

---

## The Core Question: What Systems Need Claude Access?

```
What systems does the client want Claude to access?
│
├── Only Microsoft 365 (email, calendar, SharePoint, Teams, OneDrive)?
│    │
│    ├── Read-only access is fine?
│    │    │
│    │    └── YES → Option 1A: Anthropic's M365 Connector (zero infrastructure)
│    │              Fastest setup, no Azure needed
│    │              See: 01-cloud-hosted.md
│    │
│    └── Need write access (create events, send emails)?
│         │
│         ├── Have M365 Copilot licenses?
│         │    └── YES → Option 1B: Microsoft Work IQ (preview)
│         │              See: 01-cloud-hosted.md
│         │
│         └── NO → Option 2/3/4: Self-Hosted + Custom MCP
│                   See: 02-self-hosted-aca.md + 05-custom-mcp-server.md
│
├── Dynamics 365, Azure Resources, Microsoft Fabric, or Sentinel?
│    │
│    └── These require self-hosted infrastructure
│         └── Option 2/3/4: Self-Hosted Microsoft MCP Server
│             See: 02-self-hosted-aca.md
│
└── Non-Microsoft systems (Salesforce, Jira, QuickBooks, SAP, on-prem SQL)?
     │
     └── Do they also have Microsoft systems?
          │
          ├── YES (hybrid) → Custom MCP Server + Self-Hosted Infra
          │                  One server talks to everything
          │                  See: 05-custom-mcp-server.md
          │
          └── NO (non-Microsoft only) → Custom MCP Server + Self-Hosted Infra
                                        See: 05-custom-mcp-server.md
```

---

## Quick Reference Table

| Client Situation | Option | Infra Needed | Extra Licensing | Custom Code |
|------------------|--------|--------------|-----------------|-------------|
| M365 only, read-only access | 1A: Anthropic Connector | ❌ None | ❌ None | ❌ None |
| M365 only, write access, has Copilot | 1B: Work IQ (preview) | ❌ None | ✅ M365 Copilot | ❌ None |
| D365, Azure, Fabric, Sentinel | Self-Hosted (02/03/04) | ✅ Terraform | ❌ None | ❌ None |
| Must stay in their Azure tenant | Self-Hosted (02/03/04) | ✅ Terraform | ❌ None | ❌ None |
| Non-Microsoft systems (Salesforce, etc.) | Custom MCP (05) | ✅ Terraform | ❌ None | ✅ MCP server |
| Hybrid — Microsoft + other systems | Custom MCP (05) | ✅ Terraform | ❌ None | ✅ MCP server |

---

## Option 1: Cloud-Hosted / Managed (No Infrastructure)

### 1A: Anthropic's Microsoft 365 Connector ⭐ Recommended for M365-only

| What | Details |
|------|---------|
| **Setup** | Enable in Claude settings, admin grants consent |
| **Time** | < 1 hour |
| **Cost** | $0 infrastructure |
| **Accesses** | SharePoint, OneDrive, Outlook, Teams (read-only) |
| **Managed by** | Anthropic |

**Best for:** Quick wins, pilots, M365-only clients with no compliance restrictions.

### 1B: Microsoft Work IQ MCP Servers (Preview)

| What | Details |
|------|---------|
| **Setup** | Configure in Copilot Studio or via endpoint URL |
| **Time** | 2-4 hours |
| **Cost** | Requires M365 Copilot license (~$30/user/month) |
| **Accesses** | M365 services with read + write |
| **Managed by** | Microsoft |

**Best for:** Clients already paying for M365 Copilot who need write access.

> ⚠️ Work IQ servers are designed for Copilot Studio/Foundry. Direct Claude integration is experimental.

---

## Options 2/3/4: Self-Hosted Microsoft MCP Server

Deploy Microsoft's official MCP server images in the client's Azure tenant.

### Available Microsoft MCP Server Images

| MCP Server | What It Accesses | Container Image |
|------------|------------------|-----------------|
| **Azure MCP** | All Azure services (15+ tools) | `mcr.microsoft.com/azure-mcp:latest` |
| **Dynamics 365 ERP** | D365 Finance, SCM, business actions | `mcr.microsoft.com/d365-mcp:latest` |
| **Microsoft Fabric** | Data warehouses, lakehouses, analytics | `mcr.microsoft.com/fabric-mcp:latest` |
| **Dataverse** | Power Platform business data | `mcr.microsoft.com/dataverse-mcp:latest` |

*Verify current images at [github.com/microsoft/mcp](https://github.com/microsoft/mcp)*

### Choosing the Compute Tier

| Factor | Container Apps (02) | Functions (03) | App Service (04) |
|--------|---------------------|----------------|------------------|
| **Cost** | Low ($15–50/mo) | Lowest ($10–20/mo) | Higher ($75–100/mo) |
| **Cold starts** | 2–5s from zero | 10–30s | None (always on) |
| **Auth complexity** | Medium (APIM) | Medium (APIM) | Lowest (Easy Auth) |
| **Best for** | Production | Pilots / low traffic | Simplest setup |

**Default recommendation: Container Apps (02)** for production. Functions for cost-sensitive pilots.

---

## Option 5: Custom MCP Server

Build a custom MCP server when the client needs:
- **Non-Microsoft systems**: Salesforce, SAP, Oracle, Jira, QuickBooks
- **On-premises data**: SQL Server in their data center, legacy LOB apps
- **Cross-system logic**: Joins data from multiple sources into a single answer
- **Systems not covered above**: Any API or database not in Microsoft's servers

### Example Custom MCP Servers (included in this repo)

| Server | What It Connects | Tools |
|--------|------------------|-------|
| `salesforce-mcp` | Salesforce CRM | 11 |
| `quickbooks-mcp` | QuickBooks Online | 11 |
| `jira-mcp` | Jira issue tracking | 11 |
| `sql-database-mcp` | Any SQL database | 4 |
| `account-health-mcp` | CRM + Finance + Support (cross-system) | 8 |

See `mcp-servers/README.md` for the full catalog of 19 example servers.

---

## Key Insight: Infrastructure Is the Same Regardless

If any self-hosting is involved, **the Terraform module is identical** whether you're running Microsoft's MCP server image or a custom one. The Container App, APIM gateway, Entra app registration, and Managed Identity don't change. What's inside the container changes — not the infrastructure around it.

This means:
- Deploy the Terraform module once per client
- Start with Microsoft's server image, swap in custom later with zero infra changes
- Clients with mixed needs run one infrastructure stack

---

## Scoping Questions for a Client Discovery Call

Use these to route quickly:

1. *"What systems hold the data you'd want Claude to access?"*
   - M365 only → Option 1A or 1B
   - D365, Azure, Fabric → Option 2/3/4
   - Salesforce, SAP, on-prem SQL → Option 5

2. *"Is read-only access sufficient, or does Claude need to create/update data?"*
   - Read-only M365 → Option 1A (Anthropic Connector)
   - Write access needed → Option 1B (if Copilot licensed) or Custom MCP

3. *"Do you have any compliance requirements around where data can flow?"*
   - Data residency requirements → Self-hosted (02/03/04)
   - Can't use Anthropic/Microsoft hosted → Self-hosted

4. *"Do you already have Microsoft 365 Copilot licenses?"*
   - Yes → Option 1B becomes viable
   - No → Skip 1B, use 1A or self-host

5. *"Are there any third-party platforms — Salesforce, SAP, Jira, QuickBooks?"*
   - Yes → Option 5 (Custom MCP)

---

## Engagement Effort Estimate

| Option | Setup Time | Ongoing Maintenance |
|--------|------------|---------------------|
| 1A: Anthropic Connector | < 1 hour | None |
| 1B: Work IQ (Preview) | 2–4 hours | Minimal |
| Self-Hosted Microsoft MCP (02/03/04) | 4–8 hours | Low (Terraform managed) |
| Custom MCP Server (05) | 2–5 days | Medium (server code to maintain) |

---

## Example Client Scenarios

### → Use [Option 1A: Anthropic Connector](./01-cloud-hosted.md)

- **"We just use Microsoft 365 — Outlook, SharePoint, Teams."**
  Pure M365, read-only is fine, no compliance restrictions. Setup in 30 minutes.

- **"Can we do a quick pilot before committing to infrastructure?"**
  Fast proof-of-concept. Show value immediately.

### → Use [Option 1B: Work IQ](./01-cloud-hosted.md)

- **"We have M365 Copilot licenses and want Claude to schedule meetings."**
  Write access to M365, already paying for Copilot.

### → Use [Option 2: Container Apps](./02-self-hosted-aca.md) (Default for production)

- **"We need Claude to pull data from Dynamics 365 Finance."**
  D365 requires self-hosted.

- **"Our compliance team says data can't flow through external servers."**
  Data residency requirement → self-host in their tenant.

- **"We have 50 users who will query Claude throughout the day."**
  Production workload with regular usage.

### → Use [Option 3: Functions](./03-self-hosted-functions.md)

- **"We're a 10-person team, budget is tight, just want to try it."**
  Low usage, cost-sensitive pilot.

### → Use [Option 4: App Service](./04-self-hosted-app-service.md)

- **"We don't have anyone who knows APIM or Terraform well."**
  Simplest auth setup via Easy Auth.

- **"Response time is critical — we can't have any cold start delays."**
  Always-on compute.

### → Use [Option 5: Custom MCP Server](./05-custom-mcp-server.md)

- **"We use Salesforce for CRM and D365 for finance."**
  Hybrid Microsoft + non-Microsoft.

- **"Our main database is an on-prem SQL Server."**
  On-premises data source.

- **"We use Jira for issue tracking and QuickBooks for accounting."**
  Non-Microsoft systems.

- **"We want Claude to answer questions that need data from 4 different systems."**
  Cross-system business logic.
