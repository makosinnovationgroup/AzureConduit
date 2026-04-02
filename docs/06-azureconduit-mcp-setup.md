# Option 6 — AzureConduit-mcp Setup Guide

**Deploy OBO-enabled MCP servers for Azure, D365, Dataverse, and Fabric.**

AzureConduit-mcp provides 117 MCP tools across four modular servers with On-Behalf-Of (OBO) authentication. Each user sees only what their Azure AD roles permit.

---

## What You Get

| MCP Server | Tools | Capabilities |
|------------|-------|--------------|
| **Azure** | 42 | 19 service categories: Subscriptions, Storage, Key Vault, Compute, Cosmos DB, SQL, App Service, AKS, Functions, Event Hubs, Service Bus, Monitor, Redis, Container Registry, Policy, Network, Container Apps |
| **D365** | 34 | Generic Data tools (6), Action tools (2), Form automation (13), plus legacy Finance/SCM tools |
| **Dataverse** | 13 | Full CRUD for tables/records, schema management, FetchXML queries, Search API |
| **Fabric** | 28 | Workspaces, Lakehouses, Warehouses, Notebooks, Pipelines, OneLake file operations, API documentation |

**Modular deployment** — deploy only the servers you need.

---

## Prerequisites

### Azure Requirements

- Azure subscription with Contributor access
- Entra ID (Azure AD) with Application Administrator role
- Docker (for containerized deployment)
- .NET 8 SDK (for local development)

### Claude Requirements

- Claude Team or Enterprise plan (for admin-managed integrations)
- Or Claude Pro/Max (per-user setup)

---

## Step 1: Entra App Registration

Create an app registration that will perform OBO token exchange.

### 1.1 Create the App Registration

```bash
# Login to Azure
az login

# Create app registration
az ad app create \
  --display-name "AzureConduit MCP" \
  --sign-in-audience "AzureADMyOrg" \
  --web-redirect-uris "https://localhost:8081/signin-oidc"
```

Note the **Application (client) ID** — you'll need it later.

### 1.2 Create Client Secret

```bash
# Create a client secret (valid for 1 year)
az ad app credential reset \
  --id <app-id> \
  --append \
  --years 1
```

Save the **password** value securely — this is your `OBO_CLIENT_SECRET`.

### 1.3 Add API Permissions

Add delegated permissions for each service you'll use:

**For Azure MCP:**
```bash
# Azure Service Management - user_impersonation
az ad app permission add \
  --id <app-id> \
  --api 797f4846-ba00-4fd7-ba43-dac1f8f63013 \
  --api-permissions 41094075-9dad-400e-a0bd-54e686782033=Scope
```

**For D365 MCP:**
```bash
# Dynamics CRM - user_impersonation
az ad app permission add \
  --id <app-id> \
  --api 00000007-0000-0000-c000-000000000000 \
  --api-permissions 78ce3f0f-a1ce-49c2-8cde-64b5c0896db4=Scope
```

**For Dataverse MCP:**
```bash
# Dynamics CRM (same as D365)
az ad app permission add \
  --id <app-id> \
  --api 00000007-0000-0000-c000-000000000000 \
  --api-permissions 78ce3f0f-a1ce-49c2-8cde-64b5c0896db4=Scope
```

**For Fabric MCP:**
```bash
# Power BI Service - Workspace.Read.All (add others as needed)
az ad app permission add \
  --id <app-id> \
  --api 00000009-0000-0000-c000-000000000000 \
  --api-permissions 7504609f-c495-4c64-8571-234a39a85049=Scope
```

### 1.4 Grant Admin Consent

```bash
az ad app permission admin-consent --id <app-id>
```

---

## Step 2: Configuration

### 2.1 Environment Variables

Create a `.env` file with your configuration:

```bash
# Required for all MCP servers
OBO__TenantId=your-tenant-id
OBO__ClientId=your-app-client-id
OBO__ClientSecret=your-client-secret

# For D365 MCP
D365__EnvironmentUrl=https://your-org.operations.dynamics.com
D365__FormApiUrl=https://your-org.operations.dynamics.com

# For Dataverse MCP
Dataverse__EnvironmentUrl=https://your-org.crm.dynamics.com

# For Fabric MCP (optional defaults)
Fabric__DefaultWorkspaceId=your-workspace-guid
```

### 2.2 Get Your Tenant ID

```bash
az account show --query tenantId -o tsv
```

---

## Step 3: Deploy

### Option A: Docker Compose (Recommended)

Deploy all four MCP servers:

