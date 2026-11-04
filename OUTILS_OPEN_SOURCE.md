# DeepShift OS — Intégration d'outils open source auto-hébergés

> Document de réflexion, à relire et amender. Créé le 2026-11-04.
> Contexte : l'interface Projets est jugée peu aboutie, et l'objectif est de ne pas perdre de temps à concevoir l'UX/UI de modules déjà résolus ailleurs.

---

## 1. Décision de principe

DeepShift OS garde ce qui le différencie (CRM, scoring IA, agents, dashboard unifié) et **délègue à des outils open source déjà bien conçus** les modules d'interface pure : projets, devis/factures, prise de rendez-vous.

**Les outils sont intégrés par appel (API et webhooks), pas copiés.**

### Pourquoi appeler plutôt que copier le code

- **Temps** : réécrire Plane ou Invoice Ninja, même « en s'inspirant », ramène au problème actuel (concevoir l'UX et l'UI).
- **Maintenance** : ces projets ont des équipes qui corrigent les bugs, ajoutent des fonctions et suivent les évolutions légales. Une copie laisse seul pour tout ça.
- **Licences** : copier du code est le point sensible.
  - Plane et Cal.com sont en **AGPL** (avec des parties commerciales pour Cal.com). Intégrer leur code dans une app propriétaire peut obliger à publier son propre code si des tiers l'utilisent via le réseau.
  - Invoice Ninja utilise une licence « source-available » (Elastic License 2.0, **à vérifier dans leur dépôt**), qui limite certains usages.
  - Héberger l'outil tel quel et l'appeler par API ne pose pas ces problèmes.
