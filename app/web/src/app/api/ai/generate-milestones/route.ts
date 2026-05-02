import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { anthropic } from "@/lib/anthropic";

type GeneratedMilestone = {
  name: string;
  description: string;
  daysFromStart: number;
  tasks: string[];
};

type TextBlock = { type: "text"; text: string };
type DocumentBlock = { type: "document"; source: { type: "base64"; media_type: "application/pdf"; data: string }; title?: string };
type ImageBlock = { type: "image"; source: { type: "base64"; media_type: string; data: string } };
type ContentBlock = TextBlock | DocumentBlock | ImageBlock;

export async function POST(request: NextRequest) {
  const { projectId, clearExisting } = await request.json();

  if (!projectId) return NextResponse.json({ error: "projectId requis." }, { status: 400 });

  let project;
  try {
    project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        prospect: {
          include: {
            emails: { orderBy: { sentAt: "desc" }, take: 15 },
            documents: { orderBy: { createdAt: "desc" } },
          },
        },
      },
    });
  } catch (err) {
    console.error("[generate-milestones] DB error:", err);
    return NextResponse.json({ error: "Erreur base de données." }, { status: 500 });
  }

  if (!project) return NextResponse.json({ error: "Projet introuvable." }, { status: 404 });

  const { prospect } = project;

  const emailsContext = prospect.emails.length > 0
    ? prospect.emails.map((e) =>
        `[${e.direction === "SENT" ? "Envoyé" : "Reçu"} · ${new Date(e.sentAt).toLocaleDateString("fr-FR")}]\nObjet : ${e.subject}\n${e.body.slice(0, 600)}${e.body.length > 600 ? "…" : ""}`
      ).join("\n\n---\n\n")
    : "Aucun échange email enregistré.";

  const startDate = project.startDate ?? new Date();
  const deadlineInfo = project.deadline
    ? `Deadline : ${new Date(project.deadline).toLocaleDateString("fr-FR")} (${Math.round((new Date(project.deadline).getTime() - startDate.getTime()) / 86400000)} jours disponibles)`
    : "Pas de deadline fixée.";

  const docs = prospect.documents;
  const docsNote = docs.length > 0
    ? `\n## Documents chargés (${docs.length} fichier${docs.length > 1 ? "s" : ""} ci-dessous)\nLis attentivement ces documents — ils peuvent contenir le cahier des charges, les specs techniques, ou le devis accepté.`
    : "";

  const promptText = `Tu es un expert en gestion de projet IT freelance. Tu dois générer un plan de projet réaliste pour Pierre Connes (DeepShift), développeur web freelance spécialisé en sites vitrine, web apps sur mesure et consulting digital.

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
${prospect.prospectNotes ? `\n## Notes complémentaires (saisies manuellement)\n${prospect.prospectNotes}` : ""}

## Historique des échanges
${emailsContext}
${docsNote}

## Instructions
Génère entre 3 et 5 étapes de projet (milestones) avec leurs tâches.
Chaque étape doit être concrète et adaptée au type de projet détecté.
Si des documents sont présents, base-toi sur leur contenu pour affiner les étapes.
Les \`daysFromStart\` sont relatifs à la date de début du projet.
Les tâches doivent être actionnables et précises.

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

  const contentBlocks: ContentBlock[] = [{ type: "text", text: promptText }];

  for (const doc of docs) {
    if (doc.mimeType === "application/pdf") {
      contentBlocks.push({
        type: "document",
        source: { type: "base64", media_type: "application/pdf", data: doc.data },
        title: doc.filename,
      });
    } else if (doc.mimeType.startsWith("image/")) {
      contentBlocks.push({
        type: "image",
        source: { type: "base64", media_type: doc.mimeType, data: doc.data },
      });
    }
  }

  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    messages: [{ role: "user", content: contentBlocks as any }],
  });

  const raw = message.content[0].type === "text" ? message.content[0].text : "{}";
  console.log("[generate-milestones] raw AI response:", raw.slice(0, 500));

  // Strip markdown code fences if present
  const stripped = raw.replace(/```(?:json)?\s*/gi, "").replace(/```/g, "").trim();
  const jsonMatch = stripped.match(/\{[\s\S]*\}/);

  let milestones: GeneratedMilestone[] = [];
  try {
    const parsed = JSON.parse(jsonMatch?.[0] ?? "{}");
    milestones = parsed.milestones ?? [];
  } catch (err) {
    console.error("[generate-milestones] parse error:", err, "| raw:", raw.slice(0, 300));
    return NextResponse.json({ error: `Parsing IA échoué. Réponse reçue : ${raw.slice(0, 200)}` }, { status: 500 });
  }

  if (clearExisting) {
    await prisma.milestone.deleteMany({ where: { projectId } });
  }

  const created = await Promise.all(
    milestones.map(async (m, i) => {
      const dueAt = new Date(startDate);
      dueAt.setDate(dueAt.getDate() + (m.daysFromStart ?? (i + 1) * 7));

      return prisma.milestone.create({
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
    })
  );

  return NextResponse.json({ milestones: created, documentsRead: docs.length });
}
