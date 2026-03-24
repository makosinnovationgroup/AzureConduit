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
       │  strips token, injects managed identity credential
       ▼
Azure Container Apps
  └─ MCP Server container
       │  Managed Identity (no secrets)
       ▼
Microsoft APIs (D365, Graph, Azure, Fabric, Sentinel...)
       │  RBAC-scoped to authenticated user via OBO flow
       ▼
Response → Claude → Plain English answer
```

---

## Infrastructure Components

| Resource | Purpose | Tier | Est. Monthly Cost |
|---|---|---|---|
| Container Apps Environment | Hosts the MCP server | Consumption | ~$0–15 (per vCPU-s used) |
| Azure Container App | Runs the MCP server | Scale to 0 | Included above |
| Azure API Management | OAuth gateway + policies | Consumption | ~$3.50/10k calls |
| Entra App Registration | OAuth identity for the MCP server | Free | $0 |
| User-Assigned Managed Identity | Secretless auth to Azure services | Free | $0 |
| Azure Key Vault | Secrets if needed | Standard | ~$5 |
| Log Analytics Workspace | Logging + diagnostics | Pay-per-GB | ~$2–10 |
| **Total** | | | **~$15–50/mo** |

*ACR (Azure Container Registry) adds ~$5/mo if using private images.*

---

## Key Technical Decisions

### Secretless via Managed Identity
The Container App is assigned a User-Assigned Managed Identity. When calling Microsoft Graph, D365, or other Azure APIs on behalf of a user, it uses the **On-Behalf-Of (OBO) flow** — the user's Entra token is exchanged for a downstream token that carries their identity and permissions. No client secrets are stored anywhere in the deployment.

### Scale to Zero
When no users are actively querying Claude, the Container App scales to zero instances. First-call latency after idle is typically 2–5 seconds — acceptable for the conversational use case. For clients requiring sub-second response on every call, set `min_replicas = 1`.

### APIM as the Public Face
The Container App's FQDN is never shared with users or Claude. All traffic goes through APIM, which enforces token validation via the `validate-azure-ad-token` policy. This means:
- Invalid/expired tokens are rejected before hitting the MCP server
- The MCP server implementation doesn't need to handle auth logic
- Rate limiting, logging, and future policy changes are centralized

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
  mcp_image            = "ghcr.io/microsoft/mcp-azure:latest"
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
| **Azure MCP** | `mcr.microsoft.com/azure-mcp:latest` | All Azure services (15+ tools) |
| **Dynamics 365 ERP** | `mcr.microsoft.com/d365-mcp:latest` | D365 Finance, SCM, business actions |
| **Microsoft Fabric** | `mcr.microsoft.com/fabric-mcp:latest` | Data warehouses, lakehouses, analytics |
| **Dataverse** | `mcr.microsoft.com/dataverse-mcp:latest` | Power Platform business data |

*Verify current images at [github.com/microsoft/mcp](https://github.com/microsoft/mcp)*

Set your chosen image in Terraform:
```hcl
mcp_image = "mcr.microsoft.com/azure-mcp:latest"
```

---

## Permissions Required

The MCP server connects to Microsoft APIs using the user's identity (OBO flow). Grant permissions in the client's tenant:

| Target System | Required Permission |
|---|---|
| Dynamics 365 Finance/SCM | D365 RBAC role (e.g. System User) |
| Microsoft 365 (email, calendar) | Graph API delegated permissions |
| Azure resources (storage, databases) | Azure RBAC Reader or higher |
| Microsoft Fabric | Fabric Workspace Member or higher |
| Microsoft Sentinel | Sentinel Reader |

All permissions are granted in the client's tenant — AzureConduit infrastructure never holds standing access.

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

---

> *"Our compliance team requires all data to stay within our Azure tenant."*

A financial services firm with strict data residency requirements. Even for M365 data, they cannot use Microsoft's cloud-hosted MCP endpoints. Self-hosted Container Apps keeps all data flow within their tenant boundary.

---

> *"We have about 50 users who will use this daily."*

A consulting firm deploying Claude to their analysts. Regular daily usage justifies the ~$15–50/mo cost. Container Apps scales to handle concurrent requests and scales to zero overnight.

---

> *"We need to log every API call for audit purposes and rate-limit by user."*

A regulated industry client (healthcare, finance) requiring detailed audit trails. APIM provides centralized logging, rate limiting, and policy enforcement before requests hit the MCP server.

---

> *"We want to start with Microsoft's MCP server, but might build custom tools later."*

Perfect fit. Deploy Container Apps now with Microsoft's image. Later, swap in a custom MCP server image — zero infrastructure changes required.

---

**Don't use this option when:**

> *"We're a 5-person startup just trying this out."*

Overkill for pilots. → Use [Option 3 (Functions)](./03-self-hosted-functions.md) at ~$10–20/mo.

> *"We only need email and calendar access."*

No infrastructure needed. → Use [Option 1 (Cloud-Hosted)](./01-cloud-hosted.md).
