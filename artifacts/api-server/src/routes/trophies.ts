import { Router } from "express";
import { db, trophiesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAdmin } from "./admin-auth";
const router = Router();
router.get("/trophies", async (req, res) => {
  const teamId = req.query.teamId ? Number(req.query.teamId) : undefined;
  const rows = teamId
    ? await db.select().from(trophiesTable).where(eq(trophiesTable.teamId, teamId))
    : await db.select().from(trophiesTable);
  res.json(rows);
});
router.get("/teams/:id/trophies", async (req, res) => {
  const id = Number(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const rows = await db.select().from(trophiesTable).where(eq(trophiesTable.teamId, id));
  res.json(rows);
});
router.post("/trophies", requireAdmin, async (req, res) => {
  const { teamId, title, season, imageUrl } = req.body as {
    teamId: number; title: string; season?: string; imageUrl?: string;
  };
  if (!teamId || !title) { res.status(400).json({ error: "teamId and title are required" }); return; }
  const [trophy] = await db.insert(trophiesTable).values({
    teamId,
    title,
    season: season ?? "",
    imageUrl: imageUrl ?? "",
  }).returning();
  res.status(201).json(trophy);
});
router.patch("/trophies/:id", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  const { title, season, imageUrl } = req.body as {
    title?: string; season?: string; imageUrl?: string;
  };
  const updates: Partial<typeof trophiesTable.$inferInsert> = {};
  if (title !== undefined) updates.title = title;
  if (season !== undefined) updates.season = season;
  if (imageUrl !== undefined) updates.imageUrl = imageUrl;
  const [updated] = await db.update(trophiesTable).set(updates).where(eq(trophiesTable.id, id)).returning();
  if (!updated) { res.status(404).json({ error: "Trophy not found" }); return; }
  res.json(updated);
});
router.delete("/trophies/:id", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  await db.delete(trophiesTable).where(eq(trophiesTable.id, id));
  res.status(204).send();
});
export default router;
