import { Router } from "express";
import { db, matchesTable, matchEventsTable, teamsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { CreateMatchEventBody, UpdateMatchEventBody } from "@workspace/api-zod";
import { sendPushToAll } from "./push";
import { broadcastMatchUpdate } from "../lib/match-sse";

const router = Router();

/* ── Event types that affect the scoreline ── */
const SCORE_GOAL_TYPES = new Set(["goal", "penalty_goal", "ten_meter_goal"]);

/* ── Push payload builder ── */
type EventType = typeof CreateMatchEventBody._type["type"];

const EVENT_PUSH: Partial<Record<EventType, (opts: {
  playerName: string;
  playerNumber?: string | null;
  teamName: string;
  minute: string;
}) => { title: string; body: string }>> = {
  goal: ({ playerName, playerNumber, teamName, minute }) => ({
    title: "⚽ GOAL!",
    body: `${playerNumber ? `#${playerNumber} ` : ""}${playerName} (${teamName}) · ${minute}'`,
  }),
  own_goal: ({ playerName, playerNumber, teamName, minute }) => ({
    title: "⚽ Own Goal!",
    body: `${playerNumber ? `#${playerNumber} ` : ""}${playerName} (${teamName}) · ${minute}'`,
  }),
  penalty_goal: ({ playerName, playerNumber, teamName, minute }) => ({
    title: "⚽ Penalty GOAL!",
    body: `${playerNumber ? `#${playerNumber} ` : ""}${playerName} (${teamName}) · ${minute}'`,
  }),
  ten_meter_goal: ({ playerName, playerNumber, teamName, minute }) => ({
    title: "⚽ 10-Meter GOAL!",
    body: `${playerNumber ? `#${playerNumber} ` : ""}${playerName} (${teamName}) · ${minute}'`,
  }),
  penalty_awarded: ({ teamName, minute }) => ({
    title: "🟡 Penalty Awarded!",
    body: `${teamName} awarded a penalty · ${minute}'`,
  }),
  penalty_missed: ({ playerName, playerNumber, teamName, minute }) => ({
    title: "❌ Penalty Missed",
    body: `${playerNumber ? `#${playerNumber} ` : ""}${playerName} (${teamName}) · ${minute}'`,
  }),
  ten_meter_missed: ({ playerName, playerNumber, teamName, minute }) => ({
    title: "❌ 10m Penalty Missed",
    body: `${playerNumber ? `#${playerNumber} ` : ""}${playerName} (${teamName}) · ${minute}'`,
  }),
  var_review: ({ teamName, minute }) => ({
    title: "📺 VAR Review",
    body: `VAR checking ${teamName} decision · ${minute}'`,
  }),
  var_goal_cancelled: ({ playerName, playerNumber, minute }) => ({
    title: "📺 VAR: Goal Cancelled",
    body: `${playerNumber ? `#${playerNumber} ` : ""}${playerName} goal disallowed · ${minute}'`,
  }),
  red_card: ({ playerName, playerNumber, teamName, minute }) => ({
    title: "🟥 Red Card!",
    body: `${playerNumber ? `#${playerNumber} ` : ""}${playerName} (${teamName}) · ${minute}'`,
  }),
  second_yellow_red: ({ playerName, playerNumber, teamName, minute }) => ({
    title: "🟥 Second Yellow — Off!",
    body: `${playerNumber ? `#${playerNumber} ` : ""}${playerName} (${teamName}) · ${minute}'`,
  }),
};

router.get("/matches/:id/events", async (req, res) => {
  const matchId = Number(req.params.id);
  const events = await db
    .select()
    .from(matchEventsTable)
    .where(eq(matchEventsTable.matchId, matchId))
    .orderBy(matchEventsTable.minute);
  res.json(events);
});

router.post("/matches/:id/events", async (req, res) => {
  const matchId = Number(req.params.id);
  const parsed = CreateMatchEventBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [event] = await db.insert(matchEventsTable).values({
    matchId,
    ...parsed.data,
  }).returning();
  res.status(201).json(event);

  // Auto-update score + broadcast via SSE (non-blocking)
  setImmediate(async () => {
    try {
      const isGoal = SCORE_GOAL_TYPES.has(parsed.data.type);
      const isOwnGoal = parsed.data.type === "own_goal";

      if (isGoal || isOwnGoal) {
        const [matchRow] = await db
          .select({ homeTeamId: matchesTable.homeTeamId, awayTeamId: matchesTable.awayTeamId, homeScore: matchesTable.homeScore, awayScore: matchesTable.awayScore })
          .from(matchesTable)
          .where(eq(matchesTable.id, matchId));

        if (matchRow) {
          const eventTeamId = parsed.data.teamId;
          let homeScoreDelta = 0;
          let awayScoreDelta = 0;

          if (isOwnGoal) {
            // Own goal: opposite team gets the point
            if (eventTeamId === matchRow.homeTeamId) awayScoreDelta = 1;
            else homeScoreDelta = 1;
          } else {
            // Regular goal: scoring team gets the point
            if (eventTeamId === matchRow.homeTeamId) homeScoreDelta = 1;
            else awayScoreDelta = 1;
          }

          const newHomeScore = matchRow.homeScore + homeScoreDelta;
          const newAwayScore = matchRow.awayScore + awayScoreDelta;

          await db.update(matchesTable)
            .set({ homeScore: newHomeScore, awayScore: newAwayScore })
            .where(eq(matchesTable.id, matchId));

          // Immediately push new scores to all watching clients
          broadcastMatchUpdate(matchId, {
            type: "score",
            homeScore: newHomeScore,
            awayScore: newAwayScore,
          });
        }
      }

      // Push notification
      const homeTeam = alias(teamsTable, "homeTeam");
      const awayTeam = alias(teamsTable, "awayTeam");
      const [row] = await db
        .select({ match: matchesTable, homeTeam, awayTeam })
        .from(matchesTable)
        .leftJoin(homeTeam, eq(matchesTable.homeTeamId, homeTeam.id))
        .leftJoin(awayTeam, eq(matchesTable.awayTeamId, awayTeam.id))
        .where(eq(matchesTable.id, matchId));
      if (!row) return;

      const builder = EVENT_PUSH[parsed.data.type];
      if (builder) {
        const eventTeamId = parsed.data.teamId;
        const teamName =
          row.homeTeam?.id === eventTeamId
            ? (row.homeTeam?.name ?? "Home")
            : (row.awayTeam?.name ?? "Away");
        const matchLabel = `${row.homeTeam?.name ?? "Home"} vs ${row.awayTeam?.name ?? "Away"}`;
        const { title, body } = builder({
          playerName: parsed.data.playerName,
          playerNumber: parsed.data.playerNumber,
          teamName,
          minute: parsed.data.minute,
        });
        await sendPushToAll({
          title,
          body: `${body} — ${matchLabel}`,
          url: `/match/${matchId}`,
        });
      }
    } catch { /* never crash the request */ }
  });
});

router.patch("/matches/:id/events/:eventId", async (req, res) => {
  const matchId = Number(req.params.id);
  const eventId = Number(req.params.eventId);
  const parsed = UpdateMatchEventBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [event] = await db
    .update(matchEventsTable)
    .set(parsed.data)
    .where(and(eq(matchEventsTable.id, eventId), eq(matchEventsTable.matchId, matchId)))
    .returning();
  if (!event) { res.status(404).json({ error: "Event not found" }); return; }
  res.json(event);
});

router.delete("/matches/:id/events/:eventId", async (req, res) => {
  const matchId = Number(req.params.id);
  const eventId = Number(req.params.eventId);
  await db.delete(matchEventsTable).where(
    and(eq(matchEventsTable.id, eventId), eq(matchEventsTable.matchId, matchId))
  );
  res.status(204).send();
});

export default router;
