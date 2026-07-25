import { pgTable, serial, integer, text, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { teamsTable } from "./teams";

export const squadsTable = pgTable("squads", {
  id: serial("id").primaryKey(),
  teamId: integer("team_id").notNull().references(() => teamsTable.id, { onDelete: "cascade" }),
  playerNumber: text("player_number").notNull().default(""),
  playerName: text("player_name").notNull(),
  position: text("position"),
  role: text("role").notNull().default("player"), // player | coach | captain
  isStarting: boolean("is_starting").notNull().default(true),
  photoUrl: text("photo_url"),
  nationality: text("nationality"),
  bio: text("bio"),
  playerCode: text("player_code"), // optional unique code to link same player across teams
});

export const insertSquadSchema = createInsertSchema(squadsTable).omit({ id: true });
export type InsertSquad = z.infer<typeof insertSquadSchema>;
export type Squad = typeof squadsTable.$inferSelect;
