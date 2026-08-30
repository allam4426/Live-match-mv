import { Hono } from "hono";
import { getSignedCookie, setSignedCookie, deleteCookie } from "hono/cookie";
import bcrypt from "bcryptjs";
import { drizzle } from "drizzle-orm/d1";
import { eq, or, desc, inArray, and, asc, count as sqlCount, sql } from "drizzle-orm";
import * as schema from "@workspace/db/schema-d1";
import { buildPushPayload } from "@block65/webcrypto-web-push";
import { buildPushPayload } from "@block65/webcrypto-web-push";

type Bindings = {
  DB: D1Database;
  ASSETS: Fetcher;
  ADMIN_PASSWORD?: string;
  COOKIE_SECRET?: string;
  VAPID_PUBLIC_KEY?: string;
};

const app = new Hono<{ Bindings: Bindings }>();

/* ─── teams routes ─── */

app.get("/api/teams", async (c) => {
  const db = drizzle(c.env.DB, { schema });
  const sport = c.req.query("sport");
  let teams = await db.select().from(schema.teamsTable).orderBy(schema.teamsTable.name);
  if (sport && sport !== "all") {
    teams = teams.filter((t) => t.sport === sport);
  }
  return c.json(teams);
});

app.post("/api/teams", async (c) => {
  const db = drizzle(c.env.DB, { schema });
  const body = await c.req.json();
  if (!body.name) return c.json({ error: "name is required" }, 400);
  const [team] = await db.insert(schema.teamsTable).values({
    ...body,
    logoUrl: body.logoUrl ?? "",
  }).returning();
  return c.json(team, 201);
});

app.get("/api/teams/:id", async (c) => {
  const db = drizzle(c.env.DB, { schema });
  const id = Number(c.req.param("id"));
  if (isNaN(id)) return c.json({ error: "Invalid id" }, 400);
  const [team] = await db.select().from(schema.teamsTable).where(eq(schema.teamsTable.id, id));
  if (!team) return c.json({ error: "Team not found" }, 404);
  return c.json(team);
});

app.patch("/api/teams/:id", async (c) => {
  const db = drizzle(c.env.DB, { schema });
  const id = Number(c.req.param("id"));
  if (isNaN(id)) return c.json({ error: "Invalid id" }, 400);
  const body = await c.req.json();
  const [team] = await db.update(schema.teamsTable).set(body).where(eq(schema.teamsTable.id, id)).returning();
  if (!team) return c.json({ error: "Team not found" }, 404);
  return c.json(team);
});

app.delete("/api/teams/:id", async (c) => {
  const db = drizzle(c.env.DB, { schema });
  const id = Number(c.req.param("id"));
  if (isNaN(id)) return c.json({ error: "Invalid id" }, 400);
  await db.delete(schema.teamsTable).where(eq(schema.teamsTable.id, id));
  return c.body(null, 204);
});

app.get("/api/teams/:id/matches", async (c) => {
  const db = drizzle(c.env.DB, { schema });
  const id = Number(c.req.param("id"));
  if (isNaN(id)) return c.json({ error: "Invalid id" }, 400);

  const rows = await db
    .select()
    .from(schema.matchesTable)
    .where(or(eq(schema.matchesTable.homeTeamId, id), eq(schema.matchesTable.awayTeamId, id)))
    .orderBy(desc(schema.matchesTable.kickoffAt))
    .limit(20);

  const teamIds = [...new Set(rows.flatMap(m => [m.homeTeamId, m.awayTeamId]).filter((x): x is number => x !== null))];
  const teams = teamIds.length > 0
    ? await db.select().from(schema.teamsTable).where(inArray(schema.teamsTable.id, teamIds))
    : [];
  const teamMap = new Map(teams.map(t => [t.id, t]));

  return c.json(rows.map(m => ({
    id: m.id,
    homeScore: m.homeScore,
    awayScore: m.awayScore,
    status: m.status,
    kickoffAt: m.kickoffAt,
    competition: m.competition,
    minute: m.minute,
    tournamentId: m.tournamentId,
    homeTeam: m.homeTeamId && teamMap.has(m.homeTeamId)
      ? { id: teamMap.get(m.homeTeamId)!.id, name: teamMap.get(m.homeTeamId)!.name, logoUrl: teamMap.get(m.homeTeamId)!.logoUrl, shortName: teamMap.get(m.homeTeamId)!.shortName }
      : null,
    awayTeam: m.awayTeamId && teamMap.has(m.awayTeamId)
      ? { id: teamMap.get(m.awayTeamId)!.id, name: teamMap.get(m.awayTeamId)!.name, logoUrl: teamMap.get(m.awayTeamId)!.logoUrl, shortName: teamMap.get(m.awayTeamId)!.shortName }
      : null,
  })));
});

app.get("/api/teams/:id/tournaments", async (c) => {
  const db = drizzle(c.env.DB, { schema });
  const id = Number(c.req.param("id"));
  if (isNaN(id)) return c.json({ error: "Invalid id" }, 400);

  const rows = await db
    .selectDistinct({ tournamentId: schema.matchesTable.tournamentId })
    .from(schema.matchesTable)
    .where(or(eq(schema.matchesTable.homeTeamId, id), eq(schema.matchesTable.awayTeamId, id)));

  const ids = rows.map((r) => r.tournamentId).filter((x): x is number => x !== null);
  if (ids.length === 0) return c.json([]);

  const result = await db
    .select()
    .from(schema.tournamentsTable)
    .where(inArray(schema.tournamentsTable.id, ids))
    .orderBy(desc(schema.tournamentsTable.id));

  return c.json(result);
});

app.get("/api/teams/:id/form", async (c) => {
  const db = drizzle(c.env.DB, { schema });
  const id = Number(c.req.param("id"));
  if (isNaN(id)) return c.json({ error: "Invalid id" }, 400);

  const [team] = await db.select().from(schema.teamsTable).where(eq(schema.teamsTable.id, id));
  if (!team) return c.json({ error: "Team not found" }, 404);

  const finished = await db
    .select()
    .from(schema.matchesTable)
    .where(or(eq(schema.matchesTable.homeTeamId, id), eq(schema.matchesTable.awayTeamId, id)))
    .orderBy(desc(schema.matchesTable.kickoffAt))
    .limit(50);

  const finishedOnly = finished.filter((m) => m.status === "finished").slice(0, 5);

  const form = finishedOnly.reverse().map((m) => {
    const isHome = m.homeTeamId === id;
    const scored = isHome ? m.homeScore : m.awayScore;
    const conceded = isHome ? m.awayScore : m.homeScore;
    if (scored > conceded) return "W";
    if (scored < conceded) return "L";
    return "D";
  });

  return c.json({ teamId: id, form });
});


/* ─── tournaments routes ─── */

app.get("/api/tournaments", async (c) => {
  const db = drizzle(c.env.DB, { schema });
  const sport = c.req.query("sport");
  let rows = await db.select().from(schema.tournamentsTable).orderBy(schema.tournamentsTable.name);
  if (sport && sport !== "all") {
    rows = rows.filter((t) => t.sport === sport);
  }
  return c.json(rows);
});

