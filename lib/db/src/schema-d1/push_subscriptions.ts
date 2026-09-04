import { sqliteTable, integer, text, uniqueIndex } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

export const pushSubscriptionsTable = sqliteTable("push_subscriptions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  endpoint: text("endpoint").notNull().unique(),
  p256dh: text("p256dh").notNull(),
  auth: text("auth").notNull(),
  teamIds: text("team_ids").notNull().default("[]"),
  tournamentIds: text("tournament_ids").notNull().default("[]"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
}, (table) => ({
  endpointUnique: uniqueIndex("push_subscriptions_endpoint_unique").on(table.endpoint),
}));

export type PushSubscription = typeof pushSubscriptionsTable.$inferSelect;
