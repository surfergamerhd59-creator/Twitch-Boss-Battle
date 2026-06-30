import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const socialLinksTable = pgTable("social_links", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  url: text("url").notNull(),
  platform: text("platform").notNull().default("custom"), // discord | twitter | youtube | etc.
  color: text("color").notNull().default("#9146ff"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertSocialLinkSchema = createInsertSchema(socialLinksTable).omit({
  id: true,
  createdAt: true,
});

export type InsertSocialLink = z.infer<typeof insertSocialLinkSchema>;
export type SocialLink = typeof socialLinksTable.$inferSelect;
