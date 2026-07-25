import { Router } from "express";
import { db, squadsTable, matchEventsTable, teamsTable, lineupsTable, matchesTable, tournamentsTable } from "@workspace/db";
import { eq, and, or, inArray } from "drizzle-orm";

async function syncRoleToLineups(teamId: number, playerName: string, role: string) {
  await db
    .update(lineupsTable)
    .set({ role })
    .where(and(eq(lineupsTable.teamId, teamId), eq(lineupsTable.playerName, playerName)));
}

const router = Router();

router.get("/teams/:id/squad", async (req, res) => {
  const teamId = Number(req.params.id);
  const squad = await db
    .select()
    .from(squadsTable)
    .where(eq(squadsTable.teamId, teamId))
    .orderBy(squadsTable.role, squadsTable.playerNumber);
  res.json(squad);
});

router.post("/teams/:id/squad", async (req, res) => {
  const teamId = Number(req.params.id);
  const { playerNumber, playerName, playerCode, position, role, isStarting, photoUrl, nationality, bio } = req.body;
  if (!playerName) {
    res.status(400).json({ error: "playerName is required" });
    return;
  }
  const [player] = await db.insert(squadsTable).values({
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
  await syncRoleToLineups(teamId, playerName, player.role);
  res.status(201).json(player);
});

router.patch("/teams/:id/squad/:playerId", async (req, res) => {
  const teamId = Number(req.params.id);
  const playerId = Number(req.params.playerId);
  const { playerNumber, playerName, playerCode, position, role, isStarting, photoUrl, nationality, bio } = req.body;
  const [player] = await db
    .update(squadsTable)
    .set({
      ...(playerNumber !== undefined && { playerNumber }),
      ...(playerName !== undefined && { playerName }),
      ...(playerCode !== undefined && { playerCode: playerCode?.trim() || null }),
      ...(position !== undefined && { position }),
      ...(role !== undefined && { role }),
      ...(isStarting !== undefined && { isStarting }),
      ...(photoUrl !== undefined && { photoUrl: photoUrl || null }),
      ...(nationality !== undefined && { nationality: nationality || null }),
      ...(bio !== undefined && { bio: bio || null }),
    })
    .where(and(eq(squadsTable.id, playerId), eq(squadsTable.teamId, teamId)))
    .returning();
  if (!player) { res.status(404).json({ error: "Not found" }); return; }
  if (role !== undefined) {
    await syncRoleToLineups(teamId, player.playerName, player.role);
  }
  res.json(player);
});

router.delete("/teams/:id/squad/:playerId", async (req, res) => {
  const teamId = Number(req.params.id);
  const playerId = Number(req.params.playerId);
  await db.delete(squadsTable).where(
    and(eq(squadsTable.id, playerId), eq(squadsTable.teamId, teamId))
  );
  res.status(204).send();
});

router.get("/squad/:playerId", async (req, res) => {
  const playerId = Number(req.params.playerId);
  const [player] = await db.select().from(squadsTable).where(eq(squadsTable.id, playerId));
  if (!player) { res.status(404).json({ error: "Not found" }); return; }
  res.json(player);
});

router.get("/squad/:playerId/stats", async (req, res) => {
  const playerId = Number(req.params.playerId);
  const [player] = await db.select().from(squadsTable).where(eq(squadsTable.id, playerId));
  if (!player) { res.status(404).json({ error: "Not found" }); return; }

  const [team] = await db.select().from(teamsTable).where(eq(teamsTable.id, player.teamId));

  // Find all linked squad entries: by playerCode (if set) or just this player's name/team
  let linkedSquads: typeof squadsTable.$inferSelect[] = [player];
  if (player.playerCode) {
    linkedSquads = await db
      .select()
      .from(squadsTable)
      .where(eq(squadsTable.playerCode, player.playerCode));
  }

  // For each linked squad, get events by (teamId + playerName) pair
  const allEvents = await db.select().from(matchEventsTable);
  const allMatches = await db.select().from(matchesTable);
  const allTournaments = await db.select().from(tournamentsTable);
  const allTeams = await db.select().from(teamsTable);

  const matchMap = new Map(allMatches.map(m => [m.id, m]));
  const tournamentMap = new Map(allTournaments.map(t => [t.id, t]));
  const teamMap = new Map(allTeams.map(t => [t.id, t]));

  // Collect events that belong to this player (matching by teamId+playerName pair)
  const squadPairs = linkedSquads.map(s => ({ teamId: s.teamId, name: s.playerName }));

  const playerEvents = allEvents.filter(e =>
    squadPairs.some(p => p.teamId === e.teamId && p.name === e.playerName)
  );
  const assistEvents = allEvents.filter(e =>
    squadPairs.some(p => p.name === e.assistPlayerName)
  );

  // Overall totals
  const goals = playerEvents.filter(e => e.type === "goal" || e.type === "penalty_goal").length;
  const ownGoals = playerEvents.filter(e => e.type === "own_goal").length;
  const yellowCards = playerEvents.filter(e => e.type === "yellow_card").length;
  const redCards = playerEvents.filter(e => e.type === "red_card").length;
  const assists = assistEvents.filter(e => e.type === "goal" || e.type === "penalty_goal").length;
  const matchIds = new Set(playerEvents.map(e => e.matchId));
  const appearances = matchIds.size;

  // Per-tournament stats — group by (tournamentId, teamId)
  type TournamentKey = string;
  const byTournament = new Map<TournamentKey, {
    tournamentId: number | null;
    tournamentName: string;
    tournamentLogo: string | null;
    teamId: number;
    teamName: string;
    goals: number;
    assists: number;
    yellowCards: number;
    redCards: number;
    matchIds: Set<number>;
  }>();

  for (const ev of playerEvents) {
    const match = matchMap.get(ev.matchId);
    const tid = match?.tournamentId ?? null;
    const tournament = tid ? tournamentMap.get(tid) : null;
    const squadTeam = teamMap.get(ev.teamId);
    const key: TournamentKey = `${tid ?? 0}-${ev.teamId}`;

    if (!byTournament.has(key)) {
      byTournament.set(key, {
        tournamentId: tid,
        tournamentName: tournament?.name ?? match?.competition ?? "Friendly",
        tournamentLogo: tournament?.logoUrl ?? null,
        teamId: ev.teamId,
        teamName: squadTeam?.name ?? "Unknown",
        goals: 0,
        assists: 0,
        yellowCards: 0,
        redCards: 0,
        matchIds: new Set(),
      });
    }
    const entry = byTournament.get(key)!;
    entry.matchIds.add(ev.matchId);
    if (ev.type === "goal" || ev.type === "penalty_goal") entry.goals++;
    if (ev.type === "own_goal") entry.goals--; // don't count own goals
    if (ev.type === "yellow_card") entry.yellowCards++;
    if (ev.type === "red_card") entry.redCards++;
  }

  // Add assists to tournament entries
  for (const ev of assistEvents.filter(e => e.type === "goal" || e.type === "penalty_goal")) {
    const match = matchMap.get(ev.matchId);
    const tid = match?.tournamentId ?? null;
    // Find which squad team this assist belongs to (match the assisting player's team)
    const key = `${tid ?? 0}-${ev.teamId}`;
    if (byTournament.has(key)) {
      byTournament.get(key)!.assists++;
    }
  }

  const tournamentStats = [...byTournament.values()].map(t => ({
    tournamentId: t.tournamentId,
    tournamentName: t.tournamentName,
    tournamentLogo: t.tournamentLogo,
    teamName: t.teamName,
    goals: Math.max(0, t.goals),
    assists: t.assists,
    yellowCards: t.yellowCards,
    redCards: t.redCards,
    appearances: t.matchIds.size,
  }));

  // Collect all unique teams this player has events for
  const playedTeamIds = [...new Set(playerEvents.map(e => e.teamId).filter(Boolean) as number[])];
  let playedTeams: Array<{ id: number; name: string; shortName: string | null; logoUrl: string | null; sport: string | null }> = [];
  if (playedTeamIds.length > 0) {
    playedTeams = allTeams
      .filter(t => playedTeamIds.includes(t.id))
      .map(t => ({ id: t.id, name: t.name, shortName: t.shortName, logoUrl: t.logoUrl, sport: t.sport }));
  }

  // Also include squads' teams even if no events
  for (const s of linkedSquads) {
    if (!playedTeams.find(t => t.id === s.teamId)) {
      const t = teamMap.get(s.teamId);
      if (t) playedTeams.push({ id: t.id, name: t.name, shortName: t.shortName, logoUrl: t.logoUrl, sport: t.sport });
    }
  }

  // Always include the current team first
  if (team && !playedTeams.find(t => t.id === team.id)) {
    playedTeams.unshift({ id: team.id, name: team.name, shortName: team.shortName, logoUrl: team.logoUrl, sport: team.sport });
  }

  res.json({
    player,
    team: team ? { id: team.id, name: team.name, shortName: team.shortName, logoUrl: team.logoUrl } : null,
    goals,
    assists,
    yellowCards,
    redCards,
    ownGoals,
    appearances,
    playedTeams,
    tournamentStats,
  });
});

// GET /players — all squad players across all teams with deduplication by playerCode
router.get("/players", async (req, res) => {
  const sport = req.query.sport as string | undefined;
  const teamId = req.query.teamId ? Number(req.query.teamId) : undefined;
  const q = req.query.q as string | undefined;

  const rows = await db
    .select({
      id: squadsTable.id,
      teamId: squadsTable.teamId,
      playerNumber: squadsTable.playerNumber,
      playerName: squadsTable.playerName,
      playerCode: squadsTable.playerCode,
      position: squadsTable.position,
      role: squadsTable.role,
      isStarting: squadsTable.isStarting,
      photoUrl: squadsTable.photoUrl,
      nationality: squadsTable.nationality,
      teamName: teamsTable.name,
      teamShortName: teamsTable.shortName,
      teamLogoUrl: teamsTable.logoUrl,
      teamSport: teamsTable.sport,
    })
    .from(squadsTable)
    .innerJoin(teamsTable, eq(squadsTable.teamId, teamsTable.id))
    .orderBy(squadsTable.playerName);

  let result = rows.filter(p => p.role !== "coach");
  if (sport && sport !== "all") result = result.filter(r => r.teamSport === sport);
  if (teamId) result = result.filter(r => r.teamId === teamId);
  if (q) {
    const lq = q.toLowerCase();
    result = result.filter(r =>
      r.playerName.toLowerCase().includes(lq) ||
      r.teamName.toLowerCase().includes(lq) ||
      (r.nationality ?? "").toLowerCase().includes(lq) ||
      (r.playerCode ?? "").toLowerCase().includes(lq)
    );
  }

  // Deduplicate: for players with the same playerCode, keep only one entry (first found)
  if (!teamId) {
    const seenCodes = new Set<string>();
    result = result.filter(r => {
      if (!r.playerCode) return true; // no code → always show
      if (seenCodes.has(r.playerCode)) return false;
      seenCodes.add(r.playerCode);
      return true;
    });
  }

  res.json(result);
});

export default router;
