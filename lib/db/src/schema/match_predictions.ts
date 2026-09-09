import { pgTable, serial, integer, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
    import { matchesTable } from "./matches";

    export const matchPredictionsTable = pgTable("match_predictions", {
    id: serial("id").primaryKey(),
    matchId: integer("match_id").notNull().references(() => matchesTable.id, { onDelete: "cascade" }),
    visitorId: text("visitor_id").notNull(),
    homeScore: integer("home_score").notNull(),
    awayScore: integer("away_score").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
    }, (table) => ({
    matchVisitorUnique: uniqueIndex("match_predictions_match_visitor_unique").on(table.matchId, table.visitorId),
    }));

    export type MatchPrediction = typeof matchPredictionsTable.$inferSelect;
    