app.get("/api/tournaments/active", async (c) => {
  const db = drizzle(c.env.DB, { schema });
  const sport = c.req.query("sport");
  let tournaments = await db.select().from(schema.tournamentsTable).orderBy(schema.tournamentsTable.name);
  if (sport && sport !== "all") {
    tournaments = tournaments.filter((t) => t.sport === sport);
  }

  const results = await Promise.all(tournaments.map(async (t) => {
    const allMatches = await db
      .select()
      .from(schema.matchesTable)
      .where(eq(schema.matchesTable.tournamentId, t.id));

    const total = allMatches.length;
    const liveCount = allMatches.filter((m) => m.status === "live").length;
    const scheduledCount = allMatches.filter((m) => m.status === "scheduled").length;
    const finishedCount = allMatches.filter((m) => m.status === "finished").length;

    let matchStatus: "live" | "ongoing" | "upcoming" | "finished";
    if (liveCount > 0) matchStatus = "live";
    else if (scheduledCount > 0 && finishedCount > 0) matchStatus = "ongoing";
    else if (scheduledCount > 0) matchStatus = "upcoming";
    else matchStatus = "finished";

    return { ...t, matchStatus, matchCount: total, liveCount };
  }));

  return c.json(results.filter((r) => r.matchCount > 0));
});

app.post("/api/tournaments", async (c) => {
  const db = drizzle(c.env.DB, { schema });
  const body = await c.req.json();
  if (!body.name) return c.json({ error: "name is required" }, 400);
  const [t] = await db.insert(schema.tournamentsTable).values(body).returning();
  return c.json(t, 201);
});

app.get("/api/tournaments/:id/matches", async (c) => {
  const db = drizzle(c.env.DB, { schema });
  const id = Number(c.req.param("id"));

  const rows = await db
    .select()
    .from(schema.matchesTable)
    .where(eq(schema.matchesTable.tournamentId, id))
    .orderBy(schema.matchesTable.kickoffAt);

  const teamIds = [...new Set(rows.flatMap((m) => [m.homeTeamId, m.awayTeamId]).filter((x): x is number => x !== null))];
  const teams = teamIds.length > 0
    ? await db.select().from(schema.teamsTable).where(inArray(schema.teamsTable.id, teamIds))
    : [];
  const teamMap = new Map(teams.map((t) => [t.id, t]));
  const TBD_TEAM = { id: 0, name: "TBD", shortName: "TBD", logoUrl: null, country: null, sport: "football" };

  return c.json(rows.map((m) => ({
    id: m.id,
    homeTeam: (m.homeTeamId && teamMap.get(m.homeTeamId)) || TBD_TEAM,
    awayTeam: (m.awayTeamId && teamMap.get(m.awayTeamId)) || TBD_TEAM,
    homeScore: m.homeScore,
    awayScore: m.awayScore,
    status: m.status,
    minute: m.minute,
    competition: m.competition,
    competitionLogo: m.competitionLogo,
    kickoffAt: new Date(m.kickoffAt).toISOString(),
    streamCount: 0,
    featured: m.featured,
    sport: m.sport ?? "football",
    tournamentId: m.tournamentId,
    venue: m.venue,
    matchGroup: m.matchGroup,
  })));
});

function computeStandings(matches: Array<{ match: any; homeTeam: any; awayTeam: any }>) {
  type ResultChar = "W" | "D" | "L";
  const teamMap = new Map<number, {
    team: any; played: number; won: number; drawn: number; lost: number;
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
    const date = String(match.kickoffAt);
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
      formGuide: s.results.slice(-5).map((r) => r.result),
    }));
}

app.get("/api/tournaments/:id/standings", async (c) => {
  const db = drizzle(c.env.DB, { schema });
  const id = Number(c.req.param("id"));

  const [tournament] = await db.select().from(schema.tournamentsTable).where(eq(schema.tournamentsTable.id, id));
  if (!tournament) return c.json({ error: "Not found" }, 404);

  const matchRows = await db
    .select()
    .from(schema.matchesTable)
    .where(and(eq(schema.matchesTable.tournamentId, id), eq(schema.matchesTable.status, "finished")));

  const teamIds = [...new Set(matchRows.flatMap((m) => [m.homeTeamId, m.awayTeamId]).filter((x): x is number => x !== null))];
  const teams = teamIds.length > 0
    ? await db.select().from(schema.teamsTable).where(inArray(schema.teamsTable.id, teamIds))
    : [];
  const teamMap = new Map(teams.map((t) => [t.id, t]));

  const allMatches = matchRows.map((match) => ({
    match,
    homeTeam: match.homeTeamId ? teamMap.get(match.homeTeamId) : undefined,
    awayTeam: match.awayTeamId ? teamMap.get(match.awayTeamId) : undefined,
  }));

  const format = tournament.format ?? "league";

  const normalizeGroup = (s: string) => s.toLowerCase().replace(/[-_\s]+/g, " ").trim();
  const KNOCKOUT_ROUNDS = new Set([
    "round of 128", "round of 64", "round of 32", "round of 16", "round of 8",
    "quarter final", "quarter finals", "quarterfinal", "quarterfinals", "qf",
    "semi final", "semi finals", "semifinal", "semifinals", "sf",
    "third place", "third place playoff",
    "playoff", "play off", "final", "grand final", "championship",
    "round of 4", "round of 2",
  ].map(normalizeGroup));
  const isKnockoutRound = (g: string | null) => !!g && KNOCKOUT_ROUNDS.has(normalizeGroup(g));

  const standingsMatches = allMatches.filter((m) => !isKnockoutRound(m.match.matchGroup));
  const hasGroups = standingsMatches.some((m) => m.match.matchGroup);

  if (format === "group_stage" || hasGroups) {
    const grouped = new Map<string, typeof standingsMatches>();
    for (const m of standingsMatches) {
      const grp = m.match.matchGroup ?? "Ungrouped";
      if (!grouped.has(grp)) grouped.set(grp, []);
      grouped.get(grp)!.push(m);
    }
    const sortedGroups = Array.from(grouped.entries()).sort(([a], [b]) => a.localeCompare(b));
    const groups: Record<string, ReturnType<typeof computeStandings>> = {};
    for (const [grp, matches] of sortedGroups) {
      groups[grp] = computeStandings(matches.filter((m) => m.homeTeam && m.awayTeam) as any);
    }
    return c.json({ format: "group_stage", groups });
  } else {
    const standings = computeStandings(allMatches.filter((m) => m.homeTeam && m.awayTeam) as any);
    return c.json({ format, groups: { "League": standings } });
  }
});

