import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const botActivityLogTable = pgTable("bot_activity_log", {
  id: serial("id").primaryKey(),
  streamerUsername: text("streamer_username").notNull(),
  actionType: text("action_type").notNull(), // ban | timeout | unban | title_change | category_change | chat_mode_change | clear_chat | announcement | clip_created | sound_trigger
  details: text("details"), // human-readable summary
  performedBy: text("performed_by").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertBotActivityLogSchema = createInsertSchema(botActivityLogTable).omit({
  id: true,
  createdAt: true,
});

export type InsertBotActivityLog = z.infer<typeof insertBotActivityLogSchema>;
export type BotActivityLog = typeof botActivityLogTable.$inferSelect;
