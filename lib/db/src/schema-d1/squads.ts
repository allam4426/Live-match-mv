import { sqliteTable, integer, text } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { teamsTable } from "./teams";

export const squadsTable = sqliteTable("squads", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  teamId: integer("team_id").notNull().references(() => teamsTable.id, { onDelete: "cascade" }),
  playerNumber: text("player_number").notNull().default(""),
  playerName: text("player_name").notNull(),
  position: text("position"),
  role: text("role").notNull().default("player"),
  isStarting: integer("is_starting", { mode: "boolean" }).notNull().default(true),
  photoUrl: text("photo_url"),
  nationality: text("nationality"),
  bio: text("bio"),
  playerCode: text("player_code"),
});

export const insertSquadSchema = createInsertSchema(squadsTable).omit({ id: true });
export type InsertSquad = z.infer<typeof insertSquadSchema>;
export type Squad = typeof squadsTable.$inferSelect;
