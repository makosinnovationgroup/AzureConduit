# AzureConduit MCP Servers

Model Context Protocol (MCP) servers for Microsoft Azure services with On-Behalf-Of (OBO) authentication. These servers enable secure, user-scoped access to Azure resources through Claude and other AI assistants.

## Overview

This mono-repo contains four **modular, independently deployable** MCP servers that provide tools for interacting with Microsoft services:

| Server | Port | Tools | Description |
|--------|------|-------|-------------|
| **Azure** | 8081 | 42 | Azure Resource Manager across 19 service categories |
| **D365** | 8082 | 34 | Dynamics 365 Finance & Operations (Data, Actions, Forms) |
| **Dataverse** | 8083 | 13 | Power Platform / Dataverse with schema management |
| **Fabric** | 8084 | 28 | Microsoft Fabric (Workspaces, OneLake, Docs) |

**Total: 117 tools** aligned with Microsoft's official MCP implementation patterns.

## Key Features

- **On-Behalf-Of (OBO) Authentication**: All API calls use the requesting user's identity, ensuring Azure AD roles and permissions are enforced per-user
- **Enterprise-Ready**: Production Docker images with non-root users, health checks, and centralized logging
- **MCP-Compatible**: REST endpoints designed for integration with Claude and other MCP clients

## Architecture

```
┌──────────────────────────────────────────────────────────────────────────┐
│                           Claude / MCP Client                             │
└──────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ X-User-Token header
                                    ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                         Azure API Management                              │
│                      (Token validation + routing)                         │
└──────────────────────────────────────────────────────────────────────────┘
                                    │
        ┌───────────────┬───────────┴───────────┬───────────────┐
        │               │                       │               │
        ▼               ▼                       ▼               ▼
┌─────────────┐ ┌─────────────┐       ┌─────────────┐ ┌─────────────┐
│  Azure MCP  │ │  D365 MCP   │       │Dataverse MCP│ │ Fabric MCP  │
│  (42 tools) │ │  (34 tools) │       │  (13 tools) │ │  (28 tools) │
│             │ │             │       │             │ │             │
│  OBO Token  │ │  OBO Token  │       │  OBO Token  │ │  OBO Token  │
│  Exchange   │ │  Exchange   │       │  Exchange   │ │  Exchange   │
└─────────────┘ └─────────────┘       └─────────────┘ └─────────────┘
        │               │                       │               │
        ▼               ▼                       ▼               ▼
┌─────────────┐ ┌─────────────┐       ┌─────────────┐ ┌─────────────┐
│  Azure ARM  │ │ D365 OData  │       │  Dataverse  │ │ Fabric REST │
│  Storage    │ │  Form API   │       │   OData     │ │  OneLake    │
│  + 17 more  │ │             │       │  Web API    │ │    DFS      │
└─────────────┘ └─────────────┘       └─────────────┘ └─────────────┘
```

### Modular Deployment

Each MCP server is **independently deployable**. Deploy only what you need:

```
AzureConduit.Mcp.Core (shared library - OBO authentication)
    │
    ├── AzureConduit.Mcp.Azure     ← Deploy for Azure management
    ├── AzureConduit.Mcp.D365      ← Deploy for D365 F&O
    ├── AzureConduit.Mcp.Dataverse ← Deploy for Power Platform
    └── AzureConduit.Mcp.Fabric    ← Deploy for Microsoft Fabric
```

## Prerequisites

1. **Azure AD App Registration** with:
   - Client ID and Client Secret
   - API permissions for target services (delegated)
   - OBO flow enabled

2. **Docker** and **Docker Compose** (for containerized deployment)

3. **.NET 8 SDK** (for local development)

## Quick Start

### Using Docker Compose

1. Copy the environment template:
   ```bash
   cp .env.example .env
   ```

2. Edit `.env` with your Azure AD and service configurations

3. Build and run all servers:
   ```bash
   docker-compose up -d
   ```

### Local Development

1. Clone and restore:
   ```bash
   cd mcp-servers/AzureConduit-mcp
   dotnet restore
   ```

2. Configure `appsettings.Development.json` in each project

