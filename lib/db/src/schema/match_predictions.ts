import { pgTable, serial, integer, text, timestamp, uniqueIndex, index } from "drizzle-orm/pg-core";
import { matchesTable } from "./matches";

export const matchPredictionsTable = pgTable("match_predictions", {
  id: serial("id").primaryKey(),
  matchId: integer("match_id").notNull().references(() => matchesTable.id, { onDelete: "cascade" }),
  visitorId: text("visitor_id").notNull(),
  userId: text("user_id"),
  displayName: text("display_name").notNull().default("Player"),
  avatarUrl: text("avatar_url"),
  homeScore: integer("home_score").notNull(),
  awayScore: integer("away_score").notNull(),
  points: integer("points").notNull().default(0),
  status: text("status").notNull().default("pending"),
  submittedAt: timestamp("submitted_at").notNull().defaultNow(),
  lockedAt: timestamp("locked_at"),
  calculatedAt: timestamp("calculated_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  matchVisitorUnique: uniqueIndex("match_predictions_match_visitor_unique").on(table.matchId, table.visitorId),
  matchIndex: index("match_predictions_match_idx").on(table.matchId),
  userIndex: index("match_predictions_user_idx").on(table.userId),
}));

export type MatchPrediction = typeof matchPredictionsTable.$inferSelect;
