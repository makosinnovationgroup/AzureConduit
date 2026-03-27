# Option 2 — Self-Hosted: Azure Container Apps (Recommended for Production)

**The gold standard for enterprise AzureConduit deployments.**

Azure Container Apps (ACA) is the recommended hosting platform for production AzureConduit deployments. It provides scale-to-zero cost efficiency, minimal cold start latency (2–5 seconds from zero), secretless authentication via Managed Identity, and a clean fit with the Terraform module.

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
Azure Container Apps
  └─ MCP Server container
       │
       ▼
Microsoft APIs (D365, Graph, Azure, Fabric, Sentinel...)
       │
       ▼
Response → Claude → Plain English answer
```

---

## User Identity Options (Critical Decision)

> ⚠️ **Important**: How downstream APIs authenticate determines whether users see only their own data or shared data. Choose carefully based on security requirements.

### Option A: Managed Identity (Shared Access)

**Default in current Terraform.** All API calls use the same service principal.

| Aspect | Details |
|--------|---------|
| **How it works** | MCP server uses its Managed Identity to call downstream APIs |
| **User context** | ❌ No — all users share the same access level |
| **RBAC enforcement** | Based on Managed Identity's role assignments, not user's |
| **Best for** | Non-sensitive data, internal tools, scenarios where all users should see the same data |

```
User A ─┐                    ┌─→ Managed Identity ─→ API (sees MI's data)
User B ─┼─→ MCP Server ──────┤
User C ─┘                    └─→ Same access for all users
```

### Option B: On-Behalf-Of Flow (User-Scoped Access)

**Requires MCP server code changes.** Each API call uses the authenticated user's identity.

| Aspect | Details |
|--------|---------|
| **How it works** | MCP server exchanges user's token for downstream API token via OBO |
| **User context** | ✅ Yes — each user sees only their own data |
| **RBAC enforcement** | Based on user's role assignments |
| **Best for** | Sensitive data, multi-tenant scenarios, compliance requirements |

```
User A ─→ MCP Server ─→ OBO Exchange ─→ API (sees User A's data)
User B ─→ MCP Server ─→ OBO Exchange ─→ API (sees User B's data)
User C ─→ MCP Server ─→ OBO Exchange ─→ API (sees User C's data)
```

**Implementation status:** OBO is NOT built into Microsoft's MCP servers or the AzureConduit Terraform. See `prds/OBO_IMPLEMENTATION.md` for implementation guide.

### Option C: OAuth Identity Passthrough (Microsoft Foundry Only)

**Available only when using Microsoft Foundry Agent Service** as the orchestration layer.

| Aspect | Details |
|--------|---------|
| **How it works** | User signs in via OAuth, Foundry stores their tokens per-user |
| **User context** | ✅ Yes — each user sees only their own data |
| **RBAC enforcement** | Based on user's role assignments |
| **Best for** | Clients already using Foundry/Copilot Studio |

**Not available for direct Claude-to-MCP connections.** Requires Microsoft Foundry as intermediary.

### Decision Matrix

| Requirement | Use Managed Identity | Use OBO | Use Foundry |
|-------------|---------------------|---------|-------------|
| All users see same data | ✅ | ✅ | ✅ |
| Users see only their own data | ❌ | ✅ | ✅ |
| No code changes needed | ✅ | ❌ | ✅ |
| Works with Claude directly | ✅ | ✅ | ❌ |
| Compliance/audit per-user | ❌ | ✅ | ✅ |

---

## Infrastructure Components

| Resource | Purpose | Tier | Est. Monthly Cost |
|---|---|---|---|
| Container Apps Environment | Hosts the MCP server | Consumption | ~$0–15 (per vCPU-s used) |
| Azure Container App | Runs the MCP server | Scale to 0 | Included above |
| Azure API Management | OAuth gateway + policies | Consumption | ~$3.50/10k calls |
| Entra App Registration | OAuth identity for the MCP server | Free | $0 |
| User-Assigned Managed Identity | Secretless auth to Azure services | Free | $0 |
| Azure Key Vault | Secrets (including OBO client secret if used) | Standard | ~$5 |
| Log Analytics Workspace | Logging + diagnostics | Pay-per-GB | ~$2–10 |
| Application Insights | APIM request tracing | Pay-per-GB | ~$2–5 |
| **Total** | | | **~$15–50/mo** |

*ACR (Azure Container Registry) adds ~$5/mo if using private images.*

---

## Key Technical Decisions

### APIM as the Security Gateway

The Container App's FQDN is never shared with users or Claude. All traffic goes through APIM, which enforces token validation via the `validate-azure-ad-token` policy. This means:
- Invalid/expired tokens are rejected before hitting the MCP server
- Rate limiting, logging, and policy enforcement are centralized
- User identity is validated at the gateway

### Managed Identity for Infrastructure

The Container App is assigned a User-Assigned Managed Identity for:
- Pulling images from Azure Container Registry (if used)
- Reading secrets from Key Vault
- **Optionally** calling downstream APIs (if using shared access model)

### Scale to Zero

When no users are actively querying Claude, the Container App scales to zero instances. First-call latency after idle is typically 2–5 seconds — acceptable for the conversational use case. For clients requiring sub-second response on every call, set `min_replicas = 1`.

---

## Deployment

### Prerequisites
- Azure subscription (Owner or Contributor + User Access Administrator)
- Entra ID (Application Administrator role)
- Terraform >= 1.6 installed
- Azure CLI authenticated (`az login`)

### Deploy with the AzureConduit Terraform Module

```hcl
module "azureconduit" {
  source = "./azureconduit-mcp-infra"

  client_name          = "acme-corp"
  location             = "eastus2"
  tenant_id            = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
  subscription_id      = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
  compute_type         = "container_apps"
  mcp_image            = "mcr.microsoft.com/azure-mcp:latest"
  apim_tier            = "Consumption"
  use_acr              = false
  claude_client_id     = "your-claude-enterprise-client-id"
  entra_admin_group_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"

  tags = {
    environment = "production"
    client      = "acme-corp"
  }
}

output "mcp_endpoint" {
  value = module.azureconduit.mcp_endpoint_url
}
```

```bash
terraform init
terraform plan -out=azureconduit.tfplan
terraform apply azureconduit.tfplan
```

### Register in Claude

Take the `mcp_endpoint_url` output and:
1. Go to **claude.ai → Organization Settings → Integrations → Add More**
2. Paste the URL
3. Save — it's now available to all users in the org

---

## Available Microsoft MCP Server Images

Use one of Microsoft's official MCP server container images:

| MCP Server | Container Image | What It Accesses |
|---|---|---|
| **Azure MCP** | See [github.com/Azure/azure-mcp](https://github.com/Azure/azure-mcp) | All Azure services (15+ tools) |
| **Dynamics 365 ERP** | Check [github.com/microsoft/mcp](https://github.com/microsoft/mcp) | D365 Finance, SCM, business actions |
| **Microsoft Fabric** | Check [github.com/microsoft/mcp](https://github.com/microsoft/mcp) | Data warehouses, lakehouses, analytics |
| **Dataverse** | Check [github.com/microsoft/mcp](https://github.com/microsoft/mcp) | Power Platform business data |

> ⚠️ **Note**: Microsoft's official MCP servers use Managed Identity or the caller's direct credentials — they do NOT implement OBO out of the box. If user-scoped access is required, you'll need custom MCP server code. See `prds/OBO_IMPLEMENTATION.md`.

*Verify current images at [github.com/microsoft/mcp](https://github.com/microsoft/mcp) and [github.com/Azure/azure-mcp](https://github.com/Azure/azure-mcp)*

---

## Permissions Required

### If Using Managed Identity (Shared Access)

Grant the Managed Identity access in the client's tenant:

| Target System | Required Permission for Managed Identity |
|---|---|
| Dynamics 365 Finance/SCM | D365 Application User with appropriate security role |
| Microsoft Graph | Application permissions (e.g., `User.Read.All`) |
| Azure resources | Azure RBAC role (e.g., Reader) on target resources |
| Microsoft Fabric | Fabric Workspace Member or higher |

### If Using OBO (User-Scoped Access)

Grant **delegated permissions** to the Entra App Registration:

| Target System | Required Delegated Permission |
|---|---|
| Dynamics 365 Finance/SCM | `user_impersonation` on D365 |
| Microsoft Graph | Delegated permissions (e.g., `User.Read`, `Mail.Read`) |
| Azure resources | User must have Azure RBAC roles; app needs `user_impersonation` |
| Microsoft Fabric | Delegated permissions on Fabric API |

Additionally, add a **client secret or certificate** to the app registration for OBO token exchange.

---

## When to Use This Option

✅ Client needs D365, Azure resources, or Fabric access
✅ Production deployment with real users
✅ Needs APIM policies (rate limiting, logging, IP allowlisting)
✅ Want secretless, managed infrastructure
✅ Terraform-deployable and repeatable across multiple clients
❌ Client only needs M365 → use [Option 1 (Cloud-Hosted)](./01-cloud-hosted.md)
❌ Extremely cost-sensitive with very low usage → consider [Option 3 (Functions)](./03-self-hosted-functions.md)

---

## Example Client Scenarios

**Use this option when the client says:**

> *"We need Claude to pull purchase orders and invoices from Dynamics 365 Finance."*

A mid-size manufacturer (500 employees) running D365 F&O. Their AP team wants to ask "What invoices are due this week?" and "Show me POs over $50k awaiting approval." D365 requires self-hosted infrastructure. **This is the default production choice.**

**Identity consideration:** If different users should see different D365 data based on their security roles, implement OBO. If all users can see all data, Managed Identity is simpler.

---

> *"Our compliance team requires all data to stay within our Azure tenant."*

A financial services firm with strict data residency requirements. Even for M365 data, they cannot use Microsoft's cloud-hosted MCP endpoints. Self-hosted Container Apps keeps all data flow within their tenant boundary.

---

> *"We have about 50 users who will use this daily."*

A consulting firm deploying Claude to their analysts. Regular daily usage justifies the ~$15–50/mo cost. Container Apps scales to handle concurrent requests and scales to zero overnight.

---

> *"We need to log every API call for audit purposes and rate-limit by user."*

A regulated industry client (healthcare, finance) requiring detailed audit trails. APIM provides centralized logging, rate limiting, and policy enforcement before requests hit the MCP server.

**Identity consideration:** For per-user audit trails to be meaningful, consider implementing OBO so logs show which user accessed which data.

---

> *"We want to start with Microsoft's MCP server, but might build custom tools later."*

Perfect fit. Deploy Container Apps now with Microsoft's image. Later, swap in a custom MCP server image — zero infrastructure changes required.

---

**Don't use this option when:**

> *"We're a 5-person startup just trying this out."*

Overkill for pilots. → Use [Option 3 (Functions)](./03-self-hosted-functions.md) at ~$10–20/mo.

> *"We only need email and calendar access."*

No infrastructure needed. → Use [Option 1 (Cloud-Hosted)](./01-cloud-hosted.md).
