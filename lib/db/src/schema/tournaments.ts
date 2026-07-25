import { pgTable, serial, text, boolean, json } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const QualificationZoneSchema = z.object({
  fromPos: z.number().int(),
  toPos: z.number().int(),
  type: z.enum(["champion", "qualified", "qualified_playoff", "relegated_playoff", "relegated"]),
  label: z.string(),
});
export type QualificationZone = z.infer<typeof QualificationZoneSchema>;

export const tournamentsTable = pgTable("tournaments", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  sport: text("sport").notNull().default("football"),
  season: text("season").notNull(),
  logoUrl: text("logo_url"),
  description: text("description"),
  active: boolean("active").notNull().default(true),
  format: text("format").notNull().default("league"),
  singleGroupFormat: text("single_group_format"),
  color: text("color"),
  qualificationZones: json("qualification_zones").$type<QualificationZone[]>(),
});

export const insertTournamentSchema = createInsertSchema(tournamentsTable).omit({ id: true });
export type InsertTournament = z.infer<typeof insertTournamentSchema>;
export type Tournament = typeof tournamentsTable.$inferSelect;
