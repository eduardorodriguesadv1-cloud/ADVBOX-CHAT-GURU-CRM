import { db } from "../index";
import {
  campaignsTable,
  campaignMetricsDailyTable,
  adSetsTable,
  adsTable,
  adMetricsDailyTable,
} from "../schema/campaigns";
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

function dateRange(daysBack = 30): { dateFrom: string; dateTo: string } {
  const today = new Date();
  const dateTo = today.toISOString().slice(0, 10);
  const dateFrom = new Date(today.getTime() - daysBack * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
  return { dateFrom, dateTo };
}

export interface MetaCampaign {
  id: string;
  name: string;
  objective: string;
  status: string;
  daily_budget?: string;
}

export interface MetaAdSet {
  id: string;
  name: string;
  status: string;
  daily_budget?: string;
  targeting?: {
    age_min?: number;
    age_max?: number;
    genders?: number[];
    geo_locations?: {
      cities?: Array<{ name: string; region: string }>;
      regions?: Array<{ name: string }>;
      countries?: string[];
    };
    custom_audiences?: Array<{ id: string; name: string }>;
    lookalike_audiences?: Array<{ id: string; name: string }>;
  };
}

export interface MetaAd {
  id: string;
  name: string;
  status: string;
  creative?: {
    id: string;
    object_type?: string;
    image_url?: string;
    thumbnail_url?: string;
    title?: string;
    body?: string;
    call_to_action_type?: string;
  };
}

export interface MetaInsights {
  date_start: string;
  date_stop: string;
  spend: string;
  impressions: string;
  reach: string;
  clicks?: string;
  ctr?: string;
  cpc?: string;
  cpm?: string;
  frequency?: string;
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

export async function fetchAdSets(campaignId: string): Promise<MetaAdSet[]> {
  const data = await metaGet(`/${campaignId}/adsets`, {
    fields: "id,name,status,daily_budget,targeting",
    limit: "100",
  }) as { data: MetaAdSet[] };
  return data.data ?? [];
}

export async function fetchAds(adsetId: string): Promise<MetaAd[]> {
  const data = await metaGet(`/${adsetId}/ads`, {
    fields: "id,name,status,creative{id,object_type,image_url,thumbnail_url,title,body,call_to_action_type}",
    limit: "100",
  }) as { data: MetaAd[] };
  return data.data ?? [];
}

export async function fetchAdInsights(
  adId: string,
  dateFrom: string,
  dateTo: string
): Promise<MetaInsights[]> {
  const data = await metaGet(`/${adId}/insights`, {
    fields: "date_start,date_stop,spend,impressions,reach,clicks,ctr,cpc,cpm,frequency,actions,cost_per_action_type",
    time_range: JSON.stringify({ since: dateFrom, until: dateTo }),
    time_increment: "1",
    limit: "90",
  }) as { data: MetaInsights[] };
  return data.data ?? [];
}

function detectAudienceType(targeting: MetaAdSet["targeting"]): string {
  if (!targeting) return "open";
  if (targeting.lookalike_audiences?.length) return "lookalike";
  if (targeting.custom_audiences?.length) return "custom";
  if (
    targeting.geo_locations?.cities?.length ||
    targeting.geo_locations?.regions?.length
  ) return "saved";
  return "open";
}

function buildTargetingSummary(targeting: MetaAdSet["targeting"]): string {
  if (!targeting) return "Público aberto";
  const parts: string[] = [];
  if (targeting.age_min || targeting.age_max) {
    parts.push(`${targeting.age_min ?? "?"}-${targeting.age_max ?? "?"}a`);
  }
  if (targeting.genders?.length === 1) {
    parts.push(targeting.genders[0] === 1 ? "Homens" : "Mulheres");
  }
  const geo = targeting.geo_locations;
  if (geo?.cities?.length) {
    parts.push(geo.cities.slice(0, 2).map((c) => c.name).join(", "));
  } else if (geo?.regions?.length) {
    parts.push(geo.regions.slice(0, 2).map((r) => r.name).join(", "));
  } else if (geo?.countries?.length) {
    parts.push(geo.countries.join(", "));
  }
  if (targeting.custom_audiences?.length) {
    parts.push(`${targeting.custom_audiences.length} público(s) customizado(s)`);
  }
  if (targeting.lookalike_audiences?.length) {
    parts.push(`Lookalike`);
  }
  return parts.join(" · ") || "Público aberto";
}

function buildLocations(targeting: MetaAdSet["targeting"]): unknown {
  if (!targeting?.geo_locations) return null;
  return targeting.geo_locations;
}

export async function syncAllCampaigns(): Promise<{ campaigns: number; metrics: number }> {
  const campaigns = await fetchCampaigns();
  let metricCount = 0;
  const { dateFrom, dateTo } = dateRange(30);

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
      console.error(
        `Meta insights error for campaign ${c.id}:`,
        err instanceof Error ? err.message : String(err)
      );
    }
  }

  return { campaigns: campaigns.length, metrics: metricCount };
}