```bash
cd mcp-servers/AzureConduit-mcp

# Copy environment template
cp .env.example .env
# Edit .env with your values

# Start all servers
docker-compose up -d
```

This starts:
- Azure MCP on port 8081
- D365 MCP on port 8082
- Dataverse MCP on port 8083
- Fabric MCP on port 8084

### Option B: Deploy Single Server

Deploy only what you need:

```bash
# Build just the Azure MCP
docker build -f docker/Dockerfile.azure -t azureconduit/mcp-azure .

# Run it
docker run -d \
  -p 8081:8080 \
  -e OBO__TenantId=xxx \
  -e OBO__ClientId=xxx \
  -e OBO__ClientSecret=xxx \
  azureconduit/mcp-azure
```

### Option C: Local Development

```bash
cd mcp-servers/AzureConduit-mcp

# Restore packages
dotnet restore

# Run a specific server
dotnet run --project src/AzureConduit.Mcp.Azure
```

---

## Step 4: Deploy to Azure

### 4.1 Push to Azure Container Registry

```bash
# Login to ACR
az acr login --name myregistry

# Build and push
docker build -f docker/Dockerfile.azure -t myregistry.azurecr.io/mcp-azure:v1.0 .
docker push myregistry.azurecr.io/mcp-azure:v1.0
```

### 4.2 Deploy with Terraform

```hcl
module "azureconduit" {
  source = "../terraform/azureconduit-mcp-infra"

  client_name     = "acme-corp"
  tenant_id       = "your-tenant-id"
  subscription_id = "your-subscription-id"

  # Deploy Azure MCP with OBO
  mcp_image    = "myregistry.azurecr.io/mcp-azure:v1.0"
  compute_type = "container_apps"
  use_acr      = true
}
```

```bash
terraform init
terraform apply
```

---

## Step 5: Connect to Claude

### 5.1 Get Your MCP Endpoint

After deployment, your MCP endpoint will be:
- **Local**: `http://localhost:8081` (Azure), `8082` (D365), etc.
- **Azure**: Output from Terraform as `mcp_endpoint_url`

### 5.2 Configure in Claude

**For Claude Team/Enterprise (Admin):**
1. Go to **claude.ai → Organization Settings → Integrations**
2. Click **Add Integration**
3. Enter your MCP endpoint URL
4. Configure OAuth with your Entra app

**For Claude Pro/Max (Per-user):**
1. Go to **claude.ai → Settings → Integrations**
2. Add your MCP endpoint
3. Authenticate with your Microsoft account

---

## Step 6: Test

Once connected, try these queries:

**Azure MCP:**
> "List my Azure subscriptions"
> "Show me all storage accounts in the production subscription"
> "What VMs are running in the dev resource group?"

**D365 MCP:**
> "Find all open purchase orders over $10,000"
> "Show me the top 10 customers by revenue"
> "What invoices are overdue?"

**Dataverse MCP:**
> "List all tables in Dataverse"
> "Show me the schema for the Account table"
> "Find all contacts created this month"

**Fabric MCP:**
> "List my Fabric workspaces"
> "What tables are in the sales lakehouse?"
> "Show me recent pipeline runs"

---

## Security Considerations

### OBO Token Flow

```
User → Claude → APIM → MCP Server → OBO Exchange → Microsoft API
                         │
                         └─ User's token exchanged for
                            downstream API token with
                            user's identity & permissions
```

### What OBO Ensures

- **User-scoped access**: Each API call uses the authenticated user's identity
- **RBAC enforcement**: Azure/D365/Dataverse RBAC applies automatically
- **Conditional Access**: MFA, device compliance, location policies honored
- **Audit trail**: All API calls are attributable to specific users

### Secrets Management

- Never commit `.env` files to git
- In production, use Azure Key Vault for secrets
- Rotate client secrets annually

---

## Tool Reference

### Azure MCP (42 Tools)

