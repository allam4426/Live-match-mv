import { sqliteTable, integer, text, index } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { matchesTable } from "./matches";
import { teamsTable } from "./teams";

export const matchEventsTable = sqliteTable("match_events", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  matchId: integer("match_id").notNull().references(() => matchesTable.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  minute: text("minute").notNull(),
  teamId: integer("team_id").notNull().references(() => teamsTable.id),
  playerName: text("player_name").notNull(),
  playerNumber: text("player_number"),
  assistPlayerName: text("assist_player_name"),
  description: text("description"),
}, (table) => ({
  matchIdIdx: index("match_events_match_id_idx").on(table.matchId),
  matchIdTypeIdx: index("match_events_match_id_type_idx").on(table.matchId, table.type),
}));

export const insertMatchEventSchema = createInsertSchema(matchEventsTable).omit({ id: true });
export type InsertMatchEvent = z.infer<typeof insertMatchEventSchema>;
export type MatchEvent = typeof matchEventsTable.$inferSelect;
