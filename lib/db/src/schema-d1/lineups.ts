import { sqliteTable, integer, text } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { matchesTable } from "./matches";
import { teamsTable } from "./teams";

export const lineupsTable = sqliteTable("lineups", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  matchId: integer("match_id").notNull().references(() => matchesTable.id, { onDelete: "cascade" }),
  teamId: integer("team_id").notNull().references(() => teamsTable.id),
  playerNumber: text("player_number").notNull(),
  playerName: text("player_name").notNull(),
  position: text("position"),
  role: text("role").notNull().default("player"),
  isStarting: integer("is_starting", { mode: "boolean" }).notNull().default(true),
  photoUrl: text("photo_url"),
});

export const insertLineupSchema = createInsertSchema(lineupsTable).omit({ id: true });
export type InsertLineup = z.infer<typeof insertLineupSchema>;
export type Lineup = typeof lineupsTable.$inferSelect;