app.get("/api/tournaments/:id/top-scorers", async (c) => {
  const db = drizzle(c.env.DB, { schema });
  const id = Number(c.req.param("id"));

  const tournamentMatches = await db
    .select({ id: schema.matchesTable.id })
    .from(schema.matchesTable)
    .where(eq(schema.matchesTable.tournamentId, id));

  const matchIds = tournamentMatches.map((m) => m.id);
  if (matchIds.length === 0) return c.json({ topScorers: [], mvp: [] });

  const events = await db
    .select()
    .from(schema.matchEventsTable)
    .where(inArray(schema.matchEventsTable.matchId, matchIds));

  const teamIds = [...new Set(events.map((e) => e.teamId))];
  const teams = teamIds.length > 0
    ? await db.select().from(schema.teamsTable).where(inArray(schema.teamsTable.id, teamIds))
    : [];
  const teamMap = new Map(teams.map((t) => [t.id, t]));

  type ScorerEntry = { playerName: string; playerNumber: string | null; teamId: number; teamName: string; teamShortName: string | null; teamLogoUrl: string | null; goals: number; assists: number };
  type StatEntry = { playerName: string; playerNumber: string | null; teamId: number; teamName: string; teamShortName: string | null; teamLogoUrl: string | null; count: number };
  const scorerMap = new Map<string, ScorerEntry>();
  const mvpMap = new Map<string, ScorerEntry>();
  const yellowMap = new Map<string, StatEntry>();
  const redMap = new Map<string, StatEntry>();
  const ownGoalMap = new Map<string, StatEntry>();
  const getKey = (name: string, teamId: number) => `${name}::${teamId}`;

  const ensureScorer = (map: Map<string, ScorerEntry>, name: string, num: string | null, teamId: number, team: any): ScorerEntry => {
    const key = getKey(name, teamId);
    if (!map.has(key)) map.set(key, { playerName: name, playerNumber: num, teamId, teamName: team.name, teamShortName: team.shortName, teamLogoUrl: team.logoUrl, goals: 0, assists: 0 });
    return map.get(key)!;
  };
  const ensureStat = (map: Map<string, StatEntry>, name: string, num: string | null, teamId: number, team: any): StatEntry => {
    const key = getKey(name, teamId);
    if (!map.has(key)) map.set(key, { playerName: name, playerNumber: num, teamId, teamName: team.name, teamShortName: team.shortName, teamLogoUrl: team.logoUrl, count: 0 });
    return map.get(key)!;
  };

  for (const ev of events) {
    const team = teamMap.get(ev.teamId);
    if (!team) continue;
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

  const topScorers = Array.from(scorerMap.values()).filter((p) => p.goals > 0).sort((a, b) => b.goals - a.goals || b.assists - a.assists).slice(0, 20);
  const yellowCards = Array.from(yellowMap.values()).sort((a, b) => b.count - a.count).slice(0, 20);
  const redCards = Array.from(redMap.values()).sort((a, b) => b.count - a.count).slice(0, 20);
  const ownGoals = Array.from(ownGoalMap.values()).sort((a, b) => b.count - a.count).slice(0, 20);

  return c.json({ topScorers, mvp: Array.from(mvpMap.values()), yellowCards, redCards, ownGoals });
});

app.get("/api/tournaments/:id", async (c) => {
  const db = drizzle(c.env.DB, { schema });
  const id = Number(c.req.param("id"));
  const [t] = await db.select().from(schema.tournamentsTable).where(eq(schema.tournamentsTable.id, id));
  if (!t) return c.json({ error: "Not found" }, 404);
  return c.json(t);
});

app.patch("/api/tournaments/:id", async (c) => {
  const db = drizzle(c.env.DB, { schema });
  const id = Number(c.req.param("id"));
  const body = await c.req.json();
  const [t] = await db.update(schema.tournamentsTable).set(body).where(eq(schema.tournamentsTable.id, id)).returning();
  if (!t) return c.json({ error: "Not found" }, 404);
  return c.json(t);
});

app.delete("/api/tournaments/:id", async (c) => {
  const db = drizzle(c.env.DB, { schema });
  const id = Number(c.req.param("id"));
  await db.delete(schema.tournamentsTable).where(eq(schema.tournamentsTable.id, id));
  return c.body(null, 204);
});


/* ─── matches routes ─── */

const TBD_TEAM_M = { id: 0, name: "TBD", shortName: "TBD", logoUrl: null, sport: "football" };

function buildMatch(row: any) {
  const homeTeam = row.homeTeam ?? TBD_TEAM_M;
  const awayTeam = row.awayTeam ?? TBD_TEAM_M;
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
    kickoffAt: new Date(row.match.kickoffAt).toISOString(),
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

function chunkArray(arr, size) { const chunks = []; for (let i = 0; i < arr.length; i += size) chunks.push(arr.slice(i, i + size)); return chunks; }
async function fetchCardCounts(db: any, matchIds: number[], rows: any[]) {
  const result = new Map<number, { homeRed: number; awayRed: number; homeYellow: number; awayYellow: number }>();
  if (matchIds.length === 0) return result;
  const chunks = chunkArray(matchIds, 50);
  const cardRows: any[] = [];
  for (const chunk of chunks) {
    const rowsChunk = await db.select().from(schema.matchEventsTable).where(and(inArray(schema.matchEventsTable.matchId, chunk), inArray(schema.matchEventsTable.type, ["yellow_card", "red_card", "second_yellow_red"])));
    cardRows.push(...rowsChunk);
  }
  const matchTeamMap = new Map(rows.map((r) => [r.match.id, { homeTeamId: r.match.homeTeamId, awayTeamId: r.match.awayTeamId }]));
  for (const cr of cardRows) {
    const teams = matchTeamMap.get(cr.matchId);
    if (!teams) continue;
    const entry = result.get(cr.matchId) ?? { homeRed: 0, awayRed: 0, homeYellow: 0, awayYellow: 0 };
    const isHome = cr.teamId === teams.homeTeamId;
    const isRed = cr.type === "red_card" || cr.type === "second_yellow_red";
    if (isRed) { if (isHome) entry.homeRed++; else entry.awayRed++; }
    else { if (isHome) entry.homeYellow++; else entry.awayYellow++; }
    result.set(cr.matchId, entry);
  }
  return result;
}

async function fetchPenaltyGoals(db: any, matchIds: number[], rows: any[]) {
  const result = new Map<number, { home: number; away: number }>();
  if (matchIds.length === 0) return result;
  const chunks = chunkArray(matchIds, 50);
  const penRows: any[] = [];
  for (const chunk of chunks) {
    const rowsChunk = await db.select().from(schema.matchEventsTable).where(and(inArray(schema.matchEventsTable.matchId, chunk), eq(schema.matchEventsTable.type, "penalty_goal"), eq(schema.matchEventsTable.minute, "PSO")));
    penRows.push(...rowsChunk);
  }
  const matchTeamMap = new Map(rows.map((r) => [r.match.id, { homeTeamId: r.match.homeTeamId, awayTeamId: r.match.awayTeamId }]));
  for (const pr of penRows) {
    const teams = matchTeamMap.get(pr.matchId);
    if (!teams) continue;
    const entry = result.get(pr.matchId) ?? { home: 0, away: 0 };
    if (pr.teamId === teams.homeTeamId) entry.home++; else entry.away++;
    result.set(pr.matchId, entry);
  }
  return result;
}

async function joinMatchRows(db: any, matches: any[]) {
  const teamIds = [...new Set(matches.flatMap((m) => [m.homeTeamId, m.awayTeamId]).filter((x): x is number => x !== null))];
  const allTeams: any[] = [];
  if (teamIds.length > 0) {
    const chunks = chunkArray(teamIds, 50);
    for (const chunk of chunks) {
      const teamsChunk = await db.select().from(schema.teamsTable).where(inArray(schema.teamsTable.id, chunk));
      allTeams.push(...teamsChunk);
    }
  }
  const teamMap = new Map(allTeams.map((t: any) => [t.id, t]));
  return matches.map((match) => ({
    match,
    homeTeam: match.homeTeamId ? teamMap.get(match.homeTeamId) ?? null : null,
    awayTeam: match.awayTeamId ? teamMap.get(match.awayTeamId) ?? null : null,
  }));
}


app.get("/api/matches/:id/lineup", async (c) => {
  const matchId = Number(c.req.param("id"));
  const db = drizzle(c.env.DB, { schema });
  const [match] = await db.select().from(schema.matchesTable).where(eq(schema.matchesTable.id, matchId));
  if (!match) return c.json({ error: "Match not found" }, 404);
  const all = await db.select().from(schema.lineupsTable).where(eq(schema.lineupsTable.matchId, matchId));
  return c.json({
    matchId,
    home: all.filter((p) => p.teamId === match.homeTeamId),
    away: all.filter((p) => p.teamId === match.awayTeamId),
  });
});
app.post("/api/matches/:id/lineup/auto", async (c) => {
  try {
  const matchId = Number(c.req.param("id"));
  const db = drizzle(c.env.DB, { schema });
  const [match] = await db.select().from(schema.matchesTable).where(eq(schema.matchesTable.id, matchId));
  if (!match) return c.json({ error: "Match not found" }, 404);
  const homeTeamId = match.homeTeamId;
  const awayTeamId = match.awayTeamId;
  const [homeSquad, awaySquad] = await Promise.all([
    homeTeamId ? db.select().from(schema.squadsTable).where(eq(schema.squadsTable.teamId, homeTeamId)) : Promise.resolve([]),
    awayTeamId ? db.select().from(schema.squadsTable).where(eq(schema.squadsTable.teamId, awayTeamId)) : Promise.resolve([]),
  ]);
  await db.delete(schema.lineupsTable).where(eq(schema.lineupsTable.matchId, matchId));
  const toInsert = [
    ...(homeTeamId ? homeSquad.map((p) => ({ matchId, teamId: homeTeamId, playerNumber: p.playerNumber, playerName: p.playerName, position: p.position, role: p.role, isStarting: p.isStarting, photoUrl: p.photoUrl })) : []),
    ...(awayTeamId ? awaySquad.map((p) => ({ matchId, teamId: awayTeamId, playerNumber: p.playerNumber, playerName: p.playerName, position: p.position, role: p.role, isStarting: p.isStarting, photoUrl: p.photoUrl })) : []),
  ];
  if (toInsert.length > 0) {
    const BATCH_SIZE = 10;
    for (let i = 0; i < toInsert.length; i += BATCH_SIZE) {
      const batch = toInsert.slice(i, i + BATCH_SIZE);
      await db.insert(schema.lineupsTable).values(batch);
    }
  }
  const all = await db.select().from(schema.lineupsTable).where(eq(schema.lineupsTable.matchId, matchId));
  return c.json({
    matchId,
    home: all.filter((p) => p.teamId === match.homeTeamId),
    away: all.filter((p) => p.teamId === match.awayTeamId),
  });
  } catch (err) {
    return c.json({ debugError: err.message, cause: err.cause ? String(err.cause.message || err.cause) : null }, 500);
  }
});
app.post("/api/matches/:id/lineup", async (c) => {
  const matchId = Number(c.req.param("id"));
  const db = drizzle(c.env.DB, { schema });
  const body = await c.req.json();
  const [player] = await db.insert(schema.lineupsTable).values({ matchId, ...body }).returning();
  return c.json(player, 201);
});
app.patch("/api/matches/:id/lineup/:playerId", async (c) => {
  const matchId = Number(c.req.param("id"));
  const playerId = Number(c.req.param("playerId"));
  const db = drizzle(c.env.DB, { schema });
  const body = await c.req.json();
  const updates = {};
  if (body.role !== undefined) updates.role = body.role;
  if (body.isStarting !== undefined) updates.isStarting = body.isStarting;
  if (Object.keys(updates).length === 0) return c.json({ error: "Nothing to update" }, 400);
  const [updated] = await db.update(schema.lineupsTable).set(updates).where(and(eq(schema.lineupsTable.id, playerId), eq(schema.lineupsTable.matchId, matchId))).returning();
  return c.json(updated);
});
app.delete("/api/matches/:id/lineup/:playerId", async (c) => {
  const matchId = Number(c.req.param("id"));
  const playerId = Number(c.req.param("playerId"));
  const db = drizzle(c.env.DB, { schema });
  await db.delete(schema.lineupsTable).where(and(eq(schema.lineupsTable.id, playerId), eq(schema.lineupsTable.matchId, matchId)));
  return c.body(null, 204);
});


async function syncRoleToLineups(db, teamId, playerName, role) {
  await db.update(schema.lineupsTable).set({ role }).where(and(eq(schema.lineupsTable.teamId, teamId), eq(schema.lineupsTable.playerName, playerName)));
}
app.get("/api/teams/:id/squad", async (c) => {
  const teamId = Number(c.req.param("id"));
  const db = drizzle(c.env.DB, { schema });
  const squad = await db.select().from(schema.squadsTable).where(eq(schema.squadsTable.teamId, teamId)).orderBy(schema.squadsTable.role, schema.squadsTable.playerNumber);
  return c.json(squad);
});
app.post("/api/teams/:id/squad", async (c) => {
  const teamId = Number(c.req.param("id"));
  const db = drizzle(c.env.DB, { schema });
  const body = await c.req.json();
  const { playerNumber, playerName, playerCode, position, role, isStarting, photoUrl, nationality, bio } = body;
  if (!playerName) return c.json({ error: "playerName is required" }, 400);
  const [player] = await db.insert(schema.squadsTable).values({
    teamId,
    playerNumber: playerNumber ?? "",
    playerName,
    playerCode: playerCode?.trim() || null,
    position: position || null,
    role: role || "player",
    isStarting: isStarting ?? true,
    photoUrl: photoUrl || null,
    nationality: nationality || null,
    bio: bio || null,
  }).returning();
  await syncRoleToLineups(db, teamId, playerName, player.role);
  return c.json(player, 201);
});
app.patch("/api/teams/:id/squad/:playerId", async (c) => {
  const teamId = Number(c.req.param("id"));
  const playerId = Number(c.req.param("playerId"));
  const db = drizzle(c.env.DB, { schema });
  const body = await c.req.json();
  const { playerNumber, playerName, playerCode, position, role, isStarting, photoUrl, nationality, bio } = body;
  const updates = {};
  if (playerNumber !== undefined) updates.playerNumber = playerNumber;
  if (playerName !== undefined) updates.playerName = playerName;
  if (playerCode !== undefined) updates.playerCode = playerCode?.trim() || null;
  if (position !== undefined) updates.position = position;
  if (role !== undefined) updates.role = role;
  if (isStarting !== undefined) updates.isStarting = isStarting;
  if (photoUrl !== undefined) updates.photoUrl = photoUrl || null;
  if (nationality !== undefined) updates.nationality = nationality || null;
  if (bio !== undefined) updates.bio = bio || null;
  const [player] = await db.update(schema.squadsTable).set(updates).where(and(eq(schema.squadsTable.id, playerId), eq(schema.squadsTable.teamId, teamId))).returning();
  if (!player) return c.json({ error: "Not found" }, 404);
  if (role !== undefined) await syncRoleToLineups(db, teamId, player.playerName, player.role);
  return c.json(player);
});
app.delete("/api/teams/:id/squad/:playerId", async (c) => {
  const teamId = Number(c.req.param("id"));
  const playerId = Number(c.req.param("playerId"));
  const db = drizzle(c.env.DB, { schema });
  await db.delete(schema.squadsTable).where(and(eq(schema.squadsTable.id, playerId), eq(schema.squadsTable.teamId, teamId)));
  return c.body(null, 204);
});

app.get("/api/matches/live", async (c) => {
  const db = drizzle(c.env.DB, { schema });
  const sport = c.req.query("sport");
  const conditions = [eq(schema.matchesTable.status, "live")];
  if (sport && sport !== "all") conditions.push(eq(schema.matchesTable.sport, sport));

  const matches = await db.select().from(schema.matchesTable).where(and(...conditions)).orderBy(desc(schema.matchesTable.kickoffAt));
  const rows = await joinMatchRows(db, matches);
  const matchIds = rows.map((r) => r.match.id);

  const [streamCounts, cardCountMap] = await Promise.all([
    matchIds.length > 0 ? db.select().from(schema.streamsTable).where(inArray(schema.streamsTable.matchId, matchIds)) : Promise.resolve([]),
    fetchCardCounts(db, matchIds, rows),
  ]);
  const streamCountMap = new Map<number, number>();
  for (const s of streamCounts) streamCountMap.set(s.matchId, (streamCountMap.get(s.matchId) ?? 0) + 1);

  return c.json(rows.map((row) => {
    const cards = cardCountMap.get(row.match.id);
    return buildMatch({ ...row, streamCount: streamCountMap.get(row.match.id) ?? 0, homeRedCards: cards?.homeRed, awayRedCards: cards?.awayRed, homeYellowCards: cards?.homeYellow, awayYellowCards: cards?.awayYellow });
  }));
});

app.get("/api/matches", async (c) => {
  const db = drizzle(c.env.DB, { schema });
  const status = c.req.query("status");
  const competition = c.req.query("competition");
  const sport = c.req.query("sport");
  const tournamentId = c.req.query("tournamentId") ? Number(c.req.query("tournamentId")) : undefined;
  const limit = c.req.query("limit") ? Number(c.req.query("limit")) : 50;

  const conditions = [];
  if (status && status !== "all") conditions.push(eq(schema.matchesTable.status, status));
  if (competition) conditions.push(eq(schema.matchesTable.competition, competition));
  if (sport && sport !== "all") conditions.push(eq(schema.matchesTable.sport, sport));
  if (tournamentId) conditions.push(eq(schema.matchesTable.tournamentId, tournamentId));

  const matches = await db.select().from(schema.matchesTable).where(conditions.length > 0 ? and(...conditions) : undefined).orderBy(desc(schema.matchesTable.kickoffAt)).limit(limit);
  const rows = await joinMatchRows(db, matches);
  const matchIds = rows.map((r) => r.match.id);

  const [streamCounts, cardCountMap, penGoalsMap] = await Promise.all([
    matchIds.length > 0 ? db.select().from(schema.streamsTable) : Promise.resolve([]),
    fetchCardCounts(db, matchIds, rows),
    fetchPenaltyGoals(db, matchIds, rows),
  ]);
  const matchIdSetForStreams = new Set(matchIds);
  const streamCountMap = new Map<number, number>();
  for (const s of streamCounts) {
    if (matchIdSetForStreams.has(s.matchId)) streamCountMap.set(s.matchId, (streamCountMap.get(s.matchId) ?? 0) + 1);
  }

  return c.json(rows.map((row) => {
    const cards = cardCountMap.get(row.match.id);
    const pen = penGoalsMap.get(row.match.id);
    return buildMatch({ ...row, streamCount: streamCountMap.get(row.match.id) ?? 0, homeRedCards: cards?.homeRed, awayRedCards: cards?.awayRed, homeYellowCards: cards?.homeYellow, awayYellowCards: cards?.awayYellow, homePenGoals: pen?.home, awayPenGoals: pen?.away });
  }));
});

app.post("/api/matches", async (c) => {
  const db = drizzle(c.env.DB, { schema });
  const body = await c.req.json();
  const [match] = await db.insert(schema.matchesTable).values({
    homeTeamId: body.homeTeamId ?? null,
    awayTeamId: body.awayTeamId ?? null,
    homeScore: body.homeScore ?? 0,
    awayScore: body.awayScore ?? 0,
    status: body.status ?? "scheduled",
    minute: (body.minute && body.minute !== "null") ? body.minute : null,
    competition: body.competition,
    competitionLogo: body.competitionLogo ?? null,
    kickoffAt: new Date(body.kickoffAt),
    featured: body.featured ?? false,
    sport: body.sport ?? "football",
    tournamentId: body.tournamentId ?? null,
    venue: body.venue ?? null,
    matchGroup: body.matchGroup ?? null,
  }).returning();

  const rows = await joinMatchRows(db, [match]);
  return c.json(buildMatch({ ...rows[0], streamCount: 0 }), 201);
});

app.get("/api/matches/:id", async (c) => {
  const db = drizzle(c.env.DB, { schema });
  const id = Number(c.req.param("id"));
  const [match] = await db.select().from(schema.matchesTable).where(eq(schema.matchesTable.id, id));
  if (!match) return c.json({ error: "Match not found" }, 404);

  const rows = await joinMatchRows(db, [match]);
  const [streams, events] = await Promise.all([
    db.select().from(schema.streamsTable).where(eq(schema.streamsTable.matchId, id)),
    db.select().from(schema.matchEventsTable).where(eq(schema.matchEventsTable.matchId, id)).orderBy(schema.matchEventsTable.minute),
  ]);

  return c.json({ ...buildMatch({ ...rows[0], streamCount: streams.length }), streams, events });
});

async function sendLiveMatchNotifications(env, db, row) {
  const subs = await db.select().from(schema.pushSubscriptionsTable);
  if (subs.length === 0) return;
  const vapid = { subject: env.VAPID_CONTACT, publicKey: env.VAPID_PUBLIC_KEY, privateKey: env.VAPID_PRIVATE_KEY };
  const homeName = row.homeTeam ? row.homeTeam.name : "TBD";
  const awayName = row.awayTeam ? row.awayTeam.name : "TBD";
  const message = {
    data: JSON.stringify({ title: "Match Live!", body: homeName + " vs " + awayName + " has started" }),
    options: { ttl: 3000, urgency: "high" },
  };
  for (const sub of subs) {
    const subscription = { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } };
    try {
      const payload = await buildPushPayload(message, subscription, vapid);
      const res = await fetch(sub.endpoint, payload);
      const resText = await res.text();
      console.error("PUSH_DEBUG status=" + res.status + " body=" + resText);
      if (res.status === 404 || res.status === 410) {
        await db.delete(schema.pushSubscriptionsTable).where(eq(schema.pushSubscriptionsTable.id, sub.id));
      }
    } catch (e) {
      console.error("PUSH_DEBUG_ERROR " + (e && e.message ? e.message : String(e)));
    }
  }
}
app.patch("/api/matches/:id", async (c) => {
  const db = drizzle(c.env.DB, { schema });
  const id = Number(c.req.param("id"));
  const body = await c.req.json();
  const { kickoffAt, ...rest } = body;
  const updateData: Record<string, unknown> = { ...rest };
  if (kickoffAt) updateData.kickoffAt = new Date(kickoffAt);

  const [oldMatch] = await db.select().from(schema.matchesTable).where(eq(schema.matchesTable.id, id));
  const [match] = await db.update(schema.matchesTable).set(updateData).where(eq(schema.matchesTable.id, id)).returning();
  if (!match) return c.json({ error: "Match not found" }, 404);

  const rows = await joinMatchRows(db, [match]);
  const streamRows = await db.select().from(schema.streamsTable).where(eq(schema.streamsTable.matchId, id));
  if (match.status === "live" && oldMatch && oldMatch.status !== "live") {
    c.executionCtx.waitUntil(sendLiveMatchNotifications(c.env, db, rows[0]));
  }
  return c.json(buildMatch({ ...rows[0], streamCount: streamRows.length }));
});

app.delete("/api/matches/:id", async (c) => {
  const db = drizzle(c.env.DB, { schema });
  const id = Number(c.req.param("id"));
  await db.delete(schema.matchesTable).where(eq(schema.matchesTable.id, id));
  return c.body(null, 204);
});


/* ─── health ─── */
app.get("/api/healthz", (c) => c.json({ status: "ok" }));

/* ─── banners ─── */
app.get("/api/banners", async (c) => {
  const db = drizzle(c.env.DB, { schema });
  const position = c.req.query("position");
  const rows = position
    ? await db.select().from(schema.bannersTable).where(eq(schema.bannersTable.position, position))
    : await db.select().from(schema.bannersTable);
  return c.json(rows);
});
app.post("/api/banners", async (c) => {
  const db = drizzle(c.env.DB, { schema });
  const body = await c.req.json();
  if (!body.imageUrl) return c.json({ error: "imageUrl is required" }, 400);
  const [row] = await db.insert(schema.bannersTable).values({
    imageUrl: body.imageUrl, linkUrl: body.linkUrl ?? "", position: body.position ?? "top_home", isActive: body.isActive ?? true,
  }).returning();
  return c.json(row, 201);
});
app.patch("/api/banners/:id", async (c) => {
  const db = drizzle(c.env.DB, { schema });
  const id = Number(c.req.param("id"));
  const body = await c.req.json();
  const [row] = await db.update(schema.bannersTable).set(body).where(eq(schema.bannersTable.id, id)).returning();
  if (!row) return c.json({ error: "Banner not found" }, 404);
  return c.json(row);
});
app.delete("/api/banners/:id", async (c) => {
  const db = drizzle(c.env.DB, { schema });
  await db.delete(schema.bannersTable).where(eq(schema.bannersTable.id, Number(c.req.param("id"))));
  return c.body(null, 204);
});

/* ─── spotlights ─── */
app.get("/api/spotlights", async (c) => {
  const db = drizzle(c.env.DB, { schema });
  const rows = await db.select().from(schema.spotlightsTable).orderBy(asc(schema.spotlightsTable.sortOrder), asc(schema.spotlightsTable.createdAt));
  return c.json(rows);
});
app.post("/api/spotlights", async (c) => {
  const db = drizzle(c.env.DB, { schema });
  const body = await c.req.json();
  if (!body.title || !body.imageUrl) return c.json({ error: "title and imageUrl are required" }, 400);
  const [row] = await db.insert(schema.spotlightsTable).values({
    title: body.title, subtitle: body.subtitle ?? null, imageUrl: body.imageUrl, linkUrl: body.linkUrl ?? null, active: body.active ?? true, sortOrder: body.sortOrder ?? 0,
  }).returning();
  return c.json(row, 201);
});
app.patch("/api/spotlights/:id", async (c) => {
  const db = drizzle(c.env.DB, { schema });
  const id = Number(c.req.param("id"));
  const body = await c.req.json();
  const [row] = await db.update(schema.spotlightsTable).set(body).where(eq(schema.spotlightsTable.id, id)).returning();
  if (!row) return c.json({ error: "Not found" }, 404);
  return c.json(row);
});
app.delete("/api/spotlights/:id", async (c) => {
  const db = drizzle(c.env.DB, { schema });
  await db.delete(schema.spotlightsTable).where(eq(schema.spotlightsTable.id, Number(c.req.param("id"))));
  return c.body(null, 204);
});

/* ─── streams ─── */
app.get("/api/streams", async (c) => {
  const db = drizzle(c.env.DB, { schema });
  const matchId = c.req.query("matchId") ? Number(c.req.query("matchId")) : undefined;
  const rows = matchId !== undefined
    ? await db.select().from(schema.streamsTable).where(eq(schema.streamsTable.matchId, matchId))
    : await db.select().from(schema.streamsTable);
  return c.json(rows);
});
app.post("/api/streams", async (c) => {
  const db = drizzle(c.env.DB, { schema });
  const body = await c.req.json();
  const [row] = await db.insert(schema.streamsTable).values(body).returning();
  return c.json(row, 201);
});
app.delete("/api/streams/:id", async (c) => {
  const db = drizzle(c.env.DB, { schema });
  await db.delete(schema.streamsTable).where(eq(schema.streamsTable.id, Number(c.req.param("id"))));
  return c.body(null, 204);
});

/* ─── trophies ─── */
app.get("/api/trophies", async (c) => {
  const db = drizzle(c.env.DB, { schema });
  const teamId = c.req.query("teamId") ? Number(c.req.query("teamId")) : undefined;
  const rows = teamId ? await db.select().from(schema.trophiesTable).where(eq(schema.trophiesTable.teamId, teamId)) : await db.select().from(schema.trophiesTable);
  return c.json(rows);
});
app.get("/api/teams/:id/trophies", async (c) => {
  const db = drizzle(c.env.DB, { schema });
  const id = Number(c.req.param("id"));
  const rows = await db.select().from(schema.trophiesTable).where(eq(schema.trophiesTable.teamId, id));
  return c.json(rows);
});
app.post("/api/trophies", async (c) => {
  const db = drizzle(c.env.DB, { schema });
  const body = await c.req.json();
  if (!body.teamId || !body.title) return c.json({ error: "teamId and title are required" }, 400);
  const [row] = await db.insert(schema.trophiesTable).values({ teamId: body.teamId, title: body.title, season: body.season ?? "", imageUrl: body.imageUrl ?? "" }).returning();
  return c.json(row, 201);
});
app.patch("/api/trophies/:id", async (c) => {
  const db = drizzle(c.env.DB, { schema });
  const id = Number(c.req.param("id"));
  const body = await c.req.json();
  const [row] = await db.update(schema.trophiesTable).set(body).where(eq(schema.trophiesTable.id, id)).returning();
  if (!row) return c.json({ error: "Trophy not found" }, 404);
  return c.json(row);
});
app.delete("/api/trophies/:id", async (c) => {
  const db = drizzle(c.env.DB, { schema });
  await db.delete(schema.trophiesTable).where(eq(schema.trophiesTable.id, Number(c.req.param("id"))));
  return c.body(null, 204);
});

/* ─── stats ─── */
app.get("/api/stats/summary", async (c) => {
  const db = drizzle(c.env.DB, { schema });
  const [liveCount] = await db.select({ count: sqlCount() }).from(schema.matchesTable).where(eq(schema.matchesTable.status, "live"));
  const [scheduledCount] = await db.select({ count: sqlCount() }).from(schema.matchesTable).where(eq(schema.matchesTable.status, "scheduled"));
  const [finishedCount] = await db.select({ count: sqlCount() }).from(schema.matchesTable).where(eq(schema.matchesTable.status, "finished"));
  const [teamCount] = await db.select({ count: sqlCount() }).from(schema.teamsTable);
  const [highlightCount] = await db.select({ count: sqlCount() }).from(schema.highlightsTable);
  const [streamCount] = await db.select({ count: sqlCount() }).from(schema.streamsTable);
  const [tournamentCount] = await db.select({ count: sqlCount() }).from(schema.tournamentsTable);
  return c.json({
    liveMatchCount: liveCount.count, scheduledMatchCount: scheduledCount.count, finishedMatchCount: finishedCount.count,
    totalTeams: teamCount.count, totalHighlights: highlightCount.count, totalStreams: streamCount.count, totalTournaments: tournamentCount.count,
  });
});
app.get("/api/stats/competitions", async (c) => {
  const db = drizzle(c.env.DB, { schema });
  const matches = await db.select().from(schema.matchesTable);
  const byComp = new Map<string, { competitionLogo: string | null; liveCount: number; totalCount: number }>();
  for (const m of matches) {
    const key = m.competition;
    if (!byComp.has(key)) byComp.set(key, { competitionLogo: m.competitionLogo, liveCount: 0, totalCount: 0 });
    const entry = byComp.get(key)!;
    entry.totalCount++;
    if (m.status === "live") entry.liveCount++;
  }
  const result = Array.from(byComp.entries()).map(([name, v]) => ({ name, logoUrl: v.competitionLogo, liveCount: v.liveCount, totalCount: v.totalCount }));
  result.sort((a, b) => b.liveCount - a.liveCount);
  return c.json(result);
});

/* ─── highlights ─── */
function buildHighlight(h: any, homeTeam: any, awayTeam: any) {
  return { id: h.id, title: h.title, competition: h.competition, thumbnailUrl: h.thumbnailUrl, videoUrl: h.videoUrl, duration: h.duration, publishedAt: new Date(h.publishedAt).toISOString(), homeTeam, awayTeam, homeScore: h.homeScore, awayScore: h.awayScore, views: h.views };
}
app.get("/api/highlights", async (c) => {
  const db = drizzle(c.env.DB, { schema });
  const competition = c.req.query("competition");
  const limit = c.req.query("limit") ? Number(c.req.query("limit")) : 20;
  let rows = await db.select().from(schema.highlightsTable).orderBy(desc(schema.highlightsTable.publishedAt));
  if (competition) rows = rows.filter((h) => h.competition === competition);
  rows = rows.slice(0, limit);
  const teamIds = [...new Set(rows.flatMap((h) => [h.homeTeamId, h.awayTeamId]))];
  const teams = teamIds.length > 0 ? await db.select().from(schema.teamsTable).where(inArray(schema.teamsTable.id, teamIds)) : [];
  const teamMap = new Map(teams.map((t) => [t.id, t]));
  return c.json(rows.map((h) => buildHighlight(h, teamMap.get(h.homeTeamId), teamMap.get(h.awayTeamId))));
});
app.post("/api/highlights", async (c) => {
  const db = drizzle(c.env.DB, { schema });
  const body = await c.req.json();
  const [h] = await db.insert(schema.highlightsTable).values(body).returning();
  const [homeTeam] = await db.select().from(schema.teamsTable).where(eq(schema.teamsTable.id, h.homeTeamId));
  const [awayTeam] = await db.select().from(schema.teamsTable).where(eq(schema.teamsTable.id, h.awayTeamId));
  return c.json(buildHighlight(h, homeTeam, awayTeam), 201);
});
app.get("/api/highlights/:id", async (c) => {
  const db = drizzle(c.env.DB, { schema });
  const id = Number(c.req.param("id"));
  const [h] = await db.select().from(schema.highlightsTable).where(eq(schema.highlightsTable.id, id));
  if (!h) return c.json({ error: "Highlight not found" }, 404);
  const [homeTeam] = await db.select().from(schema.teamsTable).where(eq(schema.teamsTable.id, h.homeTeamId));
  const [awayTeam] = await db.select().from(schema.teamsTable).where(eq(schema.teamsTable.id, h.awayTeamId));
  return c.json(buildHighlight(h, homeTeam, awayTeam));
});
app.delete("/api/highlights/:id", async (c) => {
  const db = drizzle(c.env.DB, { schema });
  await db.delete(schema.highlightsTable).where(eq(schema.highlightsTable.id, Number(c.req.param("id"))));
  return c.body(null, 204);
});

/* ─── admin auth ─── */
const COOKIE_NAME = "fl_admin";

async function requireAdmin(c: any, next: any) {
  const secret = c.env.COOKIE_SECRET || "livematchmv-fallback-secret-change-me";
  const token = await getSignedCookie(c, secret, COOKIE_NAME);
  if (!token || (!token.startsWith("staff:") && token !== "superadmin")) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  await next();
}

app.post("/api/admin/login", async (c) => {
  const db = drizzle(c.env.DB, { schema });
  const secret = c.env.COOKIE_SECRET || "livematchmv-fallback-secret-change-me";
  const body = await c.req.json();
  const { email, password } = body;

  if (email) {
    const users = await db.select().from(schema.adminUsersTable).where(eq(schema.adminUsersTable.email, String(email).toLowerCase().trim())).limit(1);
    const user = users[0];
    if (!user) return c.json({ authenticated: false }, 401);
    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) return c.json({ authenticated: false }, 401);
    await setSignedCookie(c, COOKIE_NAME, `staff:${user.id}`, secret, { httpOnly: true, maxAge: 7 * 24 * 60 * 60, sameSite: "Lax", path: "/" });
    return c.json({ authenticated: true, role: "staff", email: user.email, name: user.name });
  }

  const adminPassword = c.env.ADMIN_PASSWORD || "admin2024";
  if (password !== adminPassword) return c.json({ authenticated: false }, 401);
  await setSignedCookie(c, COOKIE_NAME, "superadmin", secret, { httpOnly: true, maxAge: 7 * 24 * 60 * 60, sameSite: "Lax", path: "/" });
  return c.json({ authenticated: true, role: "superadmin" });
});

