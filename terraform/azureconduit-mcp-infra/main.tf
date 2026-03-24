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
    random = {
      source  = "hashicorp/random"
      version = "~> 3.0"
    }
  }
}

provider "azurerm" {
  features {
    key_vault {
      purge_soft_delete_on_destroy    = false
      recover_soft_deleted_key_vaults = true
    }
  }
  subscription_id = var.subscription_id
  tenant_id       = var.tenant_id
}

provider "azuread" {
  tenant_id = var.tenant_id
}

# Random suffix for globally unique resource names
resource "random_string" "suffix" {
  length  = 6
  special = false
  upper   = false
}

locals {
  name_prefix = "acd-${var.client_name}"
  name_suffix = random_string.suffix.result

  common_tags = merge(var.tags, {
    project    = "azureconduit"
    client     = var.client_name
    managed_by = "terraform"
  })

  # Validate mcp_image is provided for container-based compute types
  validate_mcp_image = (
    var.compute_type != "functions" && var.mcp_image == null
    ? tobool("ERROR: mcp_image is required for ${var.compute_type} compute type")
    : true
  )

  # Backend URL based on compute type - used by APIM and outputs
  mcp_backend_url = (
    var.compute_type == "container_apps" ? "https://${azurerm_container_app.mcp[0].ingress[0].fqdn}" :
    var.compute_type == "functions" ? "https://${azurerm_linux_function_app.mcp[0].default_hostname}" :
    var.compute_type == "app_service" ? "https://${azurerm_linux_web_app.mcp[0].default_hostname}" :
    null
  )

  # FQDN for direct access (testing)
  mcp_fqdn = (
    var.compute_type == "container_apps" ? azurerm_container_app.mcp[0].ingress[0].fqdn :
    var.compute_type == "functions" ? azurerm_linux_function_app.mcp[0].default_hostname :
    var.compute_type == "app_service" ? azurerm_linux_web_app.mcp[0].default_hostname :
    null
  )
}

# Resource Group
resource "azurerm_resource_group" "main" {
  name     = "${local.name_prefix}-rg-${local.name_suffix}"
  location = var.location
  tags     = local.common_tags
}

# Log Analytics Workspace for Container Apps
resource "azurerm_log_analytics_workspace" "main" {
  name                = "${local.name_prefix}-law-${local.name_suffix}"
  location            = azurerm_resource_group.main.location
  resource_group_name = azurerm_resource_group.main.name
  sku                 = "PerGB2018"
  retention_in_days   = 30
  tags                = local.common_tags
}
