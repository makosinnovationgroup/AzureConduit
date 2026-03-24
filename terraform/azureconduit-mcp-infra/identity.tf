# User-Assigned Managed Identity for the MCP server
resource "azurerm_user_assigned_identity" "mcp" {
  name                = "${local.name_prefix}-id-${local.name_suffix}"
  location            = azurerm_resource_group.main.location
  resource_group_name = azurerm_resource_group.main.name
  tags                = local.common_tags
}

# Role assignment for ACR pull (if using ACR)
resource "azurerm_role_assignment" "acr_pull" {
  count = var.use_acr ? 1 : 0

  scope                = azurerm_container_registry.main[0].id
  role_definition_name = "AcrPull"
  principal_id         = azurerm_user_assigned_identity.mcp.principal_id
}

# Role assignments on target Azure resources
resource "azurerm_role_assignment" "target_resources" {
  count = length(var.target_resource_ids)

  scope                = var.target_resource_ids[count.index]
  role_definition_name = var.target_resource_role
  principal_id         = azurerm_user_assigned_identity.mcp.principal_id
}

# Grant the admin group Contributor access to the resource group
resource "azurerm_role_assignment" "admin_group_contributor" {
  scope                = azurerm_resource_group.main.id
  role_definition_name = "Contributor"
  principal_id         = var.entra_admin_group_id
}

# Grant the admin group Key Vault Administrator access
resource "azurerm_role_assignment" "admin_group_keyvault" {
  scope                = azurerm_key_vault.main.id
  role_definition_name = "Key Vault Administrator"
  principal_id         = var.entra_admin_group_id
}

# Allow the managed identity to read secrets from Key Vault
resource "azurerm_role_assignment" "mcp_keyvault_secrets" {
  scope                = azurerm_key_vault.main.id
  role_definition_name = "Key Vault Secrets User"
  principal_id         = azurerm_user_assigned_identity.mcp.principal_id
}
