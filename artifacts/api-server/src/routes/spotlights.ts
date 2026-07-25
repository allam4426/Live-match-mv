import { Router } from "express";
import { db, spotlightsTable } from "@workspace/db";
import { eq, asc } from "drizzle-orm";

const router = Router();

router.get("/spotlights", async (_req, res) => {
  const rows = await db.select().from(spotlightsTable).orderBy(asc(spotlightsTable.sortOrder), asc(spotlightsTable.createdAt));
  res.json(rows);
});

router.post("/spotlights", async (req, res) => {
  const { title, subtitle, imageUrl, linkUrl, active, sortOrder } = req.body as {
    title: string; subtitle?: string; imageUrl: string; linkUrl?: string; active?: boolean; sortOrder?: number;
  };
  if (!title || !imageUrl) { res.status(400).json({ error: "title and imageUrl are required" }); return; }
  const [row] = await db.insert(spotlightsTable).values({
    title,
    subtitle: subtitle ?? null,
    imageUrl,
    linkUrl: linkUrl ?? null,
    active: active ?? true,
    sortOrder: sortOrder ?? 0,
  }).returning();
  res.status(201).json(row);
});

router.patch("/spotlights/:id", async (req, res) => {
  const id = Number(req.params.id);
  const { title, subtitle, imageUrl, linkUrl, active, sortOrder } = req.body as {
    title?: string; subtitle?: string | null; imageUrl?: string; linkUrl?: string | null; active?: boolean; sortOrder?: number;
  };
  const updates: Partial<typeof spotlightsTable.$inferInsert> = {};
  if (title !== undefined) updates.title = title;
  if (subtitle !== undefined) updates.subtitle = subtitle;
  if (imageUrl !== undefined) updates.imageUrl = imageUrl;
  if (linkUrl !== undefined) updates.linkUrl = linkUrl;
  if (active !== undefined) updates.active = active;
  if (sortOrder !== undefined) updates.sortOrder = sortOrder;
  const [updated] = await db.update(spotlightsTable).set(updates).where(eq(spotlightsTable.id, id)).returning();
  if (!updated) { res.status(404).json({ error: "Not found" }); return; }
  res.json(updated);
});

router.delete("/spotlights/:id", async (req, res) => {
  const id = Number(req.params.id);
  await db.delete(spotlightsTable).where(eq(spotlightsTable.id, id));
  res.status(204).send();
});

export default router;
