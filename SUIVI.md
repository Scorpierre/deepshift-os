# DeepShift — Suivi d'avancement

> Dernière mise à jour : 2026-03-25

---

## Infrastructure Azure

| Tâche | Statut | Notes |
|-------|--------|-------|
| Terraform `main.tf` configuré | ✅ Fait | VM, réseau, NSG, IP statique, cloud-init |
| VM size | ✅ Fait | `Standard_D2s_v3` (2 vCPU / 8 GB) — B2ms indisponible en FranceCentral |
| Ports ouverts | ✅ Fait | 22, 80, 443, 3000, 5678 |
| Variables secrets via `terraform.tfvars` | ✅ Fait | `postgres_password`, `n8n_encryption_key`, `admin_password` |
| Clé SSH configurée | ✅ Fait | `id_ed25519` (clé existante) |
| Nommage des ressources | ✅ Fait | Convention `deepshift-{type}` (rg, vm, vnet, snet, nsg, pip, nic) |
| `.gitignore` complet | ✅ Fait | Node.js + Terraform (tfstate, tfvars, .terraform/) |
| `terraform apply` — VM créée | ✅ Fait | IP : `20.111.38.245` |
| Connexion SSH vérifiée | ✅ Fait | `ssh -i ~/.ssh/id_ed25519 deepshift@20.111.38.245` |
| Docker installé sur la VM | ✅ Fait | Via cloud-init |
| n8n lancé via Docker Compose | ✅ Fait | http://20.111.38.245:5678 |
| PostgreSQL lancé via Docker Compose | ✅ Fait | Port 5432 — `n8n_db` créée manuellement |
| Compte admin n8n créé | ✅ Fait | — |

---

## GitHub & CI/CD

| Tâche | Statut | Notes |
|-------|--------|-------|
| Repo GitHub créé | ✅ Fait | `github.com/Scorpierre/deepshift-os` |
| Branche `dev` créée | ✅ Fait | Flux : `feature/*` → `dev` → `main` |
| CI GitHub Actions | ✅ Fait | Déclenché sur PR vers `main` ou `dev` — typecheck + lint + build |
| Auto-deploy GitHub Actions | ✅ Fait | Push sur `main` → SSH → `docker compose up --build` sur la VM |
| Secrets GitHub configurés | ✅ Fait | `VM_HOST`, `VM_USER`, `SSH_PRIVATE_KEY` |
| Protection branche `main` | ⬜ À faire | Nécessite GitHub Pro (repo privé) — à activer si passage Pro ou repo public |
| Template PR | ✅ Fait | `.github/pull_request_template.md` |

### Workflow Git au quotidien
```
feature/xxx  →  dev  →  main  →  VM Azure (auto-deploy)
```
- Coder sur `dev` ou `feature/xxx`
- PR vers `main` pour mettre en prod
- Ne jamais pusher directement sur `main`

---

## Application DeepShift OS

| Tâche | Statut | Notes |
|-------|--------|-------|
| Scaffolding Next.js 15 + TypeScript | ⬜ À faire | App Router |
| Prisma + PostgreSQL configuré | ⬜ À faire | — |
| shadcn/ui + Tailwind configuré | ⬜ À faire | — |

---

## Modules

| Module | Statut | Notes |
|--------|--------|-------|
| CRM & Prospection | ⬜ À faire | Pipeline prospects, scoring IA, relances auto |
| Gestion de Projets | ⬜ À faire | Kanban, suivi temps, jalons |
| Finance | ⬜ À faire | Devis, factures, relances paiement |
| Interne / Admin | ⬜ À faire | Abonnements, base de connaissance, weekly review |
| Agenda & IA centrale | ⬜ À faire | Google Calendar, chat IA, notifications |

---

## Credentials & Intégrations

| Service | Statut | Notes |
|---------|--------|-------|
| Claude API | ⬜ À configurer | Dans n8n + app Next.js |
| Gmail OAuth | ⬜ À configurer | Envoi/réception emails automatisés |
| Google Calendar API | ⬜ À configurer | Sync agenda |
| GitHub (webhooks n8n) | ⬜ À configurer | Onboarding client → création repo |
| Granola | ⬜ Optionnel | Transcription appels (~15€/mois) |

---

## Workflows n8n

| Workflow | Statut |
|----------|--------|
| Prospection → enrichissement → email Claude → CRM | ⬜ À faire |
| Analyse réponses emails → scoring → statut prospect | ⬜ À faire |
| Génération devis → envoi → relance | ⬜ À faire |
| Onboarding client → projet → repo GitHub → email bienvenue | ⬜ À faire |
| Facturation livraison → relances paiement | ⬜ À faire |
| Weekly review chaque lundi → résumé Claude → notification | ⬜ À faire |

---

## Stack technique

| Couche | Techno | Statut |
|--------|--------|--------|
| Frontend + Backend | Next.js 15 + TypeScript | ⬜ |
| Base de données | PostgreSQL 16 | ✅ (Docker — port 5432) |
| ORM | Prisma | ⬜ |
| UI | shadcn/ui + Tailwind | ⬜ |
| IA | Claude API | ⬜ |
| Automatisation | n8n self-hosted | ✅ (Docker — http://20.111.38.245:5678) |
| Email | Gmail API | ⬜ |
| Calendrier | Google Calendar API | ⬜ |
| Hébergement | Azure VM `deepshift-vm` — FranceCentral | ✅ (`20.111.38.245`) |
