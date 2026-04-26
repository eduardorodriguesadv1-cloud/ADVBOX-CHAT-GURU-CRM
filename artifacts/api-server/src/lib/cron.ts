import { db, conversationsTable, dailySummariesTable } from "@workspace/db";
import { eq, and, lt, or, isNull, sql } from "drizzle-orm";
import { generateDailySummary } from "../routes/summaries";
import { syncAllCampaigns } from "@workspace/db/services/meta-ads";
import { logger } from "./logger";

async function checkCoolingLeads() {
  try {
    const now = new Date();
    const h2 = new Date(now.getTime() - 2 * 60 * 60 * 1000);
    const h24 = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    // URGENTE: Lead aberto sem nenhuma atualização há mais de 2h
    await db.update(conversationsTable)
      .set({ coolingAlert: "urgente", coolingAlertAt: now })
      .where(and(
        eq(conversationsTable.status, "open"),
        lt(conversationsTable.updatedAt, h2),
        or(isNull(conversationsTable.coolingAlert), sql`${conversationsTable.coolingAlert} != 'urgente'`)
      ));

    // ESFRIANDO: em atendimento ou aguardando sem mudança há mais de 24h
    await db.update(conversationsTable)
      .set({ coolingAlert: "esfriando", coolingAlertAt: now })
      .where(and(
        or(eq(conversationsTable.status, "waiting"), eq(conversationsTable.status, "in_progress")),
        lt(conversationsTable.updatedAt, h24),
        or(isNull(conversationsTable.coolingAlert), sql`${conversationsTable.coolingAlert} != 'esfriando'`)
      ));

    // Limpar alerta de leads que tiveram atividade recente (últimas 2h)
    await db.update(conversationsTable)
      .set({ coolingAlert: null, coolingAlertAt: null })
      .where(and(
        sql`${conversationsTable.coolingAlert} IS NOT NULL`,
        sql`${conversationsTable.updatedAt} > NOW() - INTERVAL '2 hours'`
      ));

    logger.info("Cooling leads check completed");
  } catch (err) {
    logger.error({ err }, "Cooling leads check failed");
  }
}

async function generateAndStoreSummary() {
  try {
    const date = new Date().toISOString().slice(0, 10);
    const data = await generateDailySummary(date);
    await db.insert(dailySummariesTable)
      .values({ date, data })
      .onConflictDoUpdate({ target: dailySummariesTable.date, set: { data, generatedAt: new Date() } });
    logger.info({ date }, "Daily summary generated");
  } catch (err) {
    logger.error({ err }, "Failed to generate daily summary");
  }
}

function scheduleDaily(utcHour: number, utcMinute: number, fn: () => Promise<void>) {
  function msUntilNext() {
    const now = new Date();
    const target = new Date(now);
    target.setUTCHours(utcHour, utcMinute, 0, 0);
    if (target <= now) target.setUTCDate(target.getUTCDate() + 1);
    return target.getTime() - now.getTime();
  }

  function schedule() {
    const delay = msUntilNext();
    logger.info({ delayMs: delay, utcHour }, "Scheduling daily job");
    setTimeout(async () => {
      await fn();
      schedule();
    }, delay);
  }

  schedule();
}

async function syncMetaAds() {
  if (!process.env["META_ACCESS_TOKEN"]) {
    logger.info("META_ACCESS_TOKEN not set — skipping Meta Ads sync");
    return;
  }
  try {
    const result = await syncAllCampaigns();
    logger.info(result, "Meta Ads sync completed");
  } catch (err) {
    logger.error({ err }, "Meta Ads sync failed");
  }
}

export function startCronJobs() {
  logger.info("Starting cron jobs...");
  setInterval(checkCoolingLeads, 30 * 60 * 1000);
  checkCoolingLeads();
  // 23:00 UTC = 20:00 Brasília (UTC-3)
  scheduleDaily(23, 0, generateAndStoreSummary);
  // 10:00 UTC = 07:00 Brasília (UTC-3)
  scheduleDaily(10, 0, syncMetaAds);
  logger.info("Cron jobs started");
}
