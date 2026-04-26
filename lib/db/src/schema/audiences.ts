import { pgTable, serial, text, integer, timestamp, jsonb, unique } from "drizzle-orm/pg-core";
import { adSetsTable } from "./campaigns";

export const customAudiencesTable = pgTable("custom_audiences", {
  id: serial("id").primaryKey(),
  metaAudienceId: text("meta_audience_id").notNull().unique(),
  name: text("name").notNull(),
  type: text("type"),
  subtype: text("subtype"),
  approximateCount: integer("approximate_count"),
  status: text("status"),
  description: text("description"),
  rules: jsonb("rules"),
  createdTime: timestamp("created_time"),
  lastUsedAt: timestamp("last_used_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const audienceUsageTable = pgTable(
  "audience_usage",
  {
    id: serial("id").primaryKey(),
    adsetId: integer("adset_id")
      .notNull()
      .references(() => adSetsTable.id, { onDelete: "cascade" }),
    audienceId: integer("audience_id")
      .notNull()
      .references(() => customAudiencesTable.id, { onDelete: "cascade" }),
    type: text("type").notNull().default("INCLUDED"),
  },
  (t) => [unique("audience_usage_uniq").on(t.adsetId, t.audienceId, t.type)]
);

export type CustomAudience = typeof customAudiencesTable.$inferSelect;
export type AudienceUsage = typeof audienceUsageTable.$inferSelect;