app.post("/api/admin/logout", (c) => {
  deleteCookie(c, COOKIE_NAME, { path: "/" });
  return c.json({ authenticated: false });
});

app.get("/api/admin/me", async (c) => {
  const db = drizzle(c.env.DB, { schema });
  const secret = c.env.COOKIE_SECRET || "livematchmv-fallback-secret-change-me";
  const token = await getSignedCookie(c, secret, COOKIE_NAME);

  if (token === "superadmin") return c.json({ authenticated: true, role: "superadmin" });

  if (typeof token === "string" && token.startsWith("staff:")) {
    const id = parseInt(token.split(":")[1] ?? "0", 10);
    if (!id) return c.json({ authenticated: false });
    const users = await db.select().from(schema.adminUsersTable).where(eq(schema.adminUsersTable.id, id)).limit(1);
    const user = users[0];
    if (!user) return c.json({ authenticated: false });
    return c.json({ authenticated: true, role: "staff", email: user.email, name: user.name });
  }
  return c.json({ authenticated: false });
});

/* ─── admin staff management ─── */
app.get("/api/admin/staff", requireAdmin, async (c) => {
  const db = drizzle(c.env.DB, { schema });
  const staff = await db.select({ id: schema.adminUsersTable.id, email: schema.adminUsersTable.email, name: schema.adminUsersTable.name, createdAt: schema.adminUsersTable.createdAt }).from(schema.adminUsersTable).orderBy(schema.adminUsersTable.createdAt);
  return c.json(staff);
});
app.post("/api/admin/staff", requireAdmin, async (c) => {
  const db = drizzle(c.env.DB, { schema });
  const body = await c.req.json();
  const email = typeof body.email === "string" ? body.email.trim() : "";
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";
  if (!email || !name || password.length < 6 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return c.json({ error: "Invalid input" }, 400);
  }
  const passwordHash = await bcrypt.hash(password, 10);
  try {
    const [user] = await db.insert(schema.adminUsersTable).values({ email: email.toLowerCase().trim(), name, passwordHash }).returning({ id: schema.adminUsersTable.id, email: schema.adminUsersTable.email, name: schema.adminUsersTable.name, createdAt: schema.adminUsersTable.createdAt });
    return c.json(user, 201);
  } catch {
    return c.json({ error: "Email already exists" }, 409);
  }
});
app.delete("/api/admin/staff/:id", requireAdmin, async (c) => {
  const db = drizzle(c.env.DB, { schema });
  const id = parseInt(c.req.param("id") ?? "0", 10);
  if (!id) return c.json({ error: "Invalid id" }, 400);
  await db.delete(schema.adminUsersTable).where(eq(schema.adminUsersTable.id, id));
  return c.json({ success: true });
});

