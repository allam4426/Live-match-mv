import { Router } from "express";
import { db, lineupsTable, matchesTable, squadsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { AddLineupPlayerBody } from "@workspace/api-zod";

const router = Router();

router.get("/matches/:id/lineup", async (req, res) => {
  const matchId = Number(req.params.id);
  const [match] = await db.select().from(matchesTable).where(eq(matchesTable.id, matchId));
  if (!match) { res.status(404).json({ error: "Match not found" }); return; }
  const all = await db.select().from(lineupsTable).where(eq(lineupsTable.matchId, matchId));
  res.json({
    matchId,
    home: all.filter(p => p.teamId === match.homeTeamId),
    away: all.filter(p => p.teamId === match.awayTeamId),
  });
});

// IMPORTANT: /auto must be defined before /:playerId
router.post("/matches/:id/lineup/auto", async (req, res) => {
  const matchId = Number(req.params.id);
  const [match] = await db.select().from(matchesTable).where(eq(matchesTable.id, matchId));
  if (!match) { res.status(404).json({ error: "Match not found" }); return; }

  const homeTeamId = match.homeTeamId;
  const awayTeamId = match.awayTeamId;

  // Get squads for both teams (skip TBD slots)
  const [homeSquad, awaySquad] = await Promise.all([
    homeTeamId ? db.select().from(squadsTable).where(eq(squadsTable.teamId, homeTeamId)) : Promise.resolve([]),
    awayTeamId ? db.select().from(squadsTable).where(eq(squadsTable.teamId, awayTeamId)) : Promise.resolve([]),
  ]);

  // Clear existing lineup
  await db.delete(lineupsTable).where(eq(lineupsTable.matchId, matchId));

  // Insert all squad players as lineup
  const toInsert = [
    ...(homeTeamId ? homeSquad.map(p => ({
      matchId,
      teamId: homeTeamId,
      playerNumber: p.playerNumber,
      playerName: p.playerName,
      position: p.position,
      role: p.role,
      isStarting: p.isStarting,
    })) : []),
    ...(awayTeamId ? awaySquad.map(p => ({
      matchId,
      teamId: awayTeamId,
      playerNumber: p.playerNumber,
      playerName: p.playerName,
      position: p.position,
      role: p.role,
      isStarting: p.isStarting,
    })) : []),
  ];

  if (toInsert.length > 0) {
    await db.insert(lineupsTable).values(toInsert);
  }

  const all = await db.select().from(lineupsTable).where(eq(lineupsTable.matchId, matchId));
  res.json({
    matchId,
    home: all.filter(p => p.teamId === match.homeTeamId),
    away: all.filter(p => p.teamId === match.awayTeamId),
  });
});

router.post("/matches/:id/lineup", async (req, res) => {
  const matchId = Number(req.params.id);
  const parsed = AddLineupPlayerBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [player] = await db.insert(lineupsTable).values({
    matchId,
    ...parsed.data,
  }).returning();
  res.status(201).json(player);
});

router.patch("/matches/:id/lineup/:playerId", async (req, res) => {
  const matchId = Number(req.params.id);
  const playerId = Number(req.params.playerId);
  const { role, isStarting } = req.body as { role?: string; isStarting?: boolean };
  const updates: Record<string, unknown> = {};
  if (role !== undefined) updates.role = role;
  if (isStarting !== undefined) updates.isStarting = isStarting;
  if (Object.keys(updates).length === 0) { res.status(400).json({ error: "Nothing to update" }); return; }
  const [updated] = await db.update(lineupsTable).set(updates).where(
    and(eq(lineupsTable.id, playerId), eq(lineupsTable.matchId, matchId))
  ).returning();
  res.json(updated);
});

router.delete("/matches/:id/lineup/:playerId", async (req, res) => {
  const matchId = Number(req.params.id);
  const playerId = Number(req.params.playerId);
  await db.delete(lineupsTable).where(
    and(eq(lineupsTable.id, playerId), eq(lineupsTable.matchId, matchId))
  );
  res.status(204).send();
});

export default router;
