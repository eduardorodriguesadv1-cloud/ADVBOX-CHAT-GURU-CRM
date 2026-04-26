import { Router, Request, Response } from "express";
import { db, conversationsTable, webhookEventsTable, whatsappNumbersTable, agentsTable } from "@workspace/db";
import { eq, desc, count, and, or, isNull, sql, gte, asc } from "drizzle-orm";
import {
  ChatguruWebhookBody,
  ListConversationsQueryParams,
  CheckChatStatusBody,
} from "@workspace/api-zod";
import { logger } from "../lib/logger";
import { identifyCampaign } from "../lib/campaign";

const router = Router();

const CHATGURU_API = "https://app.zap.guru/api/v1";
const API_KEY = process.env.CHATGURU_API_KEY!;
const ACCOUNT_ID = process.env.CHATGURU_ACCOUNT_ID!;
const PHONE_ID = process.env.CHATGURU_PHONE_ID!;

function mapStatus(raw: string | undefined | null): string {
  if (!raw) return "open";
  const s = raw.toLowerCase().trim();
  if (s === "aberto" || s === "open") return "open";
  if (s === "em atendimento" || s === "in_progress" || s === "atendimento") return "in_progress";
  if (s === "aguardando" || s === "waiting") return "waiting";
  if (s === "resolvido" || s === "resolved") return "resolved";
  if (s === "fechado" || s === "closed") return "closed";
  return "open";
}

/**
 * Round-robin: retorna o agente ativo do time especificado com MENOR
 * quantidade de leads já atribuídos. Em empate, usa o de menor ID (criado primeiro).
 */
async function pickRoundRobinAgent(team: string): Promise<{ id: number; name: string } | null> {
  // Busca agentes ativos do time
  const agents = await db.select({ id: agentsTable.id, name: agentsTable.name })
    .from(agentsTable)
    .where(and(eq(agentsTable.team, team), eq(agentsTable.active, true)))
    .orderBy(asc(agentsTable.id));

  if (agents.length === 0) return null;

  // Conta leads atuais de cada agente
  const counts = await db.select({
    agentId: conversationsTable.agentId,
    total: count(),
  }).from(conversationsTable)
    .where(sql`${conversationsTable.agentId} = ANY(ARRAY[${sql.join(agents.map(a => sql`${a.id}`), sql`, `)}]::integer[])`)
    .groupBy(conversationsTable.agentId);

  const countMap = new Map(counts.map(c => [c.agentId, Number(c.total)]));

  // Escolhe o agente com menor contagem; empate → menor id
  let best = agents[0];
  let bestCount = countMap.get(best.id) ?? 0;
  for (const agent of agents.slice(1)) {
    const c = countMap.get(agent.id) ?? 0;
    if (c < bestCount) { best = agent; bestCount = c; }
  }

  return best;
}

