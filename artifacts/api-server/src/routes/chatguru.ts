import { Router, Request, Response } from "express";
import { db, conversationsTable, webhookEventsTable } from "@workspace/db";
import { eq, desc, count, and, like, sql, gte } from "drizzle-orm";
import {
  ChatguruWebhookBody,
  ListConversationsQueryParams,
  CheckChatStatusBody,
} from "@workspace/api-zod";
import { logger } from "../lib/logger";

const router = Router();

const CHATGURU_API = "https://app.zap.guru/api/v1";
const API_KEY = process.env.CHATGURU_API_KEY!;
const ACCOUNT_ID = process.env.CHATGURU_ACCOUNT_ID!;
const PHONE_ID = process.env.CHATGURU_PHONE_ID!;

function mapStatus(raw: string | undefined): string {
  if (!raw) return "unknown";
  const s = raw.toLowerCase().trim();
  if (s === "aberto" || s === "open") return "open";
  if (s === "em atendimento" || s === "in_progress" || s === "atendimento") return "in_progress";
  if (s === "aguardando" || s === "waiting") return "waiting";
  if (s === "resolvido" || s === "resolved") return "resolved";
  if (s === "fechado" || s === "closed") return "closed";
  return s;
}

router.post("/webhook", async (req: Request, res: Response) => {
  try {
    const raw = req.body ?? {};
    req.log.info({ raw }, "Webhook received");

    await db.insert(webhookEventsTable).values({
      chatNumber: raw.chat_number ?? null,
      rawPayload: JSON.stringify(raw),
    });

    // Support both English and Portuguese field names sent by ChatGuru
    const chatNumber = raw.chat_number ?? raw.celular ?? raw.chat_id ?? null;
    const contactName = raw.name ?? raw.nome ?? null;
    const agentName = raw.agent ?? raw.responsavel_nome ?? null;
    const lastMsg = raw.message ?? raw.texto_mensagem ?? null;
    const rawStatus = raw.status ?? null;

    if (chatNumber) {
      const status = mapStatus(rawStatus);

      // Extract known fields and store everything else as contextData
      const knownFields = new Set([
        "chat_number", "name", "status", "agent", "message", "phone_id", "account_id", "key",
        "celular", "nome", "responsavel_nome", "texto_mensagem", "email",
        "responsavel_email", "chat_id", "tipo_mensagem", "executado_por"
      ]);
      const contextData: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(raw)) {
        if (!knownFields.has(k) && v !== null && v !== undefined && v !== "" && !(Array.isArray(v) && v.length === 0) && !(typeof v === "object" && v !== null && Object.keys(v as object).length === 0)) {
          contextData[k] = v;
        }
      }
      const hasContext = Object.keys(contextData).length > 0;

      const existing = await db
        .select()
        .from(conversationsTable)
        .where(eq(conversationsTable.chatNumber, String(chatNumber)))
        .limit(1);

      if (existing.length > 0) {
        const prevContext = (existing[0].contextData as Record<string, unknown>) ?? {};
        await db
          .update(conversationsTable)
          .set({
            contactName: contactName ?? existing[0].contactName,
            status,
            assignedAgent: agentName ?? existing[0].assignedAgent,
            lastMessage: lastMsg ?? existing[0].lastMessage,
            lastMessageAt: new Date(),
            contextData: hasContext ? { ...prevContext, ...contextData } : existing[0].contextData,
            updatedAt: new Date(),
          })
          .where(eq(conversationsTable.chatNumber, String(chatNumber)));
      } else {
        await db.insert(conversationsTable).values({
          chatNumber: String(chatNumber),
          contactName: contactName ?? null,
          status,
          assignedAgent: agentName ?? null,
          lastMessage: lastMsg ?? null,
          lastMessageAt: new Date(),
          contextData: hasContext ? contextData : null,
        });
      }
    }

    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "Error processing webhook");
    res.json({ ok: false });
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
    db
      .select()
      .from(conversationsTable)
      .where(where)
      .orderBy(desc(conversationsTable.updatedAt))
      .limit(Number(limit))
      .offset(Number(offset)),
    db
      .select({ total: count() })
      .from(conversationsTable)
      .where(where),
  ]);

  res.json({ conversations, total: Number(total) });
});

router.get("/stats", async (req: Request, res: Response) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [statusCounts, [{ todayTotal }], recentActivity] = await Promise.all([
    db
      .select({ status: conversationsTable.status, count: count() })
      .from(conversationsTable)
      .groupBy(conversationsTable.status),
    db
      .select({ todayTotal: count() })
      .from(conversationsTable)
      .where(gte(conversationsTable.createdAt, today)),
    db
      .select()
      .from(conversationsTable)
      .orderBy(desc(conversationsTable.updatedAt))
      .limit(5),
  ]);

  const stats = {
    total: 0,
    open: 0,
    inProgress: 0,
    waiting: 0,
    resolved: 0,
    closed: 0,
    todayTotal: Number(todayTotal),
    recentActivity,
  };

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
  if (isNaN(id)) {
    res.status(400).json({ ok: false, message: "ID inválido" });
    return;
  }
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
  if (!parsed.success) {
    res.status(400).json({ chatNumber: "", found: false, raw: {} });
    return;
  }

  const { chatNumber } = parsed.data;

  try {
    const params = new URLSearchParams({
      key: API_KEY,
      account_id: ACCOUNT_ID,
      phone_id: PHONE_ID,
      action: "chat_status",
      chat_number: chatNumber,
    });

    const response = await fetch(`${CHATGURU_API}?${params}`, { method: "POST" });
    const raw = (await response.json()) as Record<string, unknown>;
    req.log.info({ chatNumber, raw }, "ChatGuru check-status response");

    const found = raw.result === "success" || raw.code === 200 || raw.code === 201;
    const status = typeof raw.status === "string" ? mapStatus(raw.status) : undefined;

    if (found && status) {
      const existing = await db
        .select()
        .from(conversationsTable)
        .where(eq(conversationsTable.chatNumber, chatNumber))
        .limit(1);

      if (existing.length > 0) {
        await db
          .update(conversationsTable)
          .set({ status, updatedAt: new Date() })
          .where(eq(conversationsTable.chatNumber, chatNumber));
      } else {
        await db.insert(conversationsTable).values({
          chatNumber,
          status,
          lastMessageAt: new Date(),
        });
      }
    }

    res.json({ chatNumber, found, status, raw });
  } catch (err) {
    req.log.error({ err }, "Error checking chat status");
    res.status(500).json({ chatNumber, found: false });
  }
});

router.get("/webhook-url", (req: Request, res: Response) => {
  const domains = process.env.REPLIT_DOMAINS?.split(",")[0] ?? "seu-dominio.replit.app";
  const url = `https://${domains}/api/chatguru/webhook`;
  res.json({
    url,
    instructions:
      "Configure este URL no ChatGuru em: Chatbot → Ação de CRM → POST Webhook. Cole este URL no campo de URL do webhook.",
  });
});

export default router;
