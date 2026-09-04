import { Router } from "express";
import webpush from "web-push";
import { db, pushSubscriptionsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "../lib/logger";

const router = Router();

const vapidPublicKey = process.env.VAPID_PUBLIC_KEY;
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
const vapidContact = process.env.VAPID_CONTACT ?? "mailto:admin@livematchmv.online";

if (vapidPublicKey && vapidPrivateKey) {
  webpush.setVapidDetails(vapidContact, vapidPublicKey, vapidPrivateKey);
}

router.get("/push/vapid-public-key", (_req, res) => {
  if (!vapidPublicKey) {
    res.status(503).json({ error: "Push notifications not configured" });
    return;
  }
  res.json({ publicKey: vapidPublicKey });
});

type PushSubscriptionBody = {
  endpoint?: string;
  keys?: { p256dh?: string; auth?: string };
  teamIds?: unknown;
  tournamentIds?: unknown;
};

function normalizePushPreferenceIds(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((id): id is number => Number.isInteger(id) && id > 0))];
}

router.post("/push/subscribe", async (req, res) => {
  const { endpoint, keys, teamIds, tournamentIds } = (req.body ?? {}) as PushSubscriptionBody;
  if (!endpoint || !keys?.p256dh || !keys?.auth) {
    res.status(400).json({ error: "Invalid subscription object" });
    return;
  }
  const normalizedTeamIds = JSON.stringify(normalizePushPreferenceIds(teamIds));
  const normalizedTournamentIds = JSON.stringify(normalizePushPreferenceIds(tournamentIds));
  const [existing] = await db
    .select({ id: pushSubscriptionsTable.id })
    .from(pushSubscriptionsTable)
    .where(eq(pushSubscriptionsTable.endpoint, endpoint));
  if (existing) {
    await db.update(pushSubscriptionsTable)
      .set({ p256dh: keys.p256dh, auth: keys.auth, teamIds: normalizedTeamIds, tournamentIds: normalizedTournamentIds })
      .where(eq(pushSubscriptionsTable.id, existing.id));
  } else {
    await db.insert(pushSubscriptionsTable).values({
      endpoint,
      p256dh: keys.p256dh,
      auth: keys.auth,
      teamIds: normalizedTeamIds,
      tournamentIds: normalizedTournamentIds,
    });
  }
  res.status(201).json({ success: true });
});

router.delete("/push/unsubscribe", async (req, res) => {
  const { endpoint } = req.body ?? {};
  if (!endpoint) {
    res.status(400).json({ error: "endpoint required" });
    return;
  }
  await db.delete(pushSubscriptionsTable).where(eq(pushSubscriptionsTable.endpoint, endpoint));
  res.json({ success: true });
});

export async function sendPushToAll(
  payload: { title: string; body: string; url?: string },
  filter: { teamIds: number[]; tournamentId: number | null },
) {
  if (!vapidPublicKey || !vapidPrivateKey) return;
  const subs = await db.select().from(pushSubscriptionsTable);
  const matchingSubs = subs.filter((sub) => {
    let teamIds: unknown;
    let tournamentIds: unknown;
    try {
      teamIds = JSON.parse(sub.teamIds);
      tournamentIds = JSON.parse(sub.tournamentIds);
    } catch {
      return false;
    }
    const followsTeam = Array.isArray(teamIds)
      && filter.teamIds.some((teamId) => teamIds.includes(teamId));
    const followsTournament = filter.tournamentId !== null
      && Array.isArray(tournamentIds)
      && tournamentIds.includes(filter.tournamentId);
    return followsTeam || followsTournament;
  });
  const dead: string[] = [];

  await Promise.allSettled(
    matchingSubs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify({ ...payload, icon: "/logo.png" }),
        );
      } catch (err: unknown) {
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) dead.push(sub.endpoint);
        else logger.warn({ err, endpoint: sub.endpoint }, "Push send failed");
      }
    }),
  );

  if (dead.length > 0) {
    await Promise.all(
      dead.map((ep) => db.delete(pushSubscriptionsTable).where(eq(pushSubscriptionsTable.endpoint, ep))),
    );
  }
}

export default router;