| Category | Tools |
|----------|-------|
| Subscriptions | `azure_subscriptions_list`, `azure_subscriptions_get` |
| Resource Groups | `azure_resource_groups_list`, `azure_resource_groups_get`, `azure_resource_groups_create` |
| Storage | `azure_storage_accounts_list`, `azure_storage_containers_list`, `azure_storage_blobs_list` |
| Key Vault | `azure_keyvault_list`, `azure_keyvault_secrets_list`, `azure_keyvault_secret_get` |
| Compute | `azure_compute_vms_list`, `azure_compute_vm_get`, `azure_compute_vm_start`, `azure_compute_vm_stop` |
| Cosmos DB | `azure_cosmosdb_accounts_list`, `azure_cosmosdb_databases_list`, `azure_cosmosdb_containers_list` |
| SQL | `azure_sql_servers_list`, `azure_sql_databases_list` |
| App Service | `azure_appservice_webapps_list`, `azure_appservice_webapp_get`, `azure_appservice_webapp_restart`, `azure_appservice_plans_list` |
| AKS | `azure_aks_clusters_list`, `azure_aks_cluster_get` |
| Functions | `azure_functions_apps_list` |
| Event Hubs | `azure_eventhubs_namespaces_list`, `azure_eventhubs_list` |
| Service Bus | `azure_servicebus_namespaces_list`, `azure_servicebus_queues_list`, `azure_servicebus_topics_list` |
| Monitor | `azure_monitor_appinsights_list`, `azure_monitor_loganalytics_list` |
| Redis | `azure_redis_caches_list` |
| Container Registry | `azure_acr_registries_list` |
| Policy | `azure_policy_assignments_list` |
| Network | `azure_network_vnets_list`, `azure_network_nsgs_list` |
| Container Apps | `azure_containerapps_list`, `azure_containerapps_environments_list` |

### D365 MCP (34 Tools)

| Category | Tools |
|----------|-------|
| Data | `d365_find_entity_type`, `d365_get_entity_metadata`, `d365_find_entities`, `d365_create_entities`, `d365_update_entities`, `d365_delete_entities` |
| Actions | `d365_find_actions`, `d365_invoke_action` |
| Forms | `d365_open_menu_item`, `d365_find_menu_item`, `d365_find_controls`, `d365_set_control_values`, `d365_click_control`, `d365_filter_form`, `d365_filter_grid`, `d365_select_grid_row`, `d365_sort_grid_column`, `d365_open_lookup`, `d365_open_or_close_tab`, `d365_save_form`, `d365_close_form` |
| Legacy | Finance tools (7), Supply Chain tools (5), Common (1) |

### Dataverse MCP (13 Tools)

| Category | Tools |
|----------|-------|
| Tables | `dataverse_tables_list`, `dataverse_table_get`, `dataverse_table_describe`, `dataverse_table_create`, `dataverse_table_update`, `dataverse_table_delete` |
| Records | `dataverse_records_list`, `dataverse_record_get`, `dataverse_record_create`, `dataverse_record_update`, `dataverse_record_delete` |
| Query | `dataverse_query`, `dataverse_search` |

### Fabric MCP (28 Tools)

| Category | Tools |
|----------|-------|
| Workspaces | `fabric_workspaces_list`, `fabric_workspace_get`, `fabric_workspace_create` |
| Lakehouses | `fabric_lakehouses_list`, `fabric_lakehouse_get`, `fabric_lakehouse_tables_list` |
| Warehouses | `fabric_warehouses_list`, `fabric_warehouse_get` |
| Notebooks | `fabric_notebooks_list`, `fabric_notebook_get` |
| Pipelines | `fabric_pipelines_list`, `fabric_pipeline_get`, `fabric_pipeline_run`, `fabric_pipeline_run_get` |
| Core | `fabric_item_create` |
| Docs | `fabric_workloads_list`, `fabric_workload_api_spec_get`, `fabric_platform_api_spec_get`, `fabric_item_definitions_get`, `fabric_best_practices_get`, `fabric_api_examples_get` |
| OneLake | `fabric_files_list`, `fabric_file_upload`, `fabric_file_download`, `fabric_file_delete`, `fabric_directory_create`, `fabric_directory_delete`, `fabric_tables_list` |

---

## Troubleshooting

### "User token not found"

The MCP server isn't receiving the user token. Check:
- APIM is forwarding the `X-User-Token` header
- The Authorization header contains a valid Bearer token

### "OBO token exchange failed"

The token exchange failed. Check:
- Client ID and secret are correct
- API permissions are granted with admin consent
- The user has access to the downstream resource

### "Access denied" from downstream API

The user doesn't have permission in the target system. This is OBO working correctly — the user's RBAC is being enforced.

### Container won't start

Check environment variables are set:
```bash
docker logs <container-id>
```

---

## Next Steps

- [Full AzureConduit-mcp Documentation](../mcp-servers/AzureConduit-mcp/README.md)
- [PRD: OBO Implementation Details](../prds/OBO_IMPLEMENTATION.md)
- [Terraform Infrastructure Guide](../terraform/azureconduit-mcp-infra/README.md)
