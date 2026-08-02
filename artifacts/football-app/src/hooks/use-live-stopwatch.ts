import { useState, useEffect, useRef } from "react";

export type StopwatchResult = { main: string; extra: string | null } | null;

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
    return Infinity;
  }
  if (startMin < 45) return 45 * 60;
  if (startMin < 90) return 90 * 60;
  if (startMin < 105) return 105 * 60;
  return 120 * 60;
}

export function parseSecs(m: string | null | undefined): number | null {
  if (!m) return null;
  if (["HT", "ET_HT", "PSO"].includes(m)) return null;
  const [base, extra] = m.split("+");
  const baseNum = parseInt(base, 10);
  if (isNaN(baseNum)) return null;
  if (extra !== undefined) {
    const extraNum = parseInt(extra, 10);
    return (baseNum + (isNaN(extraNum) ? 0 : extraNum)) * 60;
  }
  return Math.max(0, baseNum - 1) * 60;
}

export function useLiveStopwatch(
  matchId: number | string | null | undefined,
  minute: string | null | undefined,
  isLive: boolean,
  sport?: string | null,
  clockAnchorMs?: number | null,
): StopwatchResult {
  const cacheKey = matchId != null ? String(matchId) : null;
  const anchorRef = useRef<{ base: number; wallTime: number } | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!isLive || clockAnchorMs != null) {
      anchorRef.current = null;
      return;
    }
    const parsed = parseSecs(minute);
    if (parsed === null) { anchorRef.current = null; return; }
    if (anchorRef.current && anchorRef.current.base === parsed) return;
    const cached = cacheKey ? _stopwatchAnchors.get(cacheKey) : undefined;
    const anchor = cached && cached.base === parsed ? cached : { base: parsed, wallTime: Date.now() };
    anchorRef.current = anchor;
    if (cacheKey) _stopwatchAnchors.set(cacheKey, anchor);
    setTick(t => t + 1);
  }, [minute, isLive, clockAnchorMs]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!isLive) return;
    const id = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(id);
  }, [isLive]);

  // suppress unused warning
  void tick;

  if (!isLive) return null;

  let secs: number;
  if (clockAnchorMs != null) {
    secs = Math.max(0, Math.floor((Date.now() - clockAnchorMs) / 1000));
  } else if (anchorRef.current) {
    secs = anchorRef.current.base + Math.floor((Date.now() - anchorRef.current.wallTime) / 1000);
  } else {
    return null;
  }

  const boundary = (() => {
    if (!minute) return Infinity;
    if (minute.includes("+")) {
      const baseMin = parseInt(minute.split("+")[0], 10);
      return isNaN(baseMin) ? Infinity : baseMin * 60;
    }
    return getRegBoundarySecs(parseSecs(minute) ?? 0, sport);
  })();

  // In fallback mode (no server anchor) cap at the boundary — we cannot know
  // whether genuine injury/extra time is being played without the server anchor.
  const effectiveSecs = clockAnchorMs == null ? Math.min(secs, boundary) : secs;
  const cappedSecs = Math.min(effectiveSecs, boundary);
  const mm = Math.floor(cappedSecs / 60);
  const ss = cappedSecs % 60;
  const main = `${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;

  if (clockAnchorMs != null && secs > boundary) {
    const extraSecs = secs - boundary;
    const em = Math.floor(extraSecs / 60);
    const es = extraSecs % 60;
    return { main, extra: `+${String(em).padStart(2, "0")}:${String(es).padStart(2, "0")}` };
  }
  return { main, extra: null };
}
