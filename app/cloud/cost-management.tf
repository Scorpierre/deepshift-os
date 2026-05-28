# ============================================================
#  DeepShift — Managed Identity pour Cost Management
#  Active l'identité système sur la VM et lui donne accès
#  en lecture aux coûts Azure. Pas de secret à gérer.
# ============================================================

data "azurerm_subscription" "current" {}

# Rôle Cost Management Reader pour la Managed Identity de la VM
resource "azurerm_role_assignment" "vm_cost_reader" {
  scope                = data.azurerm_subscription.current.id
  role_definition_name = "Cost Management Reader"
  principal_id         = azurerm_linux_virtual_machine.vm.identity[0].principal_id
}

output "AZURE_SUBSCRIPTION_ID" {
  value = data.azurerm_subscription.current.subscription_id
}
