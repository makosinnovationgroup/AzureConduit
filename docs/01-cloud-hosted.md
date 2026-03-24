# Option 1 — Cloud-Hosted Microsoft MCP Servers

**No infrastructure. No Terraform. Just a URL.**

Several of Microsoft's first-party MCP servers are already deployed and running in Microsoft's cloud. For clients who only need access to these services, AzureConduit is purely a configuration exercise — no Azure resources to provision.

---

## Available Cloud-Hosted Servers

| MCP Server | Endpoint | What Users Can Ask |
|---|---|---|
| **M365 Calendar** | `https://agent365.svc.cloud.microsoft/agents/tenants/{tenant_id}/servers/mcp_CalendarTools` | "What's on my calendar tomorrow?", "When is Sarah available?", "Schedule a meeting with the team" |
| **M365 Mail** | `https://agent365.svc.cloud.microsoft/agents/tenants/{tenant_id}/servers/mcp_MailTools` | "Summarize emails from Acme Corp", "Draft a reply to John's email", "Find emails about the Q4 budget" |
| **M365 User** | `https://agent365.svc.cloud.microsoft/agents/tenants/{tenant_id}/servers/mcp_UserTools` | "Who is my manager?", "Who reports to Sarah?", "What team is John on?" |
| **M365 Copilot Chat** | `https://agent365.svc.cloud.microsoft/agents/tenants/{tenant_id}/servers/mcp_SearchTools` | Search across M365: emails, SharePoint, Teams, OneDrive |
| **Microsoft Foundry** | `https://mcp.ai.azure.com` | AI model deployments, evaluations, datasets |
| **Microsoft Learn Docs** | `https://learn.microsoft.com/api/mcp` | Official Microsoft documentation (public, no auth) |
| **GitHub** | `https://api.githubcopilot.com/mcp` | "Show open PRs in our repo", "What issues are assigned to me?" |
| **Power Platform** | Environment-scoped URL | 1,470+ connector actions, Dataverse queries |

*Endpoints may change — verify current URLs at [github.com/microsoft/mcp](https://github.com/microsoft/mcp)*

---

## What You Need

- Client's **Entra Tenant ID** (for the tenant-scoped endpoints)
- Client on **Claude Team or Enterprise plan** (admin access to configure integrations)
- The relevant **Microsoft license** (M365, Power Platform, etc.)
- No Azure subscription required for M365 endpoints

---

## Setup Steps

### 1. Get the endpoint URL

For tenant-scoped servers, substitute the client's tenant ID into the URL:
```
https://agent365.svc.cloud.microsoft/agents/tenants/{TENANT_ID}/servers/mcp_CalendarTools
```

### 2. Register in Claude

1. Go to **claude.ai → Organization Settings → Integrations**
2. Click **Add More**
3. Paste the MCP endpoint URL
4. Give it a friendly name (e.g. "Acme Corp Calendar")
5. Save

### 3. Each user authenticates once

Users click **Connect** on the integration. Their browser opens Microsoft's standard OAuth login. After signing in with their Microsoft account, the integration is live for that user — scoped to their Entra identity and existing M365 permissions.

---

## Pairing With a Claude Project

Create a Claude Project for the client with a system prompt that frames the experience:

```
You are an AI assistant for [Company Name]. You have access to the company's 
Microsoft 365 environment. When users ask about meetings, emails, documents, 
or calendar availability, use the available Microsoft tools to retrieve live 
data. Present answers in plain business language. Never expose raw JSON, 
tool call details, or technical errors to the user — if something fails, 
explain it simply and offer an alternative.
```

---

## Cost

| Item | Cost |
|---|---|
| Azure infrastructure | **$0** |
| Microsoft licensing | Existing client licenses |
| Claude Team plan | ~$25–30/user/month |

---

## Limitations

- No access to Dynamics 365, Azure resources, or custom internal systems (requires self-hosted deployment)
- Power Platform endpoint requires Power Platform environment setup
- M365 endpoints require appropriate Graph API permissions granted in the client's tenant
- Read-only for most operations (write actions depend on the specific server's tool set)

---

## When to Use This Option

✅ Client is already on M365 and wants AI access to their email/calendar/docs
✅ Fast proof of concept before committing to infrastructure
✅ Client has budget sensitivity and existing Microsoft licensing
❌ Client needs D365, custom Azure data, or internal LOB systems → use a self-hosted option

---

## Example Client Scenarios

**Use this option when the client says:**

> *"We just want Claude to help with email and calendar — find meetings, summarize threads, check availability."*

A 200-person marketing agency on M365 Business Premium. They want Claude to answer "What's on my calendar tomorrow?" and "Summarize the email thread with Acme Corp." No custom systems, no compliance concerns. **Setup: 2 hours. Cost: $0 infrastructure.**

---

> *"Can we try this out before we commit to deploying anything in Azure?"*

A potential client wants a proof-of-concept. You set up Cloud-Hosted M365 endpoints in an afternoon. They see value, then you propose a full Container Apps deployment for D365 access later. **This option de-risks the sales conversation.**

---

> *"We use Power Platform heavily — Power Apps, Power Automate, Dataverse."*

A client with a citizen-developer culture building internal apps on Power Platform. The Power Platform MCP gives Claude access to 1,470+ connector actions. **No custom code, no infrastructure.**

---

**Don't use this option when:**

> *"We need Claude to access Dynamics 365 Finance to check purchase orders."*

D365 F&O is not available via cloud-hosted MCPs. → Use [Option 2 (Container Apps)](./02-self-hosted-aca.md).

> *"Our compliance team won't allow data to flow through Microsoft's hosted endpoints."*

Data residency or regulatory requirements. → Use [Option 2/3/4 (Self-Hosted)](./02-self-hosted-aca.md).
