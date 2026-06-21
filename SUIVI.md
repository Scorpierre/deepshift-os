# DeepShift — Suivi d'avancement

> Dernière mise à jour : 2026-06-21

---

## Infrastructure Azure

| Tâche | Statut | Notes |
|-------|--------|-------|
| Terraform `main.tf` configuré | ✅ Fait | VM, réseau, NSG, IP statique, cloud-init |
| VM size | ✅ Fait | `Standard_D2s_v3` (2 vCPU / 8 GB) — B2ms indisponible en FranceCentral |
| Ports ouverts | ✅ Fait | 22, 80, 443, 3000, 5678 |
| Variables secrets via `terraform.tfvars` | ✅ Fait | `postgres_password`, `n8n_encryption_key`, `admin_password` |
| Clé SSH configurée | ✅ Fait | `id_ed25519` (clé existante) |
| `.gitignore` complet | ✅ Fait | Node.js + Terraform (tfstate, tfvars, .terraform/) |
| `terraform apply` — VM créée | ✅ Fait | IP : `<VM_PUBLIC_IP>` |
| Docker installé sur la VM | ✅ Fait | Via cloud-init |
| n8n + PostgreSQL lancés via Docker Compose | ✅ Fait | Port 5678 / 5432 |
| Terraform — Managed Identity | ✅ Fait | SystemAssigned MI sur `deepshift-vm` + rôle `Cost Management Reader` — pas de secrets pour Azure Cost API |

---

## GitHub & CI/CD

| Tâche | Statut | Notes |
|-------|--------|-------|
| Repo GitHub créé | ✅ Fait | `github.com/Scorpierre/deepshift-os` |
| CI GitHub Actions | ✅ Fait | Déclenché sur PR vers `main` — typecheck + lint + build |
| Auto-deploy GitHub Actions | ✅ Fait | Push sur `main` → SSH → `docker compose build --no-cache` + `docker compose up -d` |
| Déclenchement manuel deploy | ✅ Fait | `workflow_dispatch` ajouté |
| `prisma db push` en deploy | ✅ Fait | Remplace `prisma migrate deploy` (workflow `db push` sans fichiers de migration) |
| Secrets GitHub configurés | ✅ Fait | `VM_HOST`, `VM_USER`, `SSH_PRIVATE_KEY`, `ENV_PRODUCTION`, `DATABASE_URL` |
| Sécurité repo public | ✅ Fait | IPs remplacées par placeholders, secrets hors git |
| Protection branche `main` | ⬜ À faire | Nécessite GitHub Pro (repo privé) |

---

## Application DeepShift OS — Modules

### CRM & Prospection ✅

| Fonctionnalité | Statut | Notes |
|----------------|--------|-------|
| Kanban pipeline | ✅ Fait | LOST/ARCHIVED masqués, toggle "Voir perdus", auto-LOST J+10 sans réponse |
| Fiche prospect | ✅ Fait | Layout 3 colonnes, édition inline, autosave blur |
| Scoring IA | ✅ Fait | Score 0-10 + tags + action recommandée (Claude Haiku) — auto-poll tant que SCORING |
| Email IA + envoi Gmail | ✅ Fait | Génération Claude Sonnet + envoi Gmail API + timeline — 1 call optimisé |
| Avertissement jour défavorable | ✅ Fait | 422 + "Envoyer quand même" si lundi/vendredi/weekend (non bloquant) |
| Relances auto J+3/J+7 | ✅ Fait | Claude Haiku génère la relance → envoi Gmail → auto-LOST après 3 sans réponse |
| Import CSV | ✅ Fait | Modal d'import avec preview + cases à cocher, parsing comma/semicolon, déduplication email |
| Analyse emails entrants | ✅ Fait | Poll horaire n8n → intent Claude → statut auto (QUALIFIED/PROPOSAL_SENT/ARCHIVED/reminder) |
| Sync emails envoyés depuis Gmail | ✅ Fait | Poll scan `in:sent` — capture les réponses directes hors CRM, liées au prospect par adresse To: |
| Lecture pièces jointes | ✅ Fait | PDF + images dans emails entrants → transmis à Claude |
| Upload documents prospect | ✅ Fait | PDF/image → `ProspectDocument` → contexte IA lors génération jalons |

### Agenda & IA Email ✅

| Fonctionnalité | Statut | Notes |
|----------------|--------|-------|
| Vue calendrier mois | ✅ Fait | Grille ISO lun-dim, navigation mois, bouton "Aujourd'hui" |
| Sync Google Calendar | ✅ Fait | OAuth2 avec refresh token (scope calendar + gmail + tasks) |
| Events Google Calendar | ✅ Fait | Affichage couleur native Calendar, detail panel avec lien vers Google Calendar |
| Google Tasks | ✅ Fait | Affichage tâches (icône carré amber) sur les jours concernés |
| Détection date dans emails sortants | ✅ Fait | Après envoi CRM → Claude Haiku détecte date/heure → crée event Calendar auto + `meetingEventId` |
| Propositions RDV (emails entrants) | ✅ Fait | Si prospect propose une date → `aiMeetingDate` stockée → panneau "Propositions" dans Agenda |
| Confirmation manuelle | ✅ Fait | Bouton "Ajouter" → POST `/api/calendar/events` → crée event + `meetingEventId` |
| Suivi lifecycle réunion | ✅ Fait | Poll horaire analyse emails entrants : CONFIRMED (auto-crée event si manquant) / RESCHEDULED (patch start/end) / CANCELLED (supprime event) |

### Gestion de Projets ✅

