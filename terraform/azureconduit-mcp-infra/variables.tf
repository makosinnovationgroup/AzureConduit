variable "client_name" {
  description = "Client name used in resource naming and tags. Should be lowercase alphanumeric."
  type        = string

  validation {
    condition     = can(regex("^[a-z0-9]+$", var.client_name))
    error_message = "Client name must be lowercase alphanumeric only."
  }
}

variable "location" {
  description = "Azure region for all resources"
  type        = string
  default     = "eastus"
}

variable "tenant_id" {
  description = "Client's Entra (Azure AD) tenant ID"
  type        = string

  validation {
    condition     = can(regex("^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$", var.tenant_id))
    error_message = "Tenant ID must be a valid GUID."
  }
}

variable "subscription_id" {
  description = "Client's Azure subscription ID"
  type        = string

  validation {
    condition     = can(regex("^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$", var.subscription_id))
    error_message = "Subscription ID must be a valid GUID."
  }
}

variable "mcp_image" {
  description = <<-EOT
    Container image for the MCP server. Required for container_apps and app_service compute types.

    Examples:
    - "myregistry.azurecr.io/mcp-server:v1.0" (private ACR)
    - "ghcr.io/your-org/mcp-server:latest" (GitHub Container Registry)
    - "mcr.microsoft.com/some-image:tag" (Microsoft Container Registry)

    Not used for functions compute_type (Functions deploy code, not containers).
  EOT
  type        = string
  default     = null
}

variable "compute_type" {
  description = "Compute platform for the MCP server"
  type        = string
  default     = "container_apps"

  validation {
    condition     = contains(["container_apps", "functions", "app_service"], var.compute_type)
    error_message = "Compute type must be one of: container_apps, functions, app_service."
  }
}

variable "apim_tier" {
  description = "Azure API Management pricing tier"
  type        = string
  default     = "Consumption"

  validation {
    condition     = contains(["Consumption", "Developer", "Standard"], var.apim_tier)
    error_message = "APIM tier must be one of: Consumption, Developer, Standard."
  }
}

variable "use_acr" {
  description = "Whether to provision a private Azure Container Registry"
  type        = bool
  default     = false
}

variable "claude_client_id" {
  description = "Claude.ai MCP client application ID to pre-authorize for OAuth2 access"
  type        = string

  validation {
    condition     = can(regex("^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$", var.claude_client_id))
    error_message = "Claude client ID must be a valid GUID."
  }
}

variable "entra_admin_group_id" {
  description = "Entra group ID to assign admin RBAC roles"
  type        = string

  validation {
    condition     = can(regex("^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$", var.entra_admin_group_id))
    error_message = "Admin group ID must be a valid GUID."
  }
}

variable "tags" {
  description = "Additional tags to apply to all resources"
  type        = map(string)
  default     = {}
}

variable "target_resource_ids" {
  description = "List of Azure resource IDs to grant the managed identity access to"
  type        = list(string)
  default     = []
}

variable "target_resource_role" {
  description = "Role to assign on target resources (default: Reader)"
  type        = string
  default     = "Reader"
}

variable "container_app_cpu" {
  description = "CPU allocation for Container App (in cores)"
  type        = number
  default     = 0.5
}

variable "container_app_memory" {
  description = "Memory allocation for Container App (e.g. '1Gi')"
  type        = string
  default     = "1Gi"
}

variable "container_app_max_replicas" {
  description = "Maximum number of Container App replicas"
  type        = number
  default     = 3
}

variable "acr_sku" {
  description = "SKU for Azure Container Registry when use_acr is true"
  type        = string
  default     = "Basic"

  validation {
    condition     = contains(["Basic", "Standard", "Premium"], var.acr_sku)
    error_message = "ACR SKU must be one of: Basic, Standard, Premium."
  }
}

variable "functions_sku" {
  description = "SKU for Azure Functions Service Plan"
  type        = string
  default     = "Y1" # Consumption plan

  validation {
    condition     = contains(["Y1", "EP1", "EP2", "EP3"], var.functions_sku)
    error_message = "Functions SKU must be one of: Y1 (Consumption), EP1, EP2, EP3 (Premium)."
  }
}

variable "app_service_sku" {
  description = "SKU for Azure App Service Plan"
  type        = string
  default     = "B2"

  validation {
    condition     = contains(["B1", "B2", "B3", "S1", "S2", "S3", "P1v3", "P2v3", "P3v3"], var.app_service_sku)
    error_message = "App Service SKU must be a valid Linux SKU (B1-B3, S1-S3, P1v3-P3v3)."
  }
}