3. Run a specific server:
   ```bash
   dotnet run --project src/AzureConduit.Mcp.Azure
   ```

## Available Tools

### Azure MCP — 42 Tools (`/tools/azure_*`)

| Category | Tools |
|----------|-------|
| **Subscriptions** | `subscriptions_list`, `subscriptions_get` |
| **Resource Groups** | `resource_groups_list`, `resource_groups_get`, `resource_groups_create` |
| **Resources** | `resources_list` |
| **Storage** | `storage_accounts_list`, `storage_containers_list`, `storage_blobs_list` |
| **Key Vault** | `keyvault_list`, `keyvault_secrets_list`, `keyvault_secret_get` |
| **Compute** | `compute_vms_list`, `compute_vm_get`, `compute_vm_start`, `compute_vm_stop` |
| **Cosmos DB** | `cosmosdb_accounts_list`, `cosmosdb_databases_list`, `cosmosdb_containers_list` |
| **SQL** | `sql_servers_list`, `sql_databases_list` |
| **App Service** | `appservice_webapps_list`, `appservice_webapp_get`, `appservice_webapp_restart`, `appservice_plans_list` |
| **AKS** | `aks_clusters_list`, `aks_cluster_get` |
| **Functions** | `functions_apps_list` |
| **Event Hubs** | `eventhubs_namespaces_list`, `eventhubs_list` |
| **Service Bus** | `servicebus_namespaces_list`, `servicebus_queues_list`, `servicebus_topics_list` |
| **Monitor** | `monitor_appinsights_list`, `monitor_loganalytics_list` |
| **Redis** | `redis_caches_list` |
| **Container Registry** | `acr_registries_list` |
| **Policy** | `policy_assignments_list` |
| **Network** | `network_vnets_list`, `network_nsgs_list` |
| **Container Apps** | `containerapps_list`, `containerapps_environments_list` |

### D365 MCP — 34 Tools (`/tools/d365_*`)

Follows Microsoft's generic pattern with Data, Action, and Form tools.

| Category | Tools | Description |
|----------|-------|-------------|
| **Data Tools** | `find_entity_type` | Find OData entity types by keyword |
| | `get_entity_metadata` | Get entity schema from $metadata |
| | `find_entities` | Query entities with $select, $filter, $expand |
| | `create_entities` | Create records via OData POST |
| | `update_entities` | Update records via OData PATCH |
| | `delete_entities` | Delete records via OData DELETE |
| **Action Tools** | `find_actions` | Find available actions/functions |
| | `invoke_action` | Invoke bound/unbound actions |
| **Form Tools** | `open_menu_item` | Open a menu item/form |
| | `find_menu_item` | Search for menu items |
| | `find_controls` | Find form controls |
| | `set_control_values` | Set field values on form |
| | `click_control` | Click buttons/controls |
| | `filter_form` | Apply form filters |
| | `filter_grid` | Filter grid data |
| | `select_grid_row` | Select a row in grid |
| | `sort_grid_column` | Sort grid by column |
| | `open_lookup` | Open lookup dialogs |
| | `open_or_close_tab` | Toggle form tabs |
| | `save_form` | Save the current form |
| | `close_form` | Close the current form |
| **Legacy** | Finance (7), Supply Chain (5), Common (1) | Entity-specific convenience tools |

### Dataverse MCP — 13 Tools (`/tools/dataverse_*`)

| Category | Tools | Description |
|----------|-------|-------------|
| **Tables** | `tables_list` | List all Dataverse tables |
| | `table_get` | Get table metadata |
| | `table_describe` | Get detailed schema with columns & relationships |
| | `table_create` | Create a new table |
| | `table_update` | Update table metadata |
| | `table_delete` | Delete a table |
| **Records** | `records_list` | List records from a table |
| | `record_get` | Get a specific record |
| | `record_create` | Create a new record |
| | `record_update` | Update an existing record |
| | `record_delete` | Delete a record |
| **Query** | `query` | Execute FetchXML queries |
| | `search` | Keyword search across Dataverse |

### Fabric MCP — 28 Tools (`/tools/fabric_*`)

