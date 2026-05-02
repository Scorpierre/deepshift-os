import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { anthropic } from "@/lib/anthropic";
import { getEmailAttachments, EmailAttachment } from "@/lib/gmail";

type GeneratedMilestone = {
  name: string;
  description: string;
  daysFromStart: number;
  tasks: string[];
};

// Blocs de contenu compatibles Anthropic SDK
type TextBlock = { type: "text"; text: string };
type DocumentBlock = { type: "document"; source: { type: "base64"; media_type: "application/pdf"; data: string }; title?: string };
type ImageBlock = { type: "image"; source: { type: "base64"; media_type: string; data: string } };
type ContentBlock = TextBlock | DocumentBlock | ImageBlock;

export async function POST(request: NextRequest) {
  const { projectId, clearExisting } = await request.json();

  if (!projectId) return NextResponse.json({ error: "projectId requis." }, { status: 400 });

  // Charger le projet + prospect + emails (avec gmailId pour les pièces jointes)
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      prospect: {
        include: {
          emails: {
            orderBy: { sentAt: "desc" },
            take: 15,
          },
        },
      },
    },
  });

  if (!project) return NextResponse.json({ error: "Projet introuvable." }, { status: 404 });

  const { prospect } = project;

  // Récupérer les pièces jointes PDF/images des emails qui en ont un gmailId
  const attachments: { email: string; files: EmailAttachment[] }[] = [];
  const emailsWithGmailId = prospect.emails.filter((e) => e.gmailId);

  for (const email of emailsWithGmailId.slice(0, 6)) {
    try {
      const files = await getEmailAttachments(email.gmailId!);
      if (files.length > 0) {
        attachments.push({ email: email.subject, files });
      }
    } catch (err) {
      console.error(`[generate-milestones] attachments fetch error for ${email.gmailId}:`, err);
    }
  }

  const totalAttachments = attachments.reduce((sum, a) => sum + a.files.length, 0);

  // Résumé texte des emails
  const emailsContext = prospect.emails.length > 0
    ? prospect.emails.map((e) =>
        `[${e.direction === "SENT" ? "Envoyé" : "Reçu"} · ${new Date(e.sentAt).toLocaleDateString("fr-FR")}]\nObjet : ${e.subject}\n${e.body.slice(0, 600)}${e.body.length > 600 ? "…" : ""}`
      ).join("\n\n---\n\n")
    : "Aucun échange email enregistré.";

  const startDate = project.startDate ?? new Date();
  const deadlineInfo = project.deadline
    ? `Deadline : ${new Date(project.deadline).toLocaleDateString("fr-FR")} (${Math.round((new Date(project.deadline).getTime() - startDate.getTime()) / 86400000)} jours disponibles)`
    : "Pas de deadline fixée.";

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
${totalAttachments > 0 ? `\n## Pièces jointes (${totalAttachments} document${totalAttachments > 1 ? "s" : ""} ci-dessous)\nLis attentivement les pièces jointes — elles peuvent contenir le cahier des charges, les specs techniques, ou le devis accepté.` : ""}

## Instructions
Génère entre 3 et 5 étapes de projet (milestones) avec leurs tâches.
Chaque étape doit être concrète et adaptée au type de projet détecté.
Si des pièces jointes sont présentes, base-toi sur leur contenu pour affiner les étapes.
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

  // Construire les blocs de contenu : texte + pièces jointes
  const contentBlocks: ContentBlock[] = [{ type: "text", text: promptText }];

  for (const { files } of attachments) {
    for (const file of files) {
      if (file.mimeType === "application/pdf") {
        contentBlocks.push({
          type: "document",
          source: { type: "base64", media_type: "application/pdf", data: file.data },
          title: file.filename,
        });
      } else if (file.mimeType.startsWith("image/")) {
        contentBlocks.push({
          type: "image",
          source: { type: "base64", media_type: file.mimeType, data: file.data },
        });
      }
    }
  }

  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    messages: [{ role: "user", content: contentBlocks as any }],
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

  return NextResponse.json({ milestones: created, attachmentsRead: totalAttachments });
}
