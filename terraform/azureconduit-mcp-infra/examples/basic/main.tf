terraform {
  required_version = ">= 1.6"

  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 4.0"
    }
    azuread = {
      source  = "hashicorp/azuread"
      version = "~> 3.0"
    }
  }
}

# Call the AzureConduit MCP infrastructure module
module "azureconduit_mcp" {
  source = "../../"

  # Required variables
  client_name          = var.client_name
  location             = var.location
  tenant_id            = var.tenant_id
  subscription_id      = var.subscription_id
  claude_client_id     = var.claude_client_id
  entra_admin_group_id = var.entra_admin_group_id

  # Optional: Override defaults
  mcp_image    = var.mcp_image
  compute_type = var.compute_type
  apim_tier    = var.apim_tier
  use_acr      = var.use_acr

  # Optional: Target resources for managed identity access
  target_resource_ids  = var.target_resource_ids
  target_resource_role = var.target_resource_role

  # Additional tags
  tags = var.tags
}

# Variables for the example
variable "client_name" {
  description = "Client name for resource naming"
  type        = string
}

variable "location" {
  description = "Azure region"
  type        = string
  default     = "eastus"
}

variable "tenant_id" {
  description = "Entra tenant ID"
  type        = string
}

variable "subscription_id" {
  description = "Azure subscription ID"
  type        = string
}

variable "claude_client_id" {
  description = "Claude.ai client application ID"
  type        = string
}

variable "entra_admin_group_id" {
  description = "Entra admin group ID"
  type        = string
}

variable "mcp_image" {
  description = "MCP server container image"
  type        = string
  default     = "ghcr.io/microsoft/mcp:latest"
}

variable "compute_type" {
  description = "Compute type for MCP server"
  type        = string
  default     = "container_apps"
}

variable "apim_tier" {
  description = "APIM pricing tier"
  type        = string
  default     = "Consumption"
}

variable "use_acr" {
  description = "Use private ACR"
  type        = bool
  default     = false
}

variable "target_resource_ids" {
  description = "Resource IDs for managed identity access"
  type        = list(string)
  default     = []
}

variable "target_resource_role" {
  description = "Role for target resources"
  type        = string
  default     = "Reader"
}

variable "tags" {
  description = "Additional tags"
  type        = map(string)
  default     = {}
}

# Outputs
output "mcp_endpoint_url" {
  description = "MCP endpoint URL for Claude integrations"
  value       = module.azureconduit_mcp.mcp_endpoint_url
}

output "app_registration_id" {
  description = "Entra app registration client ID"
  value       = module.azureconduit_mcp.app_registration_id
}

output "container_app_fqdn" {
  description = "Container App FQDN for testing"
  value       = module.azureconduit_mcp.container_app_fqdn
}

output "apim_gateway_url" {
  description = "APIM gateway URL"
  value       = module.azureconduit_mcp.apim_gateway_url
}
