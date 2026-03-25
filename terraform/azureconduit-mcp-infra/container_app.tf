# Azure Container Apps Environment
resource "azurerm_container_app_environment" "main" {
  count = var.compute_type == "container_apps" ? 1 : 0

  name                       = "${local.name_prefix}-cae-${local.name_suffix}"
  location                   = azurerm_resource_group.main.location
  resource_group_name        = azurerm_resource_group.main.name
  log_analytics_workspace_id = azurerm_log_analytics_workspace.main.id
  tags                       = local.common_tags
}

# Azure Container App running the MCP server
resource "azurerm_container_app" "mcp" {
  count = var.compute_type == "container_apps" ? 1 : 0

  name                         = "${local.name_prefix}-ca-${local.name_suffix}"
  container_app_environment_id = azurerm_container_app_environment.main[0].id
  resource_group_name          = azurerm_resource_group.main.name
  revision_mode                = "Single"
  tags                         = local.common_tags

  identity {
    type         = "UserAssigned"
    identity_ids = [azurerm_user_assigned_identity.mcp.id]
  }

  # ACR registry configuration (conditional)
  dynamic "registry" {
    for_each = var.use_acr ? [1] : []
    content {
      server   = azurerm_container_registry.main[0].login_server
      identity = azurerm_user_assigned_identity.mcp.id
    }
  }

  ingress {
    external_enabled = true
    target_port      = 8000
    transport        = "http"

    traffic_weight {
      percentage      = 100
      latest_revision = true
    }
  }

  template {
    min_replicas = 0
    max_replicas = var.container_app_max_replicas

    container {
      name   = "mcp-server"
      image  = var.use_acr ? "${azurerm_container_registry.main[0].login_server}/${var.mcp_image}" : var.mcp_image
      cpu    = var.container_app_cpu
      memory = var.container_app_memory

      env {
        name  = "AZURE_CLIENT_ID"
        value = azurerm_user_assigned_identity.mcp.client_id
      }

      env {
        name  = "AZURE_TENANT_ID"
        value = var.tenant_id
      }

      env {
        name  = "PORT"
        value = "8000"
      }

      liveness_probe {
        path                    = "/health"
        port                    = 8000
        transport               = "HTTP"
        initial_delay           = 10
        interval_seconds        = 30
        timeout                 = 5
        failure_count_threshold = 3
      }

      readiness_probe {
        path                    = "/health"
        port                    = 8000
        transport               = "HTTP"
        initial_delay           = 5
        interval_seconds        = 10
        timeout                 = 3
        success_count_threshold = 1
        failure_count_threshold = 3
      }
    }

    # Scale based on HTTP traffic
    http_scale_rule {
      name                = "http-scaling"
      concurrent_requests = 50
    }
  }

  depends_on = [
    azurerm_role_assignment.acr_pull
  ]
}

# Storage Account for Functions compute type
resource "azurerm_storage_account" "functions" {
  count = var.compute_type == "functions" ? 1 : 0

  name                     = "acd${var.client_name}fn${local.name_suffix}"
  resource_group_name      = azurerm_resource_group.main.name
  location                 = azurerm_resource_group.main.location
  account_tier             = "Standard"
  account_replication_type = "LRS"
  min_tls_version          = "TLS1_2"
  tags                     = local.common_tags

  blob_properties {
    delete_retention_policy {
      days = 7
    }
  }
}
