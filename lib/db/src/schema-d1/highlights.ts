import { sqliteTable, integer, text } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { teamsTable } from "./teams";

export const highlightsTable = sqliteTable("highlights", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  title: text("title").notNull(),
  competition: text("competition").notNull(),
  thumbnailUrl: text("thumbnail_url").notNull(),
  videoUrl: text("video_url").notNull(),
  duration: text("duration").notNull(),
  publishedAt: integer("published_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
  homeTeamId: integer("home_team_id").notNull().references(() => teamsTable.id),
  awayTeamId: integer("away_team_id").notNull().references(() => teamsTable.id),
  homeScore: integer("home_score").notNull().default(0),
  awayScore: integer("away_score").notNull().default(0),
  views: integer("views").notNull().default(0),
});

export const insertHighlightSchema = createInsertSchema(highlightsTable).omit({ id: true });
export type InsertHighlight = z.infer<typeof insertHighlightSchema>;
export type Highlight = typeof highlightsTable.$inferSelect;
