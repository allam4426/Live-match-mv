import { sqliteTable, integer, text } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { teamsTable } from "./teams";

export const trophiesTable = sqliteTable("trophies", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  teamId: integer("team_id").notNull().references(() => teamsTable.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  season: text("season"),
  imageUrl: text("image_url"),
  createdAt: integer("created_at", { mode: "timestamp" }).default(sql`(unixepoch())`),
});
export const insertTrophySchema = createInsertSchema(trophiesTable).omit({ id: true, createdAt: true });
export type InsertTrophy = z.infer<typeof insertTrophySchema>;
export type Trophy = typeof trophiesTable.$inferSelect;
