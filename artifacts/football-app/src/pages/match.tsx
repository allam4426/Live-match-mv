import {
  useGetMatch,
  useGetMatchLineup,
  useGetTournamentStandings,
  useGetTeamForm,
  getGetMatchQueryKey,
  getGetMatchLineupQueryKey,
  getGetTournamentStandingsQueryKey,
  type MatchDetail,
} from "@workspace/api-client-react";
import { useParams, Link } from "wouter";
import { useState, useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { TeamLogo } from "@/components/team-logo";
import { LivePulse } from "@/components/live-pulse";
import { ChevronLeft, Play, Share2, Check } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { PenaltyIcon } from "@/components/penalty-icon";
import { SubstitutionIcon } from "@/components/substitution-icon";

/* ─── helpers ─── */

function FormDot({ result }: { result: string }) {
  const colors = { W: "bg-emerald-500", D: "bg-slate-500", L: "bg-red-500" };
  return (
    <span
      className={cn(
        "w-4 h-4 rounded-full inline-flex items-center justify-center text-[8px] font-black text-white",
        colors[result as keyof typeof colors] ?? "bg-white/10",
      )}
    >
      {result}
    </span>
  );
}

function EmptyDot() {
  return (
    <span className="w-4 h-4 rounded-full border border-white/20 inline-block" />
  );
}

function TeamFormDots({ teamId }: { teamId: number }) {
  const { data } = useGetTeamForm(teamId, {
    query: { enabled: !!teamId, queryKey: ["teamForm", teamId] },
  });
  const form = data?.form ?? [];
  const empties = Math.max(0, 5 - form.length);
  if (form.length === 0) return null;
  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: empties }).map((_, i) => (
        <EmptyDot key={`e${i}`} />
      ))}
      {form.map((r, i) => (
        <FormDot key={i} result={r} />
      ))}
    </div>
  );
}

/* ── Live stopwatch: ticks up from the stored minute in real time ── */
type StopwatchResult = { main: string; extra: string | null } | null;

/**
 * Module-level anchor cache — survives component unmount/remount (navigation).
 * Key: matchId. Value: { base: total seconds at last server save, wallTime: Date.now() at that save }
 */
const _stopwatchAnchors = new Map<string, { base: number; wallTime: number }>();

/** Returns the regulation cap in seconds for the current half, based on starting minute and sport. */
function getRegBoundarySecs(startSecs: number, sport: string | null | undefined): number {
  const startMin = Math.floor(startSecs / 60);
  if (sport === "futsal") {
    if (startMin < 20) return 20 * 60;
    if (startMin < 40) return 40 * 60;
    return Infinity; // ET futsal — free running
  }
  // Football
  if (startMin < 45) return 45 * 60;
  if (startMin < 90) return 90 * 60;
  if (startMin < 105) return 105 * 60;
  return 120 * 60;
}

function parseSecs(m: string | null | undefined): number | null {
  if (!m) return null;
  if (["HT", "ET_HT", "PSO"].includes(m)) return null;
  const [base, extra] = m.split("+");
  const baseNum = parseInt(base, 10);
  if (isNaN(baseNum)) return null;
  if (extra !== undefined) {
    // Extra-time format "20+2": anchor at 20*60 + 2*60 = 1320s (matches admin minuteStr)
    const extraNum = parseInt(extra, 10);
    return (baseNum + (isNaN(extraNum) ? 0 : extraNum)) * 60;
  }
  // Regular minute: admin stores "20" when clock reads 19:xx (the 20th minute is running).
  // Mirror admin formula: Math.max(0, n - 1) * 60
  return Math.max(0, baseNum - 1) * 60;
}

