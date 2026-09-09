import { useEffect, useMemo, useState } from "react";
    import { Check, Loader2, Target } from "lucide-react";

    type PredictionTeam = { name: string; shortName?: string | null };
    type PredictionMatch = { status: string; kickoffAt: string; homeTeam: PredictionTeam; awayTeam: PredictionTeam };
    type PredictionDistribution = { homeScore: number; awayScore: number; count: number };
    type PredictionResponse = { canPredict: boolean; totalPredictions: number; myPrediction: { homeScore: number; awayScore: number } | null; distribution: PredictionDistribution[] };

    const VISITOR_KEY = "livematchmv-prediction-visitor";
    function getVisitorId() {
     if (typeof window === "undefined") return "";
     const existing = window.localStorage.getItem(VISITOR_KEY);
     if (existing) return existing;
     const generated = window.crypto?.randomUUID?.() ?? "visitor-" + Math.random().toString(36).slice(2) + Date.now().toString(36);
     window.localStorage.setItem(VISITOR_KEY, generated);
     return generated;
    }

    export function MatchPrediction({ matchId, match }: { matchId: number; match: PredictionMatch }) {
     const [visitorId] = useState(getVisitorId);
     const [homeScore, setHomeScore] = useState("");
     const [awayScore, setAwayScore] = useState("");
     const [data, setData] = useState<PredictionResponse | null>(null);
     const [loading, setLoading] = useState(true);
     const [saving, setSaving] = useState(false);
     const [saved, setSaved] = useState(false);
     const [error, setError] = useState("");
     const endpoint = "/api/matches/" + matchId + "/prediction";
     const isScheduled = match.status === "scheduled";
     const kickoffLabel = useMemo(() => new Date(match.kickoffAt).toLocaleString([], { dateStyle: "medium", timeStyle: "short" }), [match.kickoffAt]);

     useEffect(() => {
       let cancelled = false;
       if (!visitorId) return;
       setLoading(true);
       fetch(endpoint, { headers: { "X-Prediction-Visitor": visitorId } })
         .then(async (response) => {
           if (!response.ok) throw new Error("Could not load predictions");
           return response.json() as Promise<PredictionResponse>;
         })
         .then((next) => {
           if (cancelled) return;
           setData(next);
           if (next.myPrediction) {
             setHomeScore(String(next.myPrediction.homeScore));
             setAwayScore(String(next.myPrediction.awayScore));
           }
         })
         .catch(() => { if (!cancelled) setError("Predictions are temporarily unavailable."); })
         .finally(() => { if (!cancelled) setLoading(false); });
       return () => { cancelled = true; };
     }, [endpoint, visitorId]);

     const submit = async () => {
       const home = Number(homeScore);
       const away = Number(awayScore);
       if (!Number.isInteger(home) || !Number.isInteger(away) || home < 0 || away < 0 || home > 30 || away > 30) {
         setError("Enter whole-number scores from 0 to 30.");
         return;
       }
       setError("");
       setSaving(true);
       setSaved(false);
       try {
         const response = await fetch(endpoint, {
           method: "POST",
           headers: { "Content-Type": "application/json", "X-Prediction-Visitor": visitorId },
           body: JSON.stringify({ homeScore: home, awayScore: away }),
         });
         const next = await response.json() as PredictionResponse & { error?: string };
         if (!response.ok) throw new Error(next.error || "Could not save prediction");
         setData(next);
         setSaved(true);
         window.setTimeout(() => setSaved(false), 2400);
       } catch (submitError) {
         setError(submitError instanceof Error ? submitError.message : "Could not save prediction.");
       } finally { setSaving(false); }
     };

     const canPredict = Boolean(data?.canPredict ?? isScheduled);
     const homeLabel = match.homeTeam.shortName || match.homeTeam.name;
     const awayLabel = match.awayTeam.shortName || match.awayTeam.name;

     return (
       <section className="mx-4 mt-3 overflow-hidden rounded-2xl border border-border bg-card shadow-lg dark:border-white/5 dark:bg-[#191b1f]">
         <div className="flex items-start justify-between gap-3 border-b border-border px-4 py-3 dark:border-white/5">
           <div>
             <div className="flex items-center gap-2"><Target className="h-4 w-4 text-primary" /><h2 className="text-sm font-black text-foreground">Score prediction</h2></div>
             <p className="mt-1 text-[11px] text-muted-foreground">{canPredict ? "What do you think the final score will be?" : "Predictions are closed for this match."}</p>
           </div>
           {data && data.totalPredictions > 0 && <span className="shrink-0 rounded-full bg-primary/10 px-2 py-1 text-[10px] font-bold text-primary">{data.totalPredictions} {data.totalPredictions === 1 ? "prediction" : "predictions"}</span>}
         </div>
         <div className="p-4">
           {canPredict ? <>
             <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-3">
               <label className="min-w-0"><span className="mb-1.5 block truncate text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{homeLabel}</span><input value={homeScore} onChange={(event) => setHomeScore(event.target.value.replace(/[^0-9]/g, "").slice(0, 2))} inputMode="numeric" type="number" min="0" max="30" aria-label={homeLabel + " predicted score"} className="h-12 w-full rounded-xl border border-border bg-background px-3 text-center text-2xl font-black text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20" placeholder="0" /></label>
               <span className="pb-3 text-lg font-black text-muted-foreground">–</span>
               <label className="min-w-0"><span className="mb-1.5 block truncate text-right text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{awayLabel}</span><input value={awayScore} onChange={(event) => setAwayScore(event.target.value.replace(/[^0-9]/g, "").slice(0, 2))} inputMode="numeric" type="number" min="0" max="30" aria-label={awayLabel + " predicted score"} className="h-12 w-full rounded-xl border border-border bg-background px-3 text-center text-2xl font-black text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20" placeholder="0" /></label>
             </div>
             <button type="button" onClick={submit} disabled={saving || loading} className="mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary text-sm font-black text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : saved ? <Check className="h-4 w-4" /> : null}{saving ? "Saving prediction…" : saved ? "Prediction saved" : data?.myPrediction ? "Update prediction" : "Submit prediction"}</button>
             <p className="mt-2 text-center text-[10px] text-muted-foreground">Closes at kickoff · {kickoffLabel}</p>
           </> : <div className="rounded-xl bg-muted/30 px-3 py-3 text-center text-xs text-muted-foreground">You can still view how other fans predicted this match below.</div>}
           {loading ? <div className="mt-4 h-4 animate-pulse rounded bg-muted/50" /> : data && data.distribution.length > 0 ? <div className="mt-4 border-t border-border pt-3 dark:border-white/5"><p className="mb-2 text-[10px] font-black uppercase tracking-wider text-muted-foreground">Most popular scores</p><div className="space-y-2">{data.distribution.slice(0, 3).map((item) => <div key={item.homeScore + "-" + item.awayScore} className="flex items-center gap-2 text-xs"><span className="w-12 font-black tabular-nums text-foreground">{item.homeScore}–{item.awayScore}</span><div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: Math.max(8, (item.count / data.totalPredictions) * 100) + "%" }} /></div><span className="w-16 text-right text-[10px] font-semibold text-muted-foreground">{item.count} {item.count === 1 ? "vote" : "votes"}</span></div>)}</div></div> : null}
           {error && <p className="mt-3 text-center text-xs font-semibold text-red-500">{error}</p>}
         </div>
       </section>
     );
    }
    