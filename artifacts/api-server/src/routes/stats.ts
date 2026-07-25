import { Router } from "express";
import { db, matchesTable, teamsTable, highlightsTable, streamsTable, tournamentsTable } from "@workspace/db";
import { eq, count, sql } from "drizzle-orm";

const router = Router();

router.get("/stats/summary", async (req, res) => {
  const [liveCount] = await db.select({ count: count() }).from(matchesTable).where(eq(matchesTable.status, "live"));
  const [scheduledCount] = await db.select({ count: count() }).from(matchesTable).where(eq(matchesTable.status, "scheduled"));
  const [finishedCount] = await db.select({ count: count() }).from(matchesTable).where(eq(matchesTable.status, "finished"));
  const [teamCount] = await db.select({ count: count() }).from(teamsTable);
  const [highlightCount] = await db.select({ count: count() }).from(highlightsTable);
  const [streamCount] = await db.select({ count: count() }).from(streamsTable);
  const [tournamentCount] = await db.select({ count: count() }).from(tournamentsTable);

  res.json({
    liveMatchCount: liveCount.count,
    scheduledMatchCount: scheduledCount.count,
    finishedMatchCount: finishedCount.count,
    totalTeams: teamCount.count,
    totalHighlights: highlightCount.count,
    totalStreams: streamCount.count,
    totalTournaments: tournamentCount.count,
  });
});

router.get("/stats/competitions", async (req, res) => {
  const rows = await db
    .select({
      competition: matchesTable.competition,
      competitionLogo: matchesTable.competitionLogo,
      liveCount: sql<number>`cast(sum(case when ${matchesTable.status} = 'live' then 1 else 0 end) as int)`,
      totalCount: count(),
    })
    .from(matchesTable)
    .groupBy(matchesTable.competition, matchesTable.competitionLogo)
    .orderBy(sql`sum(case when ${matchesTable.status} = 'live' then 1 else 0 end) desc`);

  res.json(rows.map(r => ({
    name: r.competition,
    logoUrl: r.competitionLogo,
    liveCount: r.liveCount,
    totalCount: r.totalCount,
  })));
});

export default router;