function useLiveStopwatch(
  matchId: number | string | null | undefined,
  minute: string | null | undefined,
  isLive: boolean,
  sport?: string | null,
): StopwatchResult {
  const cacheKey = matchId != null ? String(matchId) : null;
  // anchorRef holds the fixed reference point; seconds are computed from it at render time.
  const anchorRef = useRef<{ base: number; wallTime: number } | null>(null);
  // tick is a counter incremented every second — its only job is to trigger re-renders.
  const [tick, setTick] = useState(0);

  // Set / restore anchor whenever isLive or minute changes.
  useEffect(() => {
    if (!isLive) {
      anchorRef.current = null;
      return;
    }
    const parsed = parseSecs(minute);
    if (parsed === null) {
      anchorRef.current = null;
      return;
    }
    // If anchor already matches the current minute, leave it alone (keeps elapsed time).
    if (anchorRef.current && anchorRef.current.base === parsed) return;

    // New minute (server update or first mount). Restore from cache if possible so
    // navigating back doesn't reset the clock.
    const cached = cacheKey ? _stopwatchAnchors.get(cacheKey) : undefined;
    const anchor =
      cached && cached.base === parsed
        ? cached
        : { base: parsed, wallTime: Date.now() };

    anchorRef.current = anchor;
    if (cacheKey) _stopwatchAnchors.set(cacheKey, anchor);
    setTick(t => t + 1); // force a render so the new anchor is visible immediately
  }, [minute, isLive]); // eslint-disable-line react-hooks/exhaustive-deps

  // Ticker — increments tick every second while live, causing a re-render each time.
  // Seconds are computed fresh from anchorRef at render time — no stale-state issues.
  useEffect(() => {
    if (!isLive) return;
    const id = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(id);
  }, [isLive]);

  if (!isLive || !anchorRef.current) return null;

  // Compute current elapsed seconds directly from the anchor (always fresh).
  const secs = anchorRef.current.base + Math.floor((Date.now() - anchorRef.current.wallTime) / 1000);

  // Boundary derived from the minute prop every render — no ref, no timing race.
  const boundary = (() => {
    if (!minute) return Infinity;
    if (minute.includes("+")) {
      const baseMin = parseInt(minute.split("+")[0], 10);
      return isNaN(baseMin) ? Infinity : baseMin * 60;
    }
    return getRegBoundarySecs(parseSecs(minute) ?? 0, sport);
  })();

  const cappedSecs = Math.min(secs, boundary);
  const mm = Math.floor(cappedSecs / 60);
  const ss = cappedSecs % 60;
  const main = `${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;

  if (secs > boundary) {
    const extraSecs = secs - boundary;
    const em = Math.floor(extraSecs / 60);
    const es = extraSecs % 60;
    return { main, extra: `+${String(em).padStart(2, "0")}:${String(es).padStart(2, "0")}` };
  }
  return { main, extra: null };
}

/* ─── tabs ─── */
type Tab = "Summary" | "Squad" | "Standings";

/* ─── Summary ─── */

type EventPhase = "pso" | "et2" | "et1" | "h2" | "h1";

function getEventPhase(minute: string, sport?: string | null): EventPhase {
  if (!minute || minute === "PSO") return "pso";
  const base = parseInt(minute.split("+")[0], 10);
  if (isNaN(base)) return "pso";
  const isFutsal = sport === "futsal";
  if (isFutsal) {
    if (base > 40) return "et1"; // futsal ET is one chunk
    if (base > 20) return "h2";
    return "h1";
  }
  // Football
  if (base > 105) return "et2";
  if (base > 90) return "et1";
  if (base > 45) return "h2";
  return "h1";
}

function PhaseSeparator({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 py-3">
      <div className="flex-1 h-px bg-border" />
      <span className="text-[10px] font-black text-muted-foreground/80 uppercase tracking-widest shrink-0 whitespace-nowrap">
        {label}
      </span>
      <div className="flex-1 h-px bg-border" />
    </div>
  );
}

const EVENT_INFO: Record<string, { emoji: string; label: string }> = {
  goal: { emoji: "⚽", label: "Goal" },
  penalty_goal: { emoji: "⚽", label: "Pen. Goal" },
  own_goal: { emoji: "↩", label: "Own Goal" },
  ten_meter_goal: { emoji: "🎯", label: "10m Pen Goal" },
  ten_meter_missed: { emoji: "❌", label: "10m Pen Missed" },
  foul: { emoji: "🚫", label: "Foul" },
  yellow_card: { emoji: "🟨", label: "Yellow" },
  red_card: { emoji: "🟥", label: "Red Card" },
  second_yellow_red: { emoji: "🟨🟥", label: "2nd Yellow" },
  penalty_missed: { emoji: "❌⚽️", label: "Pen. Missed" },
  penalty_awarded: { emoji: "📋", label: "Penalty" },
  substitution: { emoji: "🔄", label: "Sub" },
  mvp: { emoji: "⭐", label: "MVP" },
  var_review:         { emoji: "📺", label: "VAR Review" },
  var_award_goal:     { emoji: "📺", label: "VAR: Goal" },
  var_no_goal:        { emoji: "📺", label: "VAR: No Goal" },
  var_award_foul:     { emoji: "📺", label: "VAR: Foul" },
  var_award_penalty:  { emoji: "📺", label: "VAR: Penalty" },
};

const SHOW_LABEL = new Set([
  "penalty_goal",
  "ten_meter_goal",
  "substitution",
  "penalty_missed",
  "ten_meter_missed",
  "own_goal",
  "var_review",
  "var_award_goal",
  "var_no_goal",
  "var_award_foul",
  "var_award_penalty",
]);

const CARD_Y = "bg-[#FFE600]";
const CARD_R = "bg-[#E91E63]";

function YellowCard({ w = 22, h = 30 }: { w?: number; h?: number }) {
  return (
    <div
      className={`${CARD_Y} rounded-[4px] shadow-lg`}
      style={{ width: w, height: h }}
    />
  );
}
function RedCard({ w = 22, h = 30 }: { w?: number; h?: number }) {
  return (
    <div
      className={`${CARD_R} rounded-[4px] shadow-lg`}
      style={{ width: w, height: h }}
    />
  );
}
function SecondYellowRedCard() {
  return (
    <div className="relative" style={{ width: 30, height: 32 }}>
      <div
        className={`absolute bottom-0 right-0 ${CARD_Y} rounded-[4px] shadow`}
        style={{ width: 20, height: 28 }}
      />
      <div
        className={`absolute top-0 left-0 ${CARD_R} rounded-[4px] shadow-lg`}
        style={{ width: 20, height: 28 }}
      />
    </div>
  );
}

const CARD_TYPES = new Set(["yellow_card", "red_card", "second_yellow_red"]);

function EventIcon({ type }: { type: string }) {
  const info = EVENT_INFO[type] ?? { emoji: "•", label: type };
  const isCard = CARD_TYPES.has(type);
  return (
    <div
      className={`w-11 h-11 rounded-2xl flex items-center justify-center text-[18px] shrink-0 z-10 overflow-hidden ${isCard ? "bg-transparent border-0" : "bg-[#141e2e] border border-white/5"}`}
    >
      {type === "substitution" ? (
        <SubstitutionIcon />
      ) : type === "penalty_goal" ? (
        <PenaltyIcon outcome="goal" />
      ) : type === "penalty_missed" ? (
        <PenaltyIcon outcome="missed" />
      ) : type === "yellow_card" ? (
        <YellowCard />
      ) : type === "red_card" ? (
        <RedCard />
      ) : type === "second_yellow_red" ? (
        <SecondYellowRedCard />
      ) : type === "own_goal" ? (
        <img src="/own-goal.png" width="32" height="32" />
      ) : type === "var_review" || type === "var_award_goal" || type === "var_no_goal" || type === "var_award_foul" || type === "var_award_penalty" ? (
        <img src="/var-icon.png" width="36" height="28" style={{ filter: "brightness(0) invert(1)", opacity: 0.85 }} />
      ) : (
        info.emoji
      )}
    </div>
  );
}

interface SummaryEvent {
  id: number;
  type: string;
  minute: string;
  teamId: number;
  playerName?: string | null;
  playerNumber?: string | null;
  assistPlayerName?: string | null;
  description?: string | null;
}

function InlineEventIcon({ type }: { type: string }) {
  if (type === "goal")
    return <span className="text-[13px] leading-none">⚽</span>;
  if (type === "penalty_goal" || type === "ten_meter_goal")
    return <PenaltyIcon outcome="goal" />;
  if (type === "own_goal")
    return <img src="/own-goal.png" width="22" height="22" className="inline-block align-middle" />;
  if (type === "yellow_card")
    return <span className={`inline-block w-[9px] h-[13px] rounded-[2px] shrink-0 ${CARD_Y}`} />;
  if (type === "red_card")
    return <span className={`inline-block w-[9px] h-[13px] rounded-[2px] shrink-0 ${CARD_R}`} />;
  if (type === "second_yellow_red")
    return (
      <span className="relative inline-flex shrink-0" style={{ width: 14, height: 13 }}>
        <span className={`absolute bottom-0 right-0 w-[8px] h-[11px] rounded-[2px] ${CARD_Y}`} />
        <span className={`absolute top-0 left-0 w-[8px] h-[11px] rounded-[2px] ${CARD_R}`} />
      </span>
    );
  if (type === "penalty_missed" || type === "ten_meter_missed")
    return <PenaltyIcon outcome="missed" />;
  if (type === "foul")
    return <span className="text-[13px] leading-none">🚫</span>;
  if (type === "mvp")
    return <span className="text-[12px] leading-none">⭐</span>;
  if (type === "var_review" || type === "var_award_goal" || type === "var_no_goal" || type === "var_award_foul" || type === "var_award_penalty")
    return <img src="/var-icon.png" width="22" height="17" className="inline-block align-middle opacity-80" />;
  return null;
}

function EventRow({
  event,
  homeTeamId,
  isPSO,
  psoRunningScore,
}: {
  event: SummaryEvent;
  homeTeamId: number;
  isPSO?: boolean;
  psoRunningScore?: { home: number; away: number };
}) {
  const isHome = event.teamId === homeTeamId;
  const minuteLabel = isPSO ? "PEN" : `${event.minute}'`;
  const isSub = event.type === "substitution";
  const subOut =
    isSub && event.description
      ? event.description.replace(/^Out:\s*/i, "").split(" · ")[0]?.trim()
      : null;

  const content = (
    <div className={cn("flex items-center gap-1.5 min-w-0 flex-1", isHome ? "flex-row-reverse" : "flex-row")}>
      <InlineEventIcon type={event.type} />
      <div className={cn("flex-1 flex flex-col min-w-0", isHome ? "items-end" : "items-start")}>
        {event.playerName ? (
          <>
            <span className="text-[12px] font-semibold text-foreground leading-snug truncate w-full">
              {event.playerNumber && (
                <span className="text-[10px] font-bold text-primary/70 mr-0.5">#{event.playerNumber}</span>
              )}
              {event.playerName}
            </span>
            {["penalty_goal", "penalty_missed", "ten_meter_goal", "ten_meter_missed", "foul", "own_goal", "var_review", "var_award_goal", "var_no_goal", "var_award_foul", "var_award_penalty"].includes(event.type) && (
              <span className="text-[10px] text-muted-foreground/70 leading-none">
                {event.description
                  ? `${(EVENT_INFO[event.type] ?? { label: event.type }).label} · ${event.description}`
                  : (EVENT_INFO[event.type] ?? { label: event.type }).label}
              </span>
            )}
          </>
        ) : (
          <span className="text-[11px] font-bold text-foreground leading-snug">
            {(EVENT_INFO[event.type] ?? { label: event.type }).label}
          </span>
        )}
        {event.assistPlayerName && (
          <span className="text-[10px] text-muted-foreground/60 leading-none truncate w-full">
            Assist: {event.assistPlayerName}
          </span>
        )}
        {subOut && (
          <div className={cn("flex items-center gap-1", isHome ? "justify-end" : "justify-start")}>
            <span className="w-2 h-2 rounded-full bg-red-500 shrink-0" />
            <span className="text-[11px] text-muted-foreground leading-none truncate">{subOut}</span>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="flex items-center gap-1 py-1.5">
      <div className="flex-1 flex justify-end min-w-0 pr-2">
        {isHome && content}
      </div>
      <div className="w-14 flex flex-col items-center shrink-0 gap-0.5">
        <span className="bg-muted/70 text-muted-foreground rounded-full px-2.5 py-[3px] text-[10px] font-bold tabular-nums whitespace-nowrap">
          {minuteLabel}
        </span>
        {isPSO && psoRunningScore && (
          <span className="text-[9px] font-black text-purple-300/80 tabular-nums leading-none">
            {psoRunningScore.home}-{psoRunningScore.away}
          </span>
        )}
      </div>
      <div className="flex-1 flex justify-start min-w-0 pl-2">
        {!isHome && content}
      </div>
    </div>
  );
}

/* ─── Goal Scorers Strip ─── */
function GoalScorersStrip({ match }: { match: MatchDetail }) {
  const events = (match.events ?? []) as SummaryEvent[];
  const goalTypes = ["goal", "penalty_goal", "ten_meter_goal"];

  type GoalEntry = { name: string; number?: string | null; minute: string; og: boolean };

  const homeGoals: GoalEntry[] = [
    ...events.filter(e => goalTypes.includes(e.type) && e.teamId === match.homeTeam.id)
      .map(e => ({ name: e.playerName ?? "?", number: e.playerNumber, minute: e.minute, og: false })),
    ...events.filter(e => e.type === "own_goal" && e.teamId === match.awayTeam.id)
      .map(e => ({ name: e.playerName ?? "?", number: e.playerNumber, minute: e.minute, og: true })),
  ];
  const awayGoals: GoalEntry[] = [
    ...events.filter(e => goalTypes.includes(e.type) && e.teamId === match.awayTeam.id)
      .map(e => ({ name: e.playerName ?? "?", number: e.playerNumber, minute: e.minute, og: false })),
    ...events.filter(e => e.type === "own_goal" && e.teamId === match.homeTeam.id)
      .map(e => ({ name: e.playerName ?? "?", number: e.playerNumber, minute: e.minute, og: true })),
  ];

  if (homeGoals.length === 0 && awayGoals.length === 0) return null;

  function group(goals: GoalEntry[]) {
    const sorted = [...goals].sort((a, b) => parseInt(a.minute) - parseInt(b.minute));
    const map = new Map<string, { number?: string | null; mins: string[]; og: boolean }>();
    for (const g of sorted) {
      const k = g.name;
      if (!map.has(k)) map.set(k, { number: g.number, mins: [], og: g.og });
      map.get(k)!.mins.push(g.og ? `${g.minute}' (OG)` : `${g.minute}'`);
    }
    return Array.from(map.entries()).map(([name, v]) => ({ name, number: v.number, mins: v.mins, og: v.og }));
  }

  return (
    <div className="flex gap-3 px-4 py-2.5 border-t border-white/10">
      <div className="flex-1 space-y-0.5">
        {group(homeGoals).map(({ name, number: _num, mins, og }) => (
          <p key={name} className="text-[11px] text-white/75 leading-snug flex items-center gap-1 flex-wrap">
            {og
              ? <img src="/own-goal.png" width="22" height="22" className="inline-block shrink-0 align-middle" />
              : <span>⚽</span>}
            <span className="font-medium">{name}</span>
            <span className="text-white/40">{mins.join(", ")}</span>
          </p>
        ))}
      </div>
      <div className="flex-1 space-y-0.5 text-right">
        {group(awayGoals).map(({ name, number: _number, mins, og }) => (
          <p key={name} className="text-[11px] text-white/75 leading-snug flex items-center justify-end gap-1 flex-wrap min-w-0">
            <span className="text-white/40">{mins.join(", ")}</span>
            <span className="font-medium break-words min-w-0">{name}</span>
            {og
              ? <img src="/own-goal.png" width="22" height="22" className="inline-block shrink-0 align-middle" />
              : <span>⚽</span>}
          </p>
        ))}
      </div>
    </div>
  );
}

/* ── YouTube embed helper ── */
function getYouTubeId(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname === "youtu.be") return u.pathname.slice(1).split("?")[0];
    if (u.hostname.includes("youtube.com")) {
      if (u.pathname.startsWith("/live/")) return u.pathname.split("/live/")[1]?.split("?")[0] ?? null;
      if (u.pathname.startsWith("/embed/")) return u.pathname.split("/embed/")[1]?.split("?")[0] ?? null;
      return u.searchParams.get("v");
    }
  } catch { /* ignore */ }
  return null;
}

