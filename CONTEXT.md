# DeepShift — Contexte Projet

## Qui je suis

Je m'appelle Pierre. Je monte mon auto-entreprise **DeepShift** — services IT orientés web (web apps, sites, intégrations API) et consulting en transformation digitale. Je suis développeur JS/Node.js, j'utilise Claude Code pour aller vite. Je suis aussi moniteur de plongée — DeepShift reflète à la fois mon identité (la profondeur) et ce que j'apporte aux clients (transformation en profondeur).

---

## Ce qu'on est en train de construire

Deux choses en parallèle :

### 1. DeepShift (l'entreprise)
Auto-entreprise de services IT : web apps sur mesure, sites, intégrations API, consulting transformation digitale.

### 2. DeepShift OS — l'outil interne
Une **web app interne** hébergée sur mon VPS Azure qui gère 100% de l'entreprise. Pas de Notion, pas de Zapier, pas d'outils tiers payants — tout custom, tout IA, tout automatisé.

#### Les 5 modules

1. **CRM & Prospection** — pipeline prospects, envoi/réception/analyse emails automatique via Claude, scoring IA (1-10), relances auto J+3/J+7, historique échanges, rappels intelligents
2. **Gestion de Projets** — Kanban par projet, découpage tâches/sous-tâches, suivi temps, rappels jalons, emails auto client à chaque livraison, comptes-rendus rédigés par Claude
3. **Finance** — génération devis et factures par Claude, suivi paiements, relances auto J+30/J+45, dashboard CA mensuel/annuel, taux de conversion
4. **Interne / Admin** — liste abonnements avec coûts liés à la finance, alertes renouvellement 7j avant, stack documentée, base de connaissance (offres, tarifs, process, templates), weekly review auto par Claude chaque lundi
5. **Agenda & IA centrale** — Google Calendar synchronisé, rappels intelligents multi-modules, chat IA interne (Claude connaît toute l'entreprise), notifications push + email centralisées

#### Ce que n8n fait en arrière-plan
- Prospection → enrichissement → email perso Claude → CRM mis à jour
- Analyse des réponses emails → scoring → mise à jour statut prospect
- Génération devis après appel qualifié → envoi → relance si pas de réponse
- Onboarding client signé → création projet → repo GitHub → email bienvenue
- Facturation automatique à la livraison → relances paiement
- Weekly review chaque lundi → résumé Claude → notification

---

## Stack technique

| Couche | Techno |
|--------|--------|
| Frontend + Backend | Next.js 15 (App Router) + TypeScript |
| Base de données | PostgreSQL 16 |
| ORM | Prisma |
| UI | shadcn/ui + Tailwind |
| IA | Claude API (Anthropic) — embarqué dans l'app |
| Automatisation | n8n (self-hosted sur le VPS) |
| Email | Gmail API (compte gratuit pour démarrer) |
| Calendrier | Google Calendar API |
| Transcription appels | Granola (optionnel, ~15€/mois) |
| Hébergement | Microsoft Azure — VM `Standard_D2s_v3` (2 vCPU, 8GB RAM) |
| Versionning | GitHub — `github.com/Scorpierre/deepshift-os` |

---

## Infrastructure Azure

- **Cloud** : Microsoft Azure — crédits 100$ pour 1 an
- **VM** : `Standard_D2s_v3` — Ubuntu 24.04 LTS — 2 vCPU / 8GB RAM
  - ⚠️ B2ms voulu initialement mais indisponible en FranceCentral
- **IP publique** : `<VM_PUBLIC_IP>` (statique)
- **SSH** : `ssh -i ~/.ssh/id_ed25519 deepshift@<VM_PUBLIC_IP>`
- **Resource group** : `deepshift-rg`
- **Nom VM** : `deepshift-vm`
- **Username SSH** : `deepshift`
- **Ports ouverts** : 22 (SSH), 80 (HTTP), 443 (HTTPS), 5678 (n8n), 3000 (app Next.js)
- **Terraform** : `app/cloud/main.tf` — secrets dans `app/cloud/terraform.tfvars` (gitignored)

### Commandes VM utiles
```bash
# Éteindre (stoppe la facturation)
az vm deallocate --resource-group deepshift-rg --name deepshift-vm

# Rallumer
az vm start --resource-group deepshift-rg --name deepshift-vm

# SSH
ssh -i ~/.ssh/id_ed25519 deepshift@<VM_PUBLIC_IP>
```

### Services actifs sur la VM
| Service | URL | Statut |
|---------|-----|--------|
| n8n | http://<VM_PUBLIC_IP>:5678 | ✅ UP |
| PostgreSQL | port 5432 (interne) | ✅ UP |
| Next.js | http://<VM_PUBLIC_IP>:3000 | ⬜ pas encore déployé |

---

## GitHub & CI/CD

- **Repo** : `github.com/Scorpierre/deepshift-os`
- **Branches** : `main` (prod) · `dev` (travail quotidien) · `feature/*` (fonctionnalités)
- **Workflow Git** :
  ```
  feature/xxx  →  dev  →  PR  →  main  →  auto-deploy VM
  ```
- **CI** : GitHub Actions — typecheck + lint + build sur chaque PR vers `main` ou `dev`
- **Deploy** : push sur `main` → SSH → `docker compose up --build` sur la VM
- **Secrets GitHub** : `VM_HOST`, `VM_USER`, `SSH_PRIVATE_KEY` configurés
- **Règle** : ne jamais pusher directement sur `main`

---

## Budget mensuel cible

| Outil | Coût |
|-------|------|
| Azure VM D2s_v3 | ~70$/mois en continu — éteindre quand pas utilisé |
| n8n self-hosted | 0€ |
| Claude API (workflows n8n) | ~5-10€ |
| Gmail | 0€ |
| Granola (optionnel) | ~15€ |
| **Total actif** | **~10-25€/mois** |

> Claude Pro (abonnement perso) et Claude API (pour n8n) sont deux choses séparées.
> Le Pro = ce chat + Claude Code. L'API = les appels depuis n8n, facturation à la consommation.

---

## Outils écartés et pourquoi

| Outil | Raison |
|-------|--------|
| Notion | Plafond API, pas de temps réel, dépendance externe |
| Zapier | Trop cher, redondant avec n8n |
| Gumloop | Crédits imprévisibles, redondant avec n8n |
| BuddyPro | Pas adapté au profil |
| Salesforce / HubSpot | Overkill pour un solo |
| Oracle Cloud | Remplacé par Azure (crédits 100$ déjà disponibles) |

---

## Où on en est (2026-03-25)

- [x] Setup Azure VM + Terraform (`app/cloud/main.tf`)
- [x] Firewall Azure (ports 22, 80, 443, 5678, 3000)
- [x] Connexion SSH + Docker installé
- [x] n8n lancé via Docker Compose + compte admin créé
- [x] PostgreSQL lancé via Docker Compose
- [x] Repo GitHub créé + branches `main` / `dev`
- [x] CI/CD GitHub Actions configuré (`.github/workflows/`)
- [ ] Scaffolding Next.js 15 + TypeScript + Prisma + PostgreSQL
- [ ] shadcn/ui configuré
- [ ] Credentials configurés (Claude API, Gmail OAuth, GitHub webhooks)
- [ ] Module CRM — V1
- [ ] Module Projets — V1
- [ ] Module Finance — V1
- [ ] Module Interne — V1
- [ ] Module Agenda + IA centrale — V1
- [ ] Workflows n8n (prospection, relances, devis, onboarding, facturation)
- [ ] Granola intégré (optionnel)

---

## Comment utiliser ce fichier

**Dans Claude Code** : place `CONTEXT.md` à la racine du repo. Claude le lit automatiquement au démarrage de la session.

**Mettre à jour** : coche les cases au fur et à mesure. C'est un fichier vivant — toujours refléter l'état réel du projet.
