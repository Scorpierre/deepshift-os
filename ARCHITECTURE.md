# DeepShift OS — Document d'Architecture Technique

> **Version** : 1.2 — Août 2026  
> **Auteur** : Pierre Connes — DeepShift  
> **Statut** : En cours de développement (CRM, Agenda, Projets, Clients, Finance, Admin en production)

---

## 1. Vue d'ensemble

**DeepShift OS** est une application web interne conçue pour piloter l'intégralité d'une auto-entreprise IT en solo. L'objectif est de centraliser en un seul outil ce que la plupart des indépendants répartissent entre Notion, HubSpot, Zapier, Pennylane et d'autres SaaS — avec une couche d'IA native pour automatiser les tâches à faible valeur ajoutée.

L'application (Next.js + PostgreSQL) est hébergée sur Vercel + Supabase depuis août 2026 (migration depuis une VM Azure privée). n8n reste self-hosted sur la VM Azure pour l'orchestration des workflows — sans dépendance à un service tiers payant au-delà de l'infra.

---

## 2. Modules fonctionnels

L'OS est découpé en **5 modules** indépendants mais interconnectés :

| # | Module | Rôle |
|---|--------|------|
| 1 | **CRM & Prospection** | Pipeline prospects, scoring IA, envoi/réception emails, relances automatiques |
| 2 | **Gestion de Projets** | Kanban projets, suivi tâches, jalons, comptes-rendus IA |
| 3 | **Finance** | Devis, factures, relances paiement, dashboard CA |
| 4 | **Interne / Admin** | Abonnements, base de connaissances, weekly review IA |
| 5 | **Agenda & IA Centrale** | Google Calendar, chat IA contextuel, notifications centralisées |

Les modules **CRM**, **Agenda**, **Projets**, **Finance** et **Admin** sont en production, ainsi qu'un module **Clients** (non listé ci-dessus) qui regroupe les prospects gagnés et leurs projets. Reste à construire : le chat IA centrale (module 5) et les notifications centralisées.

---

## 3. Stack technique

### 3.1 Application (monorepo)

| Couche | Technologie | Version |
|--------|-------------|---------|
| Framework | Next.js (App Router) | 16.2.1 |
| Langage | TypeScript | ^5 |
| Runtime | Node.js | LTS |
| UI Components | shadcn/ui + Base UI | — |
| Styling | Tailwind CSS | ^4 |
| Icons | Lucide React | ^1.6 |

### 3.2 Backend & Données

| Couche | Technologie | Version |
|--------|-------------|---------|
| Base de données | PostgreSQL | 16 |
| ORM | Prisma | ^7.5 |
| Driver PostgreSQL | pg (node-postgres) | ^8.20 |
| Auth | Session cookie maison | — |

### 3.3 Intelligence Artificielle

| Service | Usage |
|---------|-------|
| **Claude API (Anthropic)** | Scoring prospects (1-10), rédaction emails personnalisés, analyse emails reçus, résumé hebdomadaire, draft relances, génération jalons projet depuis document |
| SDK | `@anthropic-ai/sdk` ^0.80 |
| Modèle utilisé | claude-opus-4-5 / claude-sonnet-4-5 |

### 3.4 Intégrations externes

| Service | Usage | Protocole |
|---------|-------|-----------|
| **Gmail API** | Envoi emails, polling réception | OAuth 2.0 |
| **Google Calendar API** | Synchronisation agenda | OAuth 2.0 |
| **n8n** (self-hosted) | Orchestration workflows automatisés | Webhooks REST |

### 3.5 Automatisation — n8n

n8n est le moteur d'automatisation du projet, hébergé sur la même VM. Il orchestre les workflows complexes en arrière-plan :

- Enrichissement prospect + génération email de prospection personnalisé (Claude)
- Analyse des réponses emails + mise à jour du scoring CRM
- Génération devis après appel qualifié + relance si pas de réponse
- Onboarding client signé → création projet → email bienvenue
- Facturation automatique à la livraison + relances paiement J+30/J+45
- Weekly review chaque lundi → résumé Claude → notification

---

## 4. Architecture de l'application

### 4.1 Structure Next.js (App Router)

