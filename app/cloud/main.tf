# ============================================================
#  DeepShift — Infrastructure Azure
#  VM B2ms · Ubuntu 24.04 · Docker · n8n · PostgreSQL
# ============================================================

terraform {
  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 4.0"
    }
    azuread = {
      source  = "hashicorp/azuread"
      version = "~> 2.0"
    }
  }
}

provider "azurerm" {
  features {}
  resource_provider_registrations = "none"
}

# --- VARIABLES ---

variable "location" {
  default = "francecentral"
}

variable "prefix" {
  default = "deepshift"
}

variable "admin_username" {
  default = "deepshift"
}

variable "admin_password" {
  sensitive = true
}

variable "postgres_password" {
  sensitive = true
}

variable "n8n_encryption_key" {
  sensitive = true
}

# --- RESOURCE GROUP ---

resource "azurerm_resource_group" "rg" {
  name     = "${var.prefix}-rg"
  location = var.location
}

# --- RÉSEAU ---

resource "azurerm_virtual_network" "vnet" {
  name                = "${var.prefix}-vnet"
  address_space       = ["10.0.0.0/16"]
  location            = azurerm_resource_group.rg.location
  resource_group_name = azurerm_resource_group.rg.name
}

resource "azurerm_subnet" "snet" {
  name                 = "${var.prefix}-snet"
  resource_group_name  = azurerm_resource_group.rg.name
  virtual_network_name = azurerm_virtual_network.vnet.name
  address_prefixes     = ["10.0.1.0/24"]
}

# --- SÉCURITÉ (NSG) ---

resource "azurerm_network_security_group" "nsg" {
  name                = "${var.prefix}-nsg"
  location            = azurerm_resource_group.rg.location
  resource_group_name = azurerm_resource_group.rg.name

  # SSH
  security_rule {
    name                       = "AllowSSH"
    priority                   = 100
    direction                  = "Inbound"
    access                     = "Allow"
    protocol                   = "Tcp"
    source_port_range          = "*"
    destination_port_range     = "22"
    source_address_prefix      = "*"
    destination_address_prefix = "*"
  }

  # HTTP
  security_rule {
    name                       = "AllowHTTP"
    priority                   = 110
    direction                  = "Inbound"
    access                     = "Allow"
    protocol                   = "Tcp"
    source_port_range          = "*"
    destination_port_range     = "80"
    source_address_prefix      = "*"
    destination_address_prefix = "*"
  }

  # HTTPS
  security_rule {
    name                       = "AllowHTTPS"
    priority                   = 120
    direction                  = "Inbound"
    access                     = "Allow"
    protocol                   = "Tcp"
    source_port_range          = "*"
    destination_port_range     = "443"
    source_address_prefix      = "*"
    destination_address_prefix = "*"
  }

  # n8n
  security_rule {
    name                       = "AllowN8N"
    priority                   = 130
    direction                  = "Inbound"
    access                     = "Allow"
    protocol                   = "Tcp"
    source_port_range          = "*"
    destination_port_range     = "5678"
    source_address_prefix      = "*"
    destination_address_prefix = "*"
  }

  # DeepShift OS (Next.js)
  security_rule {
    name                       = "AllowNextJS"
    priority                   = 140
    direction                  = "Inbound"
    access                     = "Allow"
    protocol                   = "Tcp"
    source_port_range          = "*"
    destination_port_range     = "3000"
    source_address_prefix      = "*"
    destination_address_prefix = "*"
  }
}

# Liaison NSG → Subnet
resource "azurerm_subnet_network_security_group_association" "link_nsg" {
  subnet_id                 = azurerm_subnet.snet.id
  network_security_group_id = azurerm_network_security_group.nsg.id
}

# --- IP PUBLIQUE STATIQUE ---

resource "azurerm_public_ip" "pip" {
  name                = "${var.prefix}-pip"
  location            = azurerm_resource_group.rg.location
  resource_group_name = azurerm_resource_group.rg.name
  allocation_method   = "Static"
  sku                 = "Standard"
}

# --- CARTE RÉSEAU ---

resource "azurerm_network_interface" "nic" {
  name                = "${var.prefix}-nic"
  location            = azurerm_resource_group.rg.location
  resource_group_name = azurerm_resource_group.rg.name

  ip_configuration {
    name                          = "internal"
    subnet_id                     = azurerm_subnet.snet.id
    private_ip_address_allocation = "Dynamic"
    public_ip_address_id          = azurerm_public_ip.pip.id
  }
}

