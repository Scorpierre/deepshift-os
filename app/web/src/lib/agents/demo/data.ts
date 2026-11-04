/** Données fictives de démo — en mémoire, rien n'est écrit en base. Dates relatives à aujourd'hui. */
const day = (n: number) => new Date(Date.now() + n * 86400000);
export const fmtDate = (d: Date) => d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
export const eur = (n: number) => n.toLocaleString("fr-FR", { maximumFractionDigits: 0 }) + " €";

export const prospects = [
  { id: "p1", name: "Camille Roux", company: "Atelier Roux Boulangerie", status: "NEGOTIATION", score: 9, budget: 6500, lastContact: day(-2), next: "Relancer sur le devis e-commerce" },
  { id: "p2", name: "Julien Marchand", company: "Marchand Immobilier", status: "PROPOSAL_SENT", score: 8, budget: 12000, lastContact: day(-5), next: "Relance J+7 devis CRM sur mesure" },
  { id: "p3", name: "Sofia Benali", company: "Clinique Vétérinaire du Parc", status: "QUALIFIED", score: 7, budget: 4200, lastContact: day(-1), next: "Envoyer le devis prise de RDV en ligne" },
  { id: "p4", name: "Thomas Leclerc", company: "Leclerc Paysage", status: "CONTACTED", score: 6, budget: 2800, lastContact: day(-9), next: "Relance sans réponse depuis 9 jours" },
  { id: "p5", name: "Inès Fournier", company: "Studio Pilates Inès", status: "NEW", score: 5, budget: 1800, lastContact: null, next: "Premier email à envoyer" },
  { id: "p6", name: "Marc Dubois", company: "Dubois & Fils Menuiserie", status: "WON", score: 9, budget: 7800, lastContact: day(-20), next: "Client signé" },
  { id: "p7", name: "Léa Garnier", company: "Garnier Conseil RH", status: "WON", score: 8, budget: 9500, lastContact: day(-35), next: "Client signé" },
] as const;

export const projects = [
  { id: "j1", name: "Site e-commerce Dubois", client: "Dubois & Fils Menuiserie", status: "IN_PROGRESS", deadline: day(12), budget: 7800, progress: 65,
    milestones: [{ name: "Maquettes validées", due: day(-14), done: true }, { name: "Catalogue produits", due: day(-3), done: false }, { name: "Paiement en ligne", due: day(6), done: false }, { name: "Mise en production", due: day(12), done: false }] },
  { id: "j2", name: "Portail RH Garnier", client: "Garnier Conseil RH", status: "REVIEW", deadline: day(4), budget: 9500, progress: 90,
    milestones: [{ name: "Espace candidats", due: day(-20), done: true }, { name: "Tableau de bord recruteur", due: day(-6), done: true }, { name: "Recette client", due: day(4), done: false }] },
  { id: "j3", name: "Refonte vitrine Roux", client: "Atelier Roux Boulangerie", status: "BRIEF", deadline: day(30), budget: 3200, progress: 10,
    milestones: [{ name: "Cadrage & arborescence", due: day(5), done: false }, { name: "Maquettes", due: day(15), done: false }] },
] as const;

export const invoices = [
  { number: "FAC-2026-014", client: "Garnier Conseil RH", title: "Acompte 50% Portail RH", total: 4750, status: "PAID", dueAt: day(-25), paidAt: day(-22) },
  { number: "FAC-2026-015", client: "Dubois & Fils Menuiserie", title: "Acompte 40% E-commerce", total: 3120, status: "PAID", dueAt: day(-12), paidAt: day(-10) },
  { number: "FAC-2026-016", client: "Dubois & Fils Menuiserie", title: "Jalon 2 E-commerce", total: 2340, status: "PENDING", dueAt: day(8), paidAt: null },
  { number: "FAC-2026-013", client: "Garnier Conseil RH", title: "Maintenance trimestrielle", total: 900, status: "OVERDUE", dueAt: day(-18), paidAt: null },
] as const;

export const quotes = [
  { number: "DEVIS-2026-021", client: "Marchand Immobilier", title: "CRM sur mesure", total: 12000, status: "SENT", sentAt: day(-5) },
  { number: "DEVIS-2026-022", client: "Atelier Roux Boulangerie", title: "Refonte vitrine + commande en ligne", total: 6500, status: "SENT", sentAt: day(-2) },
  { number: "DEVIS-2026-023", client: "Clinique Vétérinaire du Parc", title: "Prise de RDV en ligne", total: 4200, status: "DRAFT", sentAt: null },
] as const;

export const expenses = [
  { label: "Vercel Pro", amount: 20, renews: day(11) },
  { label: "Supabase", amount: 25, renews: day(17) },
  { label: "Claude API", amount: 38, renews: day(26) },
  { label: "VM Azure (n8n)", amount: 62, renews: day(3) },
] as const;

export const events = [
  { title: "Point de cadrage — Atelier Roux", when: day(1), time: "10:00–11:00" },
  { title: "Recette portail RH — Garnier", when: day(3), time: "14:00–15:30" },
  { title: "Démo devis CRM — Marchand Immobilier", when: day(4), time: "11:00–12:00" },
  { title: "Appel découverte — Studio Pilates Inès", when: day(6), time: "16:00–16:30" },
] as const;

export const inbox = [
  { from: "Julien Marchand", company: "Marchand Immobilier", subject: "Re: Devis CRM", excerpt: "Merci, je regarde avec mon associé. Possible de faire une démo jeudi ?", ago: "3 h" },
  { from: "Marc Dubois", company: "Dubois & Fils Menuiserie", subject: "Catalogue produits", excerpt: "Je vous envoie les 40 fiches produits restantes d'ici demain.", ago: "1 j" },
  { from: "Léa Garnier", company: "Garnier Conseil RH", subject: "Facture maintenance", excerpt: "Désolée pour le retard, le virement part cette semaine.", ago: "2 j" },
] as const;
