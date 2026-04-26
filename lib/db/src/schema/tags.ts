import { pgTable, serial, text, integer, timestamp, primaryKey } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { conversationsTable } from "./conversations";

export const tagsTable = pgTable("tags", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  category: text("category").notNull(), // "ORIGEM" | "SETOR" | "STATUS" | "CASO" | "MOTIVO_DESCARTE"
  chatguruTagId: text("chatguru_tag_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const conversationTagsTable = pgTable("conversation_tags", {
  conversationId: integer("conversation_id").notNull().references(() => conversationsTable.id, { onDelete: "cascade" }),
  tagId: integer("tag_id").notNull().references(() => tagsTable.id, { onDelete: "cascade" }),
  appliedAt: timestamp("applied_at").defaultNow().notNull(),
}, (table) => [
  primaryKey({ columns: [table.conversationId, table.tagId] }),
]);

export const insertTagSchema = createInsertSchema(tagsTable).omit({
  id: true,
  createdAt: true,
});

export type InsertTag = z.infer<typeof insertTagSchema>;
export type Tag = typeof tagsTable.$inferSelect;
export type ConversationTag = typeof conversationTagsTable.$inferSelect;
