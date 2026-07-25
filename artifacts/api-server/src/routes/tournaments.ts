import { Router } from "express";
import { db, tournamentsTable, matchesTable, teamsTable, matchEventsTable } from "@workspace/db";
import { eq, and, count, inArray } from "drizzle-orm";
import {
  CreateTournamentBody,
  UpdateTournamentBody,
  GetTournamentParams,
  UpdateTournamentParams,
  DeleteTournamentParams,
  GetTournamentStandingsParams,
} from "@workspace/api-zod";
import { alias } from "drizzle-orm/pg-core";

const router = Router();

router.get("/tournaments", async (req, res) => {
  const sport = req.query.sport as string | undefined;
  let rows = await db.select().from(tournamentsTable).orderBy(tournamentsTable.name);
  if (sport && sport !== "all") {
    rows = rows.filter(t => t.sport === sport);
  }
  res.json(rows);
});

// IMPORTANT: /tournaments/active must be BEFORE /tournaments/:id
router.get("/tournaments/active", async (req, res) => {
  const sport = req.query.sport as string | undefined;
  let tournaments = await db.select().from(tournamentsTable).orderBy(tournamentsTable.name);
  if (sport && sport !== "all") {
    tournaments = tournaments.filter(t => t.sport === sport);
  }

  const homeTeam = alias(teamsTable, "homeTeam");
  const awayTeam = alias(teamsTable, "awayTeam");

  const results = await Promise.all(tournaments.map(async (t) => {
    const allMatches = await db
      .select({ match: matchesTable, homeTeam, awayTeam })
      .from(matchesTable)
      .leftJoin(homeTeam, eq(matchesTable.homeTeamId, homeTeam.id))
      .leftJoin(awayTeam, eq(matchesTable.awayTeamId, awayTeam.id))
      .where(eq(matchesTable.tournamentId, t.id));

    const total = allMatches.length;
    const liveCount = allMatches.filter(m => m.match.status === "live").length;
    const scheduledCount = allMatches.filter(m => m.match.status === "scheduled").length;
    const finishedCount = allMatches.filter(m => m.match.status === "finished").length;

    let matchStatus: "live" | "ongoing" | "upcoming" | "finished";
    if (liveCount > 0) matchStatus = "live";
    else if (scheduledCount > 0 && finishedCount > 0) matchStatus = "ongoing";
    else if (scheduledCount > 0) matchStatus = "upcoming";
    else matchStatus = "finished";

    return {
      ...t,
      matchStatus,
      matchCount: total,
      liveCount,
    };
  }));

  // Only return tournaments that have at least one match
  res.json(results.filter(r => r.matchCount > 0));
});

router.post("/tournaments", async (req, res) => {
  const parsed = CreateTournamentBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [t] = await db.insert(tournamentsTable).values(parsed.data).returning();
  res.status(201).json(t);
});

router.get("/tournaments/:id", async (req, res) => {
  const { id } = GetTournamentParams.parse({ id: Number(req.params.id) });
  const [t] = await db.select().from(tournamentsTable).where(eq(tournamentsTable.id, id));
  if (!t) { res.status(404).json({ error: "Not found" }); return; }
  res.json(t);
});

router.patch("/tournaments/:id", async (req, res) => {
  const { id } = UpdateTournamentParams.parse({ id: Number(req.params.id) });
  const parsed = UpdateTournamentBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [t] = await db.update(tournamentsTable).set(parsed.data).where(eq(tournamentsTable.id, id)).returning();
  if (!t) { res.status(404).json({ error: "Not found" }); return; }
  res.json(t);
});

router.delete("/tournaments/:id", async (req, res) => {
  const { id } = DeleteTournamentParams.parse({ id: Number(req.params.id) });
  await db.delete(tournamentsTable).where(eq(tournamentsTable.id, id));
  res.status(204).send();
});

const TBD_TEAM = { id: 0, name: "TBD", shortName: "TBD", logoUrl: null, country: null, sport: "football" as const, createdAt: new Date() };

router.get("/tournaments/:id/matches", async (req, res) => {
  const id = Number(req.params.id);
  const homeTeam = alias(teamsTable, "homeTeam");
  const awayTeam = alias(teamsTable, "awayTeam");

  const rows = await db
    .select({ match: matchesTable, homeTeam, awayTeam })
    .from(matchesTable)
    .leftJoin(homeTeam, eq(matchesTable.homeTeamId, homeTeam.id))
    .leftJoin(awayTeam, eq(matchesTable.awayTeamId, awayTeam.id))
    .where(eq(matchesTable.tournamentId, id))
    .orderBy(matchesTable.kickoffAt);

  res.json(rows.map(row => ({
    id: row.match.id,
    homeTeam: row.homeTeam ?? TBD_TEAM,
    awayTeam: row.awayTeam ?? TBD_TEAM,
    homeScore: row.match.homeScore,
    awayScore: row.match.awayScore,
    status: row.match.status,
    minute: row.match.minute,
    competition: row.match.competition,
    competitionLogo: row.match.competitionLogo,
    kickoffAt: row.match.kickoffAt.toISOString(),
    streamCount: 0,
    featured: row.match.featured,
    sport: row.match.sport ?? "football",
    tournamentId: row.match.tournamentId,
    venue: row.match.venue,
    matchGroup: row.match.matchGroup,
  })));
});