/* ─── seed (dev/demo only) ─── */
app.post("/api/admin/seed", requireAdmin, async (c) => {
  const db = drizzle(c.env.DB, { schema });
  const [{ value: teamCount }] = await db.select({ value: sqlCount() }).from(schema.teamsTable);
  if (teamCount > 0) return c.json({ error: "Database already has data. Clear it first before seeding." }, 409);

  const now = new Date();
  const tomorrow = new Date(now.getTime() + 86400000);
  const yesterday = new Date(now.getTime() - 86400000);

  const [teamA, teamB, teamC, teamD] = await db.insert(schema.teamsTable).values([
    { name: "Maziya S&RC", shortName: "MAZ", logoUrl: "", country: "Maldives", sport: "football" },
    { name: "Club Eagles", shortName: "EAG", logoUrl: "", country: "Maldives", sport: "football" },
    { name: "TC Sports Club", shortName: "TCS", logoUrl: "", country: "Maldives", sport: "football" },
    { name: "Super United Sports", shortName: "SUS", logoUrl: "", country: "Maldives", sport: "football" },
  ]).returning();
  const [futsalA, futsalB] = await db.insert(schema.teamsTable).values([
    { name: "United Victory", shortName: "UNV", logoUrl: "", country: "Maldives", sport: "futsal" },
    { name: "Island FC", shortName: "ISL", logoUrl: "", country: "Maldives", sport: "futsal" },
  ]).returning();
  const [tournament] = await db.insert(schema.tournamentsTable).values({ name: "Dhivehi Premier League", sport: "football", season: "2025", format: "league", active: true }).returning();
  const [futsalTournament] = await db.insert(schema.tournamentsTable).values({ name: "Futsal Fiesta Cup", sport: "futsal", season: "2025", format: "league", active: true }).returning();

  await db.insert(schema.matchesTable).values([
    { homeTeamId: teamA.id, awayTeamId: teamB.id, competition: "Dhivehi Premier League", sport: "football", status: "live", kickoffAt: now, homeScore: 2, awayScore: 1, minute: "67", tournamentId: tournament.id, featured: true },
    { homeTeamId: teamC.id, awayTeamId: teamD.id, competition: "Dhivehi Premier League", sport: "football", status: "scheduled", kickoffAt: tomorrow, homeScore: 0, awayScore: 0, tournamentId: tournament.id },
    { homeTeamId: teamD.id, awayTeamId: teamA.id, competition: "Dhivehi Premier League", sport: "football", status: "finished", kickoffAt: yesterday, homeScore: 0, awayScore: 3, tournamentId: tournament.id },
    { homeTeamId: futsalA.id, awayTeamId: futsalB.id, competition: "Futsal Fiesta Cup", sport: "futsal", status: "scheduled", kickoffAt: tomorrow, homeScore: 0, awayScore: 0, tournamentId: futsalTournament.id },
  ]);

  return c.json({ success: true, message: "Demo data seeded successfully." });
});

