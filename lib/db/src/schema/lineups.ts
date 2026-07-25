import { pgTable, serial, integer, text, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { matchesTable } from "./matches";
import { teamsTable } from "./teams";

export const lineupsTable = pgTable("lineups", {
  id: serial("id").primaryKey(),
  matchId: integer("match_id").notNull().references(() => matchesTable.id, { onDelete: "cascade" }),
  teamId: integer("team_id").notNull().references(() => teamsTable.id),
  playerNumber: text("player_number").notNull(),
  playerName: text("player_name").notNull(),
  position: text("position"),
  role: text("role").notNull().default("player"),
  isStarting: boolean("is_starting").notNull().default(true),
});

export const insertLineupSchema = createInsertSchema(lineupsTable).omit({ id: true });
export type InsertLineup = z.infer<typeof insertLineupSchema>;
export type Lineup = typeof lineupsTable.$inferSelect;
