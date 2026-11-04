import { eur, expenses, events, fmtDate, inbox, invoices, projects, prospects, quotes } from "./data";

export type DemoAgentName = "sales" | "project_manager" | "financial" | "secretary";
type DemoAgent = { label: string; keywords: RegExp; answer: (q: string) => string };

const L = (lines: string[]) => lines.join("\n");

export const DEMO_AGENTS: Record<DemoAgentName, DemoAgent> = {
  sales: {
    label: "Sales",
    keywords: /prospect|pipeline|crm|relanc|lead|devis envoy|vente|commercial|score|négo|nego/i,
    answer: () => {
      const hot = prospects.filter((p) => ["NEGOTIATION", "PROPOSAL_SENT", "QUALIFIED"].includes(p.status));
      const pipeline = hot.reduce((s, p) => s + p.budget, 0);
      const stale = prospects.filter((p) => p.lastContact && Date.now() - p.lastContact.getTime() > 7 * 86400000 && p.status !== "WON");
      return L([
        `Pipeline actif : ${hot.length} opportunités pour ${eur(pipeline)}`,
        ...hot.map((p) => `• ${p.company} (${p.name}) — ${p.status}, score ${p.score}/10, ${eur(p.budget)}. Prochaine action : ${p.next}`),
        stale.length ? `À relancer : ${stale.map((p) => p.company).join(", ")} (sans contact depuis plus de 7 jours).` : "",
        `1 nouveau lead à contacter : Studio Pilates Inès.`,
      ].filter(Boolean));
    },
  },
  project_manager: {
    label: "Project Manager",
    keywords: /projet|jalon|livraison|deadline|retard|tâche|tache|avancement|production/i,
    answer: () => L([
      `${projects.length} projets actifs.`,
      ...projects.map((p) => {
        const late = p.milestones.filter((m) => !m.done && m.due < new Date());
        return `• ${p.name} (${p.client}) — ${p.status}, ${p.progress}%, deadline ${fmtDate(p.deadline)}` +
          (late.length ? ` ⚠ jalon en retard : « ${late[0].name} » (prévu ${fmtDate(late[0].due)})` : "");
      }),
      `Priorité : recette du portail Garnier dans 4 jours, et le catalogue produits Dubois est en retard (attente des 40 fiches client).`,
    ]),
  },
  financial: {
    label: "Financial",
    keywords: /factur|ca\b|chiffre|argent|paiement|impay|trésor|tresor|charge|abonnement|finance|encaiss|devis/i,
    answer: () => {
      const paid = invoices.filter((i) => i.status === "PAID").reduce((s, i) => s + i.total, 0);
      const pending = invoices.filter((i) => i.status === "PENDING").reduce((s, i) => s + i.total, 0);
      const overdue = invoices.filter((i) => i.status === "OVERDUE");
      const open = quotes.filter((q) => q.status === "SENT").reduce((s, q) => s + q.total, 0);
      const monthly = expenses.reduce((s, e) => s + e.amount, 0);
      return L([
        `CA encaissé ce mois : ${eur(paid)} · en attente : ${eur(pending)} · en retard : ${eur(overdue.reduce((s, i) => s + i.total, 0))}`,
        ...overdue.map((i) => `⚠ ${i.number} — ${i.client} — ${eur(i.total)}, échue le ${fmtDate(i.dueAt)} (relance conseillée).`),
        `Devis en attente de réponse : ${eur(open)} sur ${quotes.filter((q) => q.status === "SENT").length} devis.`,
        `Charges récurrentes : ${eur(monthly)}/mois — prochain renouvellement : ${expenses.slice().sort((a, b) => +a.renews - +b.renews)[0].label} le ${fmtDate(expenses.slice().sort((a, b) => +a.renews - +b.renews)[0].renews)}`,
      ]);
    },
  },
  secretary: {
    label: "Secrétaire",
    keywords: /agenda|rdv|rendez|calendrier|semaine|demain|email|mail|répond|repond|brouillon|boîte|boite|réunion|reunion/i,
    answer: (q) => {
      const base = [
        `Agenda des prochains jours :`,
        ...events.map((e) => `• ${fmtDate(e.when)} ${e.time} — ${e.title}`),
        `Emails à traiter (${inbox.length}) :`,
        ...inbox.map((m) => `• ${m.from} (${m.company}) il y a ${m.ago} — « ${m.subject} » : ${m.excerpt}`),
      ];
      if (/brouillon|répond|repond/i.test(q)) {
        base.push(
          "",
          "Brouillon proposé (non envoyé) :",
          "À : Julien Marchand — Objet : Re: Devis CRM",
          "Bonjour Julien, avec plaisir pour une démo jeudi. Je vous propose 11h00–12h00, je vous envoie une invitation. Bien cordialement, Pierre",
        );
      }
      return L(base);
    },
  },
};
