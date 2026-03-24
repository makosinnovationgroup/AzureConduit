output "mcp_endpoint_url" {
  description = "The APIM endpoint URL to paste into Claude Integrations"
  value       = "${azurerm_api_management.main.gateway_url}/mcp"
}

output "app_registration_id" {
  description = "Entra app registration client ID"
  value       = azuread_application.mcp.client_id
}

output "managed_identity_id" {
  description = "Principal ID of the managed identity"
  value       = azurerm_user_assigned_identity.mcp.principal_id
}

output "apim_gateway_url" {
  description = "Base APIM gateway URL"
  value       = azurerm_api_management.main.gateway_url
}

output "mcp_server_fqdn" {
  description = "Direct MCP server FQDN (for testing) - Container App, Functions, or App Service"
  value       = local.mcp_fqdn
}

output "compute_type" {
  description = "The compute platform used for the MCP server"
  value       = var.compute_type
}

output "resource_group_name" {
  description = "Name of the resource group containing all resources"
  value       = azurerm_resource_group.main.name
}

output "key_vault_uri" {
  description = "URI of the Key Vault"
  value       = azurerm_key_vault.main.vault_uri
}

output "acr_login_server" {
  description = "ACR login server URL (if ACR is provisioned)"
  value       = var.use_acr ? azurerm_container_registry.main[0].login_server : null
}

output "oauth_metadata_url" {
  description = "OAuth protected resource metadata URL"
  value       = "https://${azurerm_api_management.main.gateway_url}/mcp/.well-known/oauth-protected-resource"
}

output "tenant_id" {
  description = "Entra tenant ID"
  value       = var.tenant_id
}
