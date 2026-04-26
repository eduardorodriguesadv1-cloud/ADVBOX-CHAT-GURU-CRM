import { pgTable, serial, text, jsonb, timestamp } from "drizzle-orm/pg-core";

export const dailySummariesTable = pgTable("daily_summaries", {
  id: serial("id").primaryKey(),
  date: text("date").notNull().unique(), // "2026-04-26"
  data: jsonb("data").notNull(),
  generatedAt: timestamp("generated_at").defaultNow().notNull(),
});

export type DailySummary = typeof dailySummariesTable.$inferSelect;
