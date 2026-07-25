import { useState, useEffect, useRef, useCallback } from "react";
import {
  useListMatches, useListMatchEvents, useCreateMatchEvent, useDeleteMatchEvent,
  useUpdateMatchEvent, useUpdateMatch, useGetMatchLineup,
  getListMatchEventsQueryKey, getGetMatchLineupQueryKey, getListMatchesQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronDown, ChevronUp, Trash2, RotateCcw, X, Pencil, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { PenaltyTileIcon } from "@/components/penalty-icon";
import { SubstitutionIcon } from "@/components/substitution-icon";

/* ─── types ─── */
type EventType =
  | "goal" | "yellow_card" | "red_card" | "second_yellow_red" | "own_goal"
  | "penalty_awarded" | "penalty_goal" | "penalty_missed"
  | "ten_meter_goal" | "foul"
  | "substitution" | "mvp";

/* ─── stopwatch ─────────────────────────────────────────────────────────────
 * Key design decisions:
 *  - Stoppage ("45+N") only activates when admin explicitly presses +1 min.
 *    The clock naturally counts 46, 47 … 90 without triggering stoppage mode.
 *  - When paused (half-time), initRef saves current position so the clock
 *    resumes correctly when the second half starts — no jump back to 00:00.
 * ─────────────────────────────────────────────────────────────────────────── */
function parseMinuteToSeconds(minute: string | null | undefined): number {
  if (!minute) return 0;
  if (minute === "HT" || minute === "ET_HT" || minute === "PSO") return 0;
  const n = parseInt(minute.split("+")[0], 10);
  if (isNaN(n)) return 0;
  return Math.max(0, n - 1) * 60;
}

function useMatchStopwatch(isRunning: boolean, matchId: number, initialMinute: string | null | undefined) {
  const initRef = useRef(0);
  const elapsedRef = useRef(0);          // always tracks live elapsed for save-on-pause
  const startWallRef = useRef<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  // Stoppage is EXPLICIT — only set when admin presses "+1 min"
  const [stoppageBase, setStoppageBase] = useState<number | null>(null);
  const [stoppageCount, setStoppageCount] = useState(0);

  // Keep elapsedRef in sync every render (no extra re-render cost)
  elapsedRef.current = elapsed;

  // Re-initialize when the selected match changes
  useEffect(() => {
    const init = parseMinuteToSeconds(initialMinute);
    initRef.current = init;
    setElapsed(init);
    setStoppageBase(null);
    setStoppageCount(0);
    startWallRef.current = null;
  }, [matchId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!isRunning) {
      // ★ Save current position so second half resumes from here (e.g. 45:xx)
      initRef.current = elapsedRef.current;
      startWallRef.current = null;
      return;
    }
    if (startWallRef.current === null) {
      startWallRef.current = Date.now() - initRef.current * 1000;
    }
    const id = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startWallRef.current!) / 1000));
    }, 500);
    return () => clearInterval(id);
  }, [isRunning]);

  const reset = (toMinute = 0) => {
    const toSeconds = Math.max(0, toMinute) * 60;
    initRef.current = toSeconds;
    startWallRef.current = isRunning ? Date.now() - toSeconds * 1000 : null;
    setElapsed(toSeconds);
    setStoppageBase(null);
    setStoppageCount(0);
  };

  /** Add one extra minute of stoppage time. Activates "45+N" display. */
  const addMinute = () => {
    const next = elapsed + 60;
    initRef.current = next;
    startWallRef.current = isRunning ? Date.now() - next * 1000 : null;
    setElapsed(next);
    if (stoppageBase === null) {
      // First +1 press — anchor stoppage to the current whole minute
      setStoppageBase(Math.floor(elapsed / 60));
      setStoppageCount(1);
    } else {
      setStoppageCount(c => c + 1);
    }
  };

  // ── Display ──────────────────────────────────────────────────────────────
  const totalMin = Math.floor(elapsed / 60);
  const ss = String(elapsed % 60).padStart(2, "0");
  const isStoppage = stoppageBase !== null;

  let display: string;
  let minuteStr: string;
  if (isStoppage && stoppageBase !== null) {
    display = `${stoppageBase}+${stoppageCount}:${ss}`;
    minuteStr = `${stoppageBase}+${stoppageCount}`;
  } else {
    display = `${String(totalMin).padStart(2, "0")}:${ss}`;
    minuteStr = String(totalMin + 1);
  }

  return { display, minuteStr, isStoppage, reset, addMinute };
}

/* ─── event log modal ─── */
type ModalState = {
  type: EventType;
  label: string;
};

const EVENT_ICON_MAP: Record<string, string> = {
  goal: "⚽", yellow_card: "🟨", red_card: "🟥", second_yellow_red: "🟨🟥", own_goal: "↩⚽",
  penalty_awarded: "P!", penalty_goal: "P⚽", penalty_missed: "P✗",
  ten_meter_goal: "10⚽", foul: "🚫",
  substitution: "↕", mvp: "⭐",
};

