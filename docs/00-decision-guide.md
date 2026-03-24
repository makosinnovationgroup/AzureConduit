# AzureConduit — Decision Guide

**Start here. This doc routes every client engagement to the right option.**

---

## The Core Question: Where Does Their Data Live?

```
Is all their data in Microsoft's cloud (M365, Azure, D365, Fabric)?
│
├── YES
│    │
│    └── Do they need Claude to access it from Microsoft's already-hosted MCP endpoints?
│         │
│         ├── YES → Option 1: Cloud-Hosted MCPs (zero infrastructure)
│         │         See: 01-cloud-hosted.md
│         │
│         └── NO (compliance, data residency, or want it inside their own tenant)
│                  └── Option 2/3/4: Self-Hosted Microsoft MCP Server
│                      (pick compute tier based on cost/performance needs)
│                      See: 02-self-hosted-aca.md
│
└── NO (on-prem SQL, SAP, Salesforce, custom ERP, third-party systems)
         │
         └── Do they also have Microsoft systems?
              │
              ├── YES (hybrid) → Custom MCP Server + Self-Hosted Infra
              │                  Server talks to everything; same Terraform stack
              │                  See: 05-custom-mcp-server.md
              │
              └── NO (non-Microsoft only) → Custom MCP Server + Self-Hosted Infra
                                            See: 05-custom-mcp-server.md
```

---

## Quick Reference Table

| Client Situation | Option | Infra Needed | Custom Code |
|---|---|---|---|
| Pure Microsoft stack, okay with MS-hosted endpoints | Cloud-Hosted (01) | ❌ None | ❌ None |
| Pure Microsoft stack, must stay in their tenant | Self-Hosted (02/03/04) | ✅ Terraform | ❌ None |
| Has non-Microsoft or on-prem systems | Custom MCP (05) | ✅ Terraform | ✅ MCP server code |
| Hybrid — Microsoft + other systems | Custom MCP (05) | ✅ Terraform | ✅ MCP server code |
| Needs cross-system business logic | Custom MCP (05) | ✅ Terraform | ✅ MCP server code |

---

## Available Microsoft MCP Servers

Use this table to identify which MCP server(s) fit the client's needs:

### Cloud-Hosted (Option 01 — No Infrastructure)

| MCP Server | What It Accesses | Endpoint |
|------------|------------------|----------|
| **M365 Calendar** | Events, availability, invites | `https://agent365.svc.cloud.microsoft/...` |
| **M365 Mail** | Email create, send, reply, search | `https://agent365.svc.cloud.microsoft/...` |
| **M365 User** | User profiles, org chart, teams | `https://agent365.svc.cloud.microsoft/...` |
| **M365 Copilot Chat** | Search across M365 (docs, email, SharePoint) | `https://agent365.svc.cloud.microsoft/...` |
| **Microsoft Learn Docs** | Official MS documentation | `https://learn.microsoft.com/api/mcp` |
| **Microsoft Foundry** | AI models, evaluation, datasets | `https://mcp.ai.azure.com` |
| **GitHub** | Repos, PRs, issues, Actions | `https://api.githubcopilot.com/mcp` |
| **Power Platform** | 1,470+ connectors, Dataverse | Environment-scoped URL |

### Self-Hosted (Options 02/03/04 — Deploy with Terraform)

| MCP Server | What It Accesses | Container Image |
|------------|------------------|-----------------|
| **Azure MCP** | All Azure services (15+ tools) | `mcr.microsoft.com/azure-mcp:latest` |
| **Dynamics 365 ERP** | D365 Finance, SCM, business actions | `mcr.microsoft.com/d365-mcp:latest` |
| **Microsoft Fabric** | Data warehouses, lakehouses, analytics | `mcr.microsoft.com/fabric-mcp:latest` |
| **Dataverse** | Power Platform business data | `mcr.microsoft.com/dataverse-mcp:latest` |
| **Azure DevOps** | Projects, work items, pipelines | `mcr.microsoft.com/azdo-mcp:latest` |