| Fonctionnalité | Statut | Notes |
|----------------|--------|-------|
| Liste projets | ✅ Fait | Bouton fiche client séparé du clic projet, statuts colorés |
| Fiche projet (4 onglets) | ✅ Fait | Brief, Étapes+Tâches, Livraisons (validation client OK/À revoir), Échanges client |
| Lien client cliquable | ✅ Fait | Nom client dans header projet → fiche CRM |
| Génération IA jalons | ✅ Fait | Claude Sonnet génère milestones + tâches depuis le brief |
| Statut Maintenance | ✅ Fait | Nouveau statut MAINTENANCE (violet) pour contrats après livraison |
| Plusieurs projets par client | ✅ Fait | Relation `Prospect → has many Project` |

### Clients ✅

| Fonctionnalité | Statut | Notes |
|----------------|--------|-------|
| Page `/clients` | ✅ Fait | Liste tous les prospects WON + ceux avec au moins un projet (persistants après livraison) |
| CA total par client | ✅ Fait | Somme des budgets de tous les projets |
| Boutons rapides | ✅ Fait | "Fiche" → `/crm/[id]`, "+ Projet" → modal nouveau projet |
| Projets listés par client | ✅ Fait | Tous projets (actifs + terminés + maintenance) avec statut et budget |

### Finance ✅

| Fonctionnalité | Statut | Notes |
|----------------|--------|-------|
| Dashboard CA | ✅ Fait | Encaissé / en attente / prévisionnel |
| Devis | ✅ Fait | DRAFT → SENT → ACCEPTED, CRUD complet |
| Factures | ✅ Fait | PENDING → PAID, marquage paiement, liaison devis→facture |

### Admin ✅

| Fonctionnalité | Statut | Notes |
|----------------|--------|-------|
| Vue d'ensemble charges | ✅ Fait | Mensuelles + projection annuelle |
| Abonnements | ✅ Fait | Actifs/inactifs, alertes renouvellement 7j |
| Weekly Review IA | ✅ Fait | Résumé Claude CRM+Finance+Projets (déclenchement manuel) |
| Usage IA | ✅ Fait | Tokens/coût Claude (AiUsageLog) + crédits Azure IMDS + budget mensuel |

---

## Credentials & Intégrations

| Service | Statut | Notes |
|---------|--------|-------|
| Claude API | ✅ Fait | Haiku 4.5 (scoring, emails, poll) + Sonnet 4.6 (jalons, weekly review) — usage tracké `AiUsageLog` |
| Gmail OAuth | ✅ Fait | `pierre.deepshift@gmail.com` — refresh token couvre scopes gmail + calendar + tasks |
| Google Calendar API | ✅ Fait | Activée dans Google Cloud Console — même refresh token — lifecycle meeting complet |
| Google Tasks API | ✅ Fait | Scopes inclus — affichage dans Agenda |

---

## Workflows n8n

| Workflow | Statut | Notes |
|----------|--------|-------|
| Analyse prospect → scraping → scoring Claude → CRM | ✅ Fait | Webhook `/webhook/prospect-analysis` — déclenché à la création avec URL |
| File 9h — envoi auto prospects SCORED | ✅ Fait | `/api/cron/daily-outreach` — SCORED sans email → Claude Sonnet → envoi Gmail → CONTACTED |
| Relances auto J+3/J+7 + auto-lost J+10 | ✅ Fait | `/api/cron/process-followups` — Haiku génère relance → envoi Gmail |
| Analyse réponses emails → intent → statut | ✅ Fait | Poll **horaire** — scan inbox + sent 2 derniers jours — intent Haiku → lifecycle meeting |
| Dépense Claude auto 1er du mois | ✅ Fait | `/api/cron/monthly-claude-expense` — agrège `AiUsageLog` → dépense Finance |
| Dépense Azure auto 1er du mois | ✅ Fait | `/api/cron/monthly-azure-expense` — IMDS → Azure Cost API → dépense Finance |
| Weekly review automatique lundi | ⬜ À faire | Actuellement déclenchement manuel — workflow n8n Schedule à créer |
| Génération devis → envoi → relance | ⬜ À faire | — |
| Onboarding client → projet → repo GitHub → email bienvenue | ⬜ À faire | — |

> ⚠️ Le fichier `n8n-gmail-poll-workflow.json` est à jour (hourly) dans le repo — à importer manuellement dans l'interface n8n si pas déjà fait.

---

## Stack technique

| Couche | Techno | Statut |
|--------|--------|--------|
| Frontend + Backend | Next.js 15 + TypeScript | ✅ |
| Base de données | PostgreSQL 16 | ✅ (Docker — port 5432) |
| ORM | Prisma 7 (`db push`) | ✅ |
| UI | Tailwind CSS | ✅ (shadcn minimal) |
| IA | Claude API (Haiku 4.5 + Sonnet 4.6) | ✅ |
| Automatisation | n8n self-hosted | ✅ (Docker — port 5678) |
| Email | Gmail API (OAuth2) | ✅ |
| Calendrier | Google Calendar API | ✅ |
| Tâches | Google Tasks API | ✅ |
| Hébergement | Azure VM `deepshift-vm` — FranceCentral | ✅ |
| Infra as Code | Terraform | ✅ |

---

## Prochaines étapes

| Priorité | Tâche |
|----------|-------|
| 🔴 Action | Importer `n8n-gmail-poll-workflow.json` dans n8n UI (poll hourly) |
| 🟡 Module | IA centrale — chat interne Claude avec contexte entreprise complet |
| 🟡 Module | Notifications push/email centralisées |
| 🟢 Workflow | Weekly review automatique (Schedule n8n lundi matin) |
| 🟢 Workflow | Génération devis → envoi → relance paiement |
| 🟢 Workflow | Onboarding client → création projet + repo GitHub + email bienvenue |
| 🟢 Amélioration | Passer le repo public (prêt — IPs et secrets nettoyés) |
