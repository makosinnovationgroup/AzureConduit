# Azure Container Registry (conditional)
resource "azurerm_container_registry" "main" {
  count = var.use_acr ? 1 : 0

  name                = "acd${var.client_name}acr${local.name_suffix}"
  resource_group_name = azurerm_resource_group.main.name
  location            = azurerm_resource_group.main.location
  sku                 = var.acr_sku
  admin_enabled       = false
  tags                = local.common_tags

  # Content trust is managed via azurerm_container_registry_trust_policy for Premium SKU
  # Retention is managed via azurerm_container_registry_retention_policy for Premium SKU
}

# Diagnostic settings for ACR (if provisioned)
resource "azurerm_monitor_diagnostic_setting" "acr" {
  count = var.use_acr ? 1 : 0

  name                       = "acr-diagnostics"
  target_resource_id         = azurerm_container_registry.main[0].id
  log_analytics_workspace_id = azurerm_log_analytics_workspace.main.id

  enabled_log {
    category = "ContainerRegistryRepositoryEvents"
  }

  enabled_log {
    category = "ContainerRegistryLoginEvents"
  }

  enabled_metric {
    category = "AllMetrics"
  }
}
