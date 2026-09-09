import { sqliteTable, integer, text, uniqueIndex, index } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";
import { matchesTable } from "./matches";

export const matchPredictionsTable = sqliteTable("match_predictions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  matchId: integer("match_id").notNull().references(() => matchesTable.id, { onDelete: "cascade" }),
  visitorId: text("visitor_id").notNull(),
  userId: text("user_id"),
  displayName: text("display_name").notNull().default("Player"),
  avatarUrl: text("avatar_url"),
  homeScore: integer("home_score").notNull(),
  awayScore: integer("away_score").notNull(),
  points: integer("points").notNull().default(0),
  status: text("status").notNull().default("pending"),
  submittedAt: integer("submitted_at", { mode: "timestamp" }).notNull().default(sql.raw("(unixepoch())")),
  lockedAt: integer("locked_at", { mode: "timestamp" }),
  calculatedAt: integer("calculated_at", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql.raw("(unixepoch())")),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().default(sql.raw("(unixepoch())")),
}, (table) => ({
  matchVisitorUnique: uniqueIndex("match_predictions_match_visitor_unique").on(table.matchId, table.visitorId),
  matchIndex: index("match_predictions_match_idx").on(table.matchId),
  userIndex: index("match_predictions_user_idx").on(table.userId),
}));

export type MatchPrediction = typeof matchPredictionsTable.$inferSelect;
