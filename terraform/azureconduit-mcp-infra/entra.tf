# Data source for current client configuration
data "azuread_client_config" "current" {}

# Entra ID App Registration for MCP server
resource "azuread_application" "mcp" {
  display_name     = "AzureConduit MCP - ${var.client_name}"
  sign_in_audience = "AzureADMyOrg"
  owners           = [data.azuread_client_config.current.object_id]

  identifier_uris = [
    "api://azureconduit-mcp-${var.client_name}-${local.name_suffix}"
  ]

  # OAuth2 permission scope for user impersonation
  api {
    requested_access_token_version = 2

    oauth2_permission_scope {
      admin_consent_description  = "Allow the application to access the MCP server on behalf of the signed-in user"
      admin_consent_display_name = "Access MCP Server"
      enabled                    = true
      id                         = random_uuid.user_impersonation_scope.result
      type                       = "User"
      user_consent_description   = "Allow the application to access the MCP server on your behalf"
      user_consent_display_name  = "Access MCP Server"
      value                      = "user_impersonation"
    }
  }

  # Web configuration for OAuth2 flows
  web {
    redirect_uris = ["https://claude.ai/oauth/callback"]

    implicit_grant {
      access_token_issuance_enabled = false
      id_token_issuance_enabled     = false
    }
  }

  # Optional claims for tokens
  optional_claims {
    access_token {
      name = "email"
    }
    access_token {
      name = "upn"
    }
    id_token {
      name = "email"
    }
  }

  tags = ["AzureConduit", "MCP", var.client_name]
}

# Random UUID for the OAuth2 scope ID
resource "random_uuid" "user_impersonation_scope" {}

# Service Principal for the application
resource "azuread_service_principal" "mcp" {
  client_id                    = azuread_application.mcp.client_id
  app_role_assignment_required = false
  owners                       = [data.azuread_client_config.current.object_id]

  tags = ["AzureConduit", "MCP", var.client_name]
}

# Pre-authorize the Claude.ai client application
resource "azuread_application_pre_authorized" "claude" {
  application_id       = azuread_application.mcp.id
  authorized_client_id = var.claude_client_id
  permission_ids       = [random_uuid.user_impersonation_scope.result]
}

# Grant admin group access to manage the application
resource "azuread_app_role_assignment" "admin_group" {
  app_role_id         = "00000000-0000-0000-0000-000000000000" # Default access
  principal_object_id = var.entra_admin_group_id
  resource_object_id  = azuread_service_principal.mcp.object_id
}
