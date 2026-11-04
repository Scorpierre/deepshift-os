import "dotenv/config";
import { prisma } from "../src/lib/prisma";

if (!/@(localhost|127\.0\.0\.1)[:/]/.test(process.env.DATABASE_URL ?? "")) {
  console.error("Refus : DATABASE_URL n'est pas locale. Seed démo uniquement en local.");
  process.exit(1);
}

const day = (n: number) => new Date(Date.now() + n * 86400000);

async function main() {
  if ((await prisma.prospect.count()) > 0) {
    console.error("La base contient déjà des prospects — seed annulé.");
    process.exit(1);
  }

  const mk = (name: string, company: string, status: any, score: number, budget: number, extra: any = {}) =>
    prisma.prospect.create({
      data: {
        name, company, status, score, estimatedBudget: budget,
        email: `${name.toLowerCase().replace(/[^a-z]/g, ".")}@${company.toLowerCase().replace(/[^a-z]/g, "")}.fr`,
        needType: ["webapp"], source: "linkedin",
        aiSummary: `${company} : besoin d'un outil web sur mesure.`, aiScoreReason: "Budget clair, décideur identifié.",
        ...extra,
      },
    });

  const roux = await mk("Camille Roux", "Atelier Roux Boulangerie", "NEGOTIATION", 9, 6500, { lastContactedAt: day(-2), nextActionAt: day(1), nextActionNote: "Relancer sur le devis e-commerce" });
  const march = await mk("Julien Marchand", "Marchand Immobilier", "PROPOSAL_SENT", 8, 12000, { lastContactedAt: day(-5), nextActionAt: day(0), nextActionNote: "Relance J+7 devis CRM" });
  const sofia = await mk("Sofia Benali", "Clinique Vétérinaire du Parc", "QUALIFIED", 7, 4200, { lastContactedAt: day(-1) });
  await mk("Thomas Leclerc", "Leclerc Paysage", "CONTACTED", 6, 2800, { lastContactedAt: day(-9) });
  await mk("Inès Fournier", "Studio Pilates Inès", "NEW", 5, 1800);
  const dubois = await mk("Marc Dubois", "Dubois & Fils Menuiserie", "WON", 9, 7800, { lastContactedAt: day(-20) });
  const garnier = await mk("Léa Garnier", "Garnier Conseil RH", "WON", 8, 9500, { lastContactedAt: day(-35) });

  await prisma.email.createMany({
    data: [
      { prospectId: march.id, direction: "SENT", subject: "Devis CRM sur mesure", body: "Bonjour Julien, ci-joint le devis…", sentAt: day(-5) },
      { prospectId: march.id, direction: "RECEIVED", subject: "Re: Devis CRM", body: "Merci, je regarde avec mon associé. Possible de faire une démo jeudi ?", sentAt: day(0), aiIntent: "INTERESTED", aiAnalysis: "Intéressé, demande une démo." },
      { prospectId: roux.id, direction: "SENT", subject: "Refonte vitrine + commande en ligne", body: "Bonjour Camille, voici ma proposition…", sentAt: day(-2) },
      { prospectId: garnier.id, direction: "RECEIVED", subject: "Facture maintenance", body: "Désolée pour le retard, le virement part cette semaine.", sentAt: day(-2) },
    ],
  });
  await prisma.reminder.createMany({
    data: [
      { prospectId: march.id, dueAt: day(0), note: "Relance devis CRM", type: "FOLLOW_UP" },
      { prospectId: sofia.id, dueAt: day(1), note: "Envoyer le devis prise de RDV", type: "PROPOSAL" },
    ],
  });
  await prisma.note.create({ data: { prospectId: roux.id, content: "Veut commander en ligne avant Noël.", source: "manual" } });

  const q1 = await prisma.quote.create({ data: { prospectId: march.id, number: "DEVIS-2026-021", title: "CRM sur mesure", totalHT: 12000, lines: [{ description: "CRM sur mesure", qty: 1, unitPrice: 12000, total: 12000 }], status: "SENT", sentAt: day(-5), validUntil: day(25) } });
  await prisma.quote.create({ data: { prospectId: roux.id, number: "DEVIS-2026-022", title: "Refonte vitrine + commande en ligne", totalHT: 6500, lines: [{ description: "Refonte", qty: 1, unitPrice: 6500, total: 6500 }], status: "SENT", sentAt: day(-2) } });
  await prisma.quote.create({ data: { prospectId: sofia.id, number: "DEVIS-2026-023", title: "Prise de RDV en ligne", totalHT: 4200, lines: [{ description: "Module RDV", qty: 1, unitPrice: 4200, total: 4200 }], status: "DRAFT" } });
  void q1;

  const inv = (prospectId: string, number: string, title: string, totalHT: number, status: any, dueIn: number, paidIn?: number) =>
    prisma.invoice.create({ data: { prospectId, number, title, totalHT, lines: [{ description: title, qty: 1, unitPrice: totalHT, total: totalHT }], status, issuedAt: day(dueIn - 30), dueAt: day(dueIn), paidAt: paidIn !== undefined ? day(paidIn) : null } });
  await inv(garnier.id, "FAC-2026-014", "Acompte 50% Portail RH", 4750, "PAID", -25, -22);
  await inv(dubois.id, "FAC-2026-015", "Acompte 40% E-commerce", 3120, "PAID", -12, -10);
  await inv(dubois.id, "FAC-2026-016", "Jalon 2 E-commerce", 2340, "PENDING", 8);
  await inv(garnier.id, "FAC-2026-013", "Maintenance trimestrielle", 900, "OVERDUE", -18);

  const proj = (prospectId: string, name: string, description: string, status: any, deadline: number, budget: number, ms: [string, number, string, string[]][]) =>
    prisma.project.create({
      data: {
        prospectId, name, description, status, deadline: day(deadline), startDate: day(-45), budget,
        milestones: { create: ms.map(([n, due, st, tasks], i) => ({ name: n, dueAt: day(due), status: st as any, order: i, tasks: { create: tasks.map((t, j) => ({ title: t, order: j, done: st === "DONE" })) } })) },
      },
    });
  const p1 = await proj(dubois.id, "Site e-commerce Dubois", "Boutique en ligne de menuiserie sur mesure.", "IN_PROGRESS", 12, 7800, [
    ["Maquettes validées", -14, "DONE", ["Wireframes", "Charte graphique"]],
    ["Catalogue produits", -3, "IN_PROGRESS", ["Import des 40 fiches", "Filtres & recherche"]],
    ["Paiement en ligne", 6, "PENDING", ["Intégration Stripe", "Emails de commande"]],
    ["Mise en production", 12, "PENDING", ["Recette", "Mise en ligne"]],
  ]);
  await proj(garnier.id, "Portail RH Garnier", "Espace candidats et tableau de bord recruteur.", "REVIEW", 4, 9500, [
    ["Espace candidats", -20, "DONE", ["Inscription", "Dépôt de CV"]],
    ["Tableau de bord recruteur", -6, "DONE", ["KPIs", "Export"]],
    ["Recette client", 4, "IN_PROGRESS", ["Recette fonctionnelle"]],
  ]);
  await proj(roux.id, "Refonte vitrine Roux", "Site vitrine + commande en ligne.", "BRIEF", 30, 3200, [
    ["Cadrage & arborescence", 5, "PENDING", ["Atelier de cadrage"]],
    ["Maquettes", 15, "PENDING", ["Maquettes desktop", "Maquettes mobile"]],
  ]);
  await prisma.delivery.create({ data: { projectId: p1.id, title: "Maquettes v1", description: "Maquettes Figma livrées", deliveredAt: day(-14), clientOk: true, feedback: "Très bien, on valide." } });
  await prisma.clientNote.create({ data: { projectId: p1.id, type: "MEETING", content: "Dubois enverra les 40 fiches produits restantes." } });

  await prisma.expense.createMany({
    data: [
      { label: "Vercel Pro", vendor: "Vercel", amount: 20, category: "INFRA", type: "SUBSCRIPTION", billingCycle: "MONTHLY", renewsAt: day(11) },
      { label: "Supabase", vendor: "Supabase", amount: 25, category: "INFRA", type: "SUBSCRIPTION", billingCycle: "MONTHLY", renewsAt: day(17) },
      { label: "Claude API", vendor: "Anthropic", amount: 38, category: "TOOLS", type: "SUBSCRIPTION", billingCycle: "MONTHLY", renewsAt: day(26) },
      { label: "VM Azure (n8n)", vendor: "Microsoft", amount: 62, category: "INFRA", type: "SUBSCRIPTION", billingCycle: "MONTHLY", renewsAt: day(3) },
      { label: "Nom de domaine deepshift.fr", vendor: "OVH", amount: 14, category: "OTHER", type: "ONE_TIME", date: day(-60) },
    ],
  });
  console.log("Seed démo OK.");
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
