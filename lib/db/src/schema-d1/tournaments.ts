import { sqliteTable, integer, text } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const QualificationZoneSchema = z.object({
  fromPos: z.number().int(),
  toPos: z.number().int(),
  type: z.enum(["champion", "qualified", "qualified_playoff", "relegated_playoff", "relegated"]),
  label: z.string(),
});
export type QualificationZone = z.infer<typeof QualificationZoneSchema>;

export const TournamentStageSchema = z.enum(["championship", "atoll", "zone", "regional", "final"]);
export type TournamentStage = z.infer<typeof TournamentStageSchema>;

export const tournamentsTable = sqliteTable("tournaments", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  sport: text("sport").notNull().default("football"),
  season: text("season").notNull(),
  logoUrl: text("logo_url"),
  description: text("description"),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  format: text("format").notNull().default("league"),
  singleGroupFormat: text("single_group_format"),
  color: text("color"),
  qualificationZones: text("qualification_zones", { mode: "json" }).$type<QualificationZone[]>(),
  parentTournamentId: integer("parent_tournament_id"),
  stageType: text("stage_type").$type<TournamentStage>().default("championship"),
});

export const insertTournamentSchema = createInsertSchema(tournamentsTable).omit({ id: true });
export type InsertTournament = z.infer<typeof insertTournamentSchema>;
export type Tournament = typeof tournamentsTable.$inferSelect;
