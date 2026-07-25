import { pgTable, serial, text, boolean, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const spotlightsTable = pgTable("spotlights", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  subtitle: text("subtitle"),
  imageUrl: text("image_url").notNull(),
  linkUrl: text("link_url"),
  active: boolean("active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertSpotlightSchema = createInsertSchema(spotlightsTable).omit({ id: true, createdAt: true });
export type InsertSpotlight = z.infer<typeof insertSpotlightSchema>;
export type Spotlight = typeof spotlightsTable.$inferSelect;
