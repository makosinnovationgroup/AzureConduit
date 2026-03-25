# Azure App Service resources for compute_type = "app_service"

# Service Plan for App Service
resource "azurerm_service_plan" "app_service" {
  count = var.compute_type == "app_service" ? 1 : 0

  name                = "${local.name_prefix}-asp-${local.name_suffix}"
  location            = azurerm_resource_group.main.location
  resource_group_name = azurerm_resource_group.main.name
  os_type             = "Linux"
  sku_name            = var.app_service_sku

  tags = local.common_tags
}

# Linux Web App running the MCP server
resource "azurerm_linux_web_app" "mcp" {
  count = var.compute_type == "app_service" ? 1 : 0

  name                = "${local.name_prefix}-app-${local.name_suffix}"
  location            = azurerm_resource_group.main.location
  resource_group_name = azurerm_resource_group.main.name
  service_plan_id     = azurerm_service_plan.app_service[0].id

  tags = local.common_tags

  identity {
    type         = "UserAssigned"
    identity_ids = [azurerm_user_assigned_identity.mcp.id]
  }

  site_config {
    always_on = true

    # Container configuration
    application_stack {
      docker_registry_url = var.use_acr ? "https://${azurerm_container_registry.main[0].login_server}" : "https://ghcr.io"
      docker_image_name   = var.use_acr ? var.mcp_image : replace(var.mcp_image, "ghcr.io/", "")
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
    "AZURE_CLIENT_ID"                          = azurerm_user_assigned_identity.mcp.client_id
    "AZURE_TENANT_ID"                          = var.tenant_id
    "PORT"                                     = "8000"
    "WEBSITES_PORT"                            = "8000"
    "DOCKER_REGISTRY_SERVER_URL"               = var.use_acr ? "https://${azurerm_container_registry.main[0].login_server}" : null
    "WEBSITES_ENABLE_APP_SERVICE_STORAGE"      = "false"
    "MICROSOFT_PROVIDER_AUTHENTICATION_SECRET" = azuread_application_password.mcp[0].value
  }

  https_only = true

  # Easy Auth - Entra ID authentication
  auth_settings_v2 {
    auth_enabled           = true
    require_authentication = true
    default_provider       = "azureActiveDirectory"

    active_directory_v2 {
      client_id                  = azuread_application.mcp.client_id
      tenant_auth_endpoint       = "https://login.microsoftonline.com/${var.tenant_id}/v2.0"
      allowed_audiences          = ["api://${azuread_application.mcp.client_id}"]
      client_secret_setting_name = "MICROSOFT_PROVIDER_AUTHENTICATION_SECRET"
    }

    login {
      token_store_enabled = true
    }
  }

  depends_on = [
    azurerm_role_assignment.acr_pull
  ]
}

# App Registration password for Easy Auth (only needed for App Service)
resource "azuread_application_password" "mcp" {
  count = var.compute_type == "app_service" ? 1 : 0

  application_id = azuread_application.mcp.id
  display_name   = "Easy Auth Secret"
  end_date       = timeadd(timestamp(), "8760h") # 1 year

  lifecycle {
    ignore_changes = [end_date]
  }
}

# Application Insights for App Service monitoring
resource "azurerm_application_insights" "app_service" {
  count = var.compute_type == "app_service" ? 1 : 0

  name                = "${local.name_prefix}-ai-${local.name_suffix}"
  location            = azurerm_resource_group.main.location
  resource_group_name = azurerm_resource_group.main.name
  workspace_id        = azurerm_log_analytics_workspace.main.id
  application_type    = "web"

  tags = local.common_tags
}