/* ─── push (subscribe/unsubscribe only — sending still requires Node web-push, stays on Render for now) ─── */
app.get("/api/push/vapid-public-key", (c) => {
  if (!c.env.VAPID_PUBLIC_KEY) return c.json({ error: "Push notifications not configured" }, 503);
  return c.json({ publicKey: c.env.VAPID_PUBLIC_KEY });
});
app.post("/api/push/subscribe", async (c) => {
  const db = drizzle(c.env.DB, { schema });
  const body = await c.req.json().catch(() => ({}));
  const { endpoint, keys } = body ?? {};
  if (!endpoint || !keys?.p256dh || !keys?.auth) return c.json({ error: "Invalid subscription object" }, 400);
  try {
    await db.insert(schema.pushSubscriptionsTable).values({ endpoint, p256dh: keys.p256dh, auth: keys.auth });
  } catch { /* already subscribed, ignore */ }
  return c.json({ success: true }, 201);
});
app.delete("/api/push/unsubscribe", async (c) => {
  const db = drizzle(c.env.DB, { schema });
  const body = await c.req.json().catch(() => ({}));
  if (!body?.endpoint) return c.json({ error: "endpoint required" }, 400);
  await db.delete(schema.pushSubscriptionsTable).where(eq(schema.pushSubscriptionsTable.endpoint, body.endpoint));
  return c.json({ success: true });
});

