# AzureConduit MCP Infrastructure Module

This Terraform module deploys a production-ready, self-hosted Microsoft MCP (Model Context Protocol) server stack into an Azure tenant. The infrastructure is secured with Entra ID and exposed through Azure API Management for seamless integration with Claude's custom MCP integrations.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           Claude.ai                                      │
│                    (Claude Team/Enterprise)                              │
└─────────────────────────┬───────────────────────────────────────────────┘
                          │ HTTPS + OAuth2 Bearer Token
                          ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    Azure API Management                                  │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ • Validate Entra ID JWT tokens                                   │   │
│  │ • CORS policy (claude.ai allowed)                               │   │
│  │ • Strip user token, add managed identity token                   │   │
│  │ • Forward caller identity in headers                             │   │
│  └─────────────────────────────────────────────────────────────────┘   │
└─────────────────────────┬───────────────────────────────────────────────┘
                          │ HTTPS + Managed Identity Token
                          ▼
┌─────────────────────────────────────────────────────────────────────────┐
│              Azure Container Apps Environment                            │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                    MCP Server Container                          │   │
│  │  • Scale to zero (0-3 replicas)                                 │   │
│  │  • Health probes on /health                                      │   │
│  │  • User-assigned managed identity                                │   │
│  └─────────────────────────────────────────────────────────────────┘   │
└─────────────────────────┬───────────────────────────────────────────────┘
                          │ Managed Identity
                          ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    Target Azure Resources                                │
│           (Storage, Databases, Key Vault, etc.)                         │
└─────────────────────────────────────────────────────────────────────────┘
```

## Prerequisites

### Azure Permissions
The identity running Terraform requires:
- **Contributor** role on the target Azure subscription
- **Application Administrator** role in Entra ID (to create app registrations)

### Tools
- Terraform >= 1.6
- Azure CLI (`az`) for authentication
- Access to the target Azure subscription

### Information Needed
1. **Tenant ID**: Your Entra (Azure AD) tenant ID
2. **Subscription ID**: Target Azure subscription
3. **Claude Client ID**: The application ID for Claude.ai (obtain from your Claude Team/Enterprise admin)
4. **Admin Group ID**: Entra group to grant administrative access

## Quick Start

1. **Clone and navigate to the example:**
   ```bash
   cd examples/basic
   ```

2. **Create your variables file:**
   ```bash
   cp terraform.tfvars.example terraform.tfvars
   ```

3. **Edit `terraform.tfvars`** with your values (see comments in the file)

4. **Initialize and deploy:**
   ```bash
   terraform init
   terraform plan
   terraform apply
   ```

5. **Get the MCP endpoint URL:**
   ```bash
   terraform output mcp_endpoint_url
   ```

6. **Configure Claude:** Paste the endpoint URL into your Claude Team/Enterprise MCP integration settings.

## Module Inputs

| Variable | Description | Type | Default | Required |
|----------|-------------|------|---------|----------|
| `client_name` | Client identifier for resource naming (lowercase alphanumeric) | `string` | - | Yes |
| `location` | Azure region | `string` | `"eastus"` | No |
| `tenant_id` | Entra tenant ID | `string` | - | Yes |
| `subscription_id` | Azure subscription ID | `string` | - | Yes |
| `mcp_image` | MCP server container image | `string` | `"ghcr.io/microsoft/mcp:latest"` | No |
| `compute_type` | Compute platform (see Compute Types section below) | `string` | `"container_apps"` | No |
| `functions_sku` | SKU for Functions (Y1=Consumption, EP1-EP3=Premium) | `string` | `"Y1"` | No |
| `app_service_sku` | SKU for App Service (B1-B3, S1-S3, P1v3-P3v3) | `string` | `"B2"` | No |
| `apim_tier` | APIM tier (`Consumption`, `Developer`, `Standard`) | `string` | `"Consumption"` | No |
| `use_acr` | Provision private ACR | `bool` | `false` | No |
| `claude_client_id` | Claude.ai application ID to pre-authorize | `string` | - | Yes |
| `entra_admin_group_id` | Entra group for admin RBAC | `string` | - | Yes |
| `tags` | Additional resource tags | `map(string)` | `{}` | No |
| `target_resource_ids` | Azure resource IDs for managed identity access | `list(string)` | `[]` | No |
| `target_resource_role` | Role to assign on target resources | `string` | `"Reader"` | No |

## Compute Types

The module supports three compute platforms. Set `compute_type` to choose:

### `container_apps` (Default, Recommended)
- **Best for:** Production deployments
- **Cost:** ~$15–50/mo (scale to zero)
- **Cold start:** 2–5 seconds from zero
- Runs the MCP server as a Docker container
- Uses `mcp_image` variable for the container image

### `functions`
- **Best for:** Pilots, low-traffic, cost-sensitive deployments
- **Cost:** ~$10–20/mo (Consumption plan)
- **Cold start:** 10–30 seconds
- Runs the MCP server as an Azure Functions custom handler
- **Note:** Requires deploying MCP server code separately (not a container image)

### `app_service`
- **Best for:** Simplest auth setup, always-on requirement
- **Cost:** ~$75–100/mo (always running)
- **Cold start:** None (always on)
- Runs the MCP server as a Docker container with Easy Auth
- Uses `mcp_image` variable for the container image
- Easy Auth handles OAuth - simplest configuration

## Module Outputs

| Output | Description |
|--------|-------------|
| `mcp_endpoint_url` | The APIM endpoint URL to configure in Claude |
| `app_registration_id` | Entra app registration client ID |
| `managed_identity_id` | Principal ID of the managed identity |
| `apim_gateway_url` | Base APIM gateway URL |
| `mcp_server_fqdn` | Direct MCP server FQDN (for testing) |
| `compute_type` | The compute platform used |
| `key_vault_uri` | Key Vault URI |
| `acr_login_server` | ACR login server (if provisioned) |

## Security Features

### Authentication Flow
1. Claude.ai presents an Entra ID OAuth2 token to APIM
2. APIM validates the token against your tenant
3. APIM strips the user token and obtains a managed identity token
4. The MCP server receives the managed identity token
5. User identity is forwarded in `X-MS-CLIENT-PRINCIPAL-NAME` header for auditing

### Principle of Least Privilege
- MCP server uses a user-assigned managed identity (no stored credentials)
- Default role on target resources is "Reader"
- APIM validates tokens before forwarding requests
- Key Vault uses RBAC (not access policies)

### Network Security
- All traffic is HTTPS
- CORS restricted to `https://claude.ai`
- Container App ingress is external HTTPS only

