import { db } from "../index";
import { customAudiencesTable } from "../schema";

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

async function metaGetPaginated<T>(path: string, params: Record<string, string> = {}): Promise<T[]> {
  const results: T[] = [];
  let nextUrl: string | null = null;
  let isFirst = true;

  while (isFirst || nextUrl) {
    isFirst = false;
    let data: { data: T[]; paging?: { next?: string } };

    if (nextUrl) {
      const res = await fetch(`${nextUrl}&access_token=${getToken()}`);
      if (!res.ok) throw new Error(`Meta API error ${res.status}: ${await res.text()}`);
      data = await res.json() as typeof data;
    } else {
      data = await metaGet(path, params) as typeof data;
    }

    results.push(...(data.data ?? []));
    nextUrl = data.paging?.next ?? null;
  }

  return results;
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

interface MetaAdSetFlat {
  id: string;
  status: string;
  targeting?: {
    custom_audiences?: Array<{ id: string; name?: string }>;
    lookalike_audiences?: Array<{ id: string; name?: string }>;
    excluded_custom_audiences?: Array<{ id: string; name?: string }>;
  };
}

export async function fetchCustomAudiences(): Promise<MetaAudience[]> {
  const adAccountId = getAdAccountId();
  return metaGetPaginated<MetaAudience>(`/${adAccountId}/customaudiences`, {
    fields: "id,name,subtype,approximate_count_with_privacy_treatment,delivery_status,description,time_created",
    limit: "200",
  });
}

// Fetch ALL adsets from the account (all campaigns, all statuses) in one paginated call
async function fetchAllAccountAdSets(): Promise<MetaAdSetFlat[]> {
  const adAccountId = getAdAccountId();
  return metaGetPaginated<MetaAdSetFlat>(`/${adAccountId}/adsets`, {
    fields: "id,status,targeting{custom_audiences,lookalike_audiences,excluded_custom_audiences}",
    limit: "200",
  });
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
  // Fetch audiences and ALL adsets in parallel
  const [audiences, allAdsets] = await Promise.all([
    fetchCustomAudiences(),
    fetchAllAccountAdSets(),
  ]);

  // Build usage map: metaAudienceId -> { active: number, inactive: number }
  const usageMap = new Map<string, { active: number; inactive: number }>();

  for (const adset of allAdsets) {
    const t = adset.targeting;
    if (!t) continue;

    const referencedIds = [
      ...(t.custom_audiences ?? []).map((a) => a.id),
      ...(t.lookalike_audiences ?? []).map((a) => a.id),
    ];

    for (const audienceId of referencedIds) {
      if (!usageMap.has(audienceId)) usageMap.set(audienceId, { active: 0, inactive: 0 });
      const entry = usageMap.get(audienceId)!;
      if (adset.status === "ACTIVE") {
        entry.active++;
      } else {
        entry.inactive++;
      }
    }
  }

  let audienceCount = 0;
  let totalUsages = 0;

  for (const a of audiences) {
    const usage = usageMap.get(a.id) ?? { active: 0, inactive: 0 };
    const hasUsage = usage.active > 0 || usage.inactive > 0;
    totalUsages += usage.active + usage.inactive;

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
        activeAdsetCount: usage.active,
        inactiveAdsetCount: usage.inactive,
        lastUsedAt: hasUsage ? new Date() : null,
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
          activeAdsetCount: usage.active,
          inactiveAdsetCount: usage.inactive,
          lastUsedAt: hasUsage ? new Date() : undefined,
          updatedAt: new Date(),
        },
      });
    audienceCount++;
  }

  return { audiences: audienceCount, usages: totalUsages };
}
