# Option 1 — Cloud-Hosted / Managed Connectors

**Minimal or zero infrastructure for Microsoft 365 access.**

For clients who only need access to M365 data (email, calendar, SharePoint, Teams, OneDrive), there are managed options that require little to no Azure infrastructure. This doc covers two sub-options with very different requirements.

---

## Option 1A: Anthropic's Microsoft 365 Connector (Recommended)

**Zero infrastructure. Built into Claude. Just enable it.**

Anthropic provides a pre-built Microsoft 365 integration that's already deployed and managed. You don't paste a URL — you enable a connector in Claude's settings.

### What It Accesses

| Service | Capabilities |
|---------|-------------|
| **SharePoint** | Search and analyze documents across sites |
| **OneDrive** | Access files in user's personal OneDrive |
| **Outlook** | Read email threads, analyze communication patterns |
| **Teams** | Search chat conversations and channel discussions |

**Read-only access** — Claude cannot create, modify, or delete content.

### Setup Steps

**Phase 1: Admin Setup (Entra Global Administrator required)**

1. Go to **claude.ai → Organization Settings → Connectors**
2. Find **Microsoft 365** and click **Enable**
3. Admin authenticates with their Microsoft account
4. Grant tenant-wide consent for the connector

**Phase 2: User Setup (Each team member)**

1. Go to **claude.ai → Settings → Connectors**
2. Find **Microsoft 365** and click **Connect**
3. Authenticate with their Microsoft account
4. Done — Claude can now access their M365 data

### What Gets Installed in Entra

Two service principals are created in your tenant:
- **M365 MCP Client** — The client application
- **M365 MCP Server for Claude** — The server component

These are managed by Anthropic. You don't deploy or maintain anything.

### Cost

| Item | Cost |
|------|------|
| Azure infrastructure | **$0** |
| Microsoft licensing | Existing M365 licenses |
| Claude Team/Enterprise | ~$25–30/user/month |

### Security & Data Handling

