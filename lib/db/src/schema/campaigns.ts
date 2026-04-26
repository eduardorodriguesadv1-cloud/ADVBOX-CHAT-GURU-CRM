import { pgTable, serial, text, decimal, integer, date, timestamp, jsonb, unique } from "drizzle-orm/pg-core";

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

export type Campaign = typeof campaignsTable.$inferSelect;
export type CampaignMetricsDaily = typeof campaignMetricsDailyTable.$inferSelect;
