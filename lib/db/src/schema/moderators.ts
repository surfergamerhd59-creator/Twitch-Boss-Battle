import { boolean, pgTable, serial, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const authorizedModeratorsTable = pgTable(
  "authorized_moderators",
  {
    id: serial("id").primaryKey(),
    streamerId: text("streamer_id").notNull(),
    streamerUsername: text("streamer_username").notNull(),
    moderatorTwitchId: text("moderator_twitch_id").notNull(),
    moderatorUsername: text("moderator_username").notNull(),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("uq_streamer_mod").on(t.streamerId, t.moderatorTwitchId),
  ]
);

export const insertAuthorizedModeratorSchema = createInsertSchema(authorizedModeratorsTable).omit({
  id: true,
  createdAt: true,
});

export type InsertAuthorizedModerator = z.infer<typeof insertAuthorizedModeratorSchema>;
export type AuthorizedModerator = typeof authorizedModeratorsTable.$inferSelect;