```
app/web/src/
├── app/
│   ├── (dashboard)/              # Routes protégées (layout avec sidebar)
│   │   ├── layout.tsx
│   │   ├── page.tsx              # Dashboard principal
│   │   ├── crm/
│   │   │   ├── page.tsx          # Vue Kanban pipeline
│   │   │   ├── archives/
│   │   │   │   └── page.tsx      # Prospects archivés/perdus
│   │   │   └── [id]/
│   │   │       └── page.tsx      # Fiche prospect détaillée
│   │   ├── finance/
│   │   │   └── page.tsx          # Dashboard CA + devis + factures
│   │   ├── projets/
│   │   │   ├── page.tsx          # Liste projets (Kanban)
│   │   │   └── [id]/
│   │   │       └── page.tsx      # Fiche projet (jalons, tâches, livraisons)
│   │   ├── agenda/
│   │   │   └── page.tsx          # Vue mois Google Calendar + Tasks, propositions RDV
│   │   ├── clients/
│   │   │   └── page.tsx          # Prospects WON + projets, CA total par client
│   │   └── admin/
│   │       └── page.tsx          # Charges, abonnements, weekly review IA, usage IA
│   ├── login/
│   │   └── page.tsx
│   └── api/
│       ├── prospects/            # CRUD prospects
│       │   └── [id]/
│       │       ├── emails/       # Historique + envoi emails
│       │       ├── notes/        # Notes prospect
│       │       └── documents/    # Upload documents (PDF, etc.)
│       ├── prospect-documents/   # Suppression documents
│       ├── emails/
│       │   └── analyze/          # Analyse email entrant (Claude)
│       ├── ai/
│       │   ├── score/            # Scoring prospect (Claude)
│       │   ├── draft-email/      # Rédaction email (Claude)
│       │   ├── draft-followup/   # Rédaction relance (Claude)
│       │   ├── generate-milestones/ # Génération jalons depuis document (Claude)
│       │   └── weekly-summary/   # Résumé hebdo (Claude)
│       ├── calendar/
│       │   ├── events/           # Création/patch events Google Calendar
│       │   └── proposals/        # Propositions RDV détectées dans emails entrants
│       ├── clients/              # Liste clients (prospects WON + projets)
│       ├── client-notes/         # Notes de suivi client (meeting/feedback/decision)
│       ├── expenses/             # CRUD charges + stats
│       ├── admin/
│       │   └── ai-usage/         # Usage IA (tokens/coût Claude + crédits Azure)
│       ├── quotes/               # CRUD devis
│       │   └── [id]/
│       │       ├── route.ts
│       │       ├── accept/       # Acceptation devis → création facture
│       │       └── send/         # Envoi devis par email
│       ├── invoices/             # CRUD factures
│       │   └── [id]/
│       │       ├── route.ts
│       │       └── paid/         # Marquer facture payée
│       ├── finance/
│       │   └── stats/            # Dashboard CA, devis, factures en cours
│       ├── projects/             # CRUD projets
│       │   └── [id]/
│       │       ├── milestones/   # Jalons du projet
│       │       ├── deliveries/   # Livraisons
│       │       └── notes/        # Notes client (réunion, feedback, décision)
│       ├── milestones/           # CRUD jalons
│       │   └── [id]/
│       │       └── tasks/        # Tâches d'un jalon
│       ├── tasks/                # CRUD tâches
│       ├── deliveries/           # CRUD livraisons
│       ├── reminders/            # Rappels & relances CRM
│       ├── cron/                 # Appelés par n8n (VM Azure) via webhook, hébergés sur Vercel
│       │   ├── daily-outreach/   # Envoi auto prospects SCORED (9h)
│       │   ├── process-followups/ # Relances J+3/J+7
│       │   ├── auto-lost/        # Auto-LOST J+10 sans réponse
│       │   ├── payment-reminders/ # Relances paiement facture
│       │   └── monthly-claude-expense/ # Dépense Claude auto 1er du mois
│       ├── webhooks/
│       │   └── gmail-poll/       # Polling Gmail (analyse intent, lifecycle meeting)
│       └── auth/
│           ├── login/
│           └── logout/
├── lib/
│   ├── prisma.ts                 # Client Prisma singleton
│   ├── anthropic.ts              # Client Claude API
│   ├── gmail.ts                  # Client Gmail API
│   ├── session.ts                # Gestion session cookie
│   ├── html.ts                   # Utilitaire parsing HTML emails
│   ├── scrape.ts                 # Scraping site web prospect
│   ├── parse-ai-json.ts          # Parser robuste JSON réponses Claude
│   └── sequencing.ts             # Séquences de relances
├── config.ts                     # Config centralisée (constantes)
└── components/
    └── ui/                       # Composants shadcn/ui
```

### 4.2 Schéma de base de données