*Note: Container image URLs are examples — verify current images at [github.com/microsoft/mcp](https://github.com/microsoft/mcp)*

### When to Build Custom (Option 05)

Build a custom MCP server when the client needs:
- **Non-Microsoft systems**: Salesforce, SAP, Oracle, custom databases
- **On-premises data**: SQL Server in their data center, legacy LOB apps
- **Cross-system logic**: Joins data from multiple sources into a single answer
- **Systems not listed above**: Any API or database not covered by Microsoft's servers

---

## Key Insight: Infrastructure Is the Same Regardless

If any self-hosting is involved, **the Terraform module is identical** whether you're running Microsoft's MCP server image or a custom one you built. The Container App, APIM gateway, Entra app registration, and Managed Identity don't change. What's inside the container changes — not the infrastructure around it.

This means:
- The Terraform module deploys once per client regardless of which server runs inside it
- You can start with Microsoft's server image and swap in a custom one later with zero infra changes
- Clients with mixed needs (Microsoft + custom systems) run one infrastructure stack, one MCP server that talks to everything

---

## Choosing the Compute Tier (Options 2, 3, 4)

Once you've determined self-hosting is needed, pick the compute option:

| Factor | Container Apps (02) | Functions (03) | App Service (04) |
|---|---|---|---|
| **Cost** | Low ($15–50/mo) | Lowest ($10–20/mo) | Higher ($75–100/mo) |
| **Cold starts** | 2–5s from zero | 10–30s | None (always on) |
| **Auth complexity** | Medium (APIM) | Medium (APIM) | Lowest (Easy Auth) |
| **Best for** | Production | Pilots / low traffic | Simplest setup |

**Default recommendation: Container Apps (02)** for any production engagement. Functions for pilots where cost is the primary concern.

---

## Scoping Questions for a Client Discovery Call

Use these to route quickly:

1. *"What systems hold the data you'd want Claude to access?"* — identifies Microsoft vs non-Microsoft
2. *"Is everything in Azure/M365 or do you have on-premises servers?"* — flags hybrid/on-prem scenarios
3. *"Do you have any compliance requirements around where data can flow?"* — determines cloud-hosted vs self-hosted
4. *"How many people would be using this day-to-day?"* — informs compute tier choice
5. *"Are there any third-party platforms — Salesforce, SAP, a custom ERP?"* — flags custom MCP need

---

## Engagement Effort Estimate

| Option | Setup Time | Ongoing Maintenance |
|---|---|---|
| Cloud-Hosted (01) | 2–4 hours | Minimal |
| Self-Hosted Microsoft MCP (02/03/04) | 4–8 hours | Low (Terraform managed) |
| Custom MCP Server (05) | 2–5 days depending on systems | Medium (server code to maintain) |

---

## Example Client Scenarios

Use these to quickly identify which doc applies:

### → Use [01 Cloud-Hosted](./01-cloud-hosted.md)
- **"We just use Microsoft 365 — Outlook, SharePoint, Teams."** Pure M365, no on-prem, no compliance restrictions.
- **"Can we do a quick pilot before committing to infrastructure?"** Fast proof-of-concept using Microsoft's hosted endpoints.
- **"We use Power Platform and Dataverse for our apps."** Power Platform MCP is cloud-hosted.

### → Use [02 Container Apps](./02-self-hosted-aca.md) (Default for production)
- **"We need Claude to pull data from Dynamics 365 Finance."** D365 requires self-hosted infra.
- **"Our compliance team says data can't flow through Microsoft's servers."** Data residency requirement → self-host in their tenant.
- **"We have 50 users who will query Claude throughout the day."** Production workload with regular usage.
- **"We need to rate-limit and log all API calls."** APIM policies required.

### → Use [03 Functions](./03-self-hosted-functions.md)
- **"We're a 10-person team, budget is tight, just want to try it."** Low usage, cost-sensitive pilot.
- **"Usage will be sporadic — maybe a few queries per day."** Occasional use where cold starts are acceptable.

### → Use [04 App Service](./04-self-hosted-app-service.md)
- **"We don't have anyone who knows APIM or Terraform well."** Simplest auth setup via Easy Auth.
- **"Response time is critical — we can't have any cold start delays."** Always-on compute, no scale-to-zero.
- **"We already run other apps on App Service."** Familiar platform, consolidated billing.

### → Use [05 Custom MCP Server](./05-custom-mcp-server.md)
- **"We use Salesforce for CRM and D365 for finance."** Hybrid Microsoft + non-Microsoft systems.
- **"Our main database is an on-prem SQL Server in our data center."** On-premises data source.
- **"We want Claude to answer 'account health' which requires data from 4 systems."** Cross-system business logic.
- **"We use SAP for ERP."** Non-Microsoft system requiring custom integration.
- **"We have a legacy system with a REST API we built ourselves."** Custom internal systems.
