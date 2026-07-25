import { Router } from "express";
import { db, bannersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();

router.get("/banners", async (req, res) => {
  const position = req.query.position as string | undefined;
  const rows = position
    ? await db.select().from(bannersTable).where(eq(bannersTable.position, position))
    : await db.select().from(bannersTable);
  res.json(rows);
});

router.post("/banners", async (req, res) => {
  const { imageUrl, linkUrl, position, isActive } = req.body as {
    imageUrl: string; linkUrl?: string; position?: string; isActive?: boolean;
  };
  if (!imageUrl) { res.status(400).json({ error: "imageUrl is required" }); return; }
  const [banner] = await db.insert(bannersTable).values({
    imageUrl,
    linkUrl: linkUrl ?? "",
    position: position ?? "top_home",
    isActive: isActive ?? true,
  }).returning();
  res.status(201).json(banner);
});

router.patch("/banners/:id", async (req, res) => {
  const id = Number(req.params.id);
  const { imageUrl, linkUrl, position, isActive } = req.body as {
    imageUrl?: string; linkUrl?: string; position?: string; isActive?: boolean;
  };
  const updates: Partial<typeof bannersTable.$inferInsert> = {};
  if (imageUrl !== undefined) updates.imageUrl = imageUrl;
  if (linkUrl !== undefined) updates.linkUrl = linkUrl;
  if (position !== undefined) updates.position = position;
  if (isActive !== undefined) updates.isActive = isActive;
  const [updated] = await db.update(bannersTable).set(updates).where(eq(bannersTable.id, id)).returning();
  if (!updated) { res.status(404).json({ error: "Banner not found" }); return; }
  res.json(updated);
});

router.delete("/banners/:id", async (req, res) => {
  const id = Number(req.params.id);
  await db.delete(bannersTable).where(eq(bannersTable.id, id));
  res.status(204).send();
});

export default router;