Le schéma Prisma couvre les modules CRM, Finance et Projets :

```
Prospect (1) ──── (N) Email
         (1) ──── (N) Note
         (1) ──── (N) Reminder
         (1) ──── (N) ProspectDocument
         (1) ──── (N) Quote
         (1) ──── (N) Invoice
         (1) ──── (N) Project

Quote    (1) ──── (0..1) Invoice

Project  (1) ──── (N) Milestone ──── (N) Task
         (1) ──── (N) Delivery
         (1) ──── (N) ClientNote

Invoice  (1) ──── (N) PaymentReminder
```

**Modèle Prospect** — champs clés :
- Données contact : `name`, `company`, `email`, `phone`, `linkedinUrl`, `websiteUrl`
- Pipeline : `status` (enum 11 états), `score` (1-10, calculé par Claude)
- IA : `aiSummary`, `aiScoreReason`, `aiTags[]`, `aiRecommendedAction`
- Suivi : `lastContactedAt`, `nextActionAt`, `nextActionNote`

**États du pipeline prospect :**
```
NEW → SCORING → SCORED → CONTACTED → QUALIFIED → PROPOSAL_SENT → NEGOTIATION → WON / LOST / ARCHIVED
                   ↘ VIP (fast track)
```

**Module Finance — modèles clés :**
- `Quote` : devis (DRAFT / SENT / ACCEPTED / REJECTED / EXPIRED), lignes en JSON, lié à un prospect
- `Invoice` : facture (PENDING / PAID / OVERDUE / CANCELLED), date d'échéance, lié optionnellement à un devis
- `PaymentReminder` : relances paiement J+30 / J+45

**Module Projets — modèles clés :**
- `Project` : statuts BRIEF / IN_PROGRESS / REVIEW / DELIVERED / COMPLETED / ON_HOLD
- `Milestone` : jalons (PENDING / IN_PROGRESS / DONE), ordonnés, avec tâches
- `Task` : cases à cocher dans un jalon
- `Delivery` : livraisons avec validation client (`clientOk`)
- `ClientNote` : notes de suivi client (MEETING / FEEDBACK / DECISION / OTHER)

### 4.3 Flux Finance — Devis → Facture

```
Prospect WON → Création devis (POST /api/quotes)
        ↓
Envoi devis (POST /api/quotes/[id]/send → Gmail API)
        ↓
Acceptation client (POST /api/quotes/[id]/accept)
        ↓ → Crée automatiquement une Invoice liée
Facture générée → statut PENDING
        ↓
Paiement reçu (POST /api/invoices/[id]/paid)
        ↓ → statut PAID, date paiement enregistrée
```

### 4.4 Flux Projets — Création → Livraison

```
Prospect WON → Création projet (POST /api/projects)
        ↓
IA génère jalons depuis document prospect (POST /api/ai/generate-milestones)
        ↓
Suivi tâches par jalon (PATCH /api/tasks/[id])
        ↓
Livraison enregistrée (POST /api/projects/[id]/deliveries)
        ↓ → clientOk = true → jalon DONE
Projet → statut COMPLETED
```

### 4.5 Flux de données — Scoring IA

```
1. Nouveau prospect créé (POST /api/prospects)
        ↓
2. Webhook → n8n enrichissement (scraping site, LinkedIn)
        ↓
3. POST /api/ai/score → Claude API
   [contexte prospect + données enrichies]
        ↓
4. Claude retourne JSON {score, reason, tags, recommended_action}
        ↓
5. PATCH /api/prospects/[id] → statut SCORED, score sauvegardé
        ↓
6. Webhook → n8n génération email personnalisé (Claude)
        ↓
7. POST /api/prospects/[id]/emails/send → Gmail API
        ↓
8. Statut → CONTACTED, reminder J+3 créé automatiquement
```

### 4.6 Flux emails entrants (polling Gmail)

```
Poll horaire (n8n) → /api/webhooks/gmail-poll
        ↓
Gmail API → récupère nouveaux messages
        ↓
POST /api/emails/analyze → Claude API
[analyse intention : INTERESTED / NOT_INTERESTED / NEEDS_INFO / CALLBACK]
        ↓
Email + analyse sauvegardés en base
Score prospect mis à jour
Reminder relance créé si nécessaire
```

---

## 4.7 Architecture multi-agents (IA centrale)

Un **agent principal (orchestrateur)** pilote quatre agents spécialisés. Chaque agent est un appel Claude en boucle tool-use avec son propre prompt système et ses propres outils ; l'orchestrateur ne touche jamais aux données, il délègue.

