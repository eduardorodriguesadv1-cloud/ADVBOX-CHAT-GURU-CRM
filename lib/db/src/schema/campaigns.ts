import { pgTable, serial, text, decimal, integer, date, timestamp, jsonb, unique, boolean } from "drizzle-orm/pg-core";

export const campaignsTable = pgTable("campaigns", {
  id: serial("id").primaryKey(),
  metaCampaignId: text("meta_campaign_id").notNull().unique(),
  name: text("name").notNull(),
  objective: text("objective"),
  status: text("status").notNull().default("UNKNOWN"),
  dailyBudget: decimal("daily_budget", { precision: 12, scale: 2 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const campaignMetricsDailyTable = pgTable(
  "campaign_metrics_daily",
  {
    id: serial("id").primaryKey(),
    campaignId: integer("campaign_id")
      .notNull()
      .references(() => campaignsTable.id, { onDelete: "cascade" }),
    date: date("date").notNull(),
    spend: decimal("spend", { precision: 12, scale: 2 }).default("0"),
    impressions: integer("impressions").default(0),
    reach: integer("reach").default(0),
    conversationsStarted: integer("conversations_started").default(0),
    costPerConversation: decimal("cost_per_conversation", { precision: 12, scale: 2 }),
    rawInsights: jsonb("raw_insights"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [unique("campaign_metrics_daily_uniq").on(t.campaignId, t.date)]
);

export const adSetsTable = pgTable("ad_sets", {
  id: serial("id").primaryKey(),
  metaAdsetId: text("meta_adset_id").notNull().unique(),
  campaignId: integer("campaign_id")
    .notNull()
    .references(() => campaignsTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  status: text("status").notNull().default("UNKNOWN"),
  dailyBudget: decimal("daily_budget", { precision: 12, scale: 2 }),
  targetingSummary: text("targeting_summary"),
  audienceType: text("audience_type"),
  audienceDetails: jsonb("audience_details"),
  ageMin: integer("age_min"),
  ageMax: integer("age_max"),
  genders: text("genders"),
  locations: jsonb("locations"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const adsTable = pgTable("ads", {
  id: serial("id").primaryKey(),
  metaAdId: text("meta_ad_id").notNull().unique(),
  adsetId: integer("adset_id")
    .notNull()
    .references(() => adSetsTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  status: text("status").notNull().default("UNKNOWN"),
  creativeId: text("creative_id"),
  creativeType: text("creative_type"),
  creativeUrl: text("creative_url"),
  headline: text("headline"),
  body: text("body"),
  callToAction: text("call_to_action"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const adMetricsDailyTable = pgTable(
  "ad_metrics_daily",
  {
    id: serial("id").primaryKey(),
    adId: integer("ad_id")
      .notNull()
      .references(() => adsTable.id, { onDelete: "cascade" }),
    date: date("date").notNull(),
    spend: decimal("spend", { precision: 12, scale: 2 }).default("0"),
    impressions: integer("impressions").default(0),
    reach: integer("reach").default(0),
    clicks: integer("clicks").default(0),
    ctr: decimal("ctr", { precision: 10, scale: 4 }),
    cpc: decimal("cpc", { precision: 12, scale: 2 }),
    cpm: decimal("cpm", { precision: 12, scale: 2 }),
    frequency: decimal("frequency", { precision: 10, scale: 4 }),
    conversations: integer("conversations").default(0),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [unique("ad_metrics_daily_uniq").on(t.adId, t.date)]
);

export type Campaign = typeof campaignsTable.$inferSelect;
export type CampaignMetricsDaily = typeof campaignMetricsDailyTable.$inferSelect;
export type AdSet = typeof adSetsTable.$inferSelect;
export type Ad = typeof adsTable.$inferSelect;
export type AdMetricsDaily = typeof adMetricsDailyTable.$inferSelect;