function computeStandings(matches: Array<{
  match: typeof matchesTable.$inferSelect;
  homeTeam: typeof teamsTable.$inferSelect;
  awayTeam: typeof teamsTable.$inferSelect;
}>) {
  type ResultChar = "W" | "D" | "L";
  const teamMap = new Map<number, {
    team: typeof teamsTable.$inferSelect;
    played: number; won: number; drawn: number; lost: number;
    goalsFor: number; goalsAgainst: number; points: number;
    results: Array<{ date: string; result: ResultChar }>;
  }>();

  const sorted = [...matches].sort((a, b) =>
    new Date(a.match.kickoffAt).getTime() - new Date(b.match.kickoffAt).getTime()
  );

  for (const { match, homeTeam: ht, awayTeam: at } of sorted) {
    if (!teamMap.has(ht.id)) teamMap.set(ht.id, { team: ht, played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, points: 0, results: [] });
    if (!teamMap.has(at.id)) teamMap.set(at.id, { team: at, played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, points: 0, results: [] });
    const h = teamMap.get(ht.id)!;
    const a = teamMap.get(at.id)!;
    h.played++; a.played++;
    h.goalsFor += match.homeScore; h.goalsAgainst += match.awayScore;
    a.goalsFor += match.awayScore; a.goalsAgainst += match.homeScore;
    const date = match.kickoffAt.toString();
    if (match.homeScore > match.awayScore) {
      h.won++; h.points += 3; a.lost++;
      h.results.push({ date, result: "W" }); a.results.push({ date, result: "L" });
    } else if (match.homeScore < match.awayScore) {
      a.won++; a.points += 3; h.lost++;
      a.results.push({ date, result: "W" }); h.results.push({ date, result: "L" });
    } else {
      h.drawn++; h.points++; a.drawn++; a.points++;
      h.results.push({ date, result: "D" }); a.results.push({ date, result: "D" });
    }
  }

  return Array.from(teamMap.values())
    .sort((a, b) => b.points - a.points || (b.goalsFor - b.goalsAgainst) - (a.goalsFor - a.goalsAgainst))
    .map((s, i) => ({
      position: i + 1,
      team: s.team,
      played: s.played,
      won: s.won,
      drawn: s.drawn,
      lost: s.lost,
      goalsFor: s.goalsFor,
      goalsAgainst: s.goalsAgainst,
      goalDifference: s.goalsFor - s.goalsAgainst,
      points: s.points,
      formGuide: s.results.slice(-5).map(r => r.result),
    }));
}

router.get("/tournaments/:id/standings", async (req, res) => {
  const { id } = GetTournamentStandingsParams.parse({ id: Number(req.params.id) });

  const [tournament] = await db.select().from(tournamentsTable).where(eq(tournamentsTable.id, id));
  if (!tournament) { res.status(404).json({ error: "Not found" }); return; }

  const homeTeam = alias(teamsTable, "homeTeam");
  const awayTeam = alias(teamsTable, "awayTeam");

  const allMatches = await db
    .select({ match: matchesTable, homeTeam, awayTeam })
    .from(matchesTable)
    .leftJoin(homeTeam, eq(matchesTable.homeTeamId, homeTeam.id))
    .leftJoin(awayTeam, eq(matchesTable.awayTeamId, awayTeam.id))
    .where(and(eq(matchesTable.tournamentId, id), eq(matchesTable.status, "finished")));

  const format = tournament.format ?? "league";

  // Knockout round names — matches with these groups don't count toward standings
  const normalizeGroup = (s: string) => s.toLowerCase().replace(/[-_\s]+/g, " ").trim();
  const KNOCKOUT_ROUNDS = new Set([
    "round of 128","round of 64","round of 32","round of 16","round of 8",
    "quarter final","quarter finals","quarterfinal","quarterfinals","qf",
    "semi final","semi finals","semifinal","semifinals","sf",
    "third place","third place playoff",
    "playoff","play off","final","grand final","championship",
    "round of 4","round of 2",
  ].map(normalizeGroup));
  const isKnockoutRound = (g: string | null) =>
    !!g && KNOCKOUT_ROUNDS.has(normalizeGroup(g));

  // Filter out knockout-round matches so only group stage matches go into standings
  const standingsMatches = allMatches.filter(m => !isKnockoutRound(m.match.matchGroup));

  // Check if any match has a group assigned
  const hasGroups = standingsMatches.some(m => m.match.matchGroup);

  if (format === "group_stage" || hasGroups) {
    // Group by matchGroup
    const grouped = new Map<string, typeof standingsMatches>();
    for (const m of standingsMatches) {
      const grp = m.match.matchGroup ?? "Ungrouped";
      if (!grouped.has(grp)) grouped.set(grp, []);
      grouped.get(grp)!.push(m);
    }

    // Sort groups alphabetically
    const sortedGroups = Array.from(grouped.entries()).sort(([a], [b]) => a.localeCompare(b));
    const groups: Record<string, ReturnType<typeof computeStandings>> = {};
    for (const [grp, matches] of sortedGroups) {
      groups[grp] = computeStandings(matches.filter(m => m.homeTeam && m.awayTeam) as Parameters<typeof computeStandings>[0]);
    }

    res.json({ format: "group_stage", groups });
  } else {
    // Single league table
    const standings = computeStandings(allMatches.filter(m => m.homeTeam && m.awayTeam) as Parameters<typeof computeStandings>[0]);
    res.json({ format, groups: { "League": standings } });
  }
});