```
                    POST /api/agent/chat
                           │
                  ┌────────▼─────────┐
                  │   Orchestrateur   │  lib/agents/orchestrator.ts
                  │ (outils ask_<agent>)│
                  └─┬──────┬──────┬──┬┘
        ┌───────────┘      │      │  └────────────┐
   ┌────▼────┐   ┌─────────▼──┐ ┌─▼────────┐ ┌────▼──────┐
   │  Sales  │   │  Project   │ │Financial │ │ Secrétaire│
   │  (CRM)  │   │  Manager   │ │(finance) │ │ (agenda,  │
   └────┬────┘   └─────┬──────┘ └────┬─────┘ │  emails)  │
        │              │             │       └────┬──────┘
        └──── Prisma ──┴─────────────┘     Google Calendar / Gmail
```

| Agent | Fichier | Périmètre | Écritures autorisées |
|-------|---------|-----------|----------------------|
| Orchestrateur | `orchestrator.ts` | Comprend la demande, délègue (en parallèle si indépendant), synthétise | — |
| Sales | `sales.ts` | Prospects, pipeline, rappels, emails | Notes prospect |
| Project Manager | `project-manager.ts` | Projets, jalons, tâches, livraisons | Cocher une tâche |
| Financial | `financial.ts` | Devis, factures, CA, charges | Aucune (lecture seule) |
| Secrétaire | `secretary.ts` | Google Calendar, emails reçus, brouillons | Création d'événement |

Principes :
- **Boucle commune** (`runner.ts`) : max 8 tours, erreurs d'outil renvoyées au modèle (`is_error`).
- **Aucun envoi d'email ni création de document financier** par les agents : ils proposent, Pierre valide.
- **Ajouter un agent** = un fichier `AgentSpec` + l'ajouter à `AGENTS` dans l'orchestrateur.
- Les appels passent par le wrapper `lib/anthropic.ts` : l'usage de chaque agent est loggé dans `AiUsageLog`.
- Les crons n8n existants (scoring, relances, weekly review) restent des routes dédiées ; ils pourront migrer vers les agents ensuite.

## 5. Infrastructure

> **Migration (2026-08)** : l'app Next.js et PostgreSQL ont quitté la VM Azure pour Vercel + Supabase. La VM Azure est conservée uniquement pour héberger n8n (et pour le suivi des coûts Azure via l'API Cost Management, utilisé par le module Admin).

### 5.1 Hébergement — Vercel + Supabase (app)

| Paramètre | Valeur |
|-----------|--------|
| Plateforme app | Vercel — projet `deepshift` |
| Org Vercel | `team_ZW8aMXWeBdLMd9w5bJB3ZPmb` |
| Base de données | Supabase — PostgreSQL 16, connexion via pooler |
| Driver | `@prisma/adapter-pg` + `pg` |
| Migrations | `prisma db push` (exécuté manuellement contre Supabase) |

### 5.2 Hébergement — Microsoft Azure (n8n)

| Paramètre | Valeur |
|-----------|--------|
| Cloud | Microsoft Azure |
| VM | `Standard_D2s_v3` |
| OS | Ubuntu 24.04 LTS |
| CPU / RAM | 2 vCPU / 8 GB |
| IP publique | `<VM_PUBLIC_IP>` (statique) |
| Region | FranceCentral |
| Resource group | `deepshift-rg` |
| Provisioning | Terraform (`app/cloud/main.tf`) |
| Service actif | n8n (Docker Compose, port 5678) |

> Objectif : migrer n8n hors Azure (Railway ou équivalent) pour réduire le coût serveur — la VM reste le poste le plus cher du budget infra.

### 5.3 CI/CD — GitHub Actions

```
feature/xxx ──PR──> dev ──PR──> main ──auto-deploy──> Vercel
```

- **CI** (`ci.yml`) : typecheck + lint + build sur chaque PR vers `main` ou `dev`
- **CD** (`deploy.yml`) : push sur `main` → `npx vercel --prod --token=$VERCEL_TOKEN`
- **Repo** : `github.com/Scorpierre/deepshift-os`
- **Secrets** : `VERCEL_TOKEN`
- **Règle** : push direct sur `main` interdit

---

## 6. Variables d'environnement

