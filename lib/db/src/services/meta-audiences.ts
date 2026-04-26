import { db } from "../index";
import { customAudiencesTable, audienceUsageTable, adSetsTable } from "../schema";
import { eq } from "drizzle-orm";

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

export interface MetaAudience {
  id: string;
  name: string;
  subtype?: string;
  approximate_count?: number;
  approximate_count_with_privacy_treatment?: number;
  delivery_status?: { code: number; description: string };
  description?: string;
  time_created?: number;
}

export async function fetchCustomAudiences(): Promise<MetaAudience[]> {
  const adAccountId = getAdAccountId();
  const data = await metaGet(`/${adAccountId}/customaudiences`, {
    fields: "id,name,subtype,approximate_count_with_privacy_treatment,delivery_status,description,time_created",
    limit: "200",
  }) as { data: MetaAudience[] };
  return data.data ?? [];
}

function deriveType(subtype: string | undefined): string {
  if (!subtype) return "CUSTOM";
  if (subtype.includes("LOOKALIKE")) return "LOOKALIKE";
  if (subtype.includes("WEBSITE") || subtype === "WEBSITE") return "WEBSITE";
  if (subtype.includes("CUSTOMER_LIST") || subtype === "CONTACT_LIST") return "CUSTOMER_LIST";
  if (subtype.includes("ENGAGEMENT") || subtype.includes("INSTAGRAM") || subtype.includes("VIDEO") || subtype.includes("FACEBOOK_PAGE")) return "ENGAGEMENT";
  if (subtype.includes("OFFLINE")) return "OFFLINE";
  return "CUSTOM";
}

function deriveStatus(deliveryStatus: MetaAudience["delivery_status"]): string {
  if (!deliveryStatus) return "ready";
  const code = deliveryStatus.code;
  if (code === 200) return "ready";
  if (code === 300 || code === 400) return "in_progress";
  if (code >= 500) return "expired";
  return "ready";
}

export async function syncAllAudiences(): Promise<{ audiences: number; usages: number }> {
  const audiences = await fetchCustomAudiences();
  let audienceCount = 0;
  let usageCount = 0;

  for (const a of audiences) {
    await db
      .insert(customAudiencesTable)
      .values({
        metaAudienceId: a.id,
        name: a.name,
        type: deriveType(a.subtype),
        subtype: a.subtype ?? null,
        approximateCount: a.approximate_count_with_privacy_treatment ?? a.approximate_count ?? null,
        status: deriveStatus(a.delivery_status),
        description: a.description ?? null,
        rules: null,
        createdTime: a.time_created ? new Date(a.time_created * 1000) : null,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: customAudiencesTable.metaAudienceId,
        set: {
          name: a.name,
          subtype: a.subtype ?? null,
          approximateCount: a.approximate_count_with_privacy_treatment ?? a.approximate_count ?? null,
          status: deriveStatus(a.delivery_status),
          description: a.description ?? null,
          rules: null,
          updatedAt: new Date(),
        },
      });
    audienceCount++;
  }

  // Sync audience usages from adset targeting data
  const adsets = await db
    .select({
      id: adSetsTable.id,
      audienceDetails: adSetsTable.audienceDetails,
    })
    .from(adSetsTable);

  for (const adset of adsets) {
    const details = adset.audienceDetails as {
      custom_audiences?: Array<{ id: string }>;
      lookalike_audiences?: Array<{ id: string }>;
      excluded_custom_audiences?: Array<{ id: string }>;
    } | null;

    if (!details) continue;

    const included = details.custom_audiences ?? [];
    const lookalikes = details.lookalike_audiences ?? [];
    const excluded = details.excluded_custom_audiences ?? [];

    const toInsert: Array<{ metaId: string; type: string }> = [
      ...included.map((a) => ({ metaId: a.id, type: "INCLUDED" })),
      ...lookalikes.map((a) => ({ metaId: a.id, type: "INCLUDED" })),
      ...excluded.map((a) => ({ metaId: a.id, type: "EXCLUDED" })),
    ];

    for (const usage of toInsert) {
      const [audience] = await db
        .select({ id: customAudiencesTable.id })
        .from(customAudiencesTable)
        .where(eq(customAudiencesTable.metaAudienceId, usage.metaId));

      if (!audience) continue;

      await db
        .insert(audienceUsageTable)
        .values({ adsetId: adset.id, audienceId: audience.id, type: usage.type })
        .onConflictDoNothing();

      // Update last_used_at
      await db
        .update(customAudiencesTable)
        .set({ lastUsedAt: new Date() })
        .where(eq(customAudiencesTable.id, audience.id));

      usageCount++;
    }
  }

  return { audiences: audienceCount, usages: usageCount };
}
