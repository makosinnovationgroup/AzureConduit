# Option 3 — Self-Hosted: Azure Functions

**Serverless, lowest cost, ideal for smaller or pilot deployments.**

Azure Functions is a good fit when traffic is low, cost sensitivity is high, or the client wants a simple serverless deployment without managing containers. Microsoft supports MCP servers on Azure Functions natively with Streamable HTTP transport.

---

## Architecture

```
Claude (claude.ai)
       │
       │ HTTPS + OAuth token
       ▼
Azure API Management (Consumption)
       │  validates Entra JWT
       ▼
Azure Functions (Consumption Plan)
  └─ MCP server as custom handler
       │  Managed Identity (OBO flow)
       ▼
Microsoft APIs
```

---

## Infrastructure Components

| Resource | Purpose | Tier | Est. Monthly Cost |
|---|---|---|---|
| Azure Functions App | Runs the MCP server | Consumption | ~$0–10 (per execution) |
| Azure Storage Account | Required by Functions runtime | Standard LRS | ~$2–5 |
| Azure API Management | OAuth gateway | Consumption | ~$3.50/10k calls |
| Entra App Registration | OAuth identity | Free | $0 |
| User-Assigned Managed Identity | Secretless auth | Free | $0 |
| Log Analytics Workspace | Logging | Pay-per-GB | ~$2 |
| **Total** | | | **~$10–20/mo** |

---

## Key Differences vs. Container Apps

| Factor | Container Apps | Azure Functions |
|---|---|---|
| Cold start after idle | 2–5 seconds | **10–30 seconds** |
| Cost at low usage | ~$15–50/mo | **~$10–20/mo** |
| Container support | Native | Custom handler only |
| Long-running sessions | ✅ | ⚠️ 10-min timeout on Consumption |
| Blue/green deployments | ✅ (traffic splitting) | ✅ (deployment slots) |
| Complexity | Medium | **Low** |

The main tradeoff is **cold start latency**. On a Consumption plan, if no one has used the MCP server in the last 10–20 minutes, the first Claude query will take noticeably longer while the function spins up. For clients with frequent usage this normalizes quickly. For occasional users it can be jarring.

**Mitigation options:**
- Use a **Flex Consumption** or **Premium EP1** plan to eliminate cold starts (~$150/mo)
- Use **APIM with a warm-up policy** to ping the function on a schedule
- Use a **Timer-triggered warm-up function** (costs pennies, runs every 5 min)

---

## Deployment

### Prerequisites
Same as Container Apps:
- Azure subscription (Contributor + User Access Administrator)
- Entra ID Application Administrator
- Terraform >= 1.6, Azure CLI

### Deploy with AzureConduit Terraform Module

```hcl
module "azureconduit" {
  source = "./azureconduit-mcp-infra"

  client_name          = "contoso"
  location             = "eastus2"
  tenant_id            = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
  subscription_id      = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
  compute_type         = "functions"          # ← key difference
  apim_tier            = "Consumption"
  claude_client_id     = "your-claude-enterprise-client-id"
  entra_admin_group_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"

  tags = {
    environment = "pilot"
    client      = "contoso"
  }
}
```

*Note: Unlike Container Apps, Functions deployments use a code package rather than a container image. The MCP server code is deployed directly to the Function App.*

### How Azure Functions Runs the MCP Server

The MCP server runs as a **custom handler** — a lightweight web server inside the function that proxies requests from the Functions host to the MCP process. Microsoft released native support for this pattern in early 2026. The server must use **Streamable HTTP transport** (not stdio).

From `host.json`:
```json
{
  "version": "2.0",
  "extensions": {
    "mcp": {
      "transport": "streamable-http"
    }
  },
  "customHandler": {
    "description": {
      "defaultExecutablePath": "node",
      "defaultWorkerPath": "dist/index.js"
    }
  }
}
```

---

## Auth Flow Detail

When a Claude user first queries:
1. Claude sends a request to the APIM endpoint (no token)
2. APIM / Functions returns **401** with a link to Protected Resource Metadata
3. Claude reads the metadata, redirects the user to Entra ID login
4. User authenticates with their Microsoft account
5. Claude retries with the OAuth token — APIM validates and forwards to Functions
6. Functions uses OBO flow to call downstream Microsoft APIs as the user

After the initial auth, Claude caches the token for the session. Subsequent queries in the same conversation don't repeat the login flow.

---

## When to Use This Option

✅ Pilot or proof-of-concept deployment
✅ Smaller client with occasional AI queries
✅ Budget is the primary constraint
✅ Simple deployment, low maintenance
❌ High-frequency usage (cold starts become a real UX problem)
❌ Long-running agentic workflows (Functions timeout limits apply)
❌ Client needs sub-second response times → use [Option 2 (Container Apps)](./02-self-hosted-aca.md)

---

## Example Client Scenarios

**Use this option when the client says:**

> *"We're a 10-person team and want to try this before committing to a larger deployment."*

A small professional services firm testing whether AI-powered D365 access is useful. Usage will be light — maybe 5–10 queries per day across the team. The 10–30 second cold start on first query is acceptable for a pilot. **~$10–20/mo keeps the experiment cheap.**

---

> *"Budget is our main constraint — we need the lowest possible cost."*

A nonprofit or small business with limited IT budget. They need D365 or Azure resource access (can't use cloud-hosted), but can't justify $75+/mo for App Service. Functions Consumption plan charges only for actual executions.

---

> *"Usage will be sporadic — our CFO checks reports maybe twice a week."*

Low-frequency, executive-level usage. Cold starts don't matter when the user queries occasionally. Scale-to-zero means near-zero cost between uses.

---

> *"We want to validate the approach before proposing a production deployment."*

You're doing a paid pilot engagement. Functions lets you deploy real infrastructure at minimal cost. If the pilot succeeds, migrate to Container Apps for production — same Terraform module, just change `compute_type`.

---

**Don't use this option when:**

> *"We have 50 people using this throughout the day and response time matters."*

Cold starts will frustrate users. → Use [Option 2 (Container Apps)](./02-self-hosted-aca.md).

> *"We need Claude to run complex multi-step workflows that take a few minutes."*

Functions Consumption has a 10-minute timeout. → Use [Option 2 (Container Apps)](./02-self-hosted-aca.md).

> *"Our team is used to instant responses — any delay is unacceptable."*

Cold starts are inherent to serverless. → Use [Option 4 (App Service)](./04-self-hosted-app-service.md) for always-on compute.