- S'inspirer du **fonctionnement et de l'ergonomie** est libre (une idée n'est pas protégée) ; seul le code l'est.

### Quand coder le sien serait justifié

- DeepShift OS devient un **produit vendu** à d'autres freelances (licences et marque comptent alors).
- Un outil bloque un besoin précis que ni son API ni un plugin ne couvrent.
- Une fonction est très simple (tableau + formulaire) : coder soi-même coûte moins cher qu'intégrer.

**Conseil** : intégrer d'abord, utiliser 2 à 3 mois, noter ce qui frustre vraiment, puis ne refaire que ce qui le mérite.

---

## 2. Répartition cible

| Module | Aujourd'hui | Cible |
| --- | --- | --- |
| CRM, prospection, scoring, emails | DeepShift OS | **Reste dans l'OS** (avantage concurrentiel) |
| Dashboard unifié (CA, pipeline, projets, factures en retard) | DeepShift OS | **Reste**, alimenté par les APIs des outils |
| Chat IA et agents | DeepShift OS | **Reste** |
| Admin (charges, abonnements, weekly review) | DeepShift OS | **Reste** |
| Projets (jalons, tâches, livraisons) | DeepShift OS (UI jugée faible) | **Plane** (ou Vikunja si serveur petit) |
| Devis et factures | DeepShift OS | **Invoice Ninja** |
| Prise de rendez-vous | DeepShift OS (propositions RDV) | **Cal.com** |
| Calendrier | Google Calendar | **Google Calendar** (inchangé) |
| Orchestration | n8n | **n8n** (inchangé) |

Les pages Projets, Finance (devis/factures) et Agenda de l'OS sont à supprimer une fois la migration faite. La sidebar de l'OS pointe vers les outils sur leurs sous-domaines (`projets.…`, `factures.…`). Éviter les iframes, la plupart de ces outils les bloquent.

---

## 3. Les outils retenus

### Plane — gestion de projet
- Interface la plus soignée (proche de Linear) : kanban, liste, cycles, API.
- Plus lourd (plusieurs conteneurs, compter ~4 Go de RAM). **Alternative légère : Vikunja** (plus basique).
- Licence AGPL.

### Invoice Ninja — devis et factures
- Workflow complet : devis → acceptation → facture, portail client, PDF propre, relances automatiques, paiement en ligne.
- Suivi du temps intégré : **Kimai devient inutile**.
- Alternative plus « française » mais à l'UI datée : Dolibarr.

### Cal.com — rendez-vous
- Ne remplace que la réservation ; Google Calendar reste le calendrier.
- **Commencer par le plan gratuit hébergé** : l'auto-héberger est lourd pour un simple lien de réservation. Migration possible plus tard.
- Utilisable aussi sur le site Trimixon (lot 7 de son suivi).

---

## 4. Outils complémentaires (trous actuels de l'OS)

| Besoin | Outil | Intégration |
| --- | --- | --- |
| Justificatifs et dépenses (saisie manuelle aujourd'hui) | **Paperless-ngx** | n8n surveille les nouveaux documents, Claude extrait montant/TVA/fournisseur, création de la ligne `Expense`. |
| Supervision des apps (les siennes et celles des clients) | **Uptime Kuma** | Webhook vers n8n, puis notification (alimente le chantier « notifications centralisées »). |
| Statistiques du site | **Plausible** ou **Umami** | L'agent Sales lit l'API : quelles pages génèrent des prospects. |
| Mots de passe et accès clients | **Vaultwarden** | Hors OS. |
| Base de connaissance avec recherche | RAG maison (pgvector sur Supabase) ou **Outline** | Agent « Knowledge ». Le RAG maison est plus cohérent avec la philosophie « tout custom ». |
| Newsletter | **Listmonk** | Plus tard (lot 4 du site), segments issus du CRM. |
| Hébergement de tout ça | **Coolify** sur un VPS | Remplace la VM Azure (objectif < 10 €/mois pour n8n). |

---

## 5. Flux entre l'OS et les outils (via n8n)

```
Prospect → WON dans l'OS
   └─ n8n ─┬─ crée le client + le devis (brouillon) dans Invoice Ninja
           └─ crée le projet + les jalons dans Plane (jalons générés par Claude)

Devis accepté (webhook Invoice Ninja)  → statut du prospect mis à jour dans l'OS
Facture payée (webhook Invoice Ninja)  → CA du dashboard mis à jour
Projet livré dans Plane                → facture finale créée (brouillon)
Réservation Cal.com (webhook)          → RDV rattaché au prospect + brief préparé par Claude
Justificatif ajouté dans Paperless     → ligne Expense créée
Incident Uptime Kuma                   → notification
```

Règle conservée : **l'IA propose, je valide**. Les documents sont créés en brouillon.

### Agents

```
Orchestrateur
 ├── Sales        ← Plausible (leads), Cal.com (RDV)
 ├── Project Mgr  ← Plane (avancement)
 ├── Financial    ← Invoice Ninja (CA, factures), Paperless (justificatifs)  [lecture seule]
 ├── Secrétaire   ← Cal.com (disponibilités), Google Calendar
 └── Ops (nouveau)← Uptime Kuma, Coolify
```

Ajouter un agent = un fichier `AgentSpec` + l'enregistrer dans `AGENTS`. Chaque outil a une API REST : ajouter `lib/plane.ts`, `lib/invoicing.ts`, `lib/calcom.ts`, `lib/paperless.ts`, puis les exposer comme outils aux agents concernés.

### Couche d'abstraction (anti-dépendance)

```
lib/invoicing.ts  → createQuote(), markPaid(), listInvoices()
    └─ implémentation actuelle : Invoice Ninja
```

Les agents et le dashboard n'appellent que ces fichiers. Remplacer un outil plus tard (par un autre ou par un module maison) ne change qu'un fichier. Même principe pour `projects.ts` (Plane) et `booking.ts` (Cal.com).

---

## 6. Points d'attention

1. **Facturation électronique en France** : l'obligation de réception est en vigueur, l'émission arrive pour les micro-entreprises en 2027 et nécessitera une plateforme agréée (PA) qu'aucun de ces outils ne remplace. **Calendrier exact à vérifier** et à confronter à ton cas. Pour l'instant, une facture PDF correcte suffit.
2. **Mentions légales françaises** : Invoice Ninja n'est pas français. À configurer : numérotation, SIRET, mention « TVA non applicable, art. 293 B du CGI », pénalités de retard (champs personnalisés).
3. **Données existantes** : exporter les devis et factures déjà dans l'OS **avant** de supprimer le module (documents comptables à conserver).
4. **Serveur** : Plane + Invoice Ninja + n8n tiennent sur un VPS de 8 Go (~10-15 €/mois) avec Coolify.
5. **Nom de marque** : CONTEXT.md parle de **DeepShift**, la spec du site de **Trimixon** (nom final encore ouvert). Clarifier si DeepShift OS est l'outil interne de Trimixon ou s'il y a renommage.
6. **Sécurité** : `app/web/.env*` est présent dans le dossier. Vérifier qu'il est bien dans le `.gitignore` et n'a jamais été commité.

---

## 7. Ordre de mise en place

1. [ ] VPS + Coolify, n8n déplacé dessus (sortie d'Azure)
2. [ ] Invoice Ninja : identité légale configurée, test d'un vrai devis
3. [ ] Cal.com (cloud) branché sur Google Calendar
4. [ ] Plane (ou Vikunja)
5. [ ] Paperless-ngx + flux n8n vers `Expense`
6. [ ] Uptime Kuma + notifications
7. [ ] Flux n8n OS ↔ outils (« prospect gagné » en premier)
8. [ ] Couche d'abstraction `lib/*.ts` + adaptation des agents
9. [ ] Export des données, puis suppression des pages Projets / Finance / Agenda de l'OS

## 8. Questions ouvertes

- Quel serveur / VPS (RAM, hébergeur) ? Dimensionne le choix Plane vs Vikunja.
- Plane vs Vikunja : à trancher selon la RAM.
- Cal.com : cloud gratuit ou auto-hébergé ?
- DeepShift ou Trimixon : quel nom pour quoi ?
- Dolibarr plutôt qu'Invoice Ninja si la conformité française prime sur l'interface ?
- DeepShift OS reste-t-il interne ou devient-il un produit (impacte les licences) ?
