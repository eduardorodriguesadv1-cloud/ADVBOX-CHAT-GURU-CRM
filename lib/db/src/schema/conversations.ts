import { pgTable, serial, text, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const conversationsTable = pgTable("conversations", {
  id: serial("id").primaryKey(),
  chatNumber: text("chat_number").notNull().unique(),
  contactName: text("contact_name"),
  status: text("status").notNull().default("open"),
  assignedAgent: text("assigned_agent"),
  lastMessage: text("last_message"),
  lastMessageAt: timestamp("last_message_at"),
  contextData: jsonb("context_data"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const webhookEventsTable = pgTable("webhook_events", {
  id: serial("id").primaryKey(),
  chatNumber: text("chat_number"),
  rawPayload: text("raw_payload").notNull(),
  receivedAt: timestamp("received_at").defaultNow().notNull(),
});

export const insertConversationSchema = createInsertSchema(conversationsTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertWebhookEventSchema = createInsertSchema(webhookEventsTable).omit({ id: true, receivedAt: true });

export type InsertConversation = z.infer<typeof insertConversationSchema>;
export type Conversation = typeof conversationsTable.$inferSelect;
export type WebhookEvent = typeof webhookEventsTable.$inferSelect;
