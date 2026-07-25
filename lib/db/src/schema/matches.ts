import { pgTable, serial, integer, text, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { teamsTable } from "./teams";
import { tournamentsTable } from "./tournaments";

export const matchesTable = pgTable("matches", {
  id: serial("id").primaryKey(),
  homeTeamId: integer("home_team_id").references(() => teamsTable.id, { onDelete: "set null" }),
  awayTeamId: integer("away_team_id").references(() => teamsTable.id, { onDelete: "set null" }),
  homeScore: integer("home_score").notNull().default(0),
  awayScore: integer("away_score").notNull().default(0),
  status: text("status").notNull().default("scheduled"),
  minute: text("minute"),
  competition: text("competition").notNull(),
  competitionLogo: text("competition_logo"),
  kickoffAt: timestamp("kickoff_at").notNull(),
  featured: boolean("featured").notNull().default(false),
  sport: text("sport").notNull().default("football"),
  tournamentId: integer("tournament_id").references(() => tournamentsTable.id, { onDelete: "set null" }),
  venue: text("venue"),
  matchGroup: text("match_group"),
});

export const insertMatchSchema = createInsertSchema(matchesTable).omit({ id: true });
export type InsertMatch = z.infer<typeof insertMatchSchema>;
export type Match = typeof matchesTable.$inferSelect;
