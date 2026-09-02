import { db, lineupsTable, matchesTable, squadsTable } from "@workspace/db";
import { eq, inArray } from "drizzle-orm";

export async function ensureMatchLineupsFromSquads(matchId: number): Promise<number> {
  const [match] = await db.select().from(matchesTable).where(eq(matchesTable.id, matchId));
  if (!match) return 0;

  const teamIds = [match.homeTeamId, match.awayTeamId].filter((id): id is number => id !== null);
  if (teamIds.length === 0) return 0;

  const existing = await db.select().from(lineupsTable).where(eq(lineupsTable.matchId, matchId));
  const populatedTeamIds = new Set(existing.map(player => player.teamId));
  const missingTeamIds = teamIds.filter(teamId => !populatedTeamIds.has(teamId));
  if (missingTeamIds.length === 0) return 0;

  const squads = await db.select().from(squadsTable).where(inArray(squadsTable.teamId, missingTeamIds));
  const players = squads.map(player => ({
    matchId,
    teamId: player.teamId,
    playerNumber: player.playerNumber,
    playerName: player.playerName,
    position: player.position,
    role: player.role,
    isStarting: player.isStarting,
  }));

  if (players.length > 0) {
    await db.insert(lineupsTable).values(players);
  }
  return players.length;
}