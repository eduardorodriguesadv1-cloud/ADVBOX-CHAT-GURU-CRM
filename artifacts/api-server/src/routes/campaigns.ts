import { Router } from "express";
import { db, campaignsTable, campaignMetricsDailyTable, conversationsTable } from "@workspace/db";
import { desc, sql, eq, gte, and } from "drizzle-orm";
import { syncAllCampaigns } from "@workspace/db/services/meta-ads";
import { logger } from "../lib/logger";

const router = Router();

router.get("/", async (_req, res) => {
  try {
    const rows = await db
      .select({
        id: campaignsTable.id,
        metaCampaignId: campaignsTable.metaCampaignId,
        name: campaignsTable.name,
        objective: campaignsTable.objective,
        status: campaignsTable.status,
        dailyBudget: campaignsTable.dailyBudget,
        updatedAt: campaignsTable.updatedAt,
        totalSpend: sql<string>`COALESCE(SUM(${campaignMetricsDailyTable.spend}), 0)`,
        totalImpressions: sql<number>`COALESCE(SUM(${campaignMetricsDailyTable.impressions}), 0)`,
        totalReach: sql<number>`COALESCE(SUM(${campaignMetricsDailyTable.reach}), 0)`,
        totalConversations: sql<number>`COALESCE(SUM(${campaignMetricsDailyTable.conversationsStarted}), 0)`,
      })
      .from(campaignsTable)
      .leftJoin(
        campaignMetricsDailyTable,
        and(
          eq(campaignMetricsDailyTable.campaignId, campaignsTable.id),
          gte(
            campaignMetricsDailyTable.date,
            sql`(CURRENT_DATE - INTERVAL '30 days')::date`
          )
        )
      )
      .groupBy(campaignsTable.id)
      .orderBy(desc(campaignsTable.updatedAt));

    const withCpl = rows.map((r) => {
      const spend = Number(r.totalSpend);
      const convs = Number(r.totalConversations);
      return {
        ...r,
        totalSpend: spend,
        totalConversations: convs,
        cplMeta: convs > 0 ? spend / convs : null,
      };
    });

    res.json(withCpl);
  } catch (err) {
    logger.error({ err }, "GET /campaigns failed");
    res.status(500).json({ error: "internal_error" });
  }
});

router.get("/sync", async (_req, res) => {
  try {
    const result = await syncAllCampaigns();
    logger.info(result, "Manual Meta Ads sync triggered");
    res.json({ ok: true, ...result });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error({ err }, "Meta Ads sync failed");
    res.status(500).json({ error: msg });
  }
});

router.get("/performance", async (_req, res) => {
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [metaAgg] = await db
      .select({
        totalSpend: sql<string>`COALESCE(SUM(${campaignMetricsDailyTable.spend}), 0)`,
        totalImpressions: sql<number>`COALESCE(SUM(${campaignMetricsDailyTable.impressions}), 0)`,
        totalMetaConversations: sql<number>`COALESCE(SUM(${campaignMetricsDailyTable.conversationsStarted}), 0)`,
      })
      .from(campaignMetricsDailyTable)
      .where(
        gte(campaignMetricsDailyTable.date, sql`(CURRENT_DATE - INTERVAL '30 days')::date`)
      );

    const [crmLeads] = await db
      .select({ total: sql<number>`COUNT(*)` })
      .from(conversationsTable)
      .where(gte(conversationsTable.createdAt, thirtyDaysAgo));

    const [crmContracts] = await db
      .select({ total: sql<number>`COUNT(*)` })
      .from(conversationsTable)
      .where(
        and(
          gte(conversationsTable.createdAt, thirtyDaysAgo),
          eq(conversationsTable.status, "contrato_assinado")
        )
      );

    const spend = Number(metaAgg?.totalSpend ?? 0);
    const crmLeadCount = Number(crmLeads?.total ?? 0);
    const crmContractCount = Number(crmContracts?.total ?? 0);
    const cplMeta = Number(metaAgg?.totalMetaConversations) > 0
      ? spend / Number(metaAgg.totalMetaConversations)
      : null;
    const cplCrm = crmLeadCount > 0 ? spend / crmLeadCount : null;

    const campaigns = await db
      .select({
        id: campaignsTable.id,
        name: campaignsTable.name,
        status: campaignsTable.status,
        totalSpend: sql<string>`COALESCE(SUM(${campaignMetricsDailyTable.spend}), 0)`,
        totalImpressions: sql<number>`COALESCE(SUM(${campaignMetricsDailyTable.impressions}), 0)`,
        totalConversations: sql<number>`COALESCE(SUM(${campaignMetricsDailyTable.conversationsStarted}), 0)`,
      })
      .from(campaignsTable)
      .leftJoin(
        campaignMetricsDailyTable,
        and(
          eq(campaignMetricsDailyTable.campaignId, campaignsTable.id),
          gte(campaignMetricsDailyTable.date, sql`(CURRENT_DATE - INTERVAL '30 days')::date`)
        )
      )
      .groupBy(campaignsTable.id)
      .orderBy(desc(sql`SUM(${campaignMetricsDailyTable.spend})`));

    const crmByCampaign = await db
      .select({
        campaign: conversationsTable.campaign,
        leads: sql<number>`COUNT(*)`,
        contracts: sql<number>`SUM(CASE WHEN ${conversationsTable.status} = 'contrato_assinado' THEN 1 ELSE 0 END)`,
      })
      .from(conversationsTable)
      .where(gte(conversationsTable.createdAt, thirtyDaysAgo))
      .groupBy(conversationsTable.campaign);

    res.json({
      period: "30d",
      summary: {
        totalSpend: spend,
        totalImpressions: Number(metaAgg?.totalImpressions ?? 0),
        totalMetaConversations: Number(metaAgg?.totalMetaConversations ?? 0),
        totalCrmLeads: crmLeadCount,
        totalContracts: crmContractCount,
        cplMeta,
        cplCrm,
        estimatedRoi: spend > 0 && crmContractCount > 0 ? crmContractCount / spend : null,
      },
      campaigns: campaigns.map((c) => {
        const spend = Number(c.totalSpend);
        const convs = Number(c.totalConversations);
        const crm = crmByCampaign.find((x) => x.campaign?.toLowerCase().includes(c.name.toLowerCase().slice(0, 6)));
        return {
          ...c,
          totalSpend: spend,
          cplMeta: convs > 0 ? spend / convs : null,
          crmLeads: Number(crm?.leads ?? 0),
          crmContracts: Number(crm?.contracts ?? 0),
        };
      }),
    });
  } catch (err) {
    logger.error({ err }, "GET /campaigns/performance failed");
    res.status(500).json({ error: "internal_error" });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const [campaign] = await db
      .select()
      .from(campaignsTable)
      .where(eq(campaignsTable.id, id));

    if (!campaign) return res.status(404).json({ error: "not_found" });

    const metrics = await db
      .select()
      .from(campaignMetricsDailyTable)
      .where(eq(campaignMetricsDailyTable.campaignId, id))
      .orderBy(desc(campaignMetricsDailyTable.date))
      .limit(90);

    res.json({ ...campaign, metrics });
  } catch (err) {
    logger.error({ err }, "GET /campaigns/:id failed");
    res.status(500).json({ error: "internal_error" });
  }
});

export default router;
