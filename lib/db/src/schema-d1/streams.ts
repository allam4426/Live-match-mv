import { sqliteTable, integer, text } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { matchesTable } from "./matches";

export const streamsTable = sqliteTable("streams", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  matchId: integer("match_id").notNull().references(() => matchesTable.id, { onDelete: "cascade" }),
  label: text("label").notNull(),
  url: text("url").notNull(),
  quality: text("quality").notNull().default("HD"),
  language: text("language").notNull().default("EN"),
  embedCode: text("embed_code"),
});

export const insertStreamSchema = createInsertSchema(streamsTable).omit({ id: true });
export type InsertStream = z.infer<typeof insertStreamSchema>;
export type Stream = typeof streamsTable.$inferSelect;