function SummaryTab({ match }: { match: MatchDetail }) {
  const rawEvents = (match.events ?? []) as SummaryEvent[];
  const sport = match.sport;
  const phase = (minute: string) => getEventPhase(minute, sport);

  if (rawEvents.length === 0) {
    return (
      <div className="py-10 text-center text-muted-foreground text-sm">
        No events recorded yet.
      </div>
    );
  }

  const mvpEvents = rawEvents.filter((e) => e.type === "mvp");
  const lineEvents = rawEvents.filter((e) => e.type !== "mvp");
  const psoEvents = lineEvents.filter((e) => phase(e.minute) === "pso");
  const et2Events = [
    ...lineEvents.filter((e) => phase(e.minute) === "et2"),
  ].reverse();
  const et1Events = [
    ...lineEvents.filter((e) => phase(e.minute) === "et1"),
  ].reverse();
  const h2Events = [
    ...lineEvents.filter((e) => phase(e.minute) === "h2"),
  ].reverse();
  const h1Events = [
    ...lineEvents.filter((e) => phase(e.minute) === "h1"),
  ].reverse();

  // HT score from H1 goal events
  const goalTypes = ["goal", "penalty_goal", "ten_meter_goal"];
  const htHome =
    h1Events.filter(
      (e) => goalTypes.includes(e.type) && e.teamId === match.homeTeam.id,
    ).length +
    h1Events.filter(
      (e) => e.type === "own_goal" && e.teamId === match.awayTeam.id,
    ).length;
  const htAway =
    h1Events.filter(
      (e) => goalTypes.includes(e.type) && e.teamId === match.awayTeam.id,
    ).length +
    h1Events.filter(
      (e) => e.type === "own_goal" && e.teamId === match.homeTeam.id,
    ).length;

  // FT score (before PSO)
  const finalHome = match.homeScore ?? 0;
  const finalAway = match.awayScore ?? 0;
  const psoHome = psoEvents.filter(
    (e) => e.type === "penalty_goal" && e.teamId === match.homeTeam.id,
  ).length;
  const psoAway = psoEvents.filter(
    (e) => e.type === "penalty_goal" && e.teamId === match.awayTeam.id,
  ).length;
  const ftHome = finalHome - psoHome;
  const ftAway = finalAway - psoAway;

  // ET1 score = goals scored in H1+H2
  const h1h2GoalsHome =
    [...h1Events, ...h2Events].filter(
      (e) => goalTypes.includes(e.type) && e.teamId === match.homeTeam.id,
    ).length +
    [...h1Events, ...h2Events].filter(
      (e) => e.type === "own_goal" && e.teamId === match.awayTeam.id,
    ).length;
  const h1h2GoalsAway =
    [...h1Events, ...h2Events].filter(
      (e) => goalTypes.includes(e.type) && e.teamId === match.awayTeam.id,
    ).length +
    [...h1Events, ...h2Events].filter(
      (e) => e.type === "own_goal" && e.teamId === match.homeTeam.id,
    ).length;

  let kickoffStr = "";
  try {
    kickoffStr = format(new Date(match.kickoffAt), "HH:mm");
  } catch {}

  const hasET1 = et1Events.length > 0;
  const hasET2 = et2Events.length > 0;
  const hasET = hasET1 || hasET2;
  const hasPSO = psoEvents.length > 0;
  const isFinished = match.status === "finished";

  return (
    <div className="px-4 py-2">
      {/* Centre line */}
      <div className="relative">
        <div className="absolute left-1/2 top-0 bottom-0 w-px bg-border/40 -translate-x-1/2 pointer-events-none" />

        {/* ── PSO section ── */}
        {hasPSO && (
          <>
            {psoEvents.map((e, idx) => {
              const prev = psoEvents.slice(0, idx + 1);
              const runHome = prev.filter(p => p.type === "penalty_goal" && p.teamId === match.homeTeam.id).length;
              const runAway = prev.filter(p => p.type === "penalty_goal" && p.teamId === match.awayTeam.id).length;
              return (
                <EventRow
                  key={e.id}
                  event={e}
                  homeTeamId={match.homeTeam.id}
                  isPSO
                  psoRunningScore={{ home: runHome, away: runAway }}
                />
              );
            })}
            <PhaseSeparator label={`AET (${ftHome}–${ftAway})`} />
          </>
        )}

        {/* ── ET2 events (106-120') ── */}
        {hasET2 && (
          <>
            {et2Events.map((e) => (
              <EventRow key={e.id} event={e} homeTeamId={match.homeTeam.id} />
            ))}
            <PhaseSeparator label="ET 2nd Half · 106–120'" />
          </>
        )}

        {/* ── ET1 events (91-105') ── */}
        {hasET1 && (
          <>
            {et1Events.map((e) => (
              <EventRow key={e.id} event={e} homeTeamId={match.homeTeam.id} />
            ))}
            {hasET ? (
              <PhaseSeparator
                label={`ET 1st Half · 91–105' · FT (${h1h2GoalsHome}-${h1h2GoalsAway})`}
              />
            ) : null}
          </>
        )}

        {/* FT divider when no ET/PSO */}
        {!hasET && !hasPSO && isFinished && (
          <PhaseSeparator label={`Full Time (${finalHome}-${finalAway})`} />
        )}

        {/* FT divider when there IS ET */}
        {hasET && !hasET2 && (
          <PhaseSeparator
            label={`Full Time (${h1h2GoalsHome}-${h1h2GoalsAway})`}
          />
        )}

        {/* ── H2 events ── */}
        {h2Events.map((e) => (
          <EventRow key={e.id} event={e} homeTeamId={match.homeTeam.id} />
        ))}

        {/* HT divider */}
        {(h1Events.length > 0 || h2Events.length > 0) && (
          <PhaseSeparator
            label={`Half Time · ${sport === "futsal" ? "20" : "45"}' (${htHome}-${htAway})`}
          />
        )}

        {/* ── H1 events ── */}
        {h1Events.map((e) => (
          <EventRow key={e.id} event={e} homeTeamId={match.homeTeam.id} />
        ))}

        {/* KO */}
        {kickoffStr && <PhaseSeparator label={`Kick Off · ${kickoffStr}`} />}
      </div>

      {/* MVP */}
      {mvpEvents.map((e) => (
        <div
          key={e.id}
          className="flex items-center justify-center gap-2 pt-3 mt-2 border-t border-border/40"
        >
          <span className="text-amber-400 text-lg">⭐</span>
          <div className="text-center">
            <p className="text-sm font-black text-foreground">{e.playerName}</p>
            <p className="text-[10px] text-amber-400 font-semibold uppercase tracking-wide">
              Man of the Match
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ─── Squad / Pitch ─── */

type LineupPlayer = {
  id: number;
  playerName: string;
  playerNumber: string | null;
  position?: string | null;
  role?: string | null;
  isStarting?: boolean | null;
  photoUrl?: string | null;
};

// ── Squad list helpers ────────────────────────────────────────────────────────

const AVATAR_COLORS = [
  "bg-blue-700",
  "bg-emerald-700",
  "bg-violet-700",
  "bg-orange-600",
  "bg-teal-700",
  "bg-rose-700",
  "bg-indigo-700",
  "bg-pink-700",
];
function avatarColor(name: string) {
  return AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length];
}
function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return (parts[0]?.[0] ?? "").toUpperCase();
}
function isGoalkeeper(player: LineupPlayer) {
  const pos = (player.position ?? "").toLowerCase().trim();
  return (
    pos === "goalkeeper" ||
    pos === "goal keeper" ||
    pos === "gk" ||
    pos === "goalie"
  );
}
function isCoach(player: LineupPlayer) {
  return player.role === "coach";
}

function SquadAvatar({
  player,
  events,
  side,
}: {
  player: LineupPlayer;
  events: SummaryEvent[];
  side: "home" | "away";
}) {
  const isCaptain = player.role === "captain";
  const gk = isGoalkeeper(player);
  const coach = isCoach(player);
  const playerEvents = events.filter((e) => e.playerName === player.playerName);
  const hasYellow = playerEvents.some(
    (e) => e.type === "yellow_card" || e.type === "second_yellow_red",
  );
  const hasRed = playerEvents.some(
    (e) => e.type === "red_card" || e.type === "second_yellow_red",
  );
  const goalCount = playerEvents.filter(
    (e) => e.type === "goal" || e.type === "penalty_goal" || e.type === "ten_meter_goal",
  ).length;
  const hasOwnGoal = playerEvents.some((e) => e.type === "own_goal");
  const subbedOn = events.some(
    (e) => e.type === "substitution" && e.playerName === player.playerName,
  );
  const subbedOff = events.some(
    (e) =>
      e.type === "substitution" && e.description?.includes(player.playerName),
  );

  return (
    <div className="relative shrink-0">
      <div
        className={cn(
          "w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-black text-white overflow-hidden",
          !player.photoUrl && (coach
            ? "bg-violet-700"
            : gk
              ? "bg-teal-600"
              : avatarColor(player.playerName)),
        )}
      >
        {player.photoUrl ? (
          <img src={player.photoUrl} alt={player.playerName} className="w-full h-full object-cover" />
        ) : (
          initials(player.playerName)
        )}
      </div>
      {/* Role badges — top-left */}
      {isCaptain && (
        <span className="absolute -top-1 -left-1 w-3.5 h-3.5 rounded-full bg-amber-400 border border-background flex items-center justify-center text-[7px] font-black text-black leading-none">
          C
        </span>
      )}
      {gk && !isCaptain && (
        <span className="absolute -top-1 -left-1 w-3.5 h-3.5 rounded-full bg-teal-400 border border-background flex items-center justify-center text-[6px] font-black text-black leading-none">
          GK
        </span>
      )}
      {/* Card badges — top-right */}
      {hasRed ? (
        <span className="absolute -top-0.5 -right-0.5 w-2 h-2.5 rounded-[2px] bg-red-500 border border-background" />
      ) : hasYellow ? (
        <span className="absolute -top-0.5 -right-0.5 w-2 h-2.5 rounded-[2px] bg-yellow-400 border border-background" />
      ) : null}
      {/* Goal badge — bottom-left */}
      {goalCount > 0 && (
        <span className="absolute -bottom-1 -left-1 text-[9px] leading-none whitespace-nowrap drop-shadow">
          {"⚽".repeat(Math.min(goalCount, 3))}
        </span>
      )}
      {hasOwnGoal && (
        <span className="absolute -bottom-1 -right-1">
          <img src="/own-goal.png" width="10" height="10" />
        </span>
      )}
      {/* Sub badges — bottom-right (shift if goal badge present) */}
      {subbedOn && !goalCount && !hasOwnGoal && (
        <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-500 border border-background flex items-center justify-center text-[7px] text-white font-black leading-none">
          ↑
        </span>
      )}
      {subbedOff && !subbedOn && !goalCount && !hasOwnGoal && (
        <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-red-500 border border-background flex items-center justify-center text-[7px] text-white font-black leading-none">
          ↓
        </span>
      )}
    </div>
  );
}

function PlayerSubLabel({
  player,
  align,
}: {
  player: LineupPlayer;
  align: "left" | "right";
}) {
  const gk = isGoalkeeper(player);
  const coach = isCoach(player);
  if (coach) {
    return (
      <p
        className={cn(
          "text-[10px] font-bold text-violet-400 leading-none",
          align === "right" && "text-right",
        )}
      >
        Head Coach
      </p>
    );
  }
  if (gk) {
    const label = player.playerNumber
      ? `Goal Keeper - #${player.playerNumber}`
      : "Goal Keeper";
    return (
      <p
        className={cn(
          "text-[10px] font-bold text-teal-400 leading-none",
          align === "right" && "text-right",
        )}
      >
        {label}
      </p>
    );
  }
  if (player.playerNumber) {
    return (
      <p
        className={cn(
          "text-[10px] text-muted-foreground font-medium leading-none",
          align === "right" && "text-right",
        )}
      >
        #{player.playerNumber}
      </p>
    );
  }
  return null;
}

function SquadPlayerRow({
  home,
  away,
  events,
}: {
  home?: LineupPlayer;
  away?: LineupPlayer;
  events: SummaryEvent[];
}) {
  const homeGk = home && isGoalkeeper(home);
  const awayGk = away && isGoalkeeper(away);
  const homeCoach = home && isCoach(home);
  const awayCoach = away && isCoach(away);
  const highlight = homeGk || awayGk || homeCoach || awayCoach;

  return (
    <div
      className={cn(
        "grid grid-cols-2 border-t border-border/30 first:border-t-0",
        highlight && "bg-white/[0.02]",
      )}
    >
      {/* Home player — avatar left, text right */}
      <div className="flex items-center gap-2 px-3 py-2.5 border-r border-border/30">
        {home ? (
          <>
            <SquadAvatar player={home} events={events} side="home" />
            <div className="min-w-0">
              <p className="text-[12px] font-semibold text-foreground leading-tight truncate">
                {home.playerName}
              </p>
              <PlayerSubLabel player={home} align="left" />
            </div>
          </>
        ) : null}
      </div>
      {/* Away player — text left, avatar right */}
      <div className="flex items-center justify-end gap-2 px-3 py-2.5">
        {away ? (
          <>
            <div className="min-w-0 text-right">
              <p className="text-[12px] font-semibold text-foreground leading-tight truncate">
                {away.playerName}
              </p>
              <PlayerSubLabel player={away} align="right" />
            </div>
            <SquadAvatar player={away} events={events} side="away" />
          </>
        ) : null}
      </div>
    </div>
  );
}

function SquadSection({
  label,
  home,
  away,
  events,
}: {
  label: string;
  home: LineupPlayer[];
  away: LineupPlayer[];
  events: SummaryEvent[];
}) {
  if (home.length === 0 && away.length === 0) return null;
  const rows = Math.max(home.length, away.length);
  return (
    <>
      <div className="px-4 py-1.5 bg-muted/20 border-t border-border/40">
        <span className="text-[9px] font-black text-muted-foreground uppercase tracking-wider">
          {label}
        </span>
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <SquadPlayerRow key={i} home={home[i]} away={away[i]} events={events} />
      ))}
    </>
  );
}

