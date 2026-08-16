import { Router } from "express";
import { db, matchesTable, teamsTable, streamsTable, matchEventsTable } from "@workspace/db";
import { eq, and, desc, count, inArray } from "drizzle-orm";
import { sendPushToAll } from "./push";
import {
  CreateMatchBody,
  UpdateMatchBody,
  GetMatchParams,
  UpdateMatchParams,
  DeleteMatchParams,
  ListMatchesQueryParams,
} from "@workspace/api-zod";
import { alias } from "drizzle-orm/pg-core";
import { subscribeToMatch, unsubscribeFromMatch } from "../lib/match-sse";

const router = Router();

const TBD_TEAM = {
  id: 0,
  name: "TBD",
  shortName: "TBD",
  logoUrl: null,
  sport: "football",
  createdAt: new Date(),
};

function buildMatch(row: {
  match: typeof matchesTable.$inferSelect;
  homeTeam: typeof teamsTable.$inferSelect | null;
  awayTeam: typeof teamsTable.$inferSelect | null;
  streamCount: number;
  homeRedCards?: number;
  awayRedCards?: number;
  homeYellowCards?: number;
  awayYellowCards?: number;
  homePenGoals?: number;
  awayPenGoals?: number;
}) {
  const homeTeam = row.homeTeam ?? TBD_TEAM;
  const awayTeam = row.awayTeam ?? TBD_TEAM;
  return {
    id: row.match.id,
    homeTeam: { ...homeTeam, sport: homeTeam.sport ?? "football" },
    awayTeam: { ...awayTeam, sport: awayTeam.sport ?? "football" },
    homeScore: row.match.homeScore,
    awayScore: row.match.awayScore,
    status: row.match.status,
    minute: row.match.minute,
    competition: row.match.competition,
    competitionLogo: row.match.competitionLogo,
    kickoffAt: row.match.kickoffAt.toISOString(),
    streamCount: row.streamCount,
    featured: row.match.featured,
    sport: row.match.sport ?? "football",
    tournamentId: row.match.tournamentId,
    venue: row.match.venue,
    matchGroup: row.match.matchGroup,
    homeRedCards: row.homeRedCards ?? 0,
    awayRedCards: row.awayRedCards ?? 0,
    homeYellowCards: row.homeYellowCards ?? 0,
    awayYellowCards: row.awayYellowCards ?? 0,
    homePenGoals: row.homePenGoals ?? 0,
    awayPenGoals: row.awayPenGoals ?? 0,
    clockAnchorMs: row.match.clockAnchorMs ?? null,
  };
}

/** Fetch card counts for a set of match IDs and return per-match per-team aggregates. */
async function fetchCardCounts(matchIds: number[], rows: Array<{ match: typeof matchesTable.$inferSelect }>) {
  if (matchIds.length === 0) return new Map<number, { homeRed: number; awayRed: number; homeYellow: number; awayYellow: number }>();

  const cardRows = await db
    .select({
      matchId: matchEventsTable.matchId,
      teamId: matchEventsTable.teamId,
      type: matchEventsTable.type,
      cnt: count(),
    })
    .from(matchEventsTable)
    .where(and(
      inArray(matchEventsTable.matchId, matchIds),
      inArray(matchEventsTable.type, ["yellow_card", "red_card", "second_yellow_red"]),
    ))
    .groupBy(matchEventsTable.matchId, matchEventsTable.teamId, matchEventsTable.type);

  const matchTeamMap = new Map(rows.map(r => [r.match.id, { homeTeamId: r.match.homeTeamId, awayTeamId: r.match.awayTeamId }]));

  const result = new Map<number, { homeRed: number; awayRed: number; homeYellow: number; awayYellow: number }>();
  for (const cr of cardRows) {
    const teams = matchTeamMap.get(cr.matchId!);
    if (!teams || !cr.matchId) continue;
    const entry = result.get(cr.matchId) ?? { homeRed: 0, awayRed: 0, homeYellow: 0, awayYellow: 0 };
    const n = Number(cr.cnt);
    const isHome = cr.teamId === teams.homeTeamId;
    const isRed = cr.type === "red_card" || cr.type === "second_yellow_red";
    if (isRed) {
      if (isHome) entry.homeRed += n; else entry.awayRed += n;
    } else {
      if (isHome) entry.homeYellow += n; else entry.awayYellow += n;
    }
    result.set(cr.matchId, entry);
  }
  return result;
}

