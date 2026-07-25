import { Router } from "express";
import { db, highlightsTable, teamsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { CreateHighlightBody, DeleteHighlightParams, GetHighlightParams, ListHighlightsQueryParams } from "@workspace/api-zod";
import { alias } from "drizzle-orm/pg-core";

const router = Router();

function buildHighlightWithTeams(rows: Array<{
  highlight: typeof highlightsTable.$inferSelect;
  homeTeam: typeof teamsTable.$inferSelect;
  awayTeam: typeof teamsTable.$inferSelect;
}>) {
  return rows.map(({ highlight, homeTeam, awayTeam }) => ({
    id: highlight.id,
    title: highlight.title,
    competition: highlight.competition,
    thumbnailUrl: highlight.thumbnailUrl,
    videoUrl: highlight.videoUrl,
    duration: highlight.duration,
    publishedAt: highlight.publishedAt.toISOString(),
    homeTeam,
    awayTeam,
    homeScore: highlight.homeScore,
    awayScore: highlight.awayScore,
    views: highlight.views,
  }));
}

router.get("/highlights", async (req, res) => {
  const params = ListHighlightsQueryParams.safeParse({
    competition: req.query.competition,
    limit: req.query.limit ? Number(req.query.limit) : 20,
  });

  const homeTeam = alias(teamsTable, "homeTeam");
  const awayTeam = alias(teamsTable, "awayTeam");

  let query = db
    .select({ highlight: highlightsTable, homeTeam, awayTeam })
    .from(highlightsTable)
    .innerJoin(homeTeam, eq(highlightsTable.homeTeamId, homeTeam.id))
    .innerJoin(awayTeam, eq(highlightsTable.awayTeamId, awayTeam.id))
    .orderBy(desc(highlightsTable.publishedAt));

  if (params.success && params.data.competition) {
    const rows = await db
      .select({ highlight: highlightsTable, homeTeam, awayTeam })
      .from(highlightsTable)
      .innerJoin(homeTeam, eq(highlightsTable.homeTeamId, homeTeam.id))
      .innerJoin(awayTeam, eq(highlightsTable.awayTeamId, awayTeam.id))
      .where(eq(highlightsTable.competition, params.data.competition))
      .orderBy(desc(highlightsTable.publishedAt))
      .limit(params.data.limit ?? 20);
    res.json(buildHighlightWithTeams(rows));
    return;
  }

  const limit = params.success ? (params.data.limit ?? 20) : 20;
  const rows = await query.limit(limit);
  res.json(buildHighlightWithTeams(rows));
});

router.post("/highlights", async (req, res) => {
  const parsed = CreateHighlightBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [highlight] = await db.insert(highlightsTable).values(parsed.data).returning();

  const homeTeam = alias(teamsTable, "homeTeam");
  const awayTeam = alias(teamsTable, "awayTeam");
  const [row] = await db
    .select({ highlight: highlightsTable, homeTeam, awayTeam })
    .from(highlightsTable)
    .innerJoin(homeTeam, eq(highlightsTable.homeTeamId, homeTeam.id))
    .innerJoin(awayTeam, eq(highlightsTable.awayTeamId, awayTeam.id))
    .where(eq(highlightsTable.id, highlight.id));

  res.status(201).json(buildHighlightWithTeams([row])[0]);
});

router.get("/highlights/:id", async (req, res) => {
  const { id } = GetHighlightParams.parse({ id: Number(req.params.id) });
  const homeTeam = alias(teamsTable, "homeTeam");
  const awayTeam = alias(teamsTable, "awayTeam");
  const [row] = await db
    .select({ highlight: highlightsTable, homeTeam, awayTeam })
    .from(highlightsTable)
    .innerJoin(homeTeam, eq(highlightsTable.homeTeamId, homeTeam.id))
    .innerJoin(awayTeam, eq(highlightsTable.awayTeamId, awayTeam.id))
    .where(eq(highlightsTable.id, id));

  if (!row) {
    res.status(404).json({ error: "Highlight not found" });
    return;
  }
  res.json(buildHighlightWithTeams([row])[0]);
});

router.delete("/highlights/:id", async (req, res) => {
  const { id } = DeleteHighlightParams.parse({ id: Number(req.params.id) });
  await db.delete(highlightsTable).where(eq(highlightsTable.id, id));
  res.status(204).send();
});

export default router;
