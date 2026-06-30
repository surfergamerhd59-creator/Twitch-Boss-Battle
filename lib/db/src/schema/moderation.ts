import { pgTable, serial, text, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const userBansTable = pgTable("user_bans", {
  id: serial("id").primaryKey(),
  username: text("username").notNull(),
  type: text("type").notNull(), // 'ban' | 'timeout'
  durationMinutes: integer("duration_minutes"), // null = permanent
  reason: text("reason"),
  expiresAt: timestamp("expires_at", { withTimezone: true }), // null = permanent
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertUserBanSchema = createInsertSchema(userBansTable).omit({
  id: true,
  createdAt: true,
});

export type InsertUserBan = z.infer<typeof insertUserBanSchema>;
export type UserBan = typeof userBansTable.$inferSelect;