/* ─── Football Pitch ─── */

// Map position string → row bucket (0=GK, 1=DEF, 2=MID, 3=ATT)
const FIELD_BUCKET: Record<string, number> = {
  GK: 0,
  RB: 1, CB: 1, LB: 1, SW: 1, WB: 1, RWB: 1, LWB: 1, DF: 1,
  CDM: 2, DM: 2, CM: 2, RM: 2, LM: 2,
  CAM: 3, AM: 3, SS: 3, RW: 3, LW: 3, RF: 3, LF: 3, CF: 3, ST: 3, FW: 3,
};
function fieldBucket(pos: string | null | undefined): number {
  return FIELD_BUCKET[(pos ?? "").toUpperCase().trim()] ?? 2;
}
function distributeX(count: number): number[] {
  if (!count) return [];
  if (count === 1) return [50];
  const pad = Math.max(8, 16 - count * 1.5);
  return Array.from({ length: count }, (_, i) => pad + ((100 - 2 * pad) / (count - 1)) * i);
}

function PitchPlayerNode({
  player, events, x, y,
}: {
  player: LineupPlayer; events: SummaryEvent[]; x: number; y: number;
}) {
  const pe = events.filter(e => e.playerName === player.playerName);
  const goals = pe.filter(e => ["goal","penalty_goal","ten_meter_goal"].includes(e.type)).length;
  const hasOwnGoal = pe.some(e => e.type === "own_goal");
  const hasYellow = pe.some(e => e.type === "yellow_card" || e.type === "second_yellow_red");
  const hasRed = pe.some(e => e.type === "red_card" || e.type === "second_yellow_red");
  const isCaptain = player.role === "captain";
  const gk = isGoalkeeper(player);
  const lastName = player.playerName.trim().split(/\s+/).pop() ?? player.playerName;

  return (
    <div
      className="absolute flex flex-col items-center"
      style={{ left: `${x}%`, top: `${y}%`, transform: "translate(-50%,-50%)", zIndex: 10 }}
    >
      <div className="relative">
        <div className={cn(
          "w-8 h-8 rounded-full border-2 border-white/40 flex items-center justify-center text-[10px] font-black text-white overflow-hidden shadow-xl",
          !player.photoUrl && (gk ? "bg-teal-600" : "bg-[#1a3a70]"),
        )}>
          {player.photoUrl
            ? <img src={player.photoUrl} alt={player.playerName} className="w-full h-full object-cover" />
            : <span>{player.playerNumber || initials(player.playerName)}</span>}
        </div>
        {isCaptain && (
          <span className="absolute -top-1 -left-1 w-3 h-3 rounded-full bg-amber-400 border border-black/20 flex items-center justify-center text-[6px] font-black text-black">C</span>
        )}
        {gk && !isCaptain && (
          <span className="absolute -top-1 -left-1 w-3 h-3 rounded-full bg-teal-400 border border-black/20 flex items-center justify-center text-[5px] font-black text-black">GK</span>
        )}
        {hasRed
          ? <span className="absolute -top-0.5 -right-0.5 w-1.5 h-2 rounded-[2px] bg-red-500" />
          : hasYellow
          ? <span className="absolute -top-0.5 -right-0.5 w-1.5 h-2 rounded-[2px] bg-yellow-400" />
          : null}
        {goals > 0 && (
          <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 text-[9px] leading-none whitespace-nowrap drop-shadow-[0_1px_1px_rgba(0,0,0,0.9)]">
            {"⚽".repeat(Math.min(goals, 3))}
          </span>
        )}
        {hasOwnGoal && (
          <span className="absolute -bottom-1 -right-1.5">
            <img src="/own-goal.png" width="9" height="9" />
          </span>
        )}
      </div>
      <span className="text-[8px] font-semibold text-white drop-shadow-[0_1px_1px_rgba(0,0,0,0.9)] text-center max-w-[52px] leading-tight mt-1.5 truncate">
        {lastName}
      </span>
    </div>
  );
}