# --- MACHINE VIRTUELLE ---

resource "azurerm_linux_virtual_machine" "vm" {
  name                = "${var.prefix}-vm"
  resource_group_name = azurerm_resource_group.rg.name
  location            = azurerm_resource_group.rg.location
  size                = "Standard_D2s_v3"
  admin_username      = var.admin_username

  network_interface_ids = [azurerm_network_interface.nic.id]

  admin_ssh_key {
    username   = var.admin_username
    public_key = file(pathexpand("~/.ssh/id_ed25519.pub"))
  }

  os_disk {
    caching              = "ReadWrite"
    storage_account_type = "StandardSSD_LRS"
    disk_size_gb         = 32
  }

  source_image_reference {
    publisher = "Canonical"
    offer     = "ubuntu-24_04-lts"
    sku       = "server"
    version   = "latest"
  }

  disable_password_authentication = true

  identity {
    type = "SystemAssigned"
  }

  # Cloud-Init — installe Docker + Docker Compose + génère docker-compose.yml
  user_data = base64encode(<<-EOF
    #!/bin/bash
    set -e

    # --- Mise à jour système ---
    apt-get update -y
    apt-get upgrade -y

    # --- Installation Docker ---
    curl -fsSL https://get.docker.com | sh
    usermod -aG docker ${var.admin_username}

    # --- Créer le dossier DeepShift ---
    mkdir -p /opt/deepshift
    chown -R ${var.admin_username}:${var.admin_username} /opt/deepshift

    # --- docker-compose.yml ---
    cat <<'COMPOSE' > /opt/deepshift/docker-compose.yml
    version: '3.8'

    services:

      # Base de données PostgreSQL
      postgres:
        image: postgres:16
        restart: always
        environment:
          POSTGRES_USER: deepshift
          POSTGRES_PASSWORD: ${var.postgres_password}
          POSTGRES_DB: deepshift_db
        volumes:
          - postgres_data:/var/lib/postgresql/data
        ports:
          - "5432:5432"

      # n8n — moteur d'automatisation
      n8n:
        image: n8nio/n8n
        restart: always
        ports:
          - "5678:5678"
        environment:
          - N8N_PORT=5678
          - N8N_PROTOCOL=http
          - GENERIC_TIMEZONE=Europe/Paris
          - N8N_SECURE_COOKIE=false
          - N8N_ENCRYPTION_KEY=${var.n8n_encryption_key}
          - DB_TYPE=postgresdb
          - DB_POSTGRESDB_HOST=postgres
          - DB_POSTGRESDB_PORT=5432
          - DB_POSTGRESDB_DATABASE=n8n_db
          - DB_POSTGRESDB_USER=deepshift
          - DB_POSTGRESDB_PASSWORD=${var.postgres_password}
        volumes:
          - n8n_data:/home/node/.n8n
        depends_on:
          - postgres

    volumes:
      postgres_data:
      n8n_data:
    COMPOSE

    chown ${var.admin_username}:${var.admin_username} /opt/deepshift/docker-compose.yml

    # --- Lancer les containers ---
    cd /opt/deepshift
    docker compose up -d

    # --- Créer la base n8n_db ---
    sleep 10
    docker compose exec -T postgres psql -U deepshift -d deepshift_db -c "CREATE DATABASE n8n_db;" || true

    echo "✅ DeepShift infrastructure ready" >> /var/log/deepshift-init.log
  EOF
  )
}

# --- OUTPUTS ---

output "public_ip" {
  description = "IP publique de la VM DeepShift"
  value       = azurerm_public_ip.pip.ip_address
}

output "ssh_command" {
  description = "Commande SSH pour se connecter"
  value       = "ssh -i ~/.ssh/id_ed25519 deepshift@${azurerm_public_ip.pip.ip_address}"
}

output "n8n_url" {
  description = "URL d'accès à n8n"
  value       = "http://${azurerm_public_ip.pip.ip_address}:5678"
}

output "app_url" {
  description = "URL d'accès à DeepShift OS"
  value       = "http://${azurerm_public_ip.pip.ip_address}:3000"
}
