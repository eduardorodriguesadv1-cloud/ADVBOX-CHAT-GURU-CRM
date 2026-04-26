export function identifyCampaign(firstMessage: string): string {
  const msg = firstMessage.toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, ""); // remove acentos para comparar

  if (msg.includes("laudo do sus") && msg.includes("pe")) return "LAUDO_SUS_PE";
  if (msg.includes("auxilio doenca") || msg.includes("auxílio doença") || msg.includes("auxilio-doenca")) return "AUX_DOENCA";
  if (msg.includes("auxilio-acidente") || msg.includes("auxílio-acidente") || msg.includes("auxilio acidente")) return "AUX_ACIDENTE";
  if (msg.includes("passei pela pericia") || msg.includes("passei pela perícia") || msg.includes("negaram")) return "PERICIA_NEGADA";
  if (msg.includes("tenho interesse") && (msg.includes("mais informacoes") || msg.includes("mais informações"))) return "LAUDO_SUS_GERAL";

  return "INDEFINIDA";
}