Per [Anthropic's security documentation](https://support.claude.com/en/articles/12684923-microsoft-365-connector-security-guide):
- Documents remain in your Microsoft 365 tenant
- Connector retrieves data on-demand during active queries
- No file content is cached
- User-scoped access — Claude sees only what each user can access

### When to Use Option 1A

✅ Client only needs email, calendar, SharePoint, Teams, OneDrive access
✅ Fastest possible setup (under 1 hour)
✅ No Azure infrastructure to manage
✅ Read-only access is sufficient

### Limitations

❌ No access to Dynamics 365, Azure resources, Power Platform, or custom systems
❌ Cannot write/modify data (read-only)
❌ Limited to the specific M365 services Anthropic supports
❌ Less control over security policies (managed by Anthropic)

---

## Option 1B: Microsoft Work IQ MCP Servers (Preview)

**Cloud-hosted by Microsoft, but requires M365 Copilot license and additional setup.**

Microsoft provides cloud-hosted MCP servers under the "Work IQ" brand. These are real MCP endpoints hosted at `agent365.svc.cloud.microsoft`, but they're designed primarily for Microsoft Copilot Studio and Azure AI Foundry — not directly for Claude.

> ⚠️ **Important**: These servers require a **Microsoft 365 Copilot license** (~$30/user/month on top of M365). They are in **preview** and may change.

### Available Work IQ Servers

| Server | Endpoint Pattern | Capabilities |
|--------|-----------------|--------------|
| **Work IQ Mail** | `https://agent365.svc.cloud.microsoft/agents/tenants/{tenant_id}/servers/mcp_MailTools` | Create, read, update, delete emails; semantic search |
| **Work IQ Calendar** | `https://agent365.svc.cloud.microsoft/agents/tenants/{tenant_id}/servers/mcp_CalendarTools` | Create, list, update events; resolve conflicts |
| **Work IQ Teams** | `https://agent365.svc.cloud.microsoft/agents/tenants/{tenant_id}/servers/mcp_TeamsServer` | Create chats, post messages, channel operations |
| **Work IQ SharePoint** | `https://agent365.svc.cloud.microsoft/agents/tenants/{tenant_id}/servers/mcp_SharePoint` | Upload files, get metadata, search, manage lists |
| **Work IQ OneDrive** | `https://agent365.svc.cloud.microsoft/agents/tenants/{tenant_id}/servers/mcp_OneDrive` | Manage files and folders |
| **Work IQ User** | `https://agent365.svc.cloud.microsoft/agents/tenants/{tenant_id}/servers/mcp_UserTools` | Get manager, direct reports, search users |
| **Work IQ Word** | `https://agent365.svc.cloud.microsoft/agents/tenants/{tenant_id}/servers/mcp_WordServer` | Create/read documents, add comments |

### Requirements

- **Microsoft 365 Copilot license** (required — not just regular M365)
- **Claude Team or Enterprise plan**
- Entra tenant admin access

### Using with Claude (Experimental)

These endpoints are designed for Copilot Studio and Foundry, not directly for Claude. To use them with Claude:

1. **Direct connection (may work)**: Paste the endpoint URL into Claude's integration settings
   - Replace `{tenant_id}` with your Entra tenant ID
   - OAuth flow should work if Claude supports the authentication pattern
   - **Status: Untested with Claude — your mileage may vary**

2. **Via APIM proxy (more reliable)**: Use AzureConduit's self-hosted infrastructure to proxy requests
   - Deploy APIM with the Terraform module
   - Configure APIM to forward to the Work IQ endpoint
   - This gives you logging, rate limiting, and token validation
   - See [Option 2](./02-self-hosted-aca.md) for APIM setup

### When to Use Option 1B

✅ Client already has M365 Copilot licenses
✅ Need write access (create emails, schedule meetings)
✅ Want Microsoft-hosted infrastructure
✅ Building agents in Copilot Studio or Foundry (primary use case)

### Limitations

❌ Requires M365 Copilot license (~$30/user/month extra)
❌ Preview feature — may change
❌ Designed for Copilot Studio, not Claude
❌ Direct Claude integration is untested
❌ No access to D365, Azure resources, or custom systems

### Documentation

- [Work IQ MCP overview (Microsoft Learn)](https://learn.microsoft.com/en-us/microsoft-agent-365/tooling-servers-overview)
- [Microsoft MCP GitHub Repository](https://github.com/microsoft/mcp)

---

## Other Cloud-Hosted Endpoints

These additional endpoints exist but have varying levels of Claude compatibility:

| Endpoint | What It Accesses | Notes |
|----------|------------------|-------|
| **Microsoft Learn Docs** | `https://learn.microsoft.com/api/mcp` | Public documentation, no auth needed |
| **Microsoft Foundry** | `https://mcp.ai.azure.com` | AI models, evaluation, datasets |
| **GitHub Copilot** | `https://api.githubcopilot.com/mcp` | Repos, PRs, issues (requires GitHub Copilot) |
| **MCP Server for Enterprise** | `https://mcp.svc.cloud.microsoft/enterprise` | Natural language queries for enterprise data |

---

## Decision: 1A vs 1B vs Self-Hosted

| Factor | 1A: Anthropic Connector | 1B: Work IQ | Self-Hosted (02/03/04) |
|--------|------------------------|-------------|------------------------|
| **Setup time** | < 1 hour | 2-4 hours | 4-8 hours |
| **Extra licensing** | None | M365 Copilot ($30/user) | None |
| **Infrastructure** | None | None (or APIM proxy) | Terraform + Azure |
| **M365 access** | ✅ Read-only | ✅ Read + Write | ✅ Read + Write |
| **D365 access** | ❌ No | ❌ No | ✅ Yes |
| **Custom systems** | ❌ No | ❌ No | ✅ Yes |
| **Data residency** | Anthropic-managed | Microsoft-managed | Your tenant |
| **Audit control** | Limited | Microsoft Defender | Full (APIM + Log Analytics) |

**Recommendation:**
- **Most clients**: Start with **Option 1A** (Anthropic's connector) — it's free, fast, and works
- **Copilot licensees building agents**: Consider **Option 1B** for write capabilities
- **D365, Azure, or custom systems**: Skip to **[Option 2 (Container Apps)](./02-self-hosted-aca.md)**

---

## Example Client Scenarios

### → Use Option 1A (Anthropic Connector)

> *"We just want Claude to help with email and calendar — find meetings, summarize threads, check availability."*

A 200-person marketing agency on M365 Business Premium. They want Claude to answer "What's on my calendar tomorrow?" and "Summarize the email thread with Acme Corp." **Setup: 30 minutes. Cost: $0 infrastructure.**

---

> *"Can we try this out before we commit to deploying anything in Azure?"*

A potential client wants a proof-of-concept. Enable Anthropic's M365 connector in an hour. They see value, then you propose self-hosted deployment for D365 access later. **This option de-risks the sales conversation.**

---

### → Use Option 1B (Work IQ) or Skip to Self-Hosted

> *"We already pay for M365 Copilot and want Claude to be able to schedule meetings and send emails."*

They need write access. If they have Copilot licenses, try Work IQ. Otherwise, self-host with custom MCP server.

---

### → Skip to Self-Hosted (Option 2+)

> *"We need Claude to access Dynamics 365 Finance to check purchase orders."*

D365 F&O is not available via any cloud-hosted option. → Use [Option 2 (Container Apps)](./02-self-hosted-aca.md).

> *"Our compliance team won't allow data to flow through Anthropic's or Microsoft's hosted endpoints."*

Data residency or regulatory requirements. → Use [Option 2/3/4 (Self-Hosted)](./02-self-hosted-aca.md).

> *"We use Salesforce, QuickBooks, Jira, or have on-prem SQL databases."*

Non-Microsoft systems require custom MCP servers. → Use [Option 5 (Custom MCP)](./05-custom-mcp-server.md).
