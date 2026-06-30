import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const streamersTable = pgTable("streamers", {
  id: serial("id").primaryKey(),
  twitchId: text("twitch_id").notNull().unique(),
  username: text("username").notNull().unique(),
  displayName: text("display_name").notNull(),
  accessToken: text("access_token").notNull(),
  refreshToken: text("refresh_token").notNull(),
  botName: text("bot_name").notNull().default(""),
  scope: text("scope").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertStreamerSchema = createInsertSchema(streamersTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertStreamer = z.infer<typeof insertStreamerSchema>;
export type Streamer = typeof streamersTable.$inferSelect;
