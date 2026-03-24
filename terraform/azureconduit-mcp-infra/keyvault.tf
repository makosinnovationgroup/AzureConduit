# Data source for current Azure client
data "azurerm_client_config" "current" {}

# Azure Key Vault for secrets management
resource "azurerm_key_vault" "main" {
  name                        = "acd-${var.client_name}-kv-${local.name_suffix}"
  location                    = azurerm_resource_group.main.location
  resource_group_name         = azurerm_resource_group.main.name
  tenant_id                   = var.tenant_id
  sku_name                    = "standard"
  purge_protection_enabled    = true
  soft_delete_retention_days  = 30
  rbac_authorization_enabled  = true
  tags                        = local.common_tags

  network_acls {
    bypass         = "AzureServices"
    default_action = "Allow" # Consider restricting in production
  }
}

# Grant the deploying identity Key Vault Administrator access
resource "azurerm_role_assignment" "deployer_keyvault" {
  scope                = azurerm_key_vault.main.id
  role_definition_name = "Key Vault Administrator"
  principal_id         = data.azurerm_client_config.current.object_id
}
