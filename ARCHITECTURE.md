# DeepShift OS — Document d'Architecture Technique

> **Version** : 1.1 — Mai 2026  
> **Auteur** : Pierre Connes — DeepShift  
> **Statut** : En cours de développement (CRM + Finance + Projets actifs)

---

## 1. Vue d'ensemble

**DeepShift OS** est une application web interne conçue pour piloter l'intégralité d'une auto-entreprise IT en solo. L'objectif est de centraliser en un seul outil ce que la plupart des indépendants répartissent entre Notion, HubSpot, Zapier, Pennylane et d'autres SaaS — avec une couche d'IA native pour automatiser les tâches à faible valeur ajoutée.

L'application est hébergée sur une VM Azure privée, entièrement self-hosted, sans dépendance à un service tiers payant au-delà de l'infra.

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

Les modules **CRM**, **Finance** et **Projets** sont en production. **Agenda** et **Admin** sont en attente.

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
│   │   │   └── page.tsx          # Placeholder — Google Calendar à venir
│   │   └── admin/
│   │       └── page.tsx          # Placeholder — Admin à venir
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
│       ├── client-notes/         # CRUD notes client
│       ├── reminders/            # Rappels & relances CRM
│       ├── cron/
│       │   ├── check-followups/  # Cron relances automatiques
│       │   ├── process-followups/
│       │   ├── daily-outreach/   # Cron prospection quotidienne 9h
│       │   └── auto-lost/        # Cron archivage prospects inactifs
│       ├── webhooks/
│       │   ├── n8n/              # Webhook entrant depuis n8n
│       │   └── gmail-poll/       # Polling Gmail
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
Cron /api/webhooks/gmail-poll (toutes les 15 min)
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

## 5. Infrastructure

### 5.1 Hébergement — Microsoft Azure

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

**Ports ouverts :**

| Port | Service |
|------|---------|
| 22 | SSH |
| 80 | HTTP |
| 443 | HTTPS |
| 3000 | Next.js |
| 5678 | n8n |

### 5.2 Services sur la VM

| Service | Démarrage | URL |
|---------|-----------|-----|
| Next.js app | Docker Compose | `http://<VM_PUBLIC_IP>:3000` |
| n8n | Docker Compose | `http://<VM_PUBLIC_IP>:5678` |
| PostgreSQL 16 | Docker Compose | port 5432 (interne) |

### 5.3 CI/CD — GitHub Actions

```
feature/xxx ──PR──> dev ──PR──> main ──auto-deploy──> VM Azure
```

- **CI** : typecheck + lint + build sur chaque PR vers `main` ou `dev`
- **CD** : push sur `main` → SSH → `docker compose up --build`
- **Repo** : `github.com/Scorpierre/deepshift-os`
- **Secrets** : `VM_HOST`, `VM_USER`, `SSH_PRIVATE_KEY`
- **Règle** : push direct sur `main` interdit

---

## 6. Variables d'environnement

```bash
# Base de données
DATABASE_URL="postgresql://deepshift:PASSWORD@localhost:5432/deepshift_db"

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
| Azure VM D2s_v3 (continu) | ~70 $/mois |
| Azure VM D2s_v3 (usage actif ~8h/j) | ~20 $/mois |
| n8n self-hosted | 0 € |
| Claude API (workflows) | ~5–10 € / mois |
| Gmail API | 0 € |
| **Total actif** | **~10–30 € / mois** |

> La VM est éteinte (`az vm deallocate`) hors des sessions de travail pour limiter les coûts.

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
| Hébergement | Azure VM (pas Vercel/Railway) | Contrôle total, n8n et PostgreSQL sur la même machine |

**Outils explicitement écartés :**

| Outil | Raison |
|-------|--------|
| Notion | API limitée, pas de temps réel, dépendance externe |
| HubSpot / Salesforce | Overkill et coûteux pour un solo |
| Zapier | Trop cher, redondant avec n8n |
| Vercel (hébergement) | Ne permet pas d'héberger n8n + PostgreSQL |
| Oracle Cloud | Remplacé par Azure (crédits 100$ disponibles) |

---

## 9. État d'avancement (Avril 2026)

| Composant | Statut |
|-----------|--------|
| Infrastructure Azure + Terraform | ✅ Opérationnel |
| Docker Compose (n8n + PostgreSQL) | ✅ Opérationnel |
| CI/CD GitHub Actions | ✅ Configuré |
| Next.js + Prisma + PostgreSQL | ✅ Opérationnel |
| shadcn/ui | ✅ Configuré |
| Module CRM — API (CRUD + IA) | ✅ Complet |
| Module CRM — UI Kanban | ✅ Développé |
| Module CRM — Fiche prospect | ✅ Développé |
| Module CRM — Envoi emails Gmail | ✅ Opérationnel |
| Module CRM — Polling Gmail entrant | ✅ Opérationnel |
| Module CRM — Scoring IA (Claude) | ✅ Opérationnel |
| Module CRM — Relances automatiques (cron) | ✅ Opérationnel |
| Module Finance — DB + API + UI | ✅ Opérationnel |
| Module Projets — DB + API + UI | ✅ Opérationnel |
| Workflows n8n — outreach / relances / Gmail poll | ✅ Déployés |
| Workflows n8n — devis / onboarding / facturation / weekly review | ⬜ À faire |
| Module Interne / Admin | ⬜ À venir |
| Module Agenda + IA Centrale | ⬜ À venir (priorité : bouton RDV → Google Calendar) |

---

*Document généré automatiquement à partir de l'état du projet — DeepShift OS, Avril 2026.*
