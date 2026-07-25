import { Router } from "express";
import { db, streamsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { CreateStreamBody, DeleteStreamParams, ListStreamsQueryParams } from "@workspace/api-zod";

const router = Router();

router.get("/streams", async (req, res) => {
  const params = ListStreamsQueryParams.safeParse({
    matchId: req.query.matchId ? Number(req.query.matchId) : undefined,
  });

  let query = db.select().from(streamsTable);
  if (params.success && params.data.matchId !== undefined) {
    const streams = await db.select().from(streamsTable).where(eq(streamsTable.matchId, params.data.matchId));
    res.json(streams);
    return;
  }
  const streams = await query;
  res.json(streams);
});

router.post("/streams", async (req, res) => {
  const parsed = CreateStreamBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [stream] = await db.insert(streamsTable).values(parsed.data).returning();
  res.status(201).json(stream);
});

router.delete("/streams/:id", async (req, res) => {
  const { id } = DeleteStreamParams.parse({ id: Number(req.params.id) });
  await db.delete(streamsTable).where(eq(streamsTable.id, id));
  res.status(204).send();
});

export default router;
