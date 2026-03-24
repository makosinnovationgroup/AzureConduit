# Azure Functions resources for compute_type = "functions"

# Service Plan for Functions (Consumption)
resource "azurerm_service_plan" "functions" {
  count = var.compute_type == "functions" ? 1 : 0

  name                = "${local.name_prefix}-asp-fn-${local.name_suffix}"
  location            = azurerm_resource_group.main.location
  resource_group_name = azurerm_resource_group.main.name
  os_type             = "Linux"
  sku_name            = var.functions_sku

  tags = local.common_tags
}

# Linux Function App running the MCP server
resource "azurerm_linux_function_app" "mcp" {
  count = var.compute_type == "functions" ? 1 : 0

  name                       = "${local.name_prefix}-fn-${local.name_suffix}"
  location                   = azurerm_resource_group.main.location
  resource_group_name        = azurerm_resource_group.main.name
  service_plan_id            = azurerm_service_plan.functions[0].id
  storage_account_name       = azurerm_storage_account.functions[0].name
  storage_account_access_key = azurerm_storage_account.functions[0].primary_access_key

  tags = local.common_tags

  identity {
    type         = "UserAssigned"
    identity_ids = [azurerm_user_assigned_identity.mcp.id]
  }

  site_config {
    application_stack {
      node_version = "20"
    }

    # Health check endpoint
    health_check_path                 = "/health"
    health_check_eviction_time_in_min = 5

    # CORS for Claude
    cors {
      allowed_origins = ["https://claude.ai"]
    }

    # Always use HTTPS
    http2_enabled       = true
    minimum_tls_version = "1.2"
  }

  app_settings = {
    "AZURE_CLIENT_ID"                      = azurerm_user_assigned_identity.mcp.client_id
    "AZURE_TENANT_ID"                      = var.tenant_id
    "FUNCTIONS_WORKER_RUNTIME"             = "custom"
    "WEBSITE_RUN_FROM_PACKAGE"             = "1"
    "SCM_DO_BUILD_DURING_DEPLOYMENT"       = "false"
    "APPLICATIONINSIGHTS_CONNECTION_STRING" = azurerm_application_insights.functions[0].connection_string
  }

  https_only = true

  lifecycle {
    ignore_changes = [
      app_settings["WEBSITE_RUN_FROM_PACKAGE"],
    ]
  }
}

# Application Insights for Functions monitoring
resource "azurerm_application_insights" "functions" {
  count = var.compute_type == "functions" ? 1 : 0

  name                = "${local.name_prefix}-ai-${local.name_suffix}"
  location            = azurerm_resource_group.main.location
  resource_group_name = azurerm_resource_group.main.name
  workspace_id        = azurerm_log_analytics_workspace.main.id
  application_type    = "web"

  tags = local.common_tags
}
