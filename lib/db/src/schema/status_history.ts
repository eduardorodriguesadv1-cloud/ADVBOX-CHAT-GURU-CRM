import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";
import { conversationsTable } from "./conversations";

export const statusHistoryTable = pgTable("status_history", {
  id: serial("id").primaryKey(),
  conversationId: integer("conversation_id").notNull().references(() => conversationsTable.id, { onDelete: "cascade" }),
  fromStatus: text("from_status"),
  toStatus: text("to_status").notNull(),
  changedBy: text("changed_by").default("system"), // "system" | "manual" | "chatguru_sync"
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type StatusHistory = typeof statusHistoryTable.$inferSelect;