```bash
# Base de données (Supabase — pooler)
DATABASE_URL="postgresql://USER:PASSWORD@HOST:PORT/postgres"

# Claude API (Anthropic)
ANTHROPIC_API_KEY="sk-ant-..."

# Gmail OAuth 2.0
GOOGLE_CLIENT_ID="..."
GOOGLE_CLIENT_SECRET="..."
GOOGLE_REDIRECT_URI="http://localhost:3000/api/auth/callback/google"
GMAIL_REFRESH_TOKEN="..."

# Session auth
SESSION_SECRET="..."

# n8n webhook secret (sécurisation webhooks entrants)
N8N_WEBHOOK_SECRET="..."
```

---

## 7. Budget infrastructure

| Poste | Coût estimé |
|-------|------------|
| Vercel (app) | 0 € (plan Hobby) |
| Supabase (PostgreSQL) | 0 € (plan Free) |
| Azure VM D2s_v3 — n8n (continu) | ~70 $/mois |
| Azure VM D2s_v3 — n8n (usage actif ~8h/j) | ~20 $/mois |
| Claude API (workflows) | ~5–10 € / mois |
| Gmail API | 0 € |
| **Total actif** | **~5–25 € / mois** |

> La VM Azure (n8n) est éteinte (`az vm deallocate`) hors des sessions de travail pour limiter les coûts. Objectif : la remplacer par un hébergement n8n moins cher (Railway) pour ne plus dépendre d'Azure du tout.

---

## 8. Décisions d'architecture

| Décision | Choix | Raison |
|----------|-------|--------|
| Framework | Next.js App Router | Full-stack en un seul repo, API routes natives, Server Components |
| BDD | PostgreSQL + Prisma | Fiabilité, typage fort, migrations versionnées |
| IA | Claude API (pas OpenAI) | Meilleure qualité de rédaction en français, contexte long |
| Automatisation | n8n self-hosted (pas Zapier) | Gratuit, full contrôle, hébergeable sur la VM |
| Email | Gmail API (pas SendGrid) | 0 coût, threading natif, suffisant pour le volume solo |
| Auth | Session maison (pas NextAuth) | Pas d'utilisateurs externes, complexité inutile |
| Hébergement app | Vercel + Supabase (pas Azure VM) | Coûts serveur réduits, déploiement simplifié — migration effectuée en 2026-08 |
| Hébergement n8n | Azure VM (temporaire) | n8n a besoin d'un hôte persistant ; migration prévue vers un hébergeur moins cher |

**Outils explicitement écartés :**

| Outil | Raison |
|-------|--------|
| Notion | API limitée, pas de temps réel, dépendance externe |
| HubSpot / Salesforce | Overkill et coûteux pour un solo |
| Zapier | Trop cher, redondant avec n8n |
| Oracle Cloud | Remplacé par Azure (crédits 100$ disponibles) |

---

## 9. État d'avancement (Août 2026)

| Composant | Statut |
|-----------|--------|
| Infrastructure Vercel + Supabase (app + BDD) | ✅ Opérationnel (migré depuis Azure en 2026-08) |
| Infrastructure Azure + Terraform (n8n) | ✅ Opérationnel — à migrer hors Azure (coût) |
| CI/CD GitHub Actions → Vercel | ✅ Configuré |
| Next.js + Prisma + Supabase | ✅ Opérationnel |
| shadcn/ui | ✅ Configuré |
| Module CRM — API + UI Kanban + fiche prospect | ✅ Complet |
| Module CRM — Scoring IA, email IA, relances auto, import CSV | ✅ Opérationnel |
| Module Agenda — Google Calendar + Tasks, lifecycle meeting | ✅ Opérationnel |
| Module Projets — DB + API + UI (4 onglets) | ✅ Opérationnel |
| Module Clients — page dédiée, CA par client | ✅ Opérationnel |
| Module Finance — devis + factures + dashboard CA | ✅ Opérationnel |
| Module Admin — charges, abonnements, usage IA | ✅ Opérationnel |
| Module Admin — weekly review IA | ✅ Opérationnel (déclenchement manuel) |
| Workflows n8n — outreach / relances / Gmail poll / dépense Claude | ✅ Déployés |
| Workflow n8n — dépense Azure mensuelle | ⚠️ Cassé — route API manquante, voir [SUIVI.md](SUIVI.md) |
| Workflows n8n — devis / onboarding / weekly review auto | ⬜ À faire |
| Module IA Centrale (chat interne) | ⬜ À venir — prochain module prioritaire |
| Notifications centralisées | ⬜ À venir |

---

*Document mis à jour manuellement à partir de l'état du projet — DeepShift OS, Août 2026.*
