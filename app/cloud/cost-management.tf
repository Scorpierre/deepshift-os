# ============================================================
#  DeepShift — Service Principal pour Cost Management
#  Crée un SP en lecture seule sur les coûts Azure
#  Après apply : copier les outputs dans .env.local
# ============================================================

terraform {
  required_providers {
    azuread = {
      source  = "hashicorp/azuread"
      version = "~> 2.0"
    }
  }
}

# --- Contexte courant ---

data "azurerm_subscription" "current" {}
data "azuread_client_config" "current" {}

# --- App Registration ---

resource "azuread_application" "cost_reader" {
  display_name = "deepshift-cost-reader"
}

# --- Service Principal ---

resource "azuread_service_principal" "cost_reader" {
  client_id = azuread_application.cost_reader.client_id
}

# --- Secret client (valide 1 an) ---

resource "azuread_service_principal_password" "cost_reader" {
  service_principal_id = azuread_service_principal.cost_reader.id
  end_date_relative    = "8760h"
}

# --- Rôle Cost Management Reader sur la subscription ---

resource "azurerm_role_assignment" "cost_reader" {
  scope                = data.azurerm_subscription.current.id
  role_definition_name = "Cost Management Reader"
  principal_id         = azuread_service_principal.cost_reader.object_id
}

# --- Outputs à copier dans .env.local ---

output "AZURE_TENANT_ID" {
  value = data.azuread_client_config.current.tenant_id
}

output "AZURE_CLIENT_ID" {
  value = azuread_application.cost_reader.client_id
}

output "AZURE_CLIENT_SECRET" {
  value     = azuread_service_principal_password.cost_reader.value
  sensitive = true
}

output "AZURE_SUBSCRIPTION_ID" {
  value = data.azurerm_subscription.current.subscription_id
}