/* ─── match events (CRUD + auto score update; push notifications + SSE broadcast NOT yet ported — TODO) ─── */
const SCORE_GOAL_TYPES = new Set(["goal", "penalty_goal", "ten_meter_goal"]);

app.get("/api/matches/:id/events", async (c) => {
  const db = drizzle(c.env.DB, { schema });
  const matchId = Number(c.req.param("id"));
  const events = await db.select().from(schema.matchEventsTable).where(eq(schema.matchEventsTable.matchId, matchId)).orderBy(schema.matchEventsTable.minute);
  return c.json(events);
});

app.post("/api/matches/:id/events", async (c) => {
  const db = drizzle(c.env.DB, { schema });
  const matchId = Number(c.req.param("id"));
  const body = await c.req.json();

  const [event] = await db.insert(schema.matchEventsTable).values({ matchId, ...body }).returning();

  const isGoal = SCORE_GOAL_TYPES.has(body.type);
  const isOwnGoal = body.type === "own_goal";
  if (isGoal || isOwnGoal) {
    const [matchRow] = await db.select().from(schema.matchesTable).where(eq(schema.matchesTable.id, matchId));
    if (matchRow) {
      let homeScoreDelta = 0, awayScoreDelta = 0;
      if (isOwnGoal) {
        if (body.teamId === matchRow.homeTeamId) awayScoreDelta = 1; else homeScoreDelta = 1;
      } else {
        if (body.teamId === matchRow.homeTeamId) homeScoreDelta = 1; else awayScoreDelta = 1;
      }
      await db.update(schema.matchesTable).set({
        homeScore: matchRow.homeScore + homeScoreDelta,
        awayScore: matchRow.awayScore + awayScoreDelta,
      }).where(eq(schema.matchesTable.id, matchId));
      // TODO: broadcastMatchUpdate (SSE) and sendPushToAll not yet ported to Workers — clients relying on
      // live push notifications for goals won't get them until this is addressed in a follow-up.
    }
  }

  return c.json(event, 201);
});