router.post("/webhook", async (req: Request, res: Response) => {
  try {
    const raw = req.body ?? {};
    req.log.info({ raw }, "Webhook received");

    await db.insert(webhookEventsTable).values({
      chatNumber: raw.chat_number ?? null,
      rawPayload: JSON.stringify(raw),
    });

    const chatNumber = raw.chat_number ?? raw.celular ?? raw.chat_id ?? null;
    const contactName = raw.name ?? raw.nome ?? null;
    const agentName = raw.agent ?? raw.responsavel_nome ?? null;
    const lastMsg = raw.message ?? raw.texto_mensagem ?? null;
    const rawStatus = raw.status ?? null;

    if (!chatNumber) {
      res.json({ ok: true });
      return;
    }

    const status = mapStatus(rawStatus);

    // Extrair contextData (campos não-mapeados)
    const knownFields = new Set([
      "chat_number", "name", "status", "agent", "message", "phone_id", "account_id", "key",
      "celular", "nome", "responsavel_nome", "texto_mensagem", "email",
      "responsavel_email", "chat_id", "tipo_mensagem", "executado_por",
    ]);
    const contextData: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(raw)) {
      if (!knownFields.has(k) && v !== null && v !== undefined && v !== "" &&
        !(Array.isArray(v) && v.length === 0) &&
        !(typeof v === "object" && v !== null && Object.keys(v as object).length === 0)) {
        contextData[k] = v;
      }
    }
    const hasContext = Object.keys(contextData).length > 0;

    // Identificar número de WhatsApp de destino (origem do lead)
    const rawPhoneId = raw.phone_id ?? raw.celular_destino ?? null;
    let whatsappNumberId: number | null = null;
    let whatsappTeam: string | null = null;
    if (rawPhoneId) {
      const phoneClean = String(rawPhoneId).replace(/\D/g, "");
      const numRow = await db.select().from(whatsappNumbersTable)
        .where(eq(whatsappNumbersTable.number, phoneClean)).limit(1);
      if (numRow.length > 0) {
        whatsappNumberId = numRow[0].id;
        whatsappTeam = (numRow[0] as any).team ?? null;
      }
    }

    // Identificar agente pelo nome vindo do webhook (para updates)
    let agentId: number | null = null;
    if (agentName) {
      const agentRow = await db.select().from(agentsTable)
        .where(eq(agentsTable.name, agentName)).limit(1);
      if (agentRow.length > 0) agentId = agentRow[0].id;
    }

    const existing = await db.select()
      .from(conversationsTable)
      .where(eq(conversationsTable.chatNumber, String(chatNumber)))
      .limit(1);

    if (existing.length > 0) {
      // UPDATE: preserva o agentId atribuído internamente; só sobrescreve se webhook trouxer agente válido
      const existingAgentId = existing[0].agentId;
      const finalAgentId = agentId ?? existingAgentId;
      const finalAgentName = agentId
        ? agentName
        : existing[0].assignedAgent;

      const prevContext = (existing[0].contextData as Record<string, unknown>) ?? {};
      await db.update(conversationsTable).set({
        contactName: contactName ?? existing[0].contactName,
        status,
        assignedAgent: finalAgentName ?? existing[0].assignedAgent,
        agentId: finalAgentId,
        lastMessage: lastMsg ?? existing[0].lastMessage,
        lastMessageAt: new Date(),
        whatsappNumberId: whatsappNumberId ?? existing[0].whatsappNumberId,
        contextData: hasContext ? { ...prevContext, ...contextData } : existing[0].contextData,
        updatedAt: new Date(),
      }).where(eq(conversationsTable.chatNumber, String(chatNumber)));

    } else {
      // INSERT: lead novo
      const firstMsg = lastMsg ?? null;
      const campaign = identifyCampaign(firstMsg);

      // Round-robin automático para número Comercial (COMERCIAL_TRAFEGO)
      // Se o webhook não trouxer agente válido, distribuímos automaticamente
      let finalAgentId: number | null = agentId;
      let finalAgentName: string | null = agentName;

      if (!finalAgentId) {
        // Comercial → COMERCIAL_TRAFEGO; qualquer outro → sem atribuição automática
        const team = "COMERCIAL_TRAFEGO"; // sempre tentar round-robin para tráfego pago
        const picked = await pickRoundRobinAgent(team);
        if (picked) {
          finalAgentId = picked.id;
          finalAgentName = picked.name;
        }
      }

      await db.insert(conversationsTable).values({
        chatNumber: String(chatNumber),
        contactName: contactName ?? null,
        status,
        assignedAgent: finalAgentName ?? null,
        agentId: finalAgentId,
        lastMessage: firstMsg,
        lastMessageAt: new Date(),
        contextData: hasContext ? contextData : null,
        whatsappNumberId,
        firstMessage: firstMsg,
        campaign,
      });

      req.log.info({ chatNumber, campaign, agentId: finalAgentId, agentName: finalAgentName }, "New lead created");
    }

    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "Error processing webhook");
    res.json({ ok: false });
  }
});

