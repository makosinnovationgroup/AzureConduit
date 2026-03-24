# Deployment Guide

This document provides step-by-step instructions for deploying the AzureConduit MCP infrastructure.

## Prerequisites

### Required Permissions

The identity running Terraform needs:

| Permission | Scope | Purpose |
|------------|-------|---------|
| **Contributor** | Azure Subscription | Create and manage Azure resources |
| **Application Administrator** | Entra ID | Create app registrations and service principals |
| **User Access Administrator** | Azure Subscription | Assign RBAC roles to managed identity |

### Required Tools

```bash
# Terraform 1.6 or later
terraform version

# Azure CLI
az version

# Logged into Azure
az login
az account show
```

### Required Information

Gather the following before deployment:

| Item | How to Find |
|------|-------------|
| Tenant ID | `az account show --query tenantId -o tsv` |
| Subscription ID | `az account show --query id -o tsv` |
| Claude Client ID | Claude Team/Enterprise admin console |
| Admin Group ID | Azure Portal > Entra ID > Groups |

## Deployment Steps

### 1. Clone and Configure

```bash
# Navigate to the example directory
cd terraform/azureconduit-mcp-infra/examples/basic

# Copy the example variables file
cp terraform.tfvars.example terraform.tfvars

# Edit with your values
# Use your preferred editor
nano terraform.tfvars
```

### 2. Initialize Terraform

```bash
terraform init
```

Expected output:
```
Initializing the backend...
Initializing provider plugins...
- Finding hashicorp/azurerm versions matching "~> 4.0"...
- Finding hashicorp/azuread versions matching "~> 3.0"...
- Finding hashicorp/random versions matching "~> 3.0"...
...
Terraform has been successfully initialized!
```

### 3. Review the Plan

```bash
terraform plan -out=tfplan
```

Review the output carefully. You should see resources being created:
- 1 Resource Group
- 1 Log Analytics Workspace
- 1 Container Apps Environment
- 1 Container App
- 1 User-Assigned Managed Identity
- 1 Entra ID App Registration
- 1 Service Principal
- 1 API Management instance
- 1 Key Vault
- Several role assignments
- (Optional) 1 Container Registry

### 4. Apply the Configuration

```bash
terraform apply tfplan
```

**Estimated Deployment Time:** 15-30 minutes

The longest-running resource is typically Azure API Management (Consumption tier still takes ~15 minutes).

### 5. Retrieve Outputs

```bash
# Get the MCP endpoint URL
terraform output mcp_endpoint_url

# Get all outputs
terraform output
```

### 6. Configure Claude

1. Log into your Claude Team/Enterprise admin console
2. Navigate to Integrations > MCP Servers
3. Add a new MCP integration
4. Paste the `mcp_endpoint_url` output
5. Configure OAuth2:
   - Authorization URL: `https://login.microsoftonline.com/{tenant_id}/oauth2/v2.0/authorize`
   - Token URL: `https://login.microsoftonline.com/{tenant_id}/oauth2/v2.0/token`
   - Scope: `api://azureconduit-mcp-{client_name}-{suffix}/user_impersonation`

## Post-Deployment Verification

### Test the Health Endpoint

```bash
# Get the Container App FQDN
FQDN=$(terraform output -raw container_app_fqdn)

# Test health endpoint (no auth required for health check)
curl -s https://$FQDN/health
```

### Test APIM Endpoint

```bash
# Get an Entra ID token (requires user login)
TOKEN=$(az account get-access-token \
  --resource api://azureconduit-mcp-{client_name}-{suffix} \
  --query accessToken -o tsv)

# Call the MCP endpoint through APIM
APIM_URL=$(terraform output -raw mcp_endpoint_url)
curl -H "Authorization: Bearer $TOKEN" $APIM_URL/health
```

### Check APIM Logs

```bash
# Query Log Analytics for APIM requests
az monitor log-analytics query \
  --workspace $(terraform output -raw log_analytics_workspace_id) \
  --analytics-query "ApiManagementGatewayLogs | take 10" \
  --output table
```

## Updating the Deployment

### Modify Variables

1. Edit `terraform.tfvars`
2. Run `terraform plan` to preview changes
3. Run `terraform apply` to apply changes

### Update MCP Server Image

```bash
# Update the image variable
terraform apply -var="mcp_image=ghcr.io/microsoft/mcp:v2.0"
```

### Scale Configuration

```bash
# Increase max replicas
terraform apply -var="container_app_max_replicas=5"
```

## Destroying the Deployment

**Warning:** This will delete all resources including the Key Vault (soft-delete enabled, recoverable for 30 days).

```bash
terraform destroy
```

Type `yes` when prompted.

## Troubleshooting

### "Application Administrator" Permission Error

```
Error: Could not create application
```

**Solution:** Ensure your account has Application Administrator role in Entra ID:
```bash
az ad signed-in-user show --query id -o tsv
# Add this user ID to Application Administrator role in Azure Portal
```

### "Contributor" Permission Error

```
Error: authorization.RoleAssignmentsClient#Create: Forbidden
```

**Solution:** Ensure your account has Contributor and User Access Administrator on the subscription:
```bash
az role assignment create \
  --assignee $(az ad signed-in-user show --query id -o tsv) \
  --role "User Access Administrator" \
  --scope /subscriptions/$(az account show --query id -o tsv)
```

### APIM Provisioning Timeout

APIM Consumption tier can take 15-30 minutes. If Terraform times out:

```bash
# Check APIM status in portal
az apim show --name acd-{client}-apim-{suffix} -g acd-{client}-rg-{suffix}

# Re-run apply to continue
terraform apply
```

### Container App Not Starting

Check the logs:
```bash
az containerapp logs show \
  --name acd-{client}-ca-{suffix} \
  --resource-group acd-{client}-rg-{suffix} \
  --type system
```

Common issues:
- Image pull failure (check ACR permissions or image URL)
- Health probe failure (ensure `/health` endpoint responds)
- Insufficient CPU/memory (increase `container_app_cpu` / `container_app_memory`)

## Security Checklist

After deployment, verify:

- [ ] Entra app registration has correct redirect URI (`https://claude.ai/oauth/callback`)
- [ ] Claude client ID is pre-authorized
- [ ] APIM CORS policy only allows `https://claude.ai`
- [ ] Managed identity has minimum required permissions
- [ ] Key Vault has RBAC enabled (not access policies)
- [ ] Container App ingress is HTTPS only

## Next Steps

1. **Add target resources:** Grant managed identity access to Azure resources the MCP server needs
2. **Configure monitoring:** Set up alerts in Azure Monitor
3. **Set up CI/CD:** Automate deployments with GitHub Actions or Azure DevOps
4. **Review logs:** Monitor APIM and Container Apps logs for issues