function FootballPitch({
  homeTeam, awayTeam, home, away, events,
}: {
  homeTeam: { name: string; shortName: string | null; logoUrl: string | null };
  awayTeam: { name: string; shortName: string | null; logoUrl: string | null };
  home: LineupPlayer[]; away: LineupPlayer[]; events: SummaryEvent[];
}) {
  function groupForPitch(players: LineupPlayer[]) {
    const gks = players.filter(p => isGoalkeeper(p));
    const out = players.filter(p => !isGoalkeeper(p));
    const rows: LineupPlayer[][] = [[], [], []]; // def, mid, att
    for (const p of out) {
      const b = Math.max(0, Math.min(2, fieldBucket(p.position) - 1));
      rows[b].push(p);
    }
    // If no positions set, redistribute evenly
    if (out.length > 0 && rows.filter(r => r.length > 0).length <= 1) {
      const s = [...out];
      const c = Math.ceil(s.length / 3);
      rows[0] = s.slice(0, c);
      rows[1] = s.slice(c, 2 * c);
      rows[2] = s.slice(2 * c);
    }
    return { gks, rows };
  }

  const { gks: hGk, rows: hRows } = groupForPitch(home);
  const { gks: aGk, rows: aRows } = groupForPitch(away);

  // Home: GK at top, attack toward bottom of home half
  const HOME_Y = [8, 22, 35, 46];  // GK, row0, row1, row2
  // Away: GK at bottom, attack toward top of away half
  const AWAY_Y = [92, 78, 65, 54]; // GK, row0, row1, row2

  return (
    <div
      className="relative w-full rounded-xl overflow-hidden shadow-2xl"
      style={{
        background: "linear-gradient(180deg,#2d7a38 0%,#246a30 48%,#246a30 52%,#2d7a38 100%)",
        paddingBottom: "148%",
      }}
    >
      <div className="absolute inset-0">
        {/* Pitch lines */}
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 w-full h-full" style={{ opacity: 0.35 }}>
          <rect x="3" y="1.5" width="94" height="97" fill="none" stroke="white" strokeWidth="0.7" />
          <line x1="3" y1="50" x2="97" y2="50" stroke="white" strokeWidth="0.5" />
          <circle cx="50" cy="50" r="10" fill="none" stroke="white" strokeWidth="0.5" />
          <circle cx="50" cy="50" r="0.8" fill="white" />
          <rect x="25" y="1.5" width="50" height="16" fill="none" stroke="white" strokeWidth="0.5" />
          <rect x="37" y="1.5" width="26" height="6.5" fill="none" stroke="white" strokeWidth="0.5" />
          <circle cx="50" cy="13" r="0.8" fill="white" />
          <rect x="25" y="82.5" width="50" height="16" fill="none" stroke="white" strokeWidth="0.5" />
          <rect x="37" y="92" width="26" height="6.5" fill="none" stroke="white" strokeWidth="0.5" />
          <circle cx="50" cy="87" r="0.8" fill="white" />
        </svg>

        {/* Team name labels */}
        <div className="absolute top-1.5 left-0 right-0 flex justify-center pointer-events-none">
          <span className="text-[9px] font-black text-white/60 uppercase tracking-wide drop-shadow">
            {homeTeam.shortName ?? homeTeam.name}
          </span>
        </div>
        <div className="absolute bottom-1.5 left-0 right-0 flex justify-center pointer-events-none">
          <span className="text-[9px] font-black text-white/60 uppercase tracking-wide drop-shadow">
            {awayTeam.shortName ?? awayTeam.name}
          </span>
        </div>

        {/* Home players */}
        {hGk.map((p, i) => {
          const xs = distributeX(hGk.length);
          return <PitchPlayerNode key={p.id} player={p} events={events} x={xs[i]} y={HOME_Y[0]} />;
        })}
        {hRows.map((row, ri) =>
          row.map((p, i) => {
            const xs = distributeX(row.length);
            return <PitchPlayerNode key={p.id} player={p} events={events} x={xs[i]} y={HOME_Y[ri + 1]} />;
          })
        )}

        {/* Away players */}
        {aGk.map((p, i) => {
          const xs = distributeX(aGk.length);
          return <PitchPlayerNode key={p.id} player={p} events={events} x={xs[i]} y={AWAY_Y[0]} />;
        })}
        {aRows.map((row, ri) =>
          row.map((p, i) => {
            const xs = distributeX(row.length);
            return <PitchPlayerNode key={p.id} player={p} events={events} x={xs[i]} y={AWAY_Y[ri + 1]} />;
          })
        )}
      </div>
    </div>
  );
}

