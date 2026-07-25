import { pgTable, serial, integer, text } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { matchesTable } from "./matches";
import { teamsTable } from "./teams";

export const matchEventsTable = pgTable("match_events", {
  id: serial("id").primaryKey(),
  matchId: integer("match_id").notNull().references(() => matchesTable.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  minute: text("minute").notNull(),
  teamId: integer("team_id").notNull().references(() => teamsTable.id),
  playerName: text("player_name").notNull(),
  playerNumber: text("player_number"),
  assistPlayerName: text("assist_player_name"),
  description: text("description"),
});

export const insertMatchEventSchema = createInsertSchema(matchEventsTable).omit({ id: true });
export type InsertMatchEvent = z.infer<typeof insertMatchEventSchema>;
export type MatchEvent = typeof matchEventsTable.$inferSelect;
