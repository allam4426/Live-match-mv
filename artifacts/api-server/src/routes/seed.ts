import { Router } from "express";
import { db, teamsTable, tournamentsTable, matchesTable } from "@workspace/db";
import { requireAdmin } from "./admin-auth";
import { count } from "drizzle-orm";

const router = Router();

router.post("/admin/seed", requireAdmin, async (_req, res) => {
  const [{ value: teamCount }] = await db.select({ value: count() }).from(teamsTable);
  if (teamCount > 0) {
    res.status(409).json({ error: "Database already has data. Clear it first before seeding." });
    return;
  }

  const now = new Date();
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const [teamA, teamB, teamC, teamD] = await db.insert(teamsTable).values([
    { name: "Maziya S&RC", shortName: "MAZ", logoUrl: "", country: "Maldives", sport: "football" },
    { name: "Club Eagles", shortName: "EAG", logoUrl: "", country: "Maldives", sport: "football" },
    { name: "TC Sports Club", shortName: "TCS", logoUrl: "", country: "Maldives", sport: "football" },
    { name: "Super United Sports", shortName: "SUS", logoUrl: "", country: "Maldives", sport: "football" },
  ]).returning();

  const [futsalA, futsalB] = await db.insert(teamsTable).values([
    { name: "United Victory", shortName: "UNV", logoUrl: "", country: "Maldives", sport: "futsal" },
    { name: "Island FC", shortName: "ISL", logoUrl: "", country: "Maldives", sport: "futsal" },
  ]).returning();

  const [tournament] = await db.insert(tournamentsTable).values({
    name: "Dhivehi Premier League",
    sport: "football",
    season: "2025",
    format: "league",
    active: true,
  }).returning();

  const [futsalTournament] = await db.insert(tournamentsTable).values({
    name: "Futsal Fiesta Cup",
    sport: "futsal",
    season: "2025",
    format: "league",
    active: true,
  }).returning();

  await db.insert(matchesTable).values([
    {
      homeTeamId: teamA.id, awayTeamId: teamB.id,
      competition: "Dhivehi Premier League",
      sport: "football", status: "live",
      kickoffAt: now, homeScore: 2, awayScore: 1, minute: "67",
      tournamentId: tournament.id, featured: true,
    },
    {
      homeTeamId: teamC.id, awayTeamId: teamD.id,
      competition: "Dhivehi Premier League",
      sport: "football", status: "scheduled",
      kickoffAt: tomorrow, homeScore: 0, awayScore: 0,
      tournamentId: tournament.id,
    },
    {
      homeTeamId: teamD.id, awayTeamId: teamA.id,
      competition: "Dhivehi Premier League",
      sport: "football", status: "finished",
      kickoffAt: yesterday, homeScore: 0, awayScore: 3,
      tournamentId: tournament.id,
    },
    {
      homeTeamId: futsalA.id, awayTeamId: futsalB.id,
      competition: "Futsal Fiesta Cup",
      sport: "futsal", status: "scheduled",
      kickoffAt: tomorrow, homeScore: 0, awayScore: 0,
      tournamentId: futsalTournament.id,
    },
  ]);

  res.json({ success: true, message: "Demo data seeded successfully." });
});

export default router;
