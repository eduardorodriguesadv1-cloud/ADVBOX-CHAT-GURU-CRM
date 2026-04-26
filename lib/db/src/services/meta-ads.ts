import { db } from "../index";
import { campaignsTable, campaignMetricsDailyTable } from "../schema/campaigns";
import { eq, and } from "drizzle-orm";

const BASE_URL = "https://graph.facebook.com/v22.0";

function getToken(): string {
  const token = process.env["META_ACCESS_TOKEN"];
  if (!token) throw new Error("META_ACCESS_TOKEN env var not set");
  return token;
}

function getAdAccountId(): string {
  const id = process.env["META_AD_ACCOUNT_ID"] ?? "act_6541320839657528";
  return id.startsWith("act_") ? id : `act_${id}`;
}

async function metaGet(path: string, params: Record<string, string> = {}): Promise<unknown> {
  const url = new URL(`${BASE_URL}${path}`);
  url.searchParams.set("access_token", getToken());
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url.toString());
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Meta API error ${res.status}: ${body}`);
  }
  return res.json();
}

export interface MetaCampaign {
  id: string;
  name: string;
  objective: string;
  status: string;
  daily_budget?: string;
}

export interface MetaInsights {
  date_start: string;
  date_stop: string;
  spend: string;
  impressions: string;
  reach: string;
  actions?: Array<{ action_type: string; value: string }>;
  cost_per_action_type?: Array<{ action_type: string; value: string }>;
}

export async function fetchCampaigns(): Promise<MetaCampaign[]> {
  const adAccountId = getAdAccountId();
  const data = await metaGet(`/${adAccountId}/campaigns`, {
    fields: "id,name,objective,status,daily_budget",
    limit: "200",
  }) as { data: MetaCampaign[] };
  return data.data ?? [];
}

export async function fetchCampaignMetrics(
  campaignId: string,
  dateFrom: string,
  dateTo: string
): Promise<MetaInsights[]> {
  const data = await metaGet(`/${campaignId}/insights`, {
    fields: "date_start,date_stop,spend,impressions,reach,actions,cost_per_action_type",
    time_range: JSON.stringify({ since: dateFrom, until: dateTo }),
    time_increment: "1",
    limit: "90",
  }) as { data: MetaInsights[] };
  return data.data ?? [];
}

export async function syncAllCampaigns(): Promise<{ campaigns: number; metrics: number }> {
  const campaigns = await fetchCampaigns();
  let metricCount = 0;

  for (const c of campaigns) {
    const [row] = await db
      .insert(campaignsTable)
      .values({
        metaCampaignId: c.id,
        name: c.name,
        objective: c.objective ?? null,
        status: c.status,
        dailyBudget: c.daily_budget ? String(Number(c.daily_budget) / 100) : null,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: campaignsTable.metaCampaignId,
        set: {
          name: c.name,
          objective: c.objective ?? null,
          status: c.status,
          dailyBudget: c.daily_budget ? String(Number(c.daily_budget) / 100) : null,
          updatedAt: new Date(),
        },
      })
      .returning();

    const today = new Date();
    const dateTo = today.toISOString().slice(0, 10);
    const dateFrom = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);

    try {
      const insights = await fetchCampaignMetrics(c.id, dateFrom, dateTo);
      for (const ins of insights) {
        const convAction = ins.actions?.find(
          (a) =>
            a.action_type === "onsite_conversion.messaging_conversation_started_7d" ||
            a.action_type === "offsite_conversion.fb_pixel_lead" ||
            a.action_type === "lead"
        );
        const conversationsStarted = Number(convAction?.value ?? 0);

        const cpaEntry = ins.cost_per_action_type?.find(
          (a) =>
            a.action_type === "onsite_conversion.messaging_conversation_started_7d" ||
            a.action_type === "offsite_conversion.fb_pixel_lead" ||
            a.action_type === "lead"
        );
        const spend = Number(ins.spend ?? 0);
        const costPerConversation = cpaEntry
          ? String(cpaEntry.value)
          : conversationsStarted > 0
          ? String((spend / conversationsStarted).toFixed(2))
          : null;

        await db
          .insert(campaignMetricsDailyTable)
          .values({
            campaignId: row.id,
            date: ins.date_start,
            spend: ins.spend ?? "0",
            impressions: Number(ins.impressions ?? 0),
            reach: Number(ins.reach ?? 0),
            conversationsStarted,
            costPerConversation,
            rawInsights: ins as object,
          })
          .onConflictDoUpdate({
            target: [campaignMetricsDailyTable.campaignId, campaignMetricsDailyTable.date],
            set: {
              spend: ins.spend ?? "0",
              impressions: Number(ins.impressions ?? 0),
              reach: Number(ins.reach ?? 0),
              conversationsStarted,
              costPerConversation,
              rawInsights: ins as object,
            },
          });
        metricCount++;
      }
    } catch (err: unknown) {
      console.error(`Meta insights error for campaign ${c.id}:`, err instanceof Error ? err.message : String(err));
    }
  }

  return { campaigns: campaigns.length, metrics: metricCount };
}