async function fetchPenaltyGoals(matchIds: number[], rows: Array<{ match: typeof matchesTable.$inferSelect }>) {
  if (matchIds.length === 0) return new Map<number, { home: number; away: number }>();
  const penRows = await db
    .select({
      matchId: matchEventsTable.matchId,
      teamId: matchEventsTable.teamId,
      cnt: count(),
    })
    .from(matchEventsTable)
    .where(and(
      inArray(matchEventsTable.matchId, matchIds),
      eq(matchEventsTable.type, "penalty_goal"),
      eq(matchEventsTable.minute, "PSO"),
    ))
    .groupBy(matchEventsTable.matchId, matchEventsTable.teamId);
  const matchTeamMap = new Map(rows.map(r => [r.match.id, { homeTeamId: r.match.homeTeamId, awayTeamId: r.match.awayTeamId }]));
  const result = new Map<number, { home: number; away: number }>();
  for (const pr of penRows) {
    const teams = matchTeamMap.get(pr.matchId!);
    if (!teams || !pr.matchId) continue;
    const entry = result.get(pr.matchId) ?? { home: 0, away: 0 };
    const n = Number(pr.cnt);
    if (pr.teamId === teams.homeTeamId) entry.home += n; else entry.away += n;
    result.set(pr.matchId, entry);
  }
  return result;
}