app.patch("/api/matches/:id/events/:eventId", async (c) => {
  const db = drizzle(c.env.DB, { schema });
  const matchId = Number(c.req.param("id"));
  const eventId = Number(c.req.param("eventId"));
  const body = await c.req.json();
  const [event] = await db.update(schema.matchEventsTable).set(body).where(and(eq(schema.matchEventsTable.id, eventId), eq(schema.matchEventsTable.matchId, matchId))).returning();
  if (!event) return c.json({ error: "Event not found" }, 404);
  return c.json(event);
});

app.delete("/api/matches/:id/events/:eventId", async (c) => {
  const db = drizzle(c.env.DB, { schema });
  const matchId = Number(c.req.param("id"));
  const eventId = Number(c.req.param("eventId"));
  await db.delete(schema.matchEventsTable).where(and(eq(schema.matchEventsTable.id, eventId), eq(schema.matchEventsTable.matchId, matchId)));
  return c.body(null, 204);
});

/* ─── fallback: proxy everything else to Render until fully ported ─── */

app.all("/api/*", async (c) => {
  const url = new URL(c.req.url);
  const target = "https://drive-file-manager-9k9q.onrender.com" + url.pathname + url.search;
  const init: RequestInit = {
    method: c.req.method,
    headers: c.req.raw.headers,
    body: (c.req.method === "GET" || c.req.method === "HEAD") ? undefined : c.req.raw.body,
  };
  return fetch(target, init);
});

app.all("*", async (c) => {
  return c.env.ASSETS.fetch(c.req.raw);
});

export default app;