function EventModal({
  modal, match, lineup, defaultMinute, onClose, onSubmit, isPending,
}: {
  modal: ModalState;
  match: { homeTeam: { id: number; shortName: string | null; name: string }; awayTeam: { id: number; shortName: string | null; name: string } };
  lineup: { home: { id: number; playerName: string; playerNumber: string; position?: string | null }[]; away: { id: number; playerName: string; playerNumber: string; position?: string | null }[] } | undefined;
  defaultMinute: string;
  onClose: () => void;
  onSubmit: (data: { type: EventType; minute: string; teamId: number; playerName: string; playerNumber?: string; assistPlayerName?: string; description?: string }) => void;
  isPending: boolean;
}) {
  const isMvp = modal.type === "mvp";
  const isCommentary = modal.type === "penalty_awarded"; // reuse for commentary edge cases
  const isGoal = modal.type === "goal" || modal.type === "penalty_goal" || modal.type === "ten_meter_goal";
  const isSub = modal.type === "substitution";

  const [teamSide, setTeamSide] = useState<"home" | "away">("home");
  const [minute, setMinute] = useState(defaultMinute);
  const [useLineup, setUseLineup] = useState(true);
  const [lineupId, setLineupId] = useState(0);
  const [playerName, setPlayerName] = useState("");
  const [playerNumber, setPlayerNumber] = useState("");
  const [assist, setAssist] = useState("");
  const [description, setDescription] = useState("");
  const [subOutId, setSubOutId] = useState(0);
  const [subOutName, setSubOutName] = useState("");

  const lineupSide = teamSide === "home" ? (lineup?.home ?? []) : (lineup?.away ?? []);
  const hasLineup = lineupSide.length > 0;
  const teamId = teamSide === "home" ? match.homeTeam.id : match.awayTeam.id;

  const pickPlayer = (id: number) => {
    const p = lineupSide.find(x => x.id === id);
    if (p) { setLineupId(id); setPlayerName(p.playerName); setPlayerNumber(p.playerNumber); }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const finalPlayerName = isMvp ? playerName : playerName;
    if (!finalPlayerName && modal.type !== "penalty_awarded") return;

    const descParts: string[] = [];
    if (isSub && subOutName) descParts.push(`Out: ${subOutName}`);
    if (description) descParts.push(description);

    onSubmit({
      type: modal.type,
      minute: isMvp ? "90" : minute,
      teamId,
      playerName: finalPlayerName || "Unknown",
      playerNumber: playerNumber || undefined,
      assistPlayerName: assist || undefined,
      description: descParts.join(" · ") || undefined,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="w-full max-w-md bg-[#0f1929] border border-white/10 rounded-t-3xl px-5 pb-8 pt-5 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <span className="text-xl">{EVENT_ICON_MAP[modal.type] ?? "•"}</span>
            <span className="text-base font-black text-white">{isMvp ? "Set Man of the Match" : `Log ${modal.label}`}</span>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center">
            <X className="w-4 h-4 text-white/70" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          {/* Team selector */}
          <div className="grid grid-cols-2 gap-2">
            {(["home", "away"] as const).map(side => (
              <button key={side} type="button"
                onClick={() => { setTeamSide(side); setLineupId(0); setPlayerName(""); setPlayerNumber(""); }}
                className={cn("py-2.5 rounded-xl text-sm font-bold border transition-all",
                  teamSide === side
                    ? "bg-primary text-white border-primary"
                    : "bg-white/5 text-white/60 border-white/10"
                )}>
                {side === "home"
                  ? (match.homeTeam.shortName || match.homeTeam.name)
                  : (match.awayTeam.shortName || match.awayTeam.name)}
              </button>
            ))}
          </div>

          {/* Player */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[10px] font-bold text-white/50 uppercase">
                {isSub ? "Player In *" : isMvp ? "Player *" : "Player *"}
              </label>
              {hasLineup && (
                <button type="button" onClick={() => { setUseLineup(u => !u); setLineupId(0); setPlayerName(""); setPlayerNumber(""); }}
                  className="text-[10px] font-semibold text-primary">
                  {useLineup ? "Manual" : "From lineup"}
                </button>
              )}
            </div>
            {useLineup && hasLineup ? (
              <select value={lineupId}
                onChange={e => pickPlayer(Number(e.target.value))}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-primary">
                <option value={0}>— Select player —</option>
                {lineupSide.map(p => (
                  <option key={p.id} value={p.id}>#{p.playerNumber} {p.playerName}{p.position ? ` (${p.position})` : ""}</option>
                ))}
              </select>
            ) : (
              <div className="flex gap-2">
                <input value={playerNumber} onChange={e => setPlayerNumber(e.target.value)}
                  placeholder="#" className="w-16 bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white text-center focus:outline-none focus:border-primary" />
                <input value={playerName} onChange={e => setPlayerName(e.target.value)}
                  placeholder="Player name" required
                  className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-primary" />
              </div>
            )}
          </div>

          {/* Sub-out player */}
          {isSub && (
            <div>
              <label className="text-[10px] font-bold text-white/50 uppercase block mb-1.5">Player Out</label>
              {useLineup && hasLineup ? (
                <select value={subOutId}
                  onChange={e => { const p = lineupSide.find(x => x.id === Number(e.target.value)); setSubOutId(Number(e.target.value)); setSubOutName(p?.playerName ?? ""); }}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-primary">
                  <option value={0}>— Select player —</option>
                  {lineupSide.map(p => (
                    <option key={p.id} value={p.id}>#{p.playerNumber} {p.playerName}</option>
                  ))}
                </select>
              ) : (
                <input value={subOutName} onChange={e => setSubOutName(e.target.value)}
                  placeholder="Player being substituted out"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-primary" />
              )}
            </div>
          )}

          {/* Assist (for goals) */}
          {isGoal && (
            <div>
              <label className="text-[10px] font-bold text-white/50 uppercase block mb-1.5">Assist (optional)</label>
              <input value={assist} onChange={e => setAssist(e.target.value)}
                placeholder="Assist player name"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-primary" />
            </div>
          )}

          {/* Note */}
          <div>
            <label className="text-[10px] font-bold text-white/50 uppercase block mb-1.5">Note (optional)</label>
            <input value={description} onChange={e => setDescription(e.target.value)}
              placeholder="e.g. VAR, header, free kick..."
              className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-primary" />
          </div>

          {/* Minute (not for MVP) */}
          {!isMvp && (
            <div>
              <label className="text-[10px] font-bold text-white/50 uppercase block mb-1.5">Minute</label>
              <input value={minute} onChange={e => setMinute(e.target.value)}
                placeholder="45' or 90+3'"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-primary" />
            </div>
          )}

          <button type="submit" disabled={isPending}
            className="w-full bg-primary text-white font-black py-3.5 rounded-2xl text-sm mt-2 disabled:opacity-50 active:scale-[0.98] transition-transform">
            {isPending ? "Logging..." : isMvp ? "⭐ Set Man of the Match" : `Log ${modal.label}`}
          </button>
        </form>
      </div>
    </div>
  );
}

/* ─── score button ─── */
function ScoreBtn({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick}
      className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 active:scale-95 transition-all flex items-center justify-center text-white font-black text-lg leading-none">
      {children}
    </button>
  );
}

/* ─── log icon ─── */
const LOG_ICONS: Record<string, { icon: string; label: string; color: string }> = {
  goal:               { icon: "⚽",   label: "Goal",            color: "text-emerald-400" },
  yellow_card:        { icon: "🟨",   label: "Yellow",          color: "text-yellow-400" },
  red_card:           { icon: "🟥",   label: "Red Card",        color: "text-red-400" },
  second_yellow_red:  { icon: "🟨🟥", label: "2nd Yellow+Red",  color: "text-orange-400" },
  own_goal:           { icon: "↩⚽",  label: "Own Goal",        color: "text-orange-400" },
  penalty_awarded:    { icon: "P!",   label: "Penalty",         color: "text-blue-400" },
  penalty_goal:       { icon: "P⚽",  label: "Pen. Goal",       color: "text-emerald-400" },
  penalty_missed:     { icon: "P✗",   label: "Pen. Miss",       color: "text-red-400" },
  ten_meter_goal:     { icon: "10⚽", label: "10m Pen Goal",    color: "text-emerald-400" },
  foul:               { icon: "🚫",   label: "Foul",            color: "text-orange-300" },
  substitution:       { icon: "↕",    label: "Sub",             color: "text-purple-400" },
  mvp:                { icon: "⭐",   label: "MVP",             color: "text-amber-400" },
};

/* ─── main component ─── */
export function EventsTab() {
  const qc = useQueryClient();

  const [selectedMatchId, setSelectedMatchId] = useState(0);
  const [modal, setModal] = useState<ModalState | null>(null);
  const [showLog, setShowLog] = useState(true);
  const [showLineup, setShowLineup] = useState(false);
  const [localScore, setLocalScore] = useState({ home: 0, away: 0 });
  const scoreDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showSetMinute, setShowSetMinute] = useState(false);
  const [setMinuteInput, setSetMinuteInput] = useState("");

  const { data: allMatches } = useListMatches({ limit: 100 });
  const match = (allMatches ?? []).find(m => m.id === selectedMatchId);
  const isFutsal = match?.sport === "futsal";
  const isLive = match?.status === "live";
  const isFinished = match?.status === "finished";
  const isHalfTime = match?.minute === "HT";
  const isETHalfTime = match?.minute === "ET_HT";
  const isPSO = match?.minute === "PSO";
  const minuteNum = (() => {
    const m = match?.minute;
    if (!m || m === "HT" || m === "ET_HT" || m === "PSO") return 0;
    return parseInt(m.split("+")[0], 10) || 0;
  })();
  const isETPhase = !isFutsal && minuteNum > 90;

  const { data: events, isLoading: evLoading } = useListMatchEvents(selectedMatchId, {
    query: { enabled: !!selectedMatchId, queryKey: getListMatchEventsQueryKey(selectedMatchId), refetchInterval: isLive ? 15000 : false },
  });
  const { data: lineup } = useGetMatchLineup(selectedMatchId, {
    query: { enabled: !!selectedMatchId, queryKey: getGetMatchLineupQueryKey(selectedMatchId) },
  });

  const createEvent = useCreateMatchEvent();
  const deleteEvent = useDeleteMatchEvent();
  const updateEvent = useUpdateMatchEvent();
  const updateMatch = useUpdateMatch();

  // Inline event editing state
  const [editingEventId, setEditingEventId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editNumber, setEditNumber] = useState("");

  const invalidateEvents = useCallback(() =>
    qc.invalidateQueries({ queryKey: getListMatchEventsQueryKey(selectedMatchId) }),
    [qc, selectedMatchId]);

  const invalidateMatches = useCallback(() =>
    qc.invalidateQueries({ queryKey: getListMatchesQueryKey() }),
    [qc]);

  // Initialize local score from match data
  useEffect(() => {
    if (match) setLocalScore({ home: match.homeScore ?? 0, away: match.awayScore ?? 0 });
  }, [match?.id, match?.homeScore, match?.awayScore]);

  // Stopwatch
  const watchRunning = isLive && !isHalfTime && !isETHalfTime && !isPSO;
  const { display: watchDisplay, minuteStr, isStoppage, reset: resetWatch, addMinute } = useMatchStopwatch(
    watchRunning,
    selectedMatchId,
    match?.minute
  );

  // Auto-save the running minute to DB every 30 s so the public site stays in sync
  const minuteStrRef = useRef(minuteStr);
  minuteStrRef.current = minuteStr;
  useEffect(() => {
    if (!isLive || isHalfTime || isETHalfTime || isPSO) return;
    const id = setInterval(() => {
      updateMatch.mutate({ id: selectedMatchId, data: { minute: minuteStrRef.current } });
    }, 30_000);
    return () => clearInterval(id);
  }, [isLive, isHalfTime, selectedMatchId]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleResetWatch = () => {
    resetWatch(0);
    setShowSetMinute(false);
    setSetMinuteInput("");
  };

  const handleSetMinute = () => {
    const n = parseInt(setMinuteInput, 10);
    if (!isNaN(n) && n >= 0) {
      resetWatch(n);
      updateMatch.mutate({ id: selectedMatchId, data: { minute: String(n) } });
    }
    setShowSetMinute(false);
    setSetMinuteInput("");
  };

  /* score control */
  const adjustScore = (side: "home" | "away", delta: number) => {
    const next = { ...localScore, [side]: Math.max(0, localScore[side] + delta) };
    setLocalScore(next);
    if (scoreDebounceRef.current) clearTimeout(scoreDebounceRef.current);
    scoreDebounceRef.current = setTimeout(() => {
      updateMatch.mutate({ id: selectedMatchId, data: { homeScore: next.home, awayScore: next.away } },
        { onSuccess: invalidateMatches });
    }, 400);
  };

  /* status controls */
  const handleHalfTime = () => {
    updateMatch.mutate({ id: selectedMatchId, data: { status: "live", minute: "HT" } },
      { onSuccess: invalidateMatches });
  };

  const handleSecondHalf = () => {
    // Football halves are 45 min each; futsal halves are 20 min each
    const halfDuration = match?.sport === "futsal" ? 20 : 45;
    resetWatch(halfDuration);
    updateMatch.mutate(
      { id: selectedMatchId, data: { status: "live", minute: String(halfDuration) } },
      { onSuccess: invalidateMatches }
    );
  };

  const handleFullTime = (fromPSO = false) => {
    if (fromPSO && !window.confirm("End penalty shootout and finish the match?")) return;
    updateMatch.mutate({
      id: selectedMatchId,
      data: { status: "finished", minute: fromPSO ? "PSO" : minuteStr, homeScore: localScore.home, awayScore: localScore.away }
    }, { onSuccess: invalidateMatches });
  };

  const handleRestart = () => {
    updateMatch.mutate(
      { id: selectedMatchId, data: { status: "live", minute: "0" } },
      { onSuccess: invalidateMatches }
    );
  };
  const handleExtraTime = () => {
    const etStart = match?.sport === "futsal" ? 40 : 90;
    resetWatch(etStart);
    updateMatch.mutate(
      { id: selectedMatchId, data: { status: "live", minute: String(etStart + 1) } },
      { onSuccess: invalidateMatches }
    );
  };

  const handleETHalfTime = () => {
    updateMatch.mutate({ id: selectedMatchId, data: { status: "live", minute: "ET_HT" } },
      { onSuccess: invalidateMatches });
  };

  const handleETSecondHalf = () => {
    const etHalf2Start = match?.sport === "futsal" ? 45 : 105;
    resetWatch(etHalf2Start);
    updateMatch.mutate(
      { id: selectedMatchId, data: { status: "live", minute: String(etHalf2Start + 1) } },
      { onSuccess: invalidateMatches }
    );
  };

  const handlePenaltyShootout = () => {
    updateMatch.mutate({ id: selectedMatchId, data: { status: "live", minute: "PSO" } },
      { onSuccess: invalidateMatches });
  };

  /* log event */
  const handleLogEvent = (data: Parameters<typeof createEvent.mutate>[0]["data"]) => {
    createEvent.mutate({ id: selectedMatchId, data }, {
      onSuccess: () => {
        setModal(null);
        invalidateEvents();
        invalidateMatches();
      }
    });
  };

  const handleDelete = (eventId: number) =>
    deleteEvent.mutate({ id: selectedMatchId, eventId }, { onSuccess: invalidateEvents });

  const handleEditStart = (event: { id: number; playerName?: string | null; playerNumber?: string | null }) => {
    setEditingEventId(event.id);
    setEditName(event.playerName ?? "");
    setEditNumber(event.playerNumber ?? "");
  };

  const handleEditSave = (eventId: number) => {
    const event = (events ?? []).find(e => e.id === eventId);
    if (!event) return;
    updateEvent.mutate(
      {
        id: selectedMatchId,
        eventId,
        data: {
          type: event.type as Parameters<typeof updateEvent.mutate>[0]["data"]["type"],
          minute: event.minute,
          teamId: event.teamId,
          playerName: editName.trim(),
          playerNumber: editNumber.trim() || undefined,
          assistPlayerName: event.assistPlayerName ?? undefined,
          description: event.description ?? undefined,
        },
      },
      {
        onSuccess: () => {
          setEditingEventId(null);
          invalidateEvents();
        },
      }
    );
  };

  /* event tile config */
  type Tile = { type: EventType; label: string; bg: string; icon: string; futsalOnly?: boolean };
  const EVENT_TILES: Tile[] = ([
    { type: "goal",               label: "Goal",            bg: "bg-[#1a4a2e] hover:bg-[#205838]", icon: "⚽" },
    { type: "yellow_card",        label: "Yellow Card",     bg: "bg-[#7a5800] hover:bg-[#8f6600]", icon: "🟨" },
    { type: "red_card",           label: "Red Card",        bg: "bg-[#6b1111] hover:bg-[#801313]", icon: "🟥" },
    { type: "second_yellow_red",  label: "2nd Yellow+Red",  bg: "bg-[#7a3200] hover:bg-[#8f3c00]", icon: "🟨🟥" },
    { type: "substitution",       label: "Substitution",    bg: "bg-[#0d3060] hover:bg-[#104080]", icon: "__sub__" },
    { type: "own_goal",           label: "Own Goal",        bg: "bg-[#5a2d00] hover:bg-[#6e3700]", icon: "↩⚽" },
    { type: "penalty_goal",       label: "Pen. Goal",       bg: "bg-[#1a4a2e] hover:bg-[#205838]", icon: "__pen_goal__" },
    { type: "penalty_missed",     label: "Pen. Missed",     bg: "bg-[#4a1a1a] hover:bg-[#5a2020]", icon: "__pen_missed__" },
    { type: "ten_meter_goal",     label: "10m Pen Goal",    bg: "bg-[#0a4a3a] hover:bg-[#0c5845]", icon: "10⚽", futsalOnly: true },
    { type: "foul",               label: "Foul",            bg: "bg-[#4a2e00] hover:bg-[#5c3800]", icon: "🚫",  futsalOnly: true },
  ] as Tile[]).filter(t => !t.futsalOnly || isFutsal);

  return (
    <div className="space-y-3">
      {/* Match selector */}
      <div>
        <label className="text-[10px] font-semibold text-muted-foreground uppercase block mb-1.5">Select Match</label>
        <select value={selectedMatchId}
          onChange={e => { setSelectedMatchId(Number(e.target.value)); setModal(null); }}
          className="admin-input">
          <option value={0}>— Choose match —</option>
          <optgroup label="Live">
            {(allMatches ?? []).filter(m => m.status === "live").map(m => (
              <option key={m.id} value={m.id}>
                🔴 {m.homeTeam.shortName} vs {m.awayTeam.shortName} · {m.competition} · {m.minute ?? "Live"}
              </option>
            ))}
          </optgroup>
          <optgroup label="Scheduled">
            {(allMatches ?? []).filter(m => m.status === "scheduled").map(m => (
              <option key={m.id} value={m.id}>
                {m.homeTeam.shortName} vs {m.awayTeam.shortName} · {m.competition}
              </option>
            ))}
          </optgroup>
          <optgroup label="Finished">
            {(allMatches ?? []).filter(m => m.status === "finished").map(m => (
              <option key={m.id} value={m.id}>
                ✓ {m.homeTeam.shortName} {m.homeScore}–{m.awayScore} {m.awayTeam.shortName}
              </option>
            ))}
          </optgroup>
        </select>
      </div>

      {selectedMatchId > 0 && match && (
        <>
          {/* ── Live control panel ── */}
          <div className="bg-[#0f1929] border border-white/8 rounded-2xl overflow-hidden">
            {/* Stopwatch / status header */}
            <div className="flex flex-col items-center pt-4 pb-1 px-4 gap-1.5">
              {isLive && !isHalfTime ? (
                <>
                  {showSetMinute ? (
                    /* Set-minute input */
                    <div className="flex items-center gap-2 w-full max-w-[220px]">
                      <input
                        autoFocus
                        type="number"
                        min="0"
                        max="120"
                        value={setMinuteInput}
                        onChange={e => setSetMinuteInput(e.target.value)}
                        onKeyDown={e => { if (e.key === "Enter") handleSetMinute(); if (e.key === "Escape") { setShowSetMinute(false); setSetMinuteInput(""); } }}
                        placeholder="e.g. 45"
                        className="flex-1 bg-white/10 border border-white/20 rounded-xl px-3 py-1.5 text-sm text-white text-center font-mono focus:outline-none focus:border-primary placeholder:text-white/30"
                      />
                      <button onClick={handleSetMinute}
                        className="bg-primary text-white text-xs font-black px-3 py-1.5 rounded-xl">
                        Set
                      </button>
                      <button onClick={() => { setShowSetMinute(false); setSetMinuteInput(""); }}
                        className="text-white/40 hover:text-white/70 transition-colors">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    /* Running stopwatch + controls */
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse shrink-0" />
                      <button
                        onClick={() => { setShowSetMinute(true); setSetMinuteInput(""); }}
                        title="Tap to set minute"
                        className={cn(
                          "font-mono text-xl font-black tracking-widest hover:opacity-80 transition-opacity",
                          isStoppage ? "text-amber-400" : "text-red-400"
                        )}>
                        {watchDisplay}
                      </button>
                      {/* +1 min button */}
                      <button
                        onClick={addMinute}
                        title="Add 1 minute (stoppage time)"
                        className="flex items-center gap-0.5 bg-amber-500/20 hover:bg-amber-500/35 border border-amber-500/30 text-amber-400 font-black text-[11px] px-2 py-1 rounded-lg transition-colors">
                        +1<span className="text-[9px] font-semibold opacity-70 ml-0.5">min</span>
                      </button>
                      {/* Reset */}
                      <button
                        onClick={handleResetWatch}
                        title="Reset to 00:00"
                        className="w-6 h-6 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors">
                        <RotateCcw className="w-3 h-3 text-white/50" />
                      </button>
                    </div>
                  )}
                </>
              ) : isPSO ? (
                <span className="text-sm font-black text-purple-400 tracking-widest uppercase">🥅 Penalties</span>
              ) : isETHalfTime ? (
                <span className="text-sm font-black text-orange-400 tracking-widest uppercase">ET Half Time</span>
              ) : isHalfTime ? (
                <span className="text-sm font-black text-amber-400 tracking-widest uppercase">Half Time</span>
              ) : isFinished ? (
                <span className="text-sm font-black text-muted-foreground tracking-widest uppercase">Full Time</span>
              ) : (
                <span className="text-sm font-black text-blue-400 tracking-widest uppercase">Scheduled</span>
              )}
            </div>

            {/* Score display */}
            <div className="px-6 py-4">
              <div className="flex items-center justify-between mb-2 px-2">
                <span className="text-xs font-bold text-white/50 tracking-wider uppercase">
                  {match.homeTeam.shortName || match.homeTeam.name}
                </span>
                <span className="text-xs text-white/30">—</span>
                <span className="text-xs font-bold text-white/50 tracking-wider uppercase">
                  {match.awayTeam.shortName || match.awayTeam.name}
                </span>
              </div>
              <div className="flex items-center justify-center gap-6">
                {/* Home */}
                <div className="flex items-center gap-3">
                  <ScoreBtn onClick={() => adjustScore("home", -1)}>−</ScoreBtn>
                  <span className="text-5xl font-black text-white w-12 text-center tabular-nums">{localScore.home}</span>
                  <ScoreBtn onClick={() => adjustScore("home", 1)}>+</ScoreBtn>
                </div>
                <span className="text-3xl font-black text-white/30">—</span>
                {/* Away */}
                <div className="flex items-center gap-3">
                  <ScoreBtn onClick={() => adjustScore("away", -1)}>−</ScoreBtn>
                  <span className="text-5xl font-black text-white w-12 text-center tabular-nums">{localScore.away}</span>
                  <ScoreBtn onClick={() => adjustScore("away", 1)}>+</ScoreBtn>
                </div>
              </div>
            </div>

            {/* Status buttons */}
            <div className="px-4 pb-4 space-y-2">
              {isFinished ? (
                <button onClick={handleRestart}
                  className="w-full flex items-center justify-center gap-2 bg-white/10 hover:bg-white/15 text-white font-black py-3.5 rounded-2xl text-sm transition-all active:scale-[0.98]">
                  <RotateCcw className="w-4 h-4" />
                  Restart Match
                </button>
              ) : isPSO ? (
                <>
                  <p className="text-[10px] font-bold text-purple-400/70 uppercase tracking-widest text-center">Penalty Shootout</p>
                  <button onClick={() => handleFullTime(true)}
                    className="w-full bg-primary hover:bg-primary/90 text-white font-black py-3.5 rounded-2xl text-sm transition-all active:scale-[0.98] flex items-center justify-center gap-1.5">
                    <span className="text-base">⏹</span> End Match (PSO)
                  </button>
                </>
              ) : isETHalfTime ? (
                <button onClick={handleETSecondHalf}
                  className="w-full bg-orange-700 hover:bg-orange-600 text-white font-black py-3.5 rounded-2xl text-sm transition-all active:scale-[0.98]">
                  ET 2nd Half Started
                </button>
              ) : isHalfTime ? (
                <button onClick={handleSecondHalf}
                  className="w-full bg-emerald-700 hover:bg-emerald-600 text-white font-black py-3.5 rounded-2xl text-sm transition-all active:scale-[0.98]">
                  2nd Half Started
                </button>
              ) : isLive && isETPhase ? (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    <button onClick={handleETHalfTime}
                      className="bg-[#1a3a4a] hover:bg-[#1f4455] text-white font-black py-3.5 rounded-2xl text-sm transition-all active:scale-[0.98] flex items-center justify-center gap-1.5">
                      <span className="text-base">⏸</span> ET Half
                    </button>
                    <button onClick={() => handleFullTime()}
                      className="bg-primary hover:bg-primary/90 text-white font-black py-3.5 rounded-2xl text-sm transition-all active:scale-[0.98] flex items-center justify-center gap-1.5">
                      <span className="text-base">⏹</span> ET Full Time
                    </button>
                  </div>
                  <button onClick={handlePenaltyShootout}
                    className="w-full bg-purple-800 hover:bg-purple-700 text-white font-black py-3 rounded-2xl text-sm transition-all active:scale-[0.98]">
                    🥅 Penalty Shootout
                  </button>
                </>
              ) : isLive ? (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    <button onClick={handleHalfTime}
                      className="bg-[#1a3a4a] hover:bg-[#1f4455] text-white font-black py-3.5 rounded-2xl text-sm transition-all active:scale-[0.98] flex items-center justify-center gap-1.5">
                      <span className="text-base">⏸</span> Half Time
                    </button>
                    <button onClick={() => handleFullTime()}
                      className="bg-primary hover:bg-primary/90 text-white font-black py-3.5 rounded-2xl text-sm transition-all active:scale-[0.98] flex items-center justify-center gap-1.5">
                      <span className="text-base">⏹</span> Full Time
                    </button>
                  </div>
                  {isFutsal ? (
                    <button onClick={handlePenaltyShootout}
                      className="w-full bg-purple-800/60 hover:bg-purple-700/70 border border-purple-500/30 text-purple-300 font-black py-2.5 rounded-2xl text-xs transition-all active:scale-[0.98]">
                      🥅 Penalty Shootout
                    </button>
                  ) : (
                    <div className="grid grid-cols-2 gap-2">
                      <button onClick={handleExtraTime}
                        className="bg-orange-800/60 hover:bg-orange-700/70 border border-orange-500/30 text-orange-300 font-black py-2.5 rounded-2xl text-xs transition-all active:scale-[0.98]">
                        ⏱ Extra Time
                      </button>
                      <button onClick={handlePenaltyShootout}
                        className="bg-purple-800/60 hover:bg-purple-700/70 border border-purple-500/30 text-purple-300 font-black py-2.5 rounded-2xl text-xs transition-all active:scale-[0.98]">
                        🥅 Penalties
                      </button>
                    </div>
                  )}
                </>
              ) : (
                <button onClick={handleRestart}
                  className="w-full bg-red-600 hover:bg-red-500 text-white font-black py-3.5 rounded-2xl text-sm transition-all active:scale-[0.98]">
                  ▶ Start Live
                </button>
              )}
            </div>
          </div>

          {/* ── LOG EVENT ── */}
          <div className="bg-[#0f1929] border border-white/8 rounded-2xl p-4">
            <p className="text-[10px] font-black text-white/40 uppercase tracking-widest mb-3">Log Event</p>
            <div className="grid grid-cols-2 gap-2">
              {EVENT_TILES.map(tile => (
                <button key={tile.type}
                  onClick={() => setModal({ type: tile.type, label: tile.label })}
                  className={cn(
                    "rounded-2xl py-4 px-3 flex flex-col items-center justify-center gap-1.5 transition-all active:scale-95 border border-white/5",
                    tile.bg
                  )}>
                  {tile.icon === "__sub__"
                    ? <SubstitutionIcon className="scale-150" />
                    : tile.icon === "__pen_goal__"
                    ? <PenaltyTileIcon outcome="goal" />
                    : tile.icon === "__pen_missed__"
                    ? <PenaltyTileIcon outcome="missed" />
                    : <span className="text-2xl leading-none">{tile.icon}</span>}
                  <span className="text-xs font-black text-white tracking-wide">{tile.label}</span>
                </button>
              ))}

              {/* Commentary */}
              <button
                onClick={() => setModal({ type: "penalty_awarded", label: "Commentary" })}
                className="rounded-2xl py-4 px-3 flex flex-col items-center justify-center gap-1.5 bg-white/5 hover:bg-white/10 border border-white/10 transition-all active:scale-95">
                <span className="text-2xl leading-none">💬</span>
                <span className="text-xs font-black text-white tracking-wide">Commentary</span>
              </button>

              {/* Set MVP — only when finished */}
              {isFinished ? (
                <button
                  onClick={() => setModal({ type: "mvp", label: "Man of the Match" })}
                  className="rounded-2xl py-4 px-3 flex flex-col items-center justify-center gap-1.5 bg-[#5a3a00] hover:bg-[#6e4500] border border-amber-500/20 transition-all active:scale-95">
                  <span className="text-2xl leading-none">⭐</span>
                  <span className="text-xs font-black text-amber-400 tracking-wide">Set MVP</span>
                </button>
              ) : (
                <div className="rounded-2xl py-4 px-3 flex flex-col items-center justify-center gap-1.5 border border-dashed border-white/10 opacity-30">
                  <span className="text-2xl leading-none">⭐</span>
                  <span className="text-xs font-black text-white/40 tracking-wide">MVP (after FT)</span>
                </div>
              )}
            </div>
          </div>

          {/* ── MATCH LOG collapsible ── */}
          <div className="bg-[#0f1929] border border-white/8 rounded-2xl overflow-hidden">
            <button
              onClick={() => setShowLog(v => !v)}
              className="w-full flex items-center justify-between px-4 py-3.5">
              <div className="flex items-center gap-2">
                <span className="text-sm">📋</span>
                <span className="text-sm font-black text-white tracking-wide">Match Log</span>
                <span className="text-xs font-semibold text-white/40">({events?.length ?? 0})</span>
              </div>
              {showLog ? <ChevronUp className="w-4 h-4 text-white/40" /> : <ChevronDown className="w-4 h-4 text-white/40" />}
            </button>
            {showLog && (
              <div className="border-t border-white/5">
                {evLoading ? (
                  <div className="p-4"><Skeleton className="h-16 w-full rounded-xl" /></div>
                ) : events && events.length > 0 ? (
                  <div className="divide-y divide-white/5">
                    {[...events].reverse().map(event => {
                      const info = LOG_ICONS[event.type];
                      const isEditing = editingEventId === event.id;
                      return (
                        <div key={event.id} className="px-4 py-3">
                          {isEditing ? (
                            /* ── Inline edit form ── */
                            <div className="space-y-2">
                              <div className="flex items-center gap-2 text-[10px] text-white/40 mb-1">
                                <span>{info?.icon ?? "•"}</span>
                                <span className={cn("font-black", info?.color ?? "text-white/50")}>{event.minute}'</span>
                                <span>{info?.label ?? event.type}</span>
                              </div>
                              <div className="flex gap-2">
                                <input
                                  type="text"
                                  value={editNumber}
                                  onChange={e => setEditNumber(e.target.value)}
                                  placeholder="#"
                                  className="w-14 bg-white/10 border border-white/20 rounded-lg px-2 py-1.5 text-xs text-white text-center font-mono focus:outline-none focus:border-primary"
                                />
                                <input
                                  autoFocus
                                  type="text"
                                  value={editName}
                                  onChange={e => setEditName(e.target.value)}
                                  onKeyDown={e => { if (e.key === "Enter") handleEditSave(event.id); if (e.key === "Escape") setEditingEventId(null); }}
                                  placeholder="Player name"
                                  className="flex-1 bg-white/10 border border-white/20 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-primary"
                                />
                                <button
                                  onClick={() => handleEditSave(event.id)}
                                  disabled={updateEvent.isPending}
                                  className="w-8 h-8 rounded-lg bg-emerald-600/80 hover:bg-emerald-500 flex items-center justify-center transition-colors shrink-0">
                                  <Check className="w-3.5 h-3.5 text-white" />
                                </button>
                                <button
                                  onClick={() => setEditingEventId(null)}
                                  className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors shrink-0">
                                  <X className="w-3.5 h-3.5 text-white/60" />
                                </button>
                              </div>
                            </div>
                          ) : (
                            /* ── Normal row ── */
                            <div className="flex items-center gap-3">
                              <span className="text-base w-6 text-center shrink-0">{info?.icon ?? "•"}</span>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold text-white leading-tight">
                                  {event.playerNumber && <span className="text-white/40 mr-1">#{event.playerNumber}</span>}
                                  {event.playerName
                                    ? event.playerName
                                    : <span className="text-white/25 italic text-xs">No player — tap ✏️ to add</span>}
                                  {event.assistPlayerName && <span className="text-white/40 text-xs ml-1">▷ {event.assistPlayerName}</span>}
                                </p>
                                <p className="text-[10px] text-white/40 mt-0.5">
                                  <span className={cn("font-black mr-1.5", info?.color ?? "text-white/50")}>{event.minute}'</span>
                                  {info?.label ?? event.type}
                                  {event.description && ` · ${event.description}`}
                                </p>
                              </div>
                              <button
                                onClick={() => handleEditStart(event)}
                                title="Edit player"
                                className="text-white/20 hover:text-blue-400 p-1 transition-colors shrink-0">
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button onClick={() => handleDelete(event.id)}
                                className="text-white/20 hover:text-red-400 p-1 transition-colors shrink-0">
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="px-4 py-4 text-xs text-white/30 text-center">No logs yet. Events and goals will appear here.</p>
                )}
              </div>
            )}
          </div>

          {/* ── LINEUP collapsible ── */}
          <div className="bg-[#0f1929] border border-white/8 rounded-2xl overflow-hidden">
            <button
              onClick={() => setShowLineup(v => !v)}
              className="w-full flex items-center justify-between px-4 py-3.5">
              <div className="flex items-center gap-2">
                <span className="text-sm">👤</span>
                <span className="text-sm font-black text-white tracking-wide">Lineup</span>
              </div>
              {showLineup ? <ChevronUp className="w-4 h-4 text-white/40" /> : <ChevronDown className="w-4 h-4 text-white/40" />}
            </button>
            {showLineup && (
              <div className="border-t border-white/5">
                {lineup ? (
                  <div className="grid grid-cols-2 divide-x divide-white/5">
                    {(["home", "away"] as const).map(side => {
                      const team = side === "home" ? match.homeTeam : match.awayTeam;
                      const players = side === "home" ? lineup.home : lineup.away;
                      return (
                        <div key={side}>
                          <p className="px-3 py-2 text-[10px] font-black text-primary uppercase tracking-widest border-b border-white/5">
                            {team.shortName || team.name}
                          </p>
                          {players.length > 0 ? (
                            <div className="divide-y divide-white/5">
                              {players.map(p => (
                                <div key={p.id} className="flex items-center gap-2 px-3 py-2">
                                  <span className="text-[10px] font-black text-white/30 w-5 shrink-0">#{p.playerNumber}</span>
                                  <span className="text-[11px] text-white/70 truncate">{p.playerName}</span>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="px-3 py-3 text-[10px] text-white/20">No lineup set</p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="px-4 py-4 text-xs text-white/30 text-center">No lineup data</p>
                )}
              </div>
            )}
          </div>
        </>
      )}

      {selectedMatchId === 0 && (
        <div className="py-12 text-center text-muted-foreground text-sm bg-card rounded-xl border border-dashed border-border">
          Select a match above to manage live events.
        </div>
      )}

      {/* ── Event modal ── */}
      {modal && match && (
        <EventModal
          modal={modal}
          match={match}
          lineup={lineup as any}
          defaultMinute={isPSO ? "PSO" : minuteStr}
          onClose={() => setModal(null)}
          onSubmit={handleLogEvent}
          isPending={createEvent.isPending}
        />
      )}
    </div>
  );
}
