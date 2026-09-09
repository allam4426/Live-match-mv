import { sqliteTable, integer, text, uniqueIndex } from "drizzle-orm/sqlite-core";
    import { sql } from "drizzle-orm";
    import { matchesTable } from "./matches";

    export const matchPredictionsTable = sqliteTable("match_predictions", {
    id: integer("id").primaryKey({ autoIncrement: true }),
    matchId: integer("match_id").notNull().references(() => matchesTable.id, { onDelete: "cascade" }),
    visitorId: text("visitor_id").notNull(),
    homeScore: integer("home_score").notNull(),
    awayScore: integer("away_score").notNull(),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql.raw("(unixepoch())")),
    updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().default(sql.raw("(unixepoch())")),
    }, (table) => ({
    matchVisitorUnique: uniqueIndex("match_predictions_match_visitor_unique").on(table.matchId, table.visitorId),
    }));

    export type MatchPrediction = typeof matchPredictionsTable.$inferSelect;
    