router.get("/tournaments/:id/top-scorers", async (req, res) => {
  const id = Number(req.params.id);

  const tournamentMatches = await db
    .select({ id: matchesTable.id })
    .from(matchesTable)
    .where(eq(matchesTable.tournamentId, id));

  const matchIds = tournamentMatches.map(m => m.id);
  if (matchIds.length === 0) {
    res.json({ topScorers: [], mvp: [] });
    return;
  }

  const events = await db
    .select({ ev: matchEventsTable, team: teamsTable })
    .from(matchEventsTable)
    .innerJoin(teamsTable, eq(matchEventsTable.teamId, teamsTable.id))
    .where(inArray(matchEventsTable.matchId, matchIds));

  type ScorerEntry = {
    playerName: string; playerNumber: string | null;
    teamId: number; teamName: string; teamShortName: string | null; teamLogoUrl: string | null;
    goals: number; assists: number;
  };
  type StatEntry = {
    playerName: string; playerNumber: string | null;
    teamId: number; teamName: string; teamShortName: string | null; teamLogoUrl: string | null;
    count: number;
  };
  const scorerMap = new Map<string, ScorerEntry>();
  const mvpMap = new Map<string, ScorerEntry>();
  const yellowMap = new Map<string, StatEntry>();
  const redMap = new Map<string, StatEntry>();
  const ownGoalMap = new Map<string, StatEntry>();

  const getKey = (name: string, teamId: number) => `${name}::${teamId}`;

  const ensureScorer = (map: Map<string, ScorerEntry>, name: string, num: string | null, teamId: number, team: typeof teamsTable.$inferSelect): ScorerEntry => {
    const key = getKey(name, teamId);
    if (!map.has(key)) map.set(key, { playerName: name, playerNumber: num, teamId, teamName: team.name, teamShortName: team.shortName, teamLogoUrl: team.logoUrl, goals: 0, assists: 0 });
    return map.get(key)!;
  };

  const ensureStat = (map: Map<string, StatEntry>, name: string, num: string | null, teamId: number, team: typeof teamsTable.$inferSelect): StatEntry => {
    const key = getKey(name, teamId);
    if (!map.has(key)) map.set(key, { playerName: name, playerNumber: num, teamId, teamName: team.name, teamShortName: team.shortName, teamLogoUrl: team.logoUrl, count: 0 });
    return map.get(key)!;
  };

  for (const { ev, team } of events) {
    if (ev.type === "goal" || ev.type === "penalty_goal") {
      ensureScorer(scorerMap, ev.playerName, ev.playerNumber ?? null, ev.teamId, team).goals += 1;
    }
    if (ev.assistPlayerName && (ev.type === "goal" || ev.type === "penalty_goal")) {
      ensureScorer(scorerMap, ev.assistPlayerName, null, ev.teamId, team).assists += 1;
    }
    if (ev.type === "own_goal") {
      ensureStat(ownGoalMap, ev.playerName, ev.playerNumber ?? null, ev.teamId, team).count += 1;
    }
    if (ev.type === "yellow_card" || ev.type === "second_yellow_red") {
      ensureStat(yellowMap, ev.playerName, ev.playerNumber ?? null, ev.teamId, team).count += 1;
    }
    if (ev.type === "red_card" || ev.type === "second_yellow_red") {
      ensureStat(redMap, ev.playerName, ev.playerNumber ?? null, ev.teamId, team).count += 1;
    }
    if (ev.type === "mvp") {
      ensureScorer(mvpMap, ev.playerName, ev.playerNumber ?? null, ev.teamId, team);
    }
  }

  const topScorers = Array.from(scorerMap.values())
    .filter(p => p.goals > 0)
    .sort((a, b) => b.goals - a.goals || b.assists - a.assists)
    .slice(0, 20);

  const yellowCards = Array.from(yellowMap.values()).sort((a, b) => b.count - a.count).slice(0, 20);
  const redCards = Array.from(redMap.values()).sort((a, b) => b.count - a.count).slice(0, 20);
  const ownGoals = Array.from(ownGoalMap.values()).sort((a, b) => b.count - a.count).slice(0, 20);

  res.json({ topScorers, mvp: Array.from(mvpMap.values()), yellowCards, redCards, ownGoals });
});

export default router;
