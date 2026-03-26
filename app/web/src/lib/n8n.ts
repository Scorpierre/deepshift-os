type ProspectPayload = {
  id: string;
  name: string;
  company: string | null;
  websiteUrl: string | null;
  linkedinUrl: string | null;
  needType: string[];
  source: string | null;
};

/**
 * Envoie un webhook à n8n pour déclencher l'analyse d'un prospect.
 * Fire-and-forget : ne bloque pas la réponse API.
 */
export function triggerN8nAnalysis(prospect: ProspectPayload) {
  const webhookUrl = process.env.N8N_WEBHOOK_PROSPECT_ANALYSIS;
  if (!webhookUrl) return; // pas configuré → on ignore silencieusement

  fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      prospectId: prospect.id,
      name: prospect.name,
      company: prospect.company,
      url: prospect.websiteUrl ?? prospect.linkedinUrl,
      needType: prospect.needType,
      source: prospect.source,
    }),
  }).catch(() => {
    // webhook en échec → on ne plante pas l'app
  });
}
