# Claude Code Prompt — AzureConduit Terraform Infrastructure

Use this prompt in Claude Code to scaffold the full Terraform infrastructure for a AzureConduit client deployment.

---

## Prompt

```
Build a production-ready Terraform module called `azureconduit-mcp-infra` that deploys a self-hosted Microsoft MCP server stack into a client's Azure tenant, secured with Entra ID and exposed through Azure API Management for use with Claude's custom MCP integrations.

## Target Architecture

The module should deploy the following resources:

### Core Compute
- **Azure Container Apps Environment** with a Log Analytics workspace
- **Azure Container App** running the MCP server Docker image (configurable via variable)
  - Scale to zero when idle (min replicas = 0, max = 3)
  - Ingress: external HTTPS only, port 8000
  - Liveness and readiness probes on `/health`

### Identity & Security
- **User-Assigned Managed Identity** for the Container App (no client secrets)
- **Entra ID App Registration** via `azuread` provider:
  - Define an OAuth2 scope: `user_impersonation`
  - Pre-authorize the Claude.ai client application ID (variable, e.g. for Team/Enterprise plan)
  - Expose a `/.well-known/oauth-protected-resource` metadata endpoint config
- **Role assignments** granting the Managed Identity the minimum required roles on target Azure resources (Reader by default, configurable)

### API Gateway
- **Azure API Management** (Consumption tier for cost efficiency)
  - Import the MCP server as a backend API
  - Policy: validate Entra ID JWT tokens on inbound requests using `validate-azure-ad-token`
  - Policy: strip Authorization header before forwarding to Container App (replace with managed identity token)
  - CORS policy allowing `https://claude.ai`

### Supporting Resources
- **Azure Key Vault** for any secrets (ACR pull credentials if needed)
- **Azure Container Registry (ACR)** — optional, controlled by `var.use_acr` boolean
- **Azure Storage Account** — only if Functions transport is selected (see `var.compute_type`)

## Variables Required

```hcl
variable "client_name"         # used in resource naming and tags
variable "location"            # Azure region
variable "tenant_id"           # Client's Entra tenant ID
variable "subscription_id"     # Client's Azure subscription
variable "mcp_image"           # Container image (e.g. "ghcr.io/microsoft/mcp:latest")
variable "compute_type"        # "container_apps" | "functions" | "app_service"
variable "apim_tier"           # "Consumption" | "Developer" | "Standard"
variable "use_acr"             # bool — provision private ACR or use public image
variable "claude_client_id"    # Claude.ai MCP client app ID to pre-authorize
variable "entra_admin_group_id" # Entra group ID to assign admin RBAC
variable "tags"                # map(string) for all resources
```

## Outputs Required

```hcl
output "mcp_endpoint_url"       # The APIM endpoint URL to paste into Claude Integrations
output "app_registration_id"    # Entra app registration client ID
output "managed_identity_id"    # Principal ID of the managed identity
output "apim_gateway_url"       # Base APIM URL
output "container_app_fqdn"     # Direct Container App FQDN (for testing)
```

## Module Structure

Organize as follows:
```
azureconduit-mcp-infra/
├── main.tf               # provider config, resource group
├── variables.tf          # all input variables with descriptions and defaults
├── outputs.tf            # all outputs
├── container_app.tf      # ACA environment + container app
├── identity.tf           # managed identity + role assignments
├── entra.tf              # app registration, scopes, pre-authorization
├── apim.tf               # APIM instance, API import, policies
├── keyvault.tf           # Key Vault + access policies
├── registry.tf           # ACR (conditional on var.use_acr)
├── policies/
│   └── apim_inbound.xml  # APIM JWT validation + backend policy
└── examples/
    └── basic/
        ├── main.tf       # Example usage calling the module
        └── terraform.tfvars.example
```

## Provider Requirements

```hcl
terraform {
  required_providers {
    azurerm  = { source = "hashicorp/azurerm", version = "~> 4.0" }
    azuread  = { source = "hashicorp/azuread", version = "~> 3.0" }
    random   = { source = "hashicorp/random", version = "~> 3.0" }
  }
  required_version = ">= 1.6"
}
```

## Additional Requirements

- All resource names should follow pattern: `acd-{client_name}-{resource_type}-{random_suffix}`
- Use `random_string` for suffix to avoid naming collisions across client deployments
- Tag all resources with: `project = "azureconduit"`, `client = var.client_name`, `managed_by = "terraform"`
- The APIM policy XML should validate Entra tokens and return 401 with a clear error for unauthenticated requests
- Include a `README.md` in the module root explaining prerequisites, how to run, and how to get the output URL into Claude
- Add a `DEPLOY.md` with the exact `terraform init / plan / apply` commands and required permissions (the deploying identity needs: Contributor on the subscription, Application Administrator in Entra)

Do not use deprecated azurerm resources. Use `azurerm_container_app` (not the preview resource). Prefer `azurerm_api_management_api_operation_policy` over inline policy blocks where possible.
```
