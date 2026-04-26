/**
 * Normaliza string para comparação:
 * - lowercase
 * - remove acentos (NFD + strip combining marks)
 * - colapsa múltiplos espaços
 */
function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // remove diacríticos
    .replace(/\s+/g, " ")
    .trim();
}

const RULES: Array<{ campaign: string; test: (msg: string) => boolean }> = [
  // ── LAUDO SUS PE ──────────────────────────────────────────────────────
  // "laudo do SUS aqui em PE" / "laudo sus pernambuco" / "laudo sus pe"
  {
    campaign: "LAUDO_SUS_PE",
    test: (msg) =>
      msg.includes("laudo") &&
      msg.includes("sus") &&
      (msg.includes(" pe") ||
        msg.includes("em pe") ||
        msg.includes("aqui pe") ||
        msg.includes("pernambuco")),
  },

  // ── AUXÍLIO DOENÇA ────────────────────────────────────────────────────
  // "auxílio doença" / "auxilio-doença" / "auxilio doenca" / "auxilio-doenca"
  {
    campaign: "AUX_DOENCA",
    test: (msg) =>
      msg.includes("auxilio doenca") ||
      msg.includes("auxilio-doenca") ||
      (msg.includes("auxilio") && msg.includes("doenca")),
  },

  // ── AUXÍLIO ACIDENTE ──────────────────────────────────────────────────
  // "auxílio-acidente" / "auxilio acidente" / "auxilio-acidente"
  {
    campaign: "AUX_ACIDENTE",
    test: (msg) =>
      msg.includes("auxilio acidente") ||
      msg.includes("auxilio-acidente") ||
      (msg.includes("auxilio") && msg.includes("acidente")),
  },

  // ── PERÍCIA NEGADA ────────────────────────────────────────────────────
  // "passei pela perícia" / "negaram meu benefício" / "pericia negada"
  {
    campaign: "PERICIA_NEGADA",
    test: (msg) =>
      msg.includes("passei pela pericia") ||
      msg.includes("negaram meu beneficio") ||
      msg.includes("negaram meu benefício".normalize("NFD").replace(/[\u0300-\u036f]/g, "")) ||
      msg.includes("negaram o beneficio") ||
      msg.includes("pericia negada") ||
      msg.includes("pericia foi negada") ||
      msg.includes("beneficio negado") ||
      msg.includes("negaram") ||
      msg.includes("pericia"),
  },

  // ── LAUDO SUS GERAL ───────────────────────────────────────────────────
  // "tenho interesse e queria mais informações" / "tenho interesse" / "mais informacoes"
  {
    campaign: "LAUDO_SUS_GERAL",
    test: (msg) =>
      (msg.includes("tenho interesse") && msg.includes("informac")) ||
      (msg.includes("tenho interesse") && msg.includes("laudo")) ||
      (msg.includes("mais informacoes") && msg.includes("laudo")) ||
      (msg.includes("mais informacoes") && msg.includes("sus")) ||
      msg.includes("laudo sus"),
  },
];

export function identifyCampaign(firstMessage: string | null | undefined): string {
  if (!firstMessage) return "INDEFINIDA";
  const msg = norm(firstMessage);
  for (const rule of RULES) {
    if (rule.test(msg)) return rule.campaign;
  }
  return "INDEFINIDA";
}
