import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { teamsTable } from "./teams";
export const trophiesTable = pgTable("trophies", {
  id: serial("id").primaryKey(),
  teamId: integer("team_id").notNull().references(() => teamsTable.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  season: text("season"),
  imageUrl: text("image_url"),
  createdAt: timestamp("created_at").defaultNow(),
});
export const insertTrophySchema = createInsertSchema(trophiesTable).omit({ id: true, createdAt: true });
export type InsertTrophy = z.infer<typeof insertTrophySchema>;
export type Trophy = typeof trophiesTable.$inferSelect;
