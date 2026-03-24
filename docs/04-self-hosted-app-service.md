# Option 4 — Self-Hosted: Azure App Service

**Simplest authentication setup. Best for teams without deep Azure expertise.**

Azure App Service with Built-in Authentication (Easy Auth) lets Microsoft handle the entire Entra ID OAuth flow for you — no APIM policies to write, no token validation code. The tradeoff is cost: it's always-on compute with no scale-to-zero.

---

## Architecture

```
Claude (claude.ai)
       │
       │ HTTPS + OAuth token
       ▼
Azure App Service
  └─ Built-in Auth (Easy Auth)     ← Microsoft handles all OAuth/Entra logic
  └─ MCP Server process
       │  Managed Identity (OBO flow)
       ▼
Microsoft APIs
```

*Note: APIM is optional with this pattern — Easy Auth handles token validation directly on the App Service instance. You can still add APIM in front if you need rate limiting or centralized policy.*

---

## Infrastructure Components

| Resource | Purpose | Tier | Est. Monthly Cost |
|---|---|---|---|
| App Service Plan | Compute for MCP server | B2 (min for production) | ~$75/mo |
| App Service App | Runs the MCP server | — | Included above |
| Entra App Registration | OAuth identity | Free | $0 |
| Easy Auth | Built-in auth config | Free | $0 |
| User-Assigned Managed Identity | Downstream API calls | Free | $0 |
| **Total** | | | **~$75–100/mo** |

*Add ~$50/mo for APIM (Consumption) if policy enforcement is needed.*

---

## Key Advantage: Easy Auth

Microsoft's Easy Auth feature handles the entire OAuth dance automatically. Once configured:

1. Any request to the MCP server without a valid Entra token gets redirected to Microsoft login automatically
2. After login, the user's claims are injected into request headers (`X-MS-CLIENT-PRINCIPAL`, etc.)
3. The MCP server code can read user claims from headers — no token parsing needed
4. The Protected Resource Metadata endpoint (`/.well-known/oauth-protected-resource`) is configured via a single app setting

This means you can deploy a standard MCP server image and secure it entirely through Azure portal configuration — no auth code changes.

### Easy Auth Setup in Terraform

```hcl
resource "azurerm_linux_web_app" "mcp" {
  # ... other config ...

  auth_settings_v2 {
    auth_enabled = true
    default_provider = "azureActiveDirectory"

    active_directory_v2 {
      client_id     = azuread_application.mcp.client_id
      tenant_auth_endpoint = "https://login.microsoftonline.com/${var.tenant_id}/v2.0"
      allowed_audiences = ["api://${azuread_application.mcp.client_id}"]
    }
  }
}
```

---

## Key Differences vs. Other Options

| Factor | App Service | Container Apps | Functions |
|---|---|---|---|
| Auth complexity | **Lowest** (Easy Auth) | Medium (APIM policies) | Medium (APIM policies) |
| Cost | **Highest** (~$75+/mo) | Low (~$15–50/mo) | **Lowest** (~$10–20/mo) |
| Scale to zero | ❌ Always on | ✅ | ✅ |
| Cold starts | None | 2–5s from zero | 10–30s |
| Blue/green deploys | ✅ Deployment slots | ✅ | ✅ |
| Container support | ✅ | ✅ | Custom handler |
| APIM required | ❌ Optional | ✅ Recommended | ✅ Recommended |

---

## Pre-Authorizing Claude as a Client

Because Easy Auth uses Entra for authentication, you need to pre-authorize the Claude.ai client application ID in the App Registration. Otherwise, users will be prompted for admin consent when connecting.

In the Entra App Registration → **Expose an API → Add a client application**:
- Add the Claude Team/Enterprise client application ID
- Grant the `user_impersonation` scope

This is a one-time configuration step in the Azure portal or via Terraform using `azuread_application_pre_authorized`.

---

## When to Use This Option

✅ Client doesn't have Azure/APIM expertise in-house for ongoing maintenance
✅ Want the simplest possible auth configuration
✅ Always-on availability is required (no cold starts ever)
✅ Client already uses App Service for other workloads
❌ Cost-sensitive client → use [Option 3 (Functions)](./03-self-hosted-functions.md) or [Option 2 (ACA)](./02-self-hosted-aca.md)
❌ Very large org with many concurrent users (App Service Plan doesn't scale as flexibly)
❌ Need advanced API policies → add APIM in front or switch to Option 2

---

## Example Client Scenarios

**Use this option when the client says:**

> *"We don't have anyone on staff who knows APIM or wants to learn it."*

A mid-size company without deep Azure expertise. Their IT team manages a few App Services but has never touched API Management. Easy Auth eliminates the need to write or maintain APIM policies — Microsoft handles all OAuth logic.

---

> *"Response time is critical — we can't tolerate any startup delay."*

An executive dashboard use case where the CEO expects instant responses. App Service is always-on; there's no cold start penalty. **Worth the extra ~$50/mo over Container Apps for guaranteed sub-second first response.**

---

> *"We already run our internal apps on App Service — can we just add this there?"*

A client with existing App Service infrastructure. Adding the MCP server to their existing App Service Plan may cost nothing extra if they have spare capacity. Consolidates billing and management.

---

> *"Our IT team is comfortable with App Service but nervous about containers."*

Some teams aren't ready for containerized deployments. App Service supports deploying code directly (Node.js, Python, .NET) without Docker knowledge. Lower learning curve for traditional dev teams.

---

> *"We need something simple to hand off to the client's IT team after we build it."*

You're a consultant deploying for a client who will maintain it themselves. Easy Auth is portal-configurable; no Terraform expertise needed for day-to-day management. **Lowest ongoing maintenance burden.**

---

**Don't use this option when:**

> *"We're a startup watching every dollar."*

$75+/mo is expensive for low usage. → Use [Option 3 (Functions)](./03-self-hosted-functions.md) at ~$10–20/mo.

> *"We have 200 people who might all query at once during an all-hands meeting."*

App Service Plans have fixed scaling limits. → Use [Option 2 (Container Apps)](./02-self-hosted-aca.md) for elastic scaling.

> *"We need detailed API analytics, rate limiting per user, and IP allowlisting."*

Easy Auth doesn't provide these. → Use [Option 2 (Container Apps)](./02-self-hosted-aca.md) with APIM, or add APIM in front of App Service.