## Cost Optimization

### Container Apps
- Scale to zero when idle (no cost when not in use)
- Scales up to 3 replicas under load

### APIM Consumption Tier
- Pay only for API calls
- No base infrastructure cost
- Suitable for most MCP workloads

## Customization

### Adding Target Resources
To grant the MCP server access to additional Azure resources:

```hcl
module "azureconduit_mcp" {
  # ... other variables ...

  target_resource_ids = [
    "/subscriptions/xxx/resourceGroups/xxx/providers/Microsoft.Storage/storageAccounts/mystorageaccount",
    "/subscriptions/xxx/resourceGroups/xxx/providers/Microsoft.KeyVault/vaults/mykeyvault",
  ]
  target_resource_role = "Contributor"  # or specific role as needed
}
```

### Using Private Container Registry
To use a private ACR instead of public images:

```hcl
module "azureconduit_mcp" {
  # ... other variables ...

  use_acr   = true
  mcp_image = "my-mcp-server:v1.0"  # Image name only; ACR prefix added automatically
}
```

Then push your image to the provisioned ACR.

## Troubleshooting

### Authentication Errors
- Verify `claude_client_id` matches your Claude organization's app ID
- Ensure the Entra app registration was created successfully
- Check APIM logs for detailed token validation errors

### Container App Not Starting
- Check Container Apps logs in Log Analytics
- Verify the MCP image is accessible
- Ensure health probes are responding at `/health`

### APIM 401 Errors
- Confirm the Authorization header contains a valid Entra ID token
- Verify the token audience matches the app registration
- Check that the Claude client app is pre-authorized

## Support

For issues with this module, please open an issue in the repository.

For Claude-specific questions, refer to the [Claude documentation](https://docs.anthropic.com/).