function SquadTab({ matchId, match }: { matchId: number; match: MatchDetail }) {
  const { data: lineup, isLoading } = useGetMatchLineup(matchId, {
    query: { enabled: !!matchId, queryKey: getGetMatchLineupQueryKey(matchId) },
  });

  const events = (match.events ?? []) as SummaryEvent[];

  if (isLoading)
    return (
      <div className="space-y-3">
        <Skeleton className="w-full rounded-xl" style={{ paddingBottom: "148%" }} />
        <Skeleton className="h-28 w-full rounded-xl" />
      </div>
    );
  if (!lineup || (!lineup.home?.length && !lineup.away?.length)) {
    return (
      <div className="py-10 text-center text-muted-foreground text-sm">
        No lineup set for this match.
      </div>
    );
  }

  const homePlayers = (lineup.home ?? []) as LineupPlayer[];
  const awayPlayers = (lineup.away ?? []) as LineupPlayer[];
  const sort = (arr: LineupPlayer[]) =>
    [...arr].sort((a, b) => {
      const na = Number(a.playerNumber ?? 99);
      const nb = Number(b.playerNumber ?? 99);
      return na - nb || a.playerName.localeCompare(b.playerName);
    });

  const homeCoaches = sort(homePlayers.filter(p => isCoach(p)));
  const awayCoaches = sort(awayPlayers.filter(p => isCoach(p)));
  const homeStarters = sort(homePlayers.filter(p => !isCoach(p) && p.isStarting !== false));
  const awayStarters = sort(awayPlayers.filter(p => !isCoach(p) && p.isStarting !== false));
  const homeSubs = sort(homePlayers.filter(p => !isCoach(p) && p.isStarting === false));
  const awaySubs = sort(awayPlayers.filter(p => !isCoach(p) && p.isStarting === false));

  const hasStarters = homeStarters.length > 0 || awayStarters.length > 0;
  const hasSubs = homeSubs.length > 0 || awaySubs.length > 0;
  const hasCoaches = homeCoaches.length > 0 || awayCoaches.length > 0;

  return (
    <div className="space-y-3">
      {/* Starting XI */}
      {hasStarters && (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <SquadSection label="Starting XI" home={homeStarters} away={awayStarters} events={events} />
        </div>
      )}
      {/* Substitutes */}
      {hasSubs && (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <SquadSection label="Substitutes" home={homeSubs} away={awaySubs} events={events} />
        </div>
      )}

      {/* Coaching staff */}
      {hasCoaches && (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <SquadSection label="Coaching Staff" home={homeCoaches} away={awayCoaches} events={events} />
        </div>
      )}
    </div>
  );
}