// ─── MIGRATE: reclassificar campanhas retroativamente ────────────────────────
router.post("/migrate/campaigns", async (req: Request, res: Response) => {
  try {
    const leads = await db.select({
      id: conversationsTable.id,
      firstMessage: conversationsTable.firstMessage,
      campaign: conversationsTable.campaign,
    }).from(conversationsTable)
      .where(or(
        isNull(conversationsTable.campaign),
        eq(conversationsTable.campaign, "INDEFINIDA"),
      ));

    let updated = 0;
    let reclassified = 0;

    for (const lead of leads) {
      const newCampaign = identifyCampaign(lead.firstMessage);
      await db.update(conversationsTable)
        .set({ campaign: newCampaign, updatedAt: new Date() })
        .where(eq(conversationsTable.id, lead.id));
      updated++;
      if (newCampaign !== "INDEFINIDA") reclassified++;
    }

    // Também reclassificar leads que já têm campanha (por precaução)
    if (req.body?.force) {
      const allLeads = await db.select({
        id: conversationsTable.id,
        firstMessage: conversationsTable.firstMessage,
      }).from(conversationsTable);

      updated = 0; reclassified = 0;
      for (const lead of allLeads) {
        const newCampaign = identifyCampaign(lead.firstMessage);
        await db.update(conversationsTable)
          .set({ campaign: newCampaign, updatedAt: new Date() })
          .where(eq(conversationsTable.id, lead.id));
        updated++;
        if (newCampaign !== "INDEFINIDA") reclassified++;
      }
    }

    res.json({ ok: true, updated, reclassified });
  } catch (err) {
    req.log.error({ err }, "Campaign migration failed");
    res.status(500).json({ ok: false, error: String(err) });
  }
});

// ─── MIGRATE: redistribuir agentes em round-robin ────────────────────────────
router.post("/migrate/agents", async (req: Request, res: Response) => {
  try {
    // Busca agentes COMERCIAL_TRAFEGO ativos por ordem de criação
    const comercialAgents = await db.select({ id: agentsTable.id, name: agentsTable.name })
      .from(agentsTable)
      .where(and(eq(agentsTable.team, "COMERCIAL_TRAFEGO"), eq(agentsTable.active, true)))
      .orderBy(asc(agentsTable.id));

    if (comercialAgents.length === 0) {
      res.json({ ok: false, error: "Nenhum agente COMERCIAL_TRAFEGO ativo" });
      return;
    }

    // Pega todos os leads sem agente atribuído OU todos (se force=true)
    const leadsQuery = req.body?.force
      ? db.select({ id: conversationsTable.id }).from(conversationsTable).orderBy(asc(conversationsTable.id))
      : db.select({ id: conversationsTable.id }).from(conversationsTable)
          .where(isNull(conversationsTable.agentId))
          .orderBy(asc(conversationsTable.id));

    const leads = await leadsQuery;
    let updated = 0;

    for (let i = 0; i < leads.length; i++) {
      const agent = comercialAgents[i % comercialAgents.length];
      await db.update(conversationsTable)
        .set({ agentId: agent.id, assignedAgent: agent.name, updatedAt: new Date() })
        .where(eq(conversationsTable.id, leads[i].id));
      updated++;
    }

    res.json({ ok: true, updated, agents: comercialAgents.map(a => a.name) });
  } catch (err) {
    req.log.error({ err }, "Agent migration failed");
    res.status(500).json({ ok: false, error: String(err) });
  }
});

router.get("/conversations", async (req: Request, res: Response) => {
  const parsed = ListConversationsQueryParams.safeParse(req.query);
  const { status, search, limit = 50, offset = 0 } = parsed.success ? parsed.data : { status: undefined, search: undefined, limit: 50, offset: 0 };

  const conditions = [];
  if (status) conditions.push(eq(conversationsTable.status, status));
  if (search) {
    conditions.push(
      sql`(${conversationsTable.chatNumber} ILIKE ${"%" + search + "%"} OR ${conversationsTable.contactName} ILIKE ${"%" + search + "%"})`
    );
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [conversations, [{ total }]] = await Promise.all([
    db.select().from(conversationsTable)
      .where(where)
      .orderBy(desc(conversationsTable.updatedAt))
      .limit(Number(limit))
      .offset(Number(offset)),
    db.select({ total: count() }).from(conversationsTable).where(where),
  ]);

  res.json({ conversations, total: Number(total) });
});

router.get("/stats", async (req: Request, res: Response) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [statusCounts, [{ todayTotal }], recentActivity] = await Promise.all([
    db.select({ status: conversationsTable.status, count: count() })
      .from(conversationsTable).groupBy(conversationsTable.status),
    db.select({ todayTotal: count() })
      .from(conversationsTable).where(gte(conversationsTable.createdAt, today)),
    db.select().from(conversationsTable)
      .orderBy(desc(conversationsTable.updatedAt)).limit(10),
  ]);

  const stats = { total: 0, open: 0, inProgress: 0, waiting: 0, resolved: 0, closed: 0, todayTotal: Number(todayTotal), recentActivity };
  for (const row of statusCounts) {
    const n = Number(row.count);
    stats.total += n;
    if (row.status === "open") stats.open = n;
    else if (row.status === "in_progress") stats.inProgress = n;
    else if (row.status === "waiting") stats.waiting = n;
    else if (row.status === "resolved") stats.resolved = n;
    else if (row.status === "closed") stats.closed = n;
  }

  res.json(stats);
});

