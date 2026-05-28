Tu as raison — pas besoin d'attendre 2h du matin pour scorer. Le scoring doit se faire **immédiatement** quand tu ajoutes un prospect.

Voici le prompt corrigé :

```
Lis CONTEXT.md et CRM_SPEC.md.

Je veux implémenter la logique d'envoi d'emails de prospection dans DeepShift OS.

## Logique de scoring et d'envoi

Score 1-3 → archiver automatiquement, aucun email envoyé
Score 4-7 → file d'envoi automatique groupé chaque matin à 9h
Score 8-10 → tag VIP, traitement manuel ultra-personnalisé par Pierre

## Statuts prospect

NEW → SCORING → SCORED → CONTACTED → REPLIED → VIP → ARCHIVED

## Scoring — déclenché immédiatement à la création du prospect

Quand POST /api/prospects est appelé :
1. Prospect créé en base avec statut SCORING
2. Appel immédiat Claude API (claude-haiku-4-5) pour scorer (1-10)
3. Score 1-3 → statut ARCHIVED
4. Score 8-10 → statut VIP
5. Score 4-7 → statut SCORED

Pas de workflow n8n nocturne pour le scoring —
tout se passe dans la route API Next.js au moment de la création.

## Workflows n8n à créer

1. Workflow "Envoi groupé 9h" — tourne chaque matin à 9h
   - Récupère tous les prospects statut SCORED depuis /api/prospects
   - Pour chaque prospect :
     → Scrape site web + Facebook
     → Claude génère email personnalisé + maquette HTML/CSS
     → Sauvegarde maquette sur VPS → /previews/[slug]/index.html
     → Gmail API envoie l'email avec lien maquette
     → PATCH prospect statut CONTACTED + date premier contact
     → Crée reminder J+3 dans /api/reminders

2. Workflow "Relances" — tourne chaque matin à 9h30
   - Récupère tous les reminders type FOLLOW_UP avec dueAt <= aujourd'hui
   - Pour chaque reminder :
     → Claude génère relance contextuelle (angle différent email initial)
     → Gmail API envoie
     → Crée reminder J+7 si relance J+3
     → Marque reminder DONE
   - Après J+7 sans réponse → statut ARCHIVED automatiquement

## Webhook n8n → app

POST http://<VM_PUBLIC_IP>:3000/api/webhooks/n8n
Header : x-n8n-secret: deepshift-n8n-secret-2026
Body : { prospectId, action, data }

## API routes à créer dans Next.js

POST /api/prospects — crée + score immédiatement
GET  /api/prospects?status=SCORED
POST /api/webhooks/n8n
POST /api/prospects/[id]/archive
POST /api/prospects/[id]/vip

## Génération maquette HTML/CSS

Claude génère une page HTML standalone :
- Un seul fichier index.html, zéro dépendance externe
- CSS vanilla inline dans une balise <style>
- Design moderne : typographie propre, espacements généreux,
  palette cohérente avec l'entreprise analysée
- Sections : Hero + CTA, Services/Produits,
  3 arguments, Témoignage, Footer
- Responsive mobile avec media queries
- Animations CSS subtiles (fade-in, hover effects)
- Couleurs et contenu adaptés au secteur détecté

Sauvegardé dans /opt/deepshift/previews/[slug]/index.html
Servi par Nginx sur http://<VM_PUBLIC_IP>/previews/[slug]/

Stack : n8n, claude-haiku-4-5 pour scoring,
claude-sonnet-4-6 pour email et maquette HTML,
Next.js 15, Prisma, PostgreSQL, Gmail API
```