/* ─── Standings ─── */
function StandingsTab({
  tournamentId,
  highlightGroup,
  homeTeamId,
  awayTeamId,
}: {
  tournamentId: number;
  highlightGroup?: string | null;
  homeTeamId: number;
  awayTeamId: number;
}) {
  const { data: standings, isLoading } = useGetTournamentStandings(
    tournamentId,
    {
      query: {
        enabled: !!tournamentId,
        queryKey: getGetTournamentStandingsQueryKey(tournamentId),
      },
    },
  );

  if (isLoading)
    return (
      <div className="py-4 space-y-2">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  if (!standings)
    return (
      <div className="py-10 text-center text-muted-foreground text-sm">
        No standings available.
      </div>
    );

  const groups = standings.groups;
  const groupEntries = Object.entries(groups);

  return (
    <div className="space-y-6">
      {groupEntries.map(([groupName, rows]) => {
        const isHighlighted =
          highlightGroup &&
          groupName.toLowerCase() === highlightGroup.toLowerCase();
        return (
          <div key={groupName}>
            <h3 className="text-sm font-black text-foreground mb-2">
              {groupName}
              {isHighlighted && (
                <span className="ml-2 text-[10px] font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                  This match
                </span>
              )}
            </h3>

            {/* Table header */}
            <div className="bg-card rounded-xl border border-border overflow-hidden">
              <div className="grid grid-cols-[auto_1fr_auto_auto_auto_auto_auto_auto] gap-x-2 px-3 py-2 border-b border-border bg-muted/30">
                <span className="text-[9px] font-black text-muted-foreground uppercase w-5 text-center">
                  #
                </span>
                <span className="text-[9px] font-black text-muted-foreground uppercase">
                  Club
                </span>
                <span className="text-[9px] font-black text-muted-foreground uppercase w-6 text-center">
                  MP
                </span>
                <span className="text-[9px] font-black text-muted-foreground uppercase w-5 text-center">
                  W
                </span>
                <span className="text-[9px] font-black text-muted-foreground uppercase w-5 text-center">
                  D
                </span>
                <span className="text-[9px] font-black text-muted-foreground uppercase w-5 text-center">
                  L
                </span>
                <span className="text-[9px] font-black text-muted-foreground uppercase w-6 text-center">
                  GD
                </span>
                <span className="text-[9px] font-black text-muted-foreground uppercase w-7 text-center">
                  PTS
                </span>
              </div>
              {rows.map((row, i) => {
                const isMatchTeam =
                  row.team.id === homeTeamId || row.team.id === awayTeamId;
                return (
                  <div
                    key={row.team.id}
                    className={cn(
                      "grid grid-cols-[auto_1fr_auto_auto_auto_auto_auto_auto] gap-x-2 items-center px-3 py-2.5",
                      i > 0 && "border-t border-border/40",
                      isMatchTeam && "bg-primary/5",
                      i < 2 && "border-l-2 border-l-emerald-500/60",
                    )}
                  >
                    <span className="text-xs font-black text-muted-foreground w-5 text-center">
                      {row.position}
                    </span>
                    <div className="flex items-center gap-2 min-w-0">
                      <TeamLogo
                        url={row.team.logoUrl}
                        name={row.team.name}
                        shortName={row.team.shortName}
                        className="w-5 h-5 shrink-0"
                      />
                      <span
                        className={cn(
                          "text-xs font-semibold truncate",
                          isMatchTeam
                            ? "text-primary font-bold"
                            : "text-foreground",
                        )}
                      >
                        {row.team.shortName || row.team.name}
                      </span>
                    </div>
                    <span className="text-xs text-muted-foreground w-6 text-center tabular-nums">
                      {row.played}
                    </span>
                    <span className="text-xs text-muted-foreground w-5 text-center tabular-nums">
                      {row.won}
                    </span>
                    <span className="text-xs text-muted-foreground w-5 text-center tabular-nums">
                      {row.drawn}
                    </span>
                    <span className="text-xs text-muted-foreground w-5 text-center tabular-nums">
                      {row.lost}
                    </span>
                    <span
                      className={cn(
                        "text-xs w-6 text-center tabular-nums font-semibold",
                        row.goalDifference > 0
                          ? "text-emerald-400"
                          : row.goalDifference < 0
                            ? "text-red-400"
                            : "text-muted-foreground",
                      )}
                    >
                      {row.goalDifference > 0 ? "+" : ""}
                      {row.goalDifference}
                    </span>
                    <span className="text-xs font-black text-foreground w-7 text-center tabular-nums">
                      {row.points}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Form guide - Last 5 */}
            <div className="mt-2 bg-card rounded-xl border border-border overflow-hidden">
              <div className="px-3 py-2 border-b border-border bg-muted/30">
                <span className="text-[9px] font-black text-muted-foreground uppercase tracking-wider">
                  Last 5 Form
                </span>
              </div>
              {rows.map((row, i) => {
                const guide = row.formGuide ?? [];
                const empties = Math.max(0, 5 - guide.length);
                const isMatchTeam =
                  row.team.id === homeTeamId || row.team.id === awayTeamId;
                return (
                  <div
                    key={row.team.id}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2",
                      i > 0 && "border-t border-border/40",
                      isMatchTeam && "bg-primary/5",
                    )}
                  >
                    <div className="flex items-center gap-1.5 min-w-0 flex-1">
                      <TeamLogo
                        url={row.team.logoUrl}
                        name={row.team.name}
                        shortName={row.team.shortName}
                        className="w-5 h-5 shrink-0"
                      />
                      <span
                        className={cn(
                          "text-xs truncate",
                          isMatchTeam
                            ? "text-primary font-bold"
                            : "text-foreground font-medium",
                        )}
                      >
                        {row.team.shortName || row.team.name}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {Array.from({ length: empties }).map((_, j) => (
                        <EmptyDot key={`e${j}`} />
                      ))}
                      {guide.map((r, j) => (
                        <FormDot key={j} result={r} />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ─── main ─── */
export default function MatchDetails() {
  const { id } = useParams();
  const matchId = parseInt(id || "0", 10);
  const [activeTab, setActiveTab] = useState<Tab>("Summary");
  const [copied, setCopied] = useState(false);

  const { data: match, isLoading } = useGetMatch(matchId, {
    query: {
      enabled: !!matchId,
      queryKey: getGetMatchQueryKey(matchId),
      refetchInterval: (q) => (q.state.data?.status === "live" ? 5000 : false),
      refetchOnMount: "always",
      staleTime: 0,
    },
  });

  // Must be called unconditionally — before any early returns
  const stopwatch = useLiveStopwatch(match?.id, match?.minute, match?.status === "live", match?.sport);

  // Real-time score updates via SSE (also acts as a keep-alive for live matches)
  const queryClient = useQueryClient();
  useEffect(() => {
    if (!matchId) return;
    const es = new EventSource(`/api/matches/${matchId}/stream`);
    es.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data as string) as { type?: string };
        if (data.type === "score") {
          // Immediately refetch the full match (events, scorers, etc.)
          queryClient.invalidateQueries({ queryKey: getGetMatchQueryKey(matchId) });
        }
      } catch { /* ignore malformed events */ }
    };
    return () => es.close();
  }, [matchId, queryClient]);

  if (isLoading) {
    return (
      <div className="space-y-4 pb-6 px-4 pt-4">
        <Skeleton className="h-8 w-24" />
        <Skeleton className="h-52 w-full rounded-2xl" />
        <Skeleton className="h-48 w-full rounded-xl" />
      </div>
    );
  }

  if (!match) {
    return (
      <div className="py-24 text-center px-4">
        <h2 className="text-xl font-bold mb-3">Match not found</h2>
        <Link href="/">
          <span className="text-primary text-sm font-semibold cursor-pointer">
            Back to Home
          </span>
        </Link>
      </div>
    );
  }

  const isLive = match.status === "live";
  const isFinished = match.status === "finished";
  const isScheduled = match.status === "scheduled";
  const hasTournament = !!match.tournamentId;

  // PSO score derived from embedded events
  const matchEvents = (match.events ?? []) as SummaryEvent[];
  const psoEvs = matchEvents.filter(e => getEventPhase(e.minute, match.sport) === "pso");
  const isPSOLive = isLive && match.minute === "PSO";
  const hasPSOEvents = psoEvs.length > 0;
  const showPSOBadge = hasPSOEvents || isPSOLive;
  const psoGoalsHome = psoEvs.filter(e => e.type === "penalty_goal" && e.teamId === match.homeTeam.id).length;
  const psoGoalsAway = psoEvs.filter(e => e.type === "penalty_goal" && e.teamId === match.awayTeam.id).length;
  const displayHome = showPSOBadge ? (match.homeScore ?? 0) - psoGoalsHome : (match.homeScore ?? 0);
  const displayAway = showPSOBadge ? (match.awayScore ?? 0) - psoGoalsAway : (match.awayScore ?? 0);

  const tabs: Tab[] = [
    "Summary",
    "Squad",
    ...(hasTournament ? ["Standings" as Tab] : []),
  ];

  const handleShare = async () => {
    const url = window.location.href;
    const title = `${match.homeTeam.name} vs ${match.awayTeam.name}`;
    const text =
      match.status === "finished"
        ? `${title} — ${match.homeScore}:${match.awayScore} (FT)`
        : match.status === "live"
          ? `${title} — ${match.homeScore}:${match.awayScore} LIVE`
          : title;
    if (navigator.share) {
      await navigator.share({ title, text, url }).catch(() => {});
    } else {
      await navigator.clipboard.writeText(url).catch(() => {});
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="pb-8">
      {/* ── Scoreboard card ── */}
      <div className="relative mb-0">
        {/* Stadium gradient background */}
        <div
          className="absolute inset-0 overflow-hidden"
          style={{
            background: "linear-gradient(175deg,#0d2117 0%,#0a1a28 55%,#081420 100%)",
          }}
        >
          {/* Wave-line effect */}
          <div className="absolute inset-0"
            style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='40'%3E%3Cpath d='M0 20 C15 8,30 8,45 20 S75 32,90 20 S105 8,120 20' fill='none' stroke='rgba(255,255,255,0.07)' stroke-width='1.5'/%3E%3Cpath d='M0 36 C15 24,30 24,45 36 S75 48,90 36 S105 24,120 36' fill='none' stroke='rgba(255,255,255,0.05)' stroke-width='1.5'/%3E%3Cpath d='M0 4 C15 -8,30 -8,45 4 S75 16,90 4 S105 -8,120 4' fill='none' stroke='rgba(255,255,255,0.05)' stroke-width='1.5'/%3E%3C/svg%3E\")", backgroundRepeat: "repeat", backgroundSize: "120px 40px" }}
          />
        </div>

        {/* Orange left accent */}
        <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary rounded-r-full" />

        <div className="relative px-4 pt-4 pb-0">
          {/* Action row: back ← … share */}
          <div className="flex items-center justify-between mb-4">
            <Link href="/">
              <span className="w-9 h-9 rounded-full bg-black/30 border border-white/10 flex items-center justify-center cursor-pointer hover:bg-black/50 transition-colors">
                <ChevronLeft className="w-5 h-5 text-white" />
              </span>
            </Link>
            <div className="flex flex-col items-center">
              <span className="text-[11px] font-semibold text-primary tracking-wide">
                {match.competition}
              </span>
              {match.matchGroup && (
                <span className="text-[9px] text-white/40">{match.matchGroup}</span>
              )}
            </div>
            <button
              onClick={handleShare}
              className="w-9 h-9 rounded-full bg-black/30 border border-white/10 flex items-center justify-center hover:bg-black/50 transition-colors"
            >
              {copied
                ? <Check className="w-4 h-4 text-emerald-400" />
                : <Share2 className="w-4 h-4 text-white" />}
            </button>
          </div>

          {/* Teams + score */}
          <div className="flex items-start justify-between gap-1 mb-3">
            {/* Home team */}
            <Link href={`/team/${match.homeTeam.id}`}>
              <div className="flex flex-col items-center gap-1.5 w-[90px] cursor-pointer">
                <TeamLogo
                  url={match.homeTeam.logoUrl}
                  name={match.homeTeam.name}
                  shortName={match.homeTeam.shortName}
                  className="w-16 h-16 drop-shadow-lg"
                />
                <span className="text-[11px] font-bold text-white text-center leading-tight line-clamp-2 hover:text-primary transition-colors w-full">
                  {match.homeTeam.name}
                </span>
                <TeamFormDots teamId={match.homeTeam.id} />
              </div>
            </Link>

            {/* Score / VS — always centered, fixed width */}
            <div className="flex flex-col items-center flex-1 min-w-0 px-1">
              {isLive || isFinished ? (
                <>
                  <div className="text-[52px] font-black text-white tabular-nums tracking-tighter leading-none">
                    {displayHome}
                    <span className="text-white/30 mx-1.5">–</span>
                    {displayAway}
                  </div>
                  {showPSOBadge && (
                    <div className="mt-1.5 bg-purple-900/50 border border-purple-400/30 rounded-full px-3 py-1 flex items-center gap-1.5">
                      <span className="text-[10px] font-black text-purple-300/70 uppercase tracking-widest">Pen</span>
                      <span className="text-[14px] font-black text-purple-200 tabular-nums leading-none">
                        {psoGoalsHome}–{psoGoalsAway}
                      </span>
                    </div>
                  )}
                  <div className="mt-1.5 flex flex-col items-center gap-0.5">
                    {isLive ? (
                      <>
                        {isPSOLive ? (
                          <LivePulse text="Penalties" />
                        ) : stopwatch ? (
                          <div className="flex flex-col items-center gap-0.5">
                            <span className="text-[22px] font-black text-primary tabular-nums leading-none tracking-tight">
                              {stopwatch.main}
                            </span>
                            {stopwatch.extra && (
                              <span className="text-[14px] font-black text-orange-400 tabular-nums leading-none tracking-tight">
                                {stopwatch.extra}
                              </span>
                            )}
                          </div>
                        ) : (
                          <LivePulse text={match.minute ? `${match.minute}'` : "Live"} />
                        )}
                        {match.minute && stopwatch && !isPSOLive && (
                          <span className="text-[9px] text-white/30 uppercase tracking-widest">Live</span>
                        )}
                      </>
                    ) : (
                      <span className="text-[11px] font-bold text-white/50 uppercase tracking-wider mt-1">
                        {showPSOBadge ? "After Penalties" : "Full Time"}
                      </span>
                    )}
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center gap-1 pt-2">
                  <span className="text-3xl font-black text-white/50">VS</span>
                  <span className="text-xs text-white/40 font-medium">
                    {format(new Date(match.kickoffAt), "EEE d MMM")}
                  </span>
                  <span className="text-sm font-bold text-white/70">
                    {format(new Date(match.kickoffAt), "HH:mm")}
                  </span>
                </div>
              )}
            </div>

            {/* Away team */}
            <Link href={`/team/${match.awayTeam.id}`}>
              <div className="flex flex-col items-center gap-1.5 w-[90px] cursor-pointer">
                <TeamLogo
                  url={match.awayTeam.logoUrl}
                  name={match.awayTeam.name}
                  shortName={match.awayTeam.shortName}
                  className="w-16 h-16 drop-shadow-lg"
                />
                <span className="text-[11px] font-bold text-white text-center leading-tight line-clamp-2 hover:text-primary transition-colors w-full">
                  {match.awayTeam.name}
                </span>
                <TeamFormDots teamId={match.awayTeam.id} />
              </div>
            </Link>
          </div>

          {/* Venue */}
          {match.venue && (
            <p className="text-center text-[10px] text-white/30 mb-2">{match.venue}</p>
          )}

          {/* Goal scorers strip */}
          <GoalScorersStrip match={match} />

          {/* Stream / Watch button */}
          {match.streams && match.streams.length > 0 ? (
            <div className="pt-3 pb-4">
              <Link href={`/stream/${match.id}`}>
                <div className="flex items-center justify-center gap-2 bg-primary rounded-xl py-2.5 cursor-pointer hover:bg-primary/90 transition-colors">
                  <Play className="w-4 h-4 text-white fill-white" />
                  <span className="text-sm font-bold text-white">
                    {isLive ? "Watch Live" : isFinished ? "Watch Replay" : "Watch Stream"}
                    {" · "}{match.streams.length}{" "}
                    {match.streams.length === 1 ? "stream" : "streams"}
                  </span>
                </div>
              </Link>
            </div>
          ) : isScheduled ? (
            <div className="pt-3 pb-4">
              <div className="flex items-center justify-center bg-white/8 rounded-xl py-2.5">
                <span className="text-sm font-semibold text-white/60">
                  Kickoff · {format(new Date(match.kickoffAt), "HH:mm")}
                </span>
              </div>
            </div>
          ) : (
            <div className="pb-4" />
          )}
        </div>
      </div>

      {/* ── YouTube embed ── */}
      {(() => {
        const ytStream = (match.streams ?? []).find(s => getYouTubeId(s.url));
        const ytId = ytStream ? getYouTubeId(ytStream.url) : null;
        if (!ytId) return null;
        return (
          <div className="mx-4 mt-3 mb-1 rounded-xl overflow-hidden border border-border shadow-lg">
            <div className="relative w-full" style={{ paddingBottom: "56.25%" }}>
              <iframe
                className="absolute inset-0 w-full h-full"
                src={`https://www.youtube.com/embed/${ytId}?rel=0&modestbranding=1`}
                title={`${match.homeTeam.name} vs ${match.awayTeam.name}`}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
            <div className="flex items-center justify-between px-3 py-2 bg-card">
              <span className="text-[11px] font-semibold text-foreground truncate">
                {match.homeTeam.name} vs {match.awayTeam.name}
              </span>
              <a
                href={ytStream!.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors shrink-0 ml-2"
              >
                <Play className="w-3 h-3" />
                YouTube
              </a>
            </div>
          </div>
        );
      })()}

      {/* ── Tab bar ── */}
      <div className="flex gap-0 border-b border-border bg-card sticky top-12 z-10">
        {tabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              "flex-1 py-2.5 text-sm font-semibold border-b-2 transition-all",
              activeTab === tab
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* ── Tab content ── */}
      <div className="mx-4 mt-2">
        {activeTab === "Summary" && <SummaryTab match={match} />}
        {activeTab === "Squad" && <SquadTab matchId={matchId} match={match} />}
        {activeTab === "Standings" && hasTournament && (
          <StandingsTab
            tournamentId={match.tournamentId!}
            highlightGroup={match.matchGroup}
            homeTeamId={match.homeTeam.id}
            awayTeamId={match.awayTeam.id}
          />
        )}
      </div>
    </div>
  );
}
