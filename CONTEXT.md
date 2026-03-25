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
| Base de données | PostgreSQL |
| ORM | Prisma |
| UI | shadcn/ui + Tailwind |
| IA | Claude API (Anthropic) — embarqué dans l'app |
| Automatisation | n8n (self-hosted sur le VPS) |
| Email | Gmail API (compte gratuit pour démarrer) |
| Calendrier | Google Calendar API |
| Transcription appels | Granola (optionnel, ~15€/mois) |
| Hébergement | Microsoft Azure — VM B2ms (2 vCPU, 8GB RAM) |
| Versionning | GitHub |

---

## Infrastructure Azure

- **Cloud** : Microsoft Azure — crédits 100$ pour 1 an
- **VM** : B2ms — Ubuntu 24.04 LTS — 2 vCPU / 8GB RAM
- **Coût estimé VM** : ~70$/an (dans les crédits)
- **Resource group** : `deepshift-rg`
- **Nom VM** : `deepshift-vm`
- **Username SSH** : `deepshift`
- **Pas de domaine pour l'instant** — accès via IP publique Azure
- **Ports ouverts** : 22 (SSH), 80 (HTTP), 443 (HTTPS), 5678 (n8n), 3000 (app Next.js)

---

## Budget mensuel cible

| Outil | Coût |
|-------|------|
| Azure VM B2ms | ~6$/mois (crédits) |
| n8n self-hosted | 0€ |
| Claude API (workflows n8n) | ~5-10€ |
| Gmail | 0€ |
| Granola (optionnel) | ~15€ |
| **Total** | **~10-25€/mois** |

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

## Où on en est

- [ ] Setup Azure VM (créer VM B2ms, Ubuntu 24.04, clé SSH)
- [ ] Firewall Azure (ports 22, 80, 443, 5678, 3000)
- [ ] Connexion SSH + Docker installé
- [ ] n8n lancé via Docker Compose
- [ ] Credentials configurés (Claude API, Gmail OAuth, GitHub)
- [ ] Repo GitHub créé (deepshift-os)
- [ ] Scaffolding Next.js 15 + TypeScript + Prisma + PostgreSQL
- [ ] shadcn/ui configuré
- [ ] Module CRM — V1
- [ ] Module Projets — V1
- [ ] Module Finance — V1
- [ ] Module Interne — V1
- [ ] Module Agenda + IA centrale — V1
- [ ] Workflows n8n (prospection, relances, devis, onboarding, facturation)
- [ ] Granola intégré (optionnel)

---

## Comment utiliser ce fichier

**Dans Claude Chat** : colle le contenu de ce fichier en début de message, puis pose ta question.

**Dans Claude Code** : place `CONTEXT.md` à la racine du repo. Dis `lis CONTEXT.md` au début de chaque session.

**Mettre à jour** : coche les cases au fur et à mesure. C'est un fichier vivant.
