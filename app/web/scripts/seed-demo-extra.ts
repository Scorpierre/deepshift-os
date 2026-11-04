import "dotenv/config";
import { prisma } from "../src/lib/prisma";

if (!/@(localhost|127\.0\.0\.1)[:/]/.test(process.env.DATABASE_URL ?? "")) {
  console.error("Refus : DATABASE_URL n'est pas locale. Seed démo uniquement en local.");
  process.exit(1);
}

const day = (n: number) => new Date(Date.now() + n * 86400000);

type Ms = [name: string, due: number, status: "PENDING" | "IN_PROGRESS" | "DONE", tasks: [string, boolean?][]];

async function client(
  name: string, company: string, email: string, status: any, score: number, budget: number,
  need: string[], desc: string, extra: any = {},
) {
  const existing = await prisma.prospect.findUnique({ where: { email } });
  if (existing) return null;
  return prisma.prospect.create({
    data: {
      name, company, email, status, score, estimatedBudget: budget, needType: need, source: "referral",
      companyDescription: desc, aiSummary: `${company} : ${desc}`,
      aiScoreReason: "Besoin clair, budget validé, interlocuteur décisionnaire.",
      aiTags: need, ...extra,
    },
  });
}

async function project(prospectId: string, name: string, description: string, status: any, start: number, deadline: number, budget: number, ms: Ms[]) {
  return prisma.project.create({
    data: {
      prospectId, name, description, status, startDate: day(start), deadline: day(deadline), budget,
      milestones: {
        create: ms.map(([n, due, st, tasks], i) => ({
          name: n, dueAt: day(due), status: st, order: i,
          tasks: { create: tasks.map(([title, done], j) => ({ title, order: j, done: done ?? st === "DONE" })) },
        })),
      },
    },
  });
}