| Category | Tools | Description |
|----------|-------|-------------|
| **Workspaces** | `workspaces_list`, `workspace_get`, `workspace_create` | Manage Fabric workspaces |
| **Lakehouses** | `lakehouses_list`, `lakehouse_get`, `lakehouse_tables_list` | Lakehouse operations |
| **Warehouses** | `warehouses_list`, `warehouse_get` | Data warehouse access |
| **Notebooks** | `notebooks_list`, `notebook_get` | Notebook management |
| **Pipelines** | `pipelines_list`, `pipeline_get`, `pipeline_run`, `pipeline_run_get` | Data pipeline orchestration |
| **Core** | `item_create` | Create any Fabric item type |
| **Docs** | `workloads_list` | List available Fabric workload types |
| | `workload_api_spec_get` | Get OpenAPI spec for a workload |
| | `platform_api_spec_get` | Get core Fabric platform API spec |
| | `item_definitions_get` | Get JSON schema for item definitions |
| | `best_practices_get` | Get best practices by topic |
| | `api_examples_get` | Get example API requests/responses |
| **OneLake** | `files_list` | List files in OneLake path |
| | `file_upload` | Upload file to OneLake |
| | `file_download` | Download file from OneLake |
| | `file_delete` | Delete file from OneLake |
| | `directory_create` | Create directory in OneLake |
| | `directory_delete` | Delete directory from OneLake |
| | `tables_list` | List Delta tables in lakehouse |

## Configuration

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `OBO_TENANT_ID` | Azure AD tenant ID | Yes |
| `OBO_CLIENT_ID` | App registration client ID | Yes |
| `OBO_CLIENT_SECRET` | App registration client secret | Yes |
| `D365_ENVIRONMENT_URL` | D365 F&O environment URL | D365 only |
| `DATAVERSE_ENVIRONMENT_URL` | Dataverse environment URL | Dataverse only |
| `FABRIC_CAPACITY_ID` | Default Fabric capacity ID | Optional |

### App Settings

Each server has its own `appsettings.json` with service-specific configuration:

```json
{
  "Obo": {
    "TenantId": "...",
    "ClientId": "...",
    "ClientSecret": "..."
  },
  "Azure": {
    "DefaultSubscriptionId": "..."
  }
}
```

## Security

- All authentication uses Azure AD OBO flow
- User tokens are passed via `X-User-Token` header
- Token exchange happens server-side using MSAL
- Per-user caching prevents token reuse across users
- Containers run as non-root user (uid 1000)

## Building

### Build All Images

```bash
docker-compose build
```

### Build Individual Image

```bash
docker build -f docker/Dockerfile.azure -t azureconduit/mcp-azure .
```

### Run Tests

```bash
dotnet test
```

## Project Structure

```
AzureConduit-mcp/
├── src/
│   ├── AzureConduit.Mcp.Core/      # Shared OBO auth, base services
│   ├── AzureConduit.Mcp.Azure/     # Azure Resource Manager tools
│   ├── AzureConduit.Mcp.D365/      # D365 Finance & Operations tools
│   ├── AzureConduit.Mcp.Dataverse/ # Power Platform tools
│   └── AzureConduit.Mcp.Fabric/    # Microsoft Fabric tools
├── tests/
│   └── AzureConduit.Mcp.Core.Tests/
├── docker/
│   ├── Dockerfile.azure
│   ├── Dockerfile.d365
│   ├── Dockerfile.dataverse
│   └── Dockerfile.fabric
├── docker-compose.yml
├── Directory.Build.props
├── Directory.Packages.props
└── AzureConduit.Mcp.sln
```

## Integration with Claude

To use these MCP servers with Claude, configure your MCP client to point to the server endpoints. The servers expect:

1. **Authentication Header**: `X-User-Token` containing the user's Azure AD access token
2. **Content-Type**: `application/json`
3. **Request Body**: JSON payload with tool-specific parameters

Example request:
```bash
curl -X POST http://localhost:8081/tools/azure_subscriptions_list \
  -H "Content-Type: application/json" \
  -H "X-User-Token: eyJ0eX..." \
  -d '{}'
```

## License

Copyright (c) Alphabyte. All rights reserved.