router.get("/matches", async (req, res) => {
  const params = ListMatchesQueryParams.safeParse({
    status: req.query.status,
    competition: req.query.competition,
    limit: req.query.limit ? Number(req.query.limit) : 50,
  });

  const sport = req.query.sport as string | undefined;
  const tournamentId = req.query.tournamentId ? Number(req.query.tournamentId) : undefined;

  const homeTeam = alias(teamsTable, "homeTeam");
  const awayTeam = alias(teamsTable, "awayTeam");

  const conditions = [];
  if (params.success && params.data.status && params.data.status !== "all") {
    conditions.push(eq(matchesTable.status, params.data.status));
  }
  if (params.success && params.data.competition) {
    conditions.push(eq(matchesTable.competition, params.data.competition));
  }
  if (sport && sport !== "all") {
    conditions.push(eq(matchesTable.sport, sport));
  }
  if (tournamentId) {
    conditions.push(eq(matchesTable.tournamentId, tournamentId));
  }

  const rows = await db
    .select({ match: matchesTable, homeTeam, awayTeam })
    .from(matchesTable)
    .leftJoin(homeTeam, eq(matchesTable.homeTeamId, homeTeam.id))
    .leftJoin(awayTeam, eq(matchesTable.awayTeamId, awayTeam.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(matchesTable.kickoffAt))
    .limit(params.success ? (params.data.limit ?? 50) : 50);

  const matchIds = rows.map(r => r.match.id);
  const [streamCounts, cardCountMap, penGoalsMap] = await Promise.all([
    matchIds.length > 0
      ? db.select({ matchId: streamsTable.matchId, cnt: count() }).from(streamsTable).groupBy(streamsTable.matchId)
      : Promise.resolve([]),
    fetchCardCounts(matchIds, rows),
    fetchPenaltyGoals(matchIds, rows),
  ]);
  const streamCountMap = new Map(streamCounts.map(s => [s.matchId, Number(s.cnt)]));

  res.json(rows.map(row => {
    const cards = cardCountMap.get(row.match.id);
    const pen = penGoalsMap.get(row.match.id);
    return buildMatch({
      ...row,
      streamCount: streamCountMap.get(row.match.id) ?? 0,
      homeRedCards: cards?.homeRed,
      awayRedCards: cards?.awayRed,
      homeYellowCards: cards?.homeYellow,
      awayYellowCards: cards?.awayYellow,
      homePenGoals: pen?.home,
      awayPenGoals: pen?.away,
    });
  }));
});

router.post("/matches", async (req, res) => {
  const parsed = CreateMatchBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { homeTeamId, awayTeamId, homeScore, awayScore, status, minute, competition, competitionLogo, kickoffAt, featured, sport, tournamentId, venue, matchGroup } = parsed.data;
  const [match] = await db.insert(matchesTable).values({
    homeTeamId: homeTeamId ?? null,
    awayTeamId: awayTeamId ?? null,
    homeScore: homeScore ?? 0,
    awayScore: awayScore ?? 0,
    status: status ?? "scheduled",
    minute: (minute && minute !== "null") ? minute : null,
    competition,
    competitionLogo: competitionLogo ?? null,
    kickoffAt: new Date(kickoffAt),
    featured: featured ?? false,
    sport: sport ?? "football",
    tournamentId: tournamentId ?? null,
    venue: venue ?? null,
    matchGroup: matchGroup ?? null,
  }).returning();

  const homeTeam = alias(teamsTable, "homeTeam");
  const awayTeam = alias(teamsTable, "awayTeam");
  const [row] = await db
    .select({ match: matchesTable, homeTeam, awayTeam })
    .from(matchesTable)
    .leftJoin(homeTeam, eq(matchesTable.homeTeamId, homeTeam.id))
    .leftJoin(awayTeam, eq(matchesTable.awayTeamId, awayTeam.id))
    .where(eq(matchesTable.id, match.id));

  res.status(201).json(buildMatch({ ...row, streamCount: 0 }));
});

// IMPORTANT: /matches/live must be defined BEFORE /matches/:id
router.get("/matches/live", async (req, res) => {
  const sport = req.query.sport as string | undefined;
  const homeTeam = alias(teamsTable, "homeTeam");
  const awayTeam = alias(teamsTable, "awayTeam");

  const conditions = [eq(matchesTable.status, "live")];
  if (sport && sport !== "all") conditions.push(eq(matchesTable.sport, sport));

  const rows = await db
    .select({ match: matchesTable, homeTeam, awayTeam })
    .from(matchesTable)
    .leftJoin(homeTeam, eq(matchesTable.homeTeamId, homeTeam.id))
    .leftJoin(awayTeam, eq(matchesTable.awayTeamId, awayTeam.id))
    .where(and(...conditions))
    .orderBy(desc(matchesTable.kickoffAt));

  const matchIds = rows.map(r => r.match.id);
  const [streamCounts, cardCountMap] = await Promise.all([
    matchIds.length > 0
      ? db.select({ matchId: streamsTable.matchId, cnt: count() }).from(streamsTable).groupBy(streamsTable.matchId)
      : Promise.resolve([]),
    fetchCardCounts(matchIds, rows),
  ]);
  const streamCountMap = new Map(streamCounts.map(s => [s.matchId, Number(s.cnt)]));

  res.json(rows.map(row => {
    const cards = cardCountMap.get(row.match.id);
    return buildMatch({
      ...row,
      streamCount: streamCountMap.get(row.match.id) ?? 0,
      homeRedCards: cards?.homeRed,
      awayRedCards: cards?.awayRed,
      homeYellowCards: cards?.homeYellow,
      awayYellowCards: cards?.awayYellow,
    });
  }));
});

router.get("/matches/:id", async (req, res) => {
  const { id } = GetMatchParams.parse({ id: Number(req.params.id) });

  const homeTeam = alias(teamsTable, "homeTeam");
  const awayTeam = alias(teamsTable, "awayTeam");

  const [row] = await db
    .select({ match: matchesTable, homeTeam, awayTeam })
    .from(matchesTable)
    .leftJoin(homeTeam, eq(matchesTable.homeTeamId, homeTeam.id))
    .leftJoin(awayTeam, eq(matchesTable.awayTeamId, awayTeam.id))
    .where(eq(matchesTable.id, id));

  if (!row) { res.status(404).json({ error: "Match not found" }); return; }

  const [streams, events] = await Promise.all([
    db.select().from(streamsTable).where(eq(streamsTable.matchId, id)),
    db.select().from(matchEventsTable).where(eq(matchEventsTable.matchId, id)).orderBy(matchEventsTable.minute),
  ]);

  res.json({
    ...buildMatch({ ...row, streamCount: streams.length }),
    streams,
    events,
  });
});

router.patch("/matches/:id", async (req, res) => {
  const { id } = UpdateMatchParams.parse({ id: Number(req.params.id) });
  const parsed = UpdateMatchBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  // Fetch old status before update to detect live transition
  const [old] = await db.select({ status: matchesTable.status }).from(matchesTable).where(eq(matchesTable.id, id));

  const { kickoffAt: kickoffAtStr, ...rest } = parsed.data;
  const updateData: Record<string, unknown> = { ...rest };
  if (kickoffAtStr) updateData.kickoffAt = new Date(kickoffAtStr);
  const [match] = await db.update(matchesTable).set(updateData).where(eq(matchesTable.id, id)).returning();
  if (!match) { res.status(404).json({ error: "Match not found" }); return; }

  const homeTeam = alias(teamsTable, "homeTeam");
  const awayTeam = alias(teamsTable, "awayTeam");
  const [row] = await db
    .select({ match: matchesTable, homeTeam, awayTeam })
    .from(matchesTable)
    .leftJoin(homeTeam, eq(matchesTable.homeTeamId, homeTeam.id))
    .leftJoin(awayTeam, eq(matchesTable.awayTeamId, awayTeam.id))
    .where(eq(matchesTable.id, id));

  const [sc] = await db.select({ cnt: count() }).from(streamsTable).where(eq(streamsTable.matchId, id));
  const result = buildMatch({ ...row, streamCount: Number(sc.cnt) });

  // Send push notification when match transitions to live
  if (old?.status !== "live" && match.status === "live") {
    const homeName = row.homeTeam?.name ?? "Home";
    const awayName = row.awayTeam?.name ?? "Away";
    setImmediate(() =>
      sendPushToAll({
        title: "🔴 Match is LIVE!",
        body: `${homeName} vs ${awayName} has kicked off — ${match.competition}`,
        url: `/match/${id}`,
      })
    );
  }

  // Send push notification when match transitions to finished
  if (old?.status !== "finished" && match.status === "finished") {
    const homeName = row.homeTeam?.name ?? "Home";
    const awayName = row.awayTeam?.name ?? "Away";
    const homeScore = match.homeScore ?? 0;
    const awayScore = match.awayScore ?? 0;
    setImmediate(() =>
      sendPushToAll({
        title: "🏁 Full Time",
        body: `${homeName} ${homeScore}–${awayScore} ${awayName} — ${match.competition}`,
        url: `/match/${id}`,
      })
    );
  }

  res.json(result);
});

router.delete("/matches/:id", async (req, res) => {
  const { id } = DeleteMatchParams.parse({ id: Number(req.params.id) });
  await db.delete(matchesTable).where(eq(matchesTable.id, id));
  res.status(204).send();
});

/* ── SSE: real-time score updates ── */
router.get("/matches/:id/stream", (req, res) => {
  const matchId = Number(req.params.id);
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no"); // disable nginx buffering
  res.flushHeaders();

  // Send a heartbeat every 25s to keep the connection alive through proxies
  const heartbeat = setInterval(() => {
    try { res.write(": ping\n\n"); } catch { clearInterval(heartbeat); }
  }, 25000);

  subscribeToMatch(matchId, res);

  req.on("close", () => {
    clearInterval(heartbeat);
    unsubscribeFromMatch(matchId, res);
  });
});

export default router;