export async function syncFullCampaignData(): Promise<{
  campaigns: number;
  metrics: number;
  adsets: number;
  ads: number;
  adMetrics: number;
}> {
  const basic = await syncAllCampaigns();
  const { dateFrom, dateTo } = dateRange(30);

  const allCampaigns = await db.select({ id: campaignsTable.id, metaCampaignId: campaignsTable.metaCampaignId }).from(campaignsTable);

  let adsetCount = 0;
  let adCount = 0;
  let adMetricCount = 0;

  for (const campaign of allCampaigns) {
    try {
      const adsets = await fetchAdSets(campaign.metaCampaignId);

      for (const as_ of adsets) {
        const audienceType = detectAudienceType(as_.targeting);
        const targetingSummary = buildTargetingSummary(as_.targeting);
        const locations = buildLocations(as_.targeting);
        const genders = as_.targeting?.genders?.length === 1
          ? (as_.targeting.genders[0] === 1 ? "male" : "female")
          : "all";

        const [adsetRow] = await db
          .insert(adSetsTable)
          .values({
            metaAdsetId: as_.id,
            campaignId: campaign.id,
            name: as_.name,
            status: as_.status,
            dailyBudget: as_.daily_budget ? String(Number(as_.daily_budget) / 100) : null,
            targetingSummary,
            audienceType,
            audienceDetails: (as_.targeting ?? null) as object | null,
            ageMin: as_.targeting?.age_min ?? null,
            ageMax: as_.targeting?.age_max ?? null,
            genders,
            locations: (locations ?? null) as object | null,
            updatedAt: new Date(),
          })
          .onConflictDoUpdate({
            target: adSetsTable.metaAdsetId,
            set: {
              name: as_.name,
              status: as_.status,
              dailyBudget: as_.daily_budget ? String(Number(as_.daily_budget) / 100) : null,
              targetingSummary,
              audienceType,
              audienceDetails: (as_.targeting ?? null) as object | null,
              ageMin: as_.targeting?.age_min ?? null,
              ageMax: as_.targeting?.age_max ?? null,
              genders,
              locations: (locations ?? null) as object | null,
              updatedAt: new Date(),
            },
          })
          .returning();

        adsetCount++;

        const ads = await fetchAds(as_.id);
        for (const ad of ads) {
          const [adRow] = await db
            .insert(adsTable)
            .values({
              metaAdId: ad.id,
              adsetId: adsetRow.id,
              name: ad.name,
              status: ad.status,
              creativeId: ad.creative?.id ?? null,
              creativeType: ad.creative?.object_type ?? null,
              creativeUrl: ad.creative?.image_url ?? ad.creative?.thumbnail_url ?? null,
              headline: ad.creative?.title ?? null,
              body: ad.creative?.body ?? null,
              callToAction: ad.creative?.call_to_action_type ?? null,
              updatedAt: new Date(),
            })
            .onConflictDoUpdate({
              target: adsTable.metaAdId,
              set: {
                name: ad.name,
                status: ad.status,
                creativeId: ad.creative?.id ?? null,
                creativeType: ad.creative?.object_type ?? null,
                creativeUrl: ad.creative?.image_url ?? ad.creative?.thumbnail_url ?? null,
                headline: ad.creative?.title ?? null,
                body: ad.creative?.body ?? null,
                callToAction: ad.creative?.call_to_action_type ?? null,
                updatedAt: new Date(),
              },
            })
            .returning();

          adCount++;

          try {
            const adInsights = await fetchAdInsights(ad.id, dateFrom, dateTo);
            for (const ins of adInsights) {
              const convAction = ins.actions?.find(
                (a) =>
                  a.action_type === "onsite_conversion.messaging_conversation_started_7d" ||
                  a.action_type === "offsite_conversion.fb_pixel_lead" ||
                  a.action_type === "lead"
              );
              await db
                .insert(adMetricsDailyTable)
                .values({
                  adId: adRow.id,
                  date: ins.date_start,
                  spend: ins.spend ?? "0",
                  impressions: Number(ins.impressions ?? 0),
                  reach: Number(ins.reach ?? 0),
                  clicks: Number(ins.clicks ?? 0),
                  ctr: ins.ctr ?? null,
                  cpc: ins.cpc ?? null,
                  cpm: ins.cpm ?? null,
                  frequency: ins.frequency ?? null,
                  conversations: Number(convAction?.value ?? 0),
                })
                .onConflictDoUpdate({
                  target: [adMetricsDailyTable.adId, adMetricsDailyTable.date],
                  set: {
                    spend: ins.spend ?? "0",
                    impressions: Number(ins.impressions ?? 0),
                    reach: Number(ins.reach ?? 0),
                    clicks: Number(ins.clicks ?? 0),
                    ctr: ins.ctr ?? null,
                    cpc: ins.cpc ?? null,
                    cpm: ins.cpm ?? null,
                    frequency: ins.frequency ?? null,
                    conversations: Number(convAction?.value ?? 0),
                  },
                });
              adMetricCount++;
            }
          } catch (err) {
            console.error(`Ad insights error for ad ${ad.id}:`, err instanceof Error ? err.message : String(err));
          }
        }
      }
    } catch (err) {
      console.error(
        `AdSets error for campaign ${campaign.metaCampaignId}:`,
        err instanceof Error ? err.message : String(err)
      );
    }
  }

  return {
    campaigns: basic.campaigns,
    metrics: basic.metrics,
    adsets: adsetCount,
    ads: adCount,
    adMetrics: adMetricCount,
  };
}
