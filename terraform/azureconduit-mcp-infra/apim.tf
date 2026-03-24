# Azure API Management instance
resource "azurerm_api_management" "main" {
  name                = "${local.name_prefix}-apim-${local.name_suffix}"
  location            = azurerm_resource_group.main.location
  resource_group_name = azurerm_resource_group.main.name
  publisher_name      = "AzureConduit"
  publisher_email     = "admin@${var.client_name}.com"
  sku_name            = var.apim_tier == "Consumption" ? "Consumption_0" : "${var.apim_tier}_1"
  tags                = local.common_tags

  identity {
    type         = "UserAssigned"
    identity_ids = [azurerm_user_assigned_identity.mcp.id]
  }
}

# Backend pointing to the MCP server (Container App, Functions, or App Service)
resource "azurerm_api_management_backend" "mcp" {
  name                = "mcp-backend"
  resource_group_name = azurerm_resource_group.main.name
  api_management_name = azurerm_api_management.main.name
  protocol            = "http"
  url                 = local.mcp_backend_url

  tls {
    validate_certificate_chain = true
    validate_certificate_name  = true
  }
}

# API definition for MCP server
resource "azurerm_api_management_api" "mcp" {
  name                  = "mcp-api"
  resource_group_name   = azurerm_resource_group.main.name
  api_management_name   = azurerm_api_management.main.name
  revision              = "1"
  display_name          = "MCP Server API"
  path                  = "mcp"
  protocols             = ["https"]
  subscription_required = false

  service_url = local.mcp_backend_url
}

# Wildcard operation to catch all MCP requests
resource "azurerm_api_management_api_operation" "all" {
  operation_id        = "all-operations"
  api_name            = azurerm_api_management_api.mcp.name
  api_management_name = azurerm_api_management.main.name
  resource_group_name = azurerm_resource_group.main.name
  display_name        = "All Operations"
  method              = "*"
  url_template        = "/*"

  response {
    status_code = 200
  }
}

# OAuth metadata endpoint
resource "azurerm_api_management_api_operation" "oauth_metadata" {
  operation_id        = "oauth-metadata"
  api_name            = azurerm_api_management_api.mcp.name
  api_management_name = azurerm_api_management.main.name
  resource_group_name = azurerm_resource_group.main.name
  display_name        = "OAuth Protected Resource Metadata"
  method              = "GET"
  url_template        = "/.well-known/oauth-protected-resource"

  response {
    status_code = 200
  }
}

# Policy for OAuth metadata endpoint - return static JSON
resource "azurerm_api_management_api_operation_policy" "oauth_metadata" {
  api_name            = azurerm_api_management_api.mcp.name
  api_management_name = azurerm_api_management.main.name
  resource_group_name = azurerm_resource_group.main.name
  operation_id        = azurerm_api_management_api_operation.oauth_metadata.operation_id

  xml_content = <<-XML
    <policies>
      <inbound>
        <base />
        <return-response>
          <set-status code="200" reason="OK" />
          <set-header name="Content-Type" exists-action="override">
            <value>application/json</value>
          </set-header>
          <set-body>{
  "resource": "${tolist(azuread_application.mcp.identifier_uris)[0]}",
  "authorization_servers": ["https://login.microsoftonline.com/${var.tenant_id}/v2.0"],
  "scopes_supported": ["${tolist(azuread_application.mcp.identifier_uris)[0]}/user_impersonation"],
  "bearer_methods_supported": ["header"]
}</set-body>
        </return-response>
      </inbound>
      <backend>
        <base />
      </backend>
      <outbound>
        <base />
      </outbound>
      <on-error>
        <base />
      </on-error>
    </policies>
  XML
}

# API-level policy for JWT validation and CORS
resource "azurerm_api_management_api_policy" "mcp" {
  api_name            = azurerm_api_management_api.mcp.name
  api_management_name = azurerm_api_management.main.name
  resource_group_name = azurerm_resource_group.main.name

  xml_content = templatefile("${path.module}/policies/apim_inbound.xml", {
    tenant_id          = var.tenant_id
    app_client_id      = azuread_application.mcp.client_id
    managed_identity_id = azurerm_user_assigned_identity.mcp.client_id
  })
}

# Named value for tenant ID (useful in policies)
resource "azurerm_api_management_named_value" "tenant_id" {
  name                = "tenant-id"
  resource_group_name = azurerm_resource_group.main.name
  api_management_name = azurerm_api_management.main.name
  display_name        = "TenantID"
  value               = var.tenant_id
}

# Named value for app client ID
resource "azurerm_api_management_named_value" "app_client_id" {
  name                = "app-client-id"
  resource_group_name = azurerm_resource_group.main.name
  api_management_name = azurerm_api_management.main.name
  display_name        = "AppClientID"
  value               = azuread_application.mcp.client_id
}
