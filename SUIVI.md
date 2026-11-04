# DeepShift — Suivi d'avancement

> Dernière mise à jour : 2026-08-15

---

## Infrastructure Azure (n8n uniquement)

> Depuis la migration du 2026-08, l'app Next.js et PostgreSQL ne sont plus hébergées ici. La VM Azure ne sert plus qu'à n8n (+ suivi des coûts Azure via l'API Cost Management, pour le module Admin).

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
| n8n lancé via Docker Compose | ✅ Fait | Port 5678 |
| Terraform — Managed Identity | ✅ Fait | SystemAssigned MI sur `deepshift-vm` + rôle `Cost Management Reader` — pas de secrets pour Azure Cost API |
| Migration app + BDD hors VM | ✅ Fait | Voir section Vercel + Supabase ci-dessous |
| Migrer n8n hors Azure (Railway ou autre) | ⬜ À faire | Objectif budget — VM Azure reste le poste le plus cher |

---

## Infrastructure Vercel + Supabase (app)

| Tâche | Statut | Notes |
|-------|--------|-------|
| Migration deploy Azure → Vercel | ✅ Fait | `eeda61a` — workflow `deploy.yml` réécrit |
| Root directory Vercel corrigé | ✅ Fait | Build depuis la racine du repo, pas `app/web` |
| Compatibilité Vercel serverless | ✅ Fait | `d7a9f95` — `waitUntil` pour `analyzeProspect` (tâches longues en background) |
| Connexion Supabase (pooler) | ✅ Fait | `@prisma/adapter-pg` + `pg`, config pool ajustée (`70528a5`) pour éviter le conflit de version `@types/pg` |
| Crons Vercel natifs | ⬜ Retiré | `vercel.json` crons supprimés (`6dd203c`) — redondants avec les workflows n8n qui appellent déjà `/api/cron/*` par webhook |
| `prisma db push` en déploiement | ⬜ Manuel | Exécuté localement contre Supabase, pas automatisé en CI |

---

## GitHub & CI/CD

| Tâche | Statut | Notes |
|-------|--------|-------|
| Repo GitHub créé | ✅ Fait | `github.com/Scorpierre/deepshift-os` |
| CI GitHub Actions | ✅ Fait | Déclenché sur PR vers `main` — typecheck + lint + build |
| Auto-deploy GitHub Actions | ✅ Fait | Push sur `main` → `vercel --prod` (`deploy.yml`) |
| Déclenchement manuel deploy | ✅ Fait | `workflow_dispatch` ajouté |
| Secrets GitHub configurés | ✅ Fait | `VERCEL_TOKEN` (org `team_ZW8aMXWeBdLMd9w5bJB3ZPmb`, projet `deepshift`) |
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
| Relances auto J+3/J+7 | ✅ Fait | `/api/cron/process-followups` — Haiku génère relance → envoi Gmail |
| Auto-LOST J+10 sans réponse | ✅ Fait | `/api/cron/auto-lost` — route séparée de `process-followups` |
| Relances paiement facture | ✅ Fait | `/api/cron/payment-reminders` |
| Analyse réponses emails → intent → statut | ✅ Fait | Poll **horaire** — scan inbox + sent 2 derniers jours — intent Haiku → lifecycle meeting |
| Dépense Claude auto 1er du mois | ✅ Fait | `/api/cron/monthly-claude-expense` — agrège `AiUsageLog` → dépense Finance |
| Dépense Azure auto 1er du mois | ⚠️ À vérifier | `n8n-monthly-azure-expense-workflow.json` existe et `/api/cron/monthly-azure-expense` est référencé dans `proxy.ts`, mais la route n'existe plus dans `app/api/cron/` — à recréer ou à retirer du workflow n8n |
| Weekly review automatique lundi | ⬜ À faire | Actuellement déclenchement manuel — workflow n8n Schedule à créer |
| Génération devis → envoi → relance | ⬜ À faire | — |
| Onboarding client → projet → repo GitHub → email bienvenue | ⬜ À faire | — |

> Les workflows n8n ci-dessus tournent sur la VM Azure et appellent les endpoints `/api/cron/*` désormais hébergés sur Vercel — penser à mettre à jour les URLs cibles dans n8n après la migration si ce n'est pas déjà fait.

---

## Stack technique

| Couche | Techno | Statut |
|--------|--------|--------|
| Frontend + Backend | Next.js 15 + TypeScript | ✅ |
| Base de données | PostgreSQL 16 (Supabase) | ✅ |
| ORM | Prisma 7 (`db push`) | ✅ (`@prisma/adapter-pg`) |
| UI | Tailwind CSS | ✅ (shadcn minimal) |
| IA | Claude API (Haiku 4.5 + Sonnet 4.6) | ✅ |
| Automatisation | n8n self-hosted | ✅ (Docker sur VM Azure — port 5678) |
| Email | Gmail API (OAuth2) | ✅ |
| Calendrier | Google Calendar API | ✅ |
| Tâches | Google Tasks API | ✅ |
| Hébergement app | Vercel | ✅ (depuis 2026-08) |
| Hébergement n8n | Azure VM `deepshift-vm` — FranceCentral | ✅ |
| Infra as Code | Terraform (VM Azure) | ✅ |

---

## Prochaines étapes

| Priorité | Tâche |
|----------|-------|
| 🔴 Action | Vérifier que les workflows n8n (VM Azure) ciblent bien les URLs Vercel post-migration |
| 🔴 Action | Recréer ou retirer `/api/cron/monthly-azure-expense` (référencée dans `proxy.ts` et le workflow n8n, absente du code) |
| 🟡 Module | IA centrale — chat interne Claude avec contexte entreprise complet |
| 🟡 Module | Notifications push/email centralisées |
| 🟢 Infra | Migrer n8n hors Azure (Railway ou équivalent) pour réduire le coût serveur |
| 🟢 Workflow | Weekly review automatique (Schedule n8n lundi matin) |
| 🟢 Workflow | Génération devis → envoi → relance paiement |
| 🟢 Workflow | Onboarding client → création projet + repo GitHub + email bienvenue |
| 🟢 Amélioration | Passer le repo public (prêt — IPs et secrets nettoyés) |
