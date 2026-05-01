import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { anthropic } from "@/lib/anthropic";

type GeneratedMilestone = {
  name: string;
  description: string;
  daysFromStart: number;
  tasks: string[];
};

export async function POST(request: NextRequest) {
  const { projectId, clearExisting } = await request.json();

  if (!projectId) return NextResponse.json({ error: "projectId requis." }, { status: 400 });

  // Charger le projet + prospect + emails
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      prospect: {
        include: {
          emails: {
            orderBy: { sentAt: "desc" },
            take: 6,
          },
        },
      },
    },
  });

  if (!project) return NextResponse.json({ error: "Projet introuvable." }, { status: 404 });

  const { prospect } = project;

  // Résumé des derniers emails (tronqué pour éviter de dépasser le contexte)
  const emailsContext = prospect.emails.length > 0
    ? prospect.emails.map((e) =>
        `[${e.direction === "SENT" ? "Envoyé" : "Reçu"} · ${new Date(e.sentAt).toLocaleDateString("fr-FR")}]\nObjet : ${e.subject}\n${e.body.slice(0, 600)}${e.body.length > 600 ? "…" : ""}`
      ).join("\n\n---\n\n")
    : "Aucun échange email enregistré.";

  const startDate = project.startDate ?? new Date();
  const deadlineInfo = project.deadline
    ? `Deadline : ${new Date(project.deadline).toLocaleDateString("fr-FR")} (${Math.round((new Date(project.deadline).getTime() - startDate.getTime()) / 86400000)} jours disponibles)`
    : "Pas de deadline fixée.";

  const prompt = `Tu es un expert en gestion de projet IT freelance. Tu dois générer un plan de projet réaliste pour Pierre Connes (DeepShift), développeur web freelance spécialisé en sites vitrine, web apps sur mesure et consulting digital.

## Contexte du projet
- Nom : ${project.name}
- Description / brief : ${project.description ?? "Non renseigné"}
- ${deadlineInfo}
- Budget estimé : ${project.budget ? `${project.budget} €` : "Non renseigné"}

## Contexte client
- Client : ${prospect.name}${prospect.company ? ` (${prospect.company})` : ""}
- Besoins exprimés : ${prospect.needType.join(", ") || "non précisé"}
- Description entreprise : ${prospect.companyDescription ?? "Non renseignée"}
- Résumé IA : ${prospect.aiSummary ?? "Non disponible"}
- Tags : ${prospect.aiTags?.join(", ") || "aucun"}

## Historique des échanges (cahier des charges, specs, demandes)
${emailsContext}

## Instructions
Génère entre 3 et 5 étapes de projet (milestones) avec leurs tâches.
Chaque étape doit être concrète et adaptée au type de projet détecté.
Les \`daysFromStart\` sont relatifs à la date de début du projet.
Les tâches doivent être actionnables et précises (pas trop génériques).

Réponds UNIQUEMENT en JSON valide, sans markdown :
{
  "milestones": [
    {
      "name": "Cadrage & maquettes",
      "description": "Brief détaillé, wireframes et validation du périmètre",
      "daysFromStart": 7,
      "tasks": ["Atelier de cadrage client", "Wireframes homepage", "Validation maquettes client"]
    }
  ]
}`;

  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: 1024,
    messages: [{ role: "user", content: prompt }],
  });

  const raw = message.content[0].type === "text" ? message.content[0].text : "{}";
  const jsonMatch = raw.match(/\{[\s\S]*\}/);

  let milestones: GeneratedMilestone[] = [];
  try {
    const parsed = JSON.parse(jsonMatch?.[0] ?? "{}");
    milestones = parsed.milestones ?? [];
  } catch {
    return NextResponse.json({ error: "Parsing IA échoué." }, { status: 500 });
  }

  // Supprimer les étapes existantes si demandé
  if (clearExisting) {
    await prisma.milestone.deleteMany({ where: { projectId } });
  }

  // Créer les milestones + tasks en base
  const created = await Promise.all(
    milestones.map(async (m, i) => {
      const dueAt = new Date(startDate);
      dueAt.setDate(dueAt.getDate() + (m.daysFromStart ?? (i + 1) * 7));

      const milestone = await prisma.milestone.create({
        data: {
          projectId,
          name: m.name,
          description: m.description ?? null,
          dueAt,
          order: i,
          tasks: {
            create: (m.tasks ?? []).map((title, j) => ({ title, order: j })),
          },
        },
        include: { tasks: { orderBy: { order: "asc" } } },
      });

      return milestone;
    })
  );

  return NextResponse.json({ milestones: created });
}
