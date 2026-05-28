# DeepShift — Suivi d'avancement

> Dernière mise à jour : 2026-05-02

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
| `terraform apply` — VM créée | ✅ Fait | IP : `<VM_PUBLIC_IP>` |
| Connexion SSH vérifiée | ✅ Fait | `ssh -i ~/.ssh/id_ed25519 deepshift@<VM_PUBLIC_IP>` |
| Docker installé sur la VM | ✅ Fait | Via cloud-init |
| n8n lancé via Docker Compose | ✅ Fait | http://<VM_PUBLIC_IP>:5678 |
| PostgreSQL lancé via Docker Compose | ✅ Fait | Port 5432 — `n8n_db` créée manuellement |
| Compte admin n8n créé | ✅ Fait | — |

---

## GitHub & CI/CD

| Tâche | Statut | Notes |
|-------|--------|-------|
| Repo GitHub créé | ✅ Fait | `github.com/Scorpierre/deepshift-os` |
| Branche `dev` créée | ✅ Fait | Flux : `feature/*` → `dev` → `main` |
| CI GitHub Actions | ✅ Fait | Déclenché sur PR vers `main` ou `dev` — typecheck + lint + build |
| Auto-deploy GitHub Actions | ✅ Fait | Push sur `main` → SSH → `npm install` + `prisma migrate deploy` + `docker compose up --build` |
| Déclenchement manuel deploy | ✅ Fait | `workflow_dispatch` ajouté — bouton "Run workflow" dans GitHub Actions |
| Migrations auto en deploy | ✅ Fait | `prisma migrate deploy` avec IP privée `<VM_PRIVATE_IP>` dans le script CI |
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
| Scaffolding Next.js 15 + TypeScript | ✅ Fait | App Router — `app/web/` |
| Prisma configuré | ✅ Fait | Prisma 7 — `app/web/prisma/` + `prisma.config.ts` |
| `prisma generate` en postinstall | ✅ Fait | Ajouté dans `package.json` — évite les erreurs de types manquants en CI/CD |
| shadcn/ui + Tailwind configuré | ✅ Fait | — |
| Structure 5 modules | ✅ Fait | `/crm`, `/projets`, `/finance`, `/admin`, `/agenda` |
| Layout dashboard | ✅ Fait | Nav latérale + routing |
| Repo GitHub restructuré | ✅ Fait | `app/web/` Next.js · `app/cloud/` Terraform |
| Fix TS Prisma 7 — enums | ✅ Fait | `ProspectStatus` et `ReminderType` : imports + casts explicites (TS2322) |
| Fiche prospect `/crm/[id]` — v2 | ✅ Fait | Layout 3 colonnes, édition inline sur tous les champs, autosave blur, timeline emails, modale email IA + envoi Gmail, rappels, tags |
| Champ `companyDescription` | ✅ Fait | Ajouté au schéma Prisma + migration `20260326000000_add_company_description` |
| Scoring IA — logique business | ✅ Fait | Score 0-10 = probabilité de conclure un contrat, basé sur profil prospect uniquement (sans email) |
| Fix parsing JSON Claude | ✅ Fait | Claude enveloppait sa réponse en markdown — regex `\{[\s\S]*\}` pour extraire le JSON brut |
| Scoring IA — tags + action recommandée | ✅ Fait | `aiTags` et `aiRecommendedAction` persistés en base + affichés dans la fiche |
| Notes manuelles supprimées | ✅ Fait | Remplacées par `companyDescription` (champ libre) — plus cohérent |
| Kanban — LOST/ARCHIVED masqués | ✅ Fait | Pipeline actif par défaut, toggle "Voir perdus" si des perdus existent |
| Auto-LOST par email | ✅ Fait | 3 emails SENT + 0 réponse + 10j → statut LOST automatiquement au chargement du Kanban |
| Séquence relances email | ✅ Fait | `/api/ai/draft-followup` (relance #1 J+3 et #2 J+7) + `/api/cron/check-followups` pour n8n |
| Gmail OAuth configuré | ✅ Fait | Client ID + Secret + Refresh Token dans `.env.local` — compte `scopierres@gmail.com` |
| Envoi email depuis la fiche | ✅ Fait | Bouton "Envoyer" dans la modale Claude — envoie via Gmail API + sauvegarde en base + mise à jour timeline |
| Optimisation calls Claude | ✅ Fait | `draft-email` réutilise `aiSummary` déjà en base — passé de 2 calls Claude à 1 par email généré |
| Logger calls Claude | ✅ Fait | `anthropic.ts` loggue chaque appel (model, tokens input/output, fichier appelant) dans les logs Docker |
| Statut CONTACTED auto à l'envoi | ✅ Fait | Envoi d'un email → prospect passe en CONTACTED depuis NEW/SCORING/SCORED/VIP/LOST/ARCHIVED |
| Analyse emails entrants | ✅ Fait | Endpoint `/api/webhooks/gmail-poll` — appelé par n8n toutes les 24h — analyse intent Claude Haiku → met à jour statut + crée reminder si LATER |
| Lecture pièces jointes emails | ✅ Fait | `/api/emails/analyze` lit les PDF et images dans les emails entrants via Gmail API — transmis à Claude comme blocs `document`/`image` |
| Upload documents prospect | ✅ Fait | Upload PDF/image depuis fiche prospect → stocké en base (`ProspectDocument`) → transmis à Claude lors de la génération de jalons |
| Module Finance | ✅ Fait | `/finance` — dashboard CA (encaissé/en attente/prévisionnel), CRUD devis + statuts (DRAFT→SENT→ACCEPTED), CRUD factures + marquage payé, liaison devis→facture |
| Module Projets | ✅ Fait | `/projets` + `/projets/[id]` — milestones + tâches, livraisons avec validation client OK/À revoir, échanges client typés, génération IA jalons (Sonnet), suppression cascade |
| Fix cascade delete prospect | ✅ Fait | Suppression d'un prospect supprime Quote, Invoice, Project, Email, Reminder, ProspectDocument en cascade (schéma Prisma + migration) |

---

## Modules

| Module | Statut | Notes |
|--------|--------|-------|
| CRM & Prospection | ✅ Fait | Kanban pipeline (LOST masqué, auto-LOST), fiche prospect 3 colonnes, scoring IA (score + tags + action), email personnalisé Claude (optimisé — 1 call) + envoi Gmail, relances auto J+3/J+7, timeline emails, rappels, analyse emails entrants (intent → statut auto), lecture pièces jointes PDF/images, upload documents prospect pour contexte IA |
| Gestion de Projets | ✅ Fait | Liste projets + fiche projet (4 onglets), milestones + tâches (CRUD complet), livraisons avec validation client, échanges/notes client, génération IA des jalons (Sonnet), suppression projet en cascade, champ notes prospect |
| Finance | ✅ Fait | Dashboard CA (encaissé / en attente / prévisionnel), devis (DRAFT→SENT→ACCEPTED), factures (UNPAID→PAID), liaison devis→facture, marquage paiement reçu |
| Interne / Admin | ⬜ À faire | Abonnements, base de connaissance, weekly review |
| Agenda & IA centrale | ⬜ À faire | Google Calendar, bouton RDV depuis fiche prospect, chat IA, notifications |

---

## Config VM (important)

| Paramètre | Valeur |
|-----------|--------|
| IP publique | `<VM_PUBLIC_IP>` |
| IP privée | `<VM_PRIVATE_IP>` |
| DATABASE_URL | `postgresql://deepshift:...@<VM_PRIVATE_IP>:5432/deepshift_db` |
| N8N_WEBHOOK_PROSPECT_ANALYSIS | `http://<VM_PRIVATE_IP>:5678/webhook/prospect-analysis` |
| ANTHROPIC_API_KEY | configurée directement dans le nœud n8n "Call Claude" |
| n8n → Update Prospect | méthode `POST` vers `http://<VM_PRIVATE_IP>:3000/api/webhooks/n8n` |

> ⚠️ Toujours utiliser `<VM_PRIVATE_IP>` (IP privée) dans les configs inter-services sur la VM — jamais `localhost`.

---

## Credentials & Intégrations

| Service | Statut | Notes |
|---------|--------|-------|
| Claude API | ✅ Fait | Connecté dans n8n + clé dans app Next.js (.env.local) |
| Gmail OAuth | ✅ Fait | OAuth2 Desktop app — refresh token configuré — envoi depuis `scopierres@gmail.com` — token à regénérer via `get-refresh-token.mjs` si invalid_grant |
| Google Calendar API | ⬜ À configurer | Sync agenda |
| GitHub (webhooks n8n) | ⬜ À configurer | Onboarding client → création repo |
| Granola | ⬜ Optionnel | Transcription appels (~15€/mois) |

---

## Workflows n8n

| Workflow | Statut | Notes |
|----------|--------|-------|
| Analyse prospect → scraping → scoring Claude → CRM | ✅ Fait | Webhook `/webhook/prospect-analysis` — déclenché à la création d'un prospect avec URL |
| File 9h — envoi auto prospects SCORED | ✅ Fait | `/api/cron/daily-outreach` — tous les SCORED sans email → Claude Sonnet → envoi Gmail → CONTACTED — n8n Schedule mardi/mercredi/jeudi 9h |
| Relances auto J+3/J+7 + auto-lost J+10 | ✅ Fait | `/api/cron/process-followups` — Haiku génère relance → envoi Gmail → auto-lost après 3 emails sans réponse — n8n Schedule mardi/mercredi/jeudi 9h |
| Analyse réponses emails → intent → statut prospect | ✅ Fait | Polling n8n 24h — scan inbox 2 derniers jours — intent Claude Haiku → INTERESTED/NEEDS_INFO → QUALIFIED, NOT_INTERESTED → LOST, PROPOSAL_REQUESTED → PROPOSAL_SENT, LATER → reminder, UNCLEAR → ARCHIVED |
| Génération devis → envoi → relance | ⬜ À faire | — |
| Onboarding client → projet → repo GitHub → email bienvenue | ⬜ À faire | — |
| Facturation livraison → relances paiement | ⬜ À faire | — |
| Weekly review chaque lundi → résumé Claude → notification | ⬜ À faire | — |

---

## Stack technique

| Couche | Techno | Statut |
|--------|--------|--------|
| Frontend + Backend | Next.js 15 + TypeScript | ✅ (scaffoldé — `app/web/`) |
| Base de données | PostgreSQL 16 | ✅ (Docker — port 5432) |
| ORM | Prisma 7 | ✅ (configuré — pas encore de modèles) |
| UI | shadcn/ui + Tailwind | ✅ (initialisé) |
| IA | Claude API | ✅ (n8n + Next.js) |
| Automatisation | n8n self-hosted | ✅ (Docker — http://<VM_PUBLIC_IP>:5678) |
| Email | Gmail API | ✅ (OAuth2 configuré — envoi opérationnel) |
| Calendrier | Google Calendar API | ⬜ |
| Hébergement | Azure VM `deepshift-vm` — FranceCentral | ✅ (`<VM_PUBLIC_IP>`) |
