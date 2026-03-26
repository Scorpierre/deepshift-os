# DeepShift OS — CRM V1 Spec

## Stack
- Next.js 15 (App Router) + TypeScript
- PostgreSQL + Prisma ORM
- shadcn/ui + Tailwind CSS
- Claude API (Anthropic)
- NextAuth.js (auth)

---

## Schéma base de données (Prisma)

### Prospect
```prisma
model Prospect {
  id              String   @id @default(cuid())
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  // Infos de base
  name            String
  company         String?
  email           String   @unique
  phone           String?
  linkedinUrl     String?

  // Pipeline
  status          ProspectStatus @default(NEW)
  score           Int?           // 1-10 par Claude

  // Contexte
  needType        String[]       // ["webapp", "site", "consulting", "api"]
  estimatedBudget Float?
  source          String?        // linkedin, referral, github, site

  // Suivi
  lastContactedAt DateTime?
  nextActionAt    DateTime?
  nextActionNote  String?

  // IA
  aiSummary       String?        // résumé Claude du prospect
  aiScoreReason   String?        // pourquoi ce score

  // Relations
  emails          Email[]
  notes           Note[]
  reminders       Reminder[]
}

enum ProspectStatus {
  NEW           // Nouveau
  CONTACTED     // Contacté
  QUALIFIED     // Qualifié
  PROPOSAL_SENT // Devis envoyé
  NEGOTIATION   // En négociation
  WON           // Signé
  LOST          // Perdu
  ARCHIVED      // Archivé
}
```

### Email
```prisma
model Email {
  id         String   @id @default(cuid())
  createdAt  DateTime @default(now())

  prospectId String
  prospect   Prospect @relation(fields: [prospectId], references: [id])

  direction  EmailDirection // SENT ou RECEIVED
  subject    String
  body       String         @db.Text
  sentAt     DateTime
  gmailId    String?        // ID Gmail pour le threading

  // Analyse IA
  aiAnalysis String?        // résumé Claude de l'email reçu
  aiIntent   String?        // INTERESTED / NOT_INTERESTED / NEEDS_INFO / CALLBACK
}

enum EmailDirection {
  SENT
  RECEIVED
}
```

### Note
```prisma
model Note {
  id         String   @id @default(cuid())
  createdAt  DateTime @default(now())

  prospectId String
  prospect   Prospect @relation(fields: [prospectId], references: [id])

  content    String   @db.Text
  source     String?  // manual, granola, ai
}
```

### Reminder
```prisma
model Reminder {
  id         String         @id @default(cuid())
  createdAt  DateTime       @default(now())

  prospectId String
  prospect   Prospect       @relation(fields: [prospectId], references: [id])

  dueAt      DateTime
  note       String
  status     ReminderStatus @default(PENDING)
  type       ReminderType
}

enum ReminderStatus {
  PENDING
  DONE
  SNOOZED
}

enum ReminderType {
  FOLLOW_UP      // Relance J+3 / J+7
  CALL           // Appel à passer
  PROPOSAL       // Devis à envoyer
  CUSTOM         // Manuel
}
```

---

## API Routes (Next.js App Router)

### Prospects
- `GET    /api/prospects` — liste tous les prospects (avec filtres status, score)
- `POST   /api/prospects` — créer un prospect
- `GET    /api/prospects/[id]` — fiche détaillée
- `PATCH  /api/prospects/[id]` — mettre à jour (statut, score, etc.)
- `DELETE /api/prospects/[id]` — supprimer

### Emails
- `GET  /api/prospects/[id]/emails` — historique emails d'un prospect
- `POST /api/prospects/[id]/emails/send` — envoyer un email via Gmail API
- `POST /api/emails/analyze` — analyser un email reçu avec Claude

### IA
- `POST /api/ai/score` — scorer un prospect (retourne score 1-10 + raison)
- `POST /api/ai/draft-email` — rédiger un email de prospection personnalisé
- `POST /api/ai/weekly-summary` — générer le résumé hebdomadaire

### Reminders
- `GET  /api/reminders` — tous les rappels en attente
- `POST /api/reminders` — créer un rappel
- `PATCH /api/reminders/[id]` — marquer comme fait / snooze

---

## Pages (App Router)

```
app/
├── (dashboard)/
│   ├── layout.tsx          # Layout avec sidebar
│   ├── page.tsx            # Dashboard principal
│   └── crm/
│       ├── page.tsx        # Vue Kanban pipeline
│       └── [id]/
│           └── page.tsx    # Fiche prospect détaillée
├── api/
│   ├── prospects/
│   ├── emails/
│   ├── ai/
│   └── reminders/
└── layout.tsx
```

---

## UI Kanban — colonnes

```
NEW → CONTACTED → QUALIFIED → PROPOSAL_SENT → NEGOTIATION → WON / LOST
```

Chaque carte prospect affiche :
- Nom + entreprise
- Score IA (badge coloré 1-10)
- Dernier contact (il y a X jours)
- Prochaine action (date + note)
- Avatar initiales

---

## Scoring IA — Prompt Claude

```
Tu analyses un prospect pour DeepShift, auto-entreprise IT spécialisée en 
web apps sur mesure et consulting transformation digitale.

Prospect :
- Nom : {{name}}
- Entreprise : {{company}}
- Besoin exprimé : {{need}}
- Source : {{source}}
- Email initial : {{email_content}}

Score de 1 à 10 selon ces critères :
- Fit avec les services DeepShift (web app, consulting digital) : /4
- Budget apparent (taille entreprise, secteur, signaux) : /3
- Urgence détectée : /2
- Facilité de collaboration estimée : /1

Réponds UNIQUEMENT en JSON :
{
  "score": 7,
  "reason": "PME avec besoin clair de refonte web, budget probable 5-15k, urgence modérée",
  "tags": ["webapp", "pme", "refonte"],
  "recommended_action": "Proposer un call de 30min cette semaine"
}
```

---

## Variables d'environnement (.env.local)

```bash
# Base de données
DATABASE_URL="postgresql://deepshift:PASSWORD@localhost:5432/deepshift_db"

# Claude API
ANTHROPIC_API_KEY="sk-ant-..."

# Gmail OAuth
GOOGLE_CLIENT_ID="..."
GOOGLE_CLIENT_SECRET="..."
GOOGLE_REDIRECT_URI="http://localhost:3000/api/auth/callback/google"

# NextAuth
NEXTAUTH_SECRET="..."
NEXTAUTH_URL="http://localhost:3000"
```

---

## Ordre de développement recommandé

1. `npx create-next-app@latest deepshift-os --typescript --tailwind --app`
2. Installer dépendances : `prisma`, `@prisma/client`, `@anthropic-ai/sdk`, `shadcn/ui`
3. Créer le schéma Prisma + migration
4. API routes prospects (CRUD)
5. UI Kanban pipeline
6. Fiche prospect
7. API scoring IA
8. Envoi email (Gmail API)
9. Analyse emails reçus (Claude)
10. Rappels + relances auto