router.delete("/conversations/:id", async (req: Request, res: Response) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ ok: false, message: "ID inválido" }); return; }
  try {
    await db.delete(conversationsTable).where(eq(conversationsTable.id, id));
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "Error deleting conversation");
    res.status(500).json({ ok: false });
  }
});

router.post("/check-status", async (req: Request, res: Response) => {
  const parsed = CheckChatStatusBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ chatNumber: "", found: false, raw: {} }); return; }
  const { chatNumber } = parsed.data;
  try {
    const params = new URLSearchParams({
      key: API_KEY, account_id: ACCOUNT_ID, phone_id: PHONE_ID,
      action: "chat_status", chat_number: chatNumber,
    });
    const response = await fetch(`${CHATGURU_API}?${params}`, { method: "POST" });
    const raw = (await response.json()) as Record<string, unknown>;
    req.log.info({ chatNumber, raw }, "ChatGuru check-status response");
    const found = raw.result === "success" || raw.code === 200 || raw.code === 201;
    const status = typeof raw.status === "string" ? mapStatus(raw.status) : undefined;
    if (found && status) {
      const existing = await db.select().from(conversationsTable)
        .where(eq(conversationsTable.chatNumber, chatNumber)).limit(1);
      if (existing.length > 0) {
        await db.update(conversationsTable).set({ status, updatedAt: new Date() })
          .where(eq(conversationsTable.chatNumber, chatNumber));
      } else {
        await db.insert(conversationsTable).values({ chatNumber, status, lastMessageAt: new Date() });
      }
    }
    res.json({ chatNumber, found, status, raw });
  } catch (err) {
    req.log.error({ err }, "Error checking chat status");
    res.status(500).json({ chatNumber, found: false });
  }
});

router.post("/send-message", async (req: Request, res: Response) => {
  const { chatNumber, message } = req.body ?? {};
  if (!chatNumber || !message) { res.status(400).json({ ok: false, error: "chatNumber e message são obrigatórios" }); return; }
  try {
    const sendDate = new Date(Date.now() + 60 * 1000);
    const pad = (n: number) => String(n).padStart(2, "0");
    const sendDateStr = `${sendDate.getFullYear()}-${pad(sendDate.getMonth() + 1)}-${pad(sendDate.getDate())} ${pad(sendDate.getHours())}:${pad(sendDate.getMinutes())}`;
    const params = new URLSearchParams({
      key: API_KEY, account_id: ACCOUNT_ID, phone_id: PHONE_ID,
      action: "message_send", chat_number: chatNumber, text: message, send_date: sendDateStr,
    });
    req.log.info({ chatNumber, sendDateStr }, "Sending message via ChatGuru API");
    const response = await fetch(`${CHATGURU_API}?${params}`, { method: "POST" });
    const raw = (await response.json()) as Record<string, unknown>;
    const ok = raw.result === "success" || raw.code === 201 || raw.code === 200;
    res.json({ ok, messageId: raw.message_id ?? null, status: raw.message_status ?? null, error: ok ? undefined : (raw.description ?? "Erro desconhecido") });
  } catch (err) {
    req.log.error({ err }, "Error sending message via ChatGuru");
    res.status(500).json({ ok: false, error: "Erro ao enviar mensagem" });
  }
});

router.get("/webhook-url", (req: Request, res: Response) => {
  const domains = process.env.REPLIT_DOMAINS?.split(",")[0] ?? "seu-dominio.replit.app";
  const url = `https://${domains}/api/chatguru/webhook`;
  res.json({ url, instructions: "Configure este URL no ChatGuru em: Chatbot → Ação de CRM → POST Webhook." });
});

export default router;