async function main() {
  const lemaire = await client("Hélène Lemaire", "Cabinet Lemaire Architectes", "helene@lemaire-archi.fr", "WON", 9, 14500, ["webapp", "api"],
    "agence d'architecture de 12 personnes, suivi de chantiers papier + Excel.", { lastContactedAt: day(-3), phone: "06 12 45 78 90" });
  const vasseur = await client("Antoine Vasseur", "Vasseur Logistique", "antoine@vasseur-logistique.fr", "WON", 8, 18900, ["webapp", "api"],
    "transporteur régional, 30 camions, planning géré sur tableur.", { lastContactedAt: day(-1) });
  const noor = await client("Noor Haddad", "Maison Noor Traiteur", "noor@maisonnoor.fr", "WON", 7, 5400, ["site"],
    "traiteur événementiel, besoin d'un site avec demande de devis en ligne.", { lastContactedAt: day(-40) });
  const petit = await client("Baptiste Petit", "Petit Cycles", "baptiste@petitcycles.fr", "WON", 8, 8200, ["webapp"],
    "magasin de vélos avec atelier de réparation, veut un suivi des réparations pour ses clients.", { lastContactedAt: day(-10) });
  const girard = await client("Élodie Girard", "Girard Formation", "elodie@girard-formation.fr", "PROPOSAL_SENT", 8, 11000, ["webapp"],
    "organisme de formation, besoin d'une plateforme d'émargement et de suivi des stagiaires.",
    { lastContactedAt: day(-4), nextActionAt: day(2), nextActionNote: "Relancer sur le devis plateforme émargement" });
  const morel = await client("Paul Morel", "Morel & Associés Expertise", "paul@morel-expertise.fr", "QUALIFIED", 7, 7500, ["webapp", "consulting"],
    "cabinet d'expertise comptable, portail client pour dépôt de pièces.", { lastContactedAt: day(-2) });

  if (lemaire) {
    const p = await project(lemaire.id, "Suivi de chantiers Lemaire", "Application web de suivi de chantiers : planning, comptes rendus de réunion et photos terrain.", "IN_PROGRESS", -60, 25, 14500, [
      ["Cadrage & maquettes", -45, "DONE", [["Ateliers avec les chefs de projet"], ["Maquettes validées"]]],
      ["Fiches chantier", -20, "DONE", [["Création / édition de chantier"], ["Upload de photos"]]],
      ["Comptes rendus de réunion", 5, "IN_PROGRESS", [["Modèle de compte rendu", true], ["Export PDF"], ["Envoi par email aux intervenants"]]],
      ["Mise en production", 25, "PENDING", [["Formation de l'équipe"], ["Migration des chantiers en cours"]]],
    ]);
    await prisma.delivery.createMany({ data: [
      { projectId: p.id, title: "Maquettes interactives", description: "Prototype Figma des écrans principaux.", deliveredAt: day(-45), clientOk: true, feedback: "Parfait, très proche de notre usage." },
      { projectId: p.id, title: "Fiches chantier (recette)", description: "Version de test en ligne.", deliveredAt: day(-18), clientOk: false, feedback: "Ajouter un champ « maître d'ouvrage » et trier par date de début." },
    ] });
    await prisma.clientNote.createMany({ data: [
      { projectId: p.id, type: "MEETING", content: "Point d'avancement : l'équipe terrain préfère utiliser l'app sur tablette. Priorité au responsive." },
      { projectId: p.id, type: "DECISION", content: "Validé : export PDF des comptes rendus inclus dans le périmètre, signature électronique en phase 2." },
    ] });
    await prisma.quote.create({ data: { prospectId: lemaire.id, number: "DEVIS-2026-031", title: "Suivi de chantiers", totalHT: 14500, status: "ACCEPTED", sentAt: day(-70), validUntil: day(-40),
      lines: [{ description: "Cadrage & maquettes", qty: 1, unitPrice: 2500, total: 2500 }, { description: "Développement application", qty: 1, unitPrice: 12000, total: 12000 }] } });
    await prisma.invoice.createMany({ data: [
      { prospectId: lemaire.id, number: "FAC-2026-021", title: "Acompte 30% Suivi de chantiers", totalHT: 4350, status: "PAID", issuedAt: day(-58), dueAt: day(-28), paidAt: day(-30), lines: [{ description: "Acompte 30%", qty: 1, unitPrice: 4350, total: 4350 }] },
      { prospectId: lemaire.id, number: "FAC-2026-024", title: "Jalon 2 Suivi de chantiers", totalHT: 5800, status: "PENDING", issuedAt: day(-6), dueAt: day(24), lines: [{ description: "Jalon 2", qty: 1, unitPrice: 5800, total: 5800 }] },
    ] });
    await prisma.note.create({ data: { prospectId: lemaire.id, content: "Hélène est ravie du rythme. Parle déjà d'un module de gestion des devis pour la suite.", source: "manual" } });
  }

  if (vasseur) {
    const p = await project(vasseur.id, "Planning flotte Vasseur", "Outil de planification des tournées et affectation chauffeurs / véhicules, avec API vers leur TMS.", "REVIEW", -90, 10, 18900, [
      ["Modèle de données & import", -75, "DONE", [["Import du parc de camions"], ["Import des chauffeurs"]]],
      ["Planning drag & drop", -40, "DONE", [["Vue semaine"], ["Détection des conflits"]]],
      ["Connecteur TMS", -10, "DONE", [["Lecture des commandes"], ["Retour des statuts"]]],
      ["Recette & formation", 10, "IN_PROGRESS", [["Jeu de test sur 2 semaines réelles", true], ["Session de formation des dispatchers"]]],
    ]);
    await prisma.delivery.create({ data: { projectId: p.id, title: "Planning drag & drop", description: "Version utilisable en conditions réelles.", deliveredAt: day(-38), clientOk: true, feedback: "Les dispatchers adorent, gain de temps énorme." } });
    await prisma.clientNote.create({ data: { projectId: p.id, type: "FEEDBACK", content: "Demande : alerte quand un chauffeur dépasse 9h de conduite sur la semaine." } });
    await prisma.invoice.createMany({ data: [
      { prospectId: vasseur.id, number: "FAC-2026-018", title: "Acompte 40% Planning flotte", totalHT: 7560, status: "PAID", issuedAt: day(-88), dueAt: day(-58), paidAt: day(-60), lines: [{ description: "Acompte 40%", qty: 1, unitPrice: 7560, total: 7560 }] },
      { prospectId: vasseur.id, number: "FAC-2026-025", title: "Jalon 2 Planning flotte", totalHT: 5670, status: "OVERDUE", issuedAt: day(-45), dueAt: day(-15), lines: [{ description: "Jalon 2", qty: 1, unitPrice: 5670, total: 5670 }] },
    ] });
  }

  if (noor) {
    const p = await project(noor.id, "Site Maison Noor", "Site vitrine avec galerie, menus et formulaire de demande de devis.", "MAINTENANCE", -120, -45, 5400, [
      ["Design & intégration", -100, "DONE", [["Maquettes"], ["Intégration responsive"]]],
      ["Formulaire de devis", -70, "DONE", [["Formulaire multi-étapes"], ["Notification par email"]]],
      ["Mise en ligne", -45, "DONE", [["Nom de domaine"], ["Recette finale"]]],
    ]);
    await prisma.delivery.create({ data: { projectId: p.id, title: "Mise en ligne", description: "Site en production sur maisonnoor.fr.", deliveredAt: day(-45), clientOk: true, feedback: "3 demandes de devis dès la première semaine !" } });
    await prisma.clientNote.create({ data: { projectId: p.id, type: "OTHER", content: "Contrat de maintenance 60 €/mois signé, mises à jour de contenu incluses." } });
    await prisma.invoice.create({ data: { prospectId: noor.id, number: "FAC-2026-017", title: "Site Maison Noor — solde", totalHT: 5400, status: "PAID", issuedAt: day(-46), dueAt: day(-16), paidAt: day(-40), lines: [{ description: "Site Maison Noor", qty: 1, unitPrice: 5400, total: 5400 }] } });
  }

  if (petit) {
    const p = await project(petit.id, "Suivi réparations Petit Cycles", "Espace client pour suivre l'état de sa réparation + back-office atelier avec notifications SMS.", "BRIEF", -5, 55, 8200, [
      ["Cadrage atelier", 3, "IN_PROGRESS", [["Visite de l'atelier", true], ["Liste des statuts de réparation"]]],
      ["Back-office atelier", 25, "PENDING", [["Création d'un ordre de réparation"], ["Changement de statut"]]],
      ["Espace client & SMS", 45, "PENDING", [["Page de suivi par QR code"], ["Notifications SMS"]]],
    ]);
    await prisma.clientNote.create({ data: { projectId: p.id, type: "MEETING", content: "Atelier de cadrage : 4 statuts suffisent (reçu, en cours, pièce commandée, prêt)." } });
    await prisma.quote.create({ data: { prospectId: petit.id, number: "DEVIS-2026-034", title: "Suivi des réparations", totalHT: 8200, status: "ACCEPTED", sentAt: day(-14), validUntil: day(16),
      lines: [{ description: "Back-office atelier", qty: 1, unitPrice: 4200, total: 4200 }, { description: "Espace client + SMS", qty: 1, unitPrice: 4000, total: 4000 }] } });
  }

  if (girard) {
    await prisma.quote.create({ data: { prospectId: girard.id, number: "DEVIS-2026-035", title: "Plateforme d'émargement", totalHT: 11000, status: "SENT", sentAt: day(-4), validUntil: day(26),
      lines: [{ description: "Émargement numérique (QR code)", qty: 1, unitPrice: 6000, total: 6000 }, { description: "Suivi des stagiaires & exports Qualiopi", qty: 1, unitPrice: 5000, total: 5000 }] } });
    await prisma.reminder.create({ data: { prospectId: girard.id, dueAt: day(2), note: "Relance devis plateforme émargement", type: "FOLLOW_UP" } });
    await prisma.email.createMany({ data: [
      { prospectId: girard.id, direction: "SENT", subject: "Devis plateforme d'émargement", body: "Bonjour Élodie, voici le devis comme convenu…", sentAt: day(-4) },
      { prospectId: girard.id, direction: "RECEIVED", subject: "Re: Devis plateforme", body: "Merci, je le fais valider par ma direction cette semaine.", sentAt: day(-2), aiIntent: "INTERESTED", aiAnalysis: "Intéressée, validation interne en cours." },
    ] });
  }

  if (morel) {
    await prisma.reminder.create({ data: { prospectId: morel.id, dueAt: day(3), note: "Envoyer le devis portail client", type: "PROPOSAL" } });
    await prisma.note.create({ data: { prospectId: morel.id, content: "Veut remplacer les échanges de pièces par email. 180 clients concernés.", source: "manual" } });
  }

  console.log("Seed démo (extra) OK.");
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
