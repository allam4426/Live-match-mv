import { Router } from "express";
import { db, teamsTable, matchesTable, tournamentsTable, matchEventsTable } from "@workspace/db";
import { eq, or, desc, inArray, and } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { CreateTeamBody, UpdateTeamBody, GetTeamParams, UpdateTeamParams, DeleteTeamParams } from "@workspace/api-zod";

const router = Router();

router.get("/teams", async (req, res) => {
  const sport = req.query.sport as string | undefined;
  let teams = await db.select().from(teamsTable).orderBy(teamsTable.name);
  if (sport && sport !== "all") {
    teams = teams.filter(t => t.sport === sport);
  }
  res.json(teams);
});

router.post("/teams", async (req, res) => {
  const parsed = CreateTeamBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [team] = await db.insert(teamsTable).values({
    ...parsed.data,
    logoUrl: parsed.data.logoUrl ?? "",
  }).returning();
  res.status(201).json(team);
});

router.get("/teams/:id/matches", async (req, res) => {
  const id = Number(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const home = alias(teamsTable, "homeTeam");
  const away = alias(teamsTable, "awayTeam");

  const rows = await db
    .select({ match: matchesTable, homeTeam: home, awayTeam: away })
    .from(matchesTable)
    .leftJoin(home, eq(matchesTable.homeTeamId, home.id))
    .leftJoin(away, eq(matchesTable.awayTeamId, away.id))
    .where(or(eq(matchesTable.homeTeamId, id), eq(matchesTable.awayTeamId, id)))
    .orderBy(desc(matchesTable.kickoffAt))
    .limit(20);

  res.json(rows.map(r => ({
    id: r.match.id,
    homeScore: r.match.homeScore,
    awayScore: r.match.awayScore,
    status: r.match.status,
    kickoffAt: r.match.kickoffAt,
    competition: r.match.competition,
    minute: r.match.minute,
    tournamentId: r.match.tournamentId,
    homeTeam: r.homeTeam
      ? { id: r.homeTeam.id, name: r.homeTeam.name, logoUrl: r.homeTeam.logoUrl, shortName: r.homeTeam.shortName }
      : null,
    awayTeam: r.awayTeam
      ? { id: r.awayTeam.id, name: r.awayTeam.name, logoUrl: r.awayTeam.logoUrl, shortName: r.awayTeam.shortName }
      : null,
  })));
});

router.get("/teams/:id/stats", async (req, res) => {
  const id = Number(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const home = alias(teamsTable, "homeTeam");
  const away = alias(teamsTable, "awayTeam");

  const rows = await db
    .select({ match: matchesTable, homeTeam: home, awayTeam: away })
    .from(matchesTable)
    .leftJoin(home, eq(matchesTable.homeTeamId, home.id))
    .leftJoin(away, eq(matchesTable.awayTeamId, away.id))
    .where(and(
      or(eq(matchesTable.homeTeamId, id), eq(matchesTable.awayTeamId, id)),
      eq(matchesTable.status, "finished")
    ));

  const matchIds = rows.map(r => r.match.id);
  let events: Array<typeof matchEventsTable.$inferSelect> = [];
  if (matchIds.length > 0) {
    events = await db
      .select()
      .from(matchEventsTable)
      .where(and(
        inArray(matchEventsTable.matchId, matchIds),
        eq(matchEventsTable.teamId, id)
      ));
  }

  const byTournament = new Map<number, { matches: typeof rows; events: typeof events }>();
  for (const row of rows) {
    const tid = row.match.tournamentId ?? 0;
    if (!byTournament.has(tid)) byTournament.set(tid, { matches: [], events: [] });
    byTournament.get(tid)!.matches.push(row);
  }
  for (const ev of events) {
    const matchRow = rows.find(r => r.match.id === ev.matchId);
    const tid = matchRow?.match.tournamentId ?? 0;
    byTournament.get(tid)?.events.push(ev);
  }

  const tIds = [...byTournament.keys()].filter(x => x > 0);
  const tournaments = tIds.length > 0
    ? await db.select().from(tournamentsTable).where(inArray(tournamentsTable.id, tIds))
    : [];

  const result = [...byTournament.entries()].map(([tid, { matches, events: evs }]) => {
    const tournament = tournaments.find(t => t.id === tid);
    let wins = 0, draws = 0, losses = 0, gf = 0, ga = 0;
    for (const { match } of matches) {
      const isHome = match.homeTeamId === id;
      const scored = isHome ? match.homeScore : match.awayScore;
      const conceded = isHome ? match.awayScore : match.homeScore;
      gf += scored; ga += conceded;
      if (scored > conceded) wins++;
      else if (scored < conceded) losses++;
      else draws++;
    }
    const played = matches.length;
    return {
      tournamentId: tid,
      tournamentName: tournament?.name ?? (tid === 0 ? "Friendly / Other" : "Unknown"),
      tournamentLogo: tournament?.logoUrl ?? null,
      tournamentSport: tournament?.sport ?? "football",
      played,
      wins,
      draws,
      losses,
      goalsScored: gf,
      goalsConceded: ga,
      yellowCards: evs.filter(e => e.type === "yellow_card").length,
      redCards: evs.filter(e => e.type === "red_card").length,
      winRate: played > 0 ? Math.round((wins / played) * 100) : 0,
      goalPerGame: played > 0 ? Math.round((gf / played) * 10) / 10 : 0,
    };
  });

  res.json(result.filter(r => r.played > 0));
});

router.get("/teams/:id/tournaments", async (req, res) => {
  const id = Number(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const rows = await db
    .selectDistinct({ tournamentId: matchesTable.tournamentId })
    .from(matchesTable)
    .where(or(eq(matchesTable.homeTeamId, id), eq(matchesTable.awayTeamId, id)));

  const ids = rows.map(r => r.tournamentId).filter((x): x is number => x !== null);
  if (ids.length === 0) { res.json([]); return; }

  const result = await db
    .select()
    .from(tournamentsTable)
    .where(inArray(tournamentsTable.id, ids))
    .orderBy(desc(tournamentsTable.id));

  res.json(result);
});

router.get("/teams/:id/form", async (req, res) => {
  const id = Number(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [team] = await db.select().from(teamsTable).where(eq(teamsTable.id, id));
  if (!team) { res.status(404).json({ error: "Team not found" }); return; }

  // Last 5 finished matches for this team across all competitions, newest first
  const finished = await db
    .select()
    .from(matchesTable)
    .where(
      or(eq(matchesTable.homeTeamId, id), eq(matchesTable.awayTeamId, id))
    )
    .orderBy(desc(matchesTable.kickoffAt))
    .limit(50);

  const finishedOnly = finished.filter(m => m.status === "finished").slice(0, 5);

  // Reverse so oldest is first (left-to-right reading order)
  const form = finishedOnly.reverse().map(m => {
    const isHome = m.homeTeamId === id;
    const scored = isHome ? m.homeScore : m.awayScore;
    const conceded = isHome ? m.awayScore : m.homeScore;
    if (scored > conceded) return "W" as const;
    if (scored < conceded) return "L" as const;
    return "D" as const;
  });

  res.json({ teamId: id, form });
});

router.get("/teams/:id", async (req, res) => {
  const { id } = GetTeamParams.parse({ id: Number(req.params.id) });
  const [team] = await db.select().from(teamsTable).where(eq(teamsTable.id, id));
  if (!team) { res.status(404).json({ error: "Team not found" }); return; }
  res.json(team);
});

router.patch("/teams/:id", async (req, res) => {
  const { id } = UpdateTeamParams.parse({ id: Number(req.params.id) });
  const parsed = UpdateTeamBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [team] = await db.update(teamsTable).set(parsed.data).where(eq(teamsTable.id, id)).returning();
  if (!team) { res.status(404).json({ error: "Team not found" }); return; }
  res.json(team);
});

router.delete("/teams/:id", async (req, res) => {
  const { id } = DeleteTeamParams.parse({ id: Number(req.params.id) });
  await db.delete(teamsTable).where(eq(teamsTable.id, id));
  res.status(204).send();
});

export default router;
