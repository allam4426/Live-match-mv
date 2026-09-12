import { useEffect, useMemo, useState } from "react";
import { useAuth, useUser } from "@clerk/react";
import { Check, Clock3, Loader2, LockKeyhole, Minus, Plus, Target, Trophy } from "lucide-react";
import { Link } from "wouter";

type PredictionTeam = { name: string; shortName?: string | null; logoUrl?: string | null };
type PredictionMatch = { status: string; kickoffAt: string; homeScore?: number; awayScore?: number; homeTeam: PredictionTeam; awayTeam: PredictionTeam };
type DistributionItem = { homeScore: number; awayScore: number; count: number; percentage?: number };
type PredictionResult = { homeScore: number; awayScore: number; points: number; label: string } | null;
type PredictionResponse = { canPredict: boolean; locked: boolean; totalPredictions: number; myPrediction: { homeScore: number; awayScore: number; points?: number; status?: string } | null; distribution: DistributionItem[]; result?: PredictionResult };

function TeamBadge({ team }: { team: PredictionTeam }) {
  return team.logoUrl ? <img src={team.logoUrl} alt="" className="h-10 w-10 object-contain" /> : <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/15 text-sm font-black text-primary">{(team.shortName || team.name).slice(0, 2).toUpperCase()}</div>;
}

export function MatchPrediction({ matchId, match }: { matchId: number; match: PredictionMatch }) {
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const { user } = useUser();
  const [homeScore, setHomeScore] = useState(0);
  const [awayScore, setAwayScore] = useState(0);
  const [data, setData] = useState<PredictionResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const isOpen = Boolean(data?.canPredict && isSignedIn);
  const kickoffLabel = useMemo(() => new Date(match.kickoffAt).toLocaleString([], { dateStyle: "medium", timeStyle: "short" }), [match.kickoffAt]);

  async function authHeaders() {
    const token = await getToken();
    const headers: Record<string, string> = {};
    if (token) headers.Authorization = "Bearer " + token;
    return headers;
  }

  async function load() {
    try {
      setLoading(true);
      const response = await fetch("/api/matches/" + matchId + "/prediction", { headers: await authHeaders() });
      if (!response.ok) throw new Error("Could not load predictions");
      const next = await response.json() as PredictionResponse;
      setData(next);
      if (next.myPrediction) {
        setHomeScore(next.myPrediction.homeScore);
        setAwayScore(next.myPrediction.awayScore);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load predictions");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { if (isLoaded) void load(); }, [isLoaded, isSignedIn, matchId]);

  async function submit() {
    if (!isSignedIn) return;
    setSaving(true);
    setSaved(false);
    setError("");
    try {
      const response = await fetch("/api/matches/" + matchId + "/prediction", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await authHeaders()) },
        body: JSON.stringify({ homeScore, awayScore, displayName: user?.fullName || user?.username || "Player", avatarUrl: user?.imageUrl || null }),
      });
      const result = await response.json() as PredictionResponse & { error?: string };
      if (!response.ok) throw new Error(result.error || "Could not save prediction");
      setData(result);
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save prediction");
    } finally {
      setSaving(false);
    }
  }

  const homeLabel = match.homeTeam.shortName || match.homeTeam.name;
  const awayLabel = match.awayTeam.shortName || match.awayTeam.name;
  const hasResult = Boolean(data?.result);

  return <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
    <div className="border-b border-border bg-gradient-to-r from-primary/10 via-transparent to-primary/5 px-4 py-4">
      <div className="flex items-center justify-between gap-3">
        <div><div className="flex items-center gap-2"><Target className="h-4 w-4 text-primary" /><h2 className="text-sm font-black text-foreground">Score prediction</h2></div><p className="mt-1 text-[11px] text-muted-foreground">Predict the final score and earn points for the leaderboard.</p></div>
        {data && <span className="shrink-0 rounded-full bg-primary/10 px-2 py-1 text-[10px] font-bold text-primary">{data.totalPredictions} {data.totalPredictions === 1 ? "prediction" : "predictions"}</span>}
      </div>
    </div>
    <div className="p-4">
      <div className="mb-4 flex items-center justify-center gap-5 text-center">
        <div className="flex min-w-0 flex-1 flex-col items-center gap-2"><TeamBadge team={match.homeTeam} /><span className="w-full truncate text-xs font-bold text-foreground">{homeLabel}</span></div>
        <span className="text-xs font-black text-muted-foreground">VS</span>
        <div className="flex min-w-0 flex-1 flex-col items-center gap-2"><TeamBadge team={match.awayTeam} /><span className="w-full truncate text-xs font-bold text-foreground">{awayLabel}</span></div>
      </div>
      {isOpen ? <>
        <p className="mb-2 text-center text-[10px] font-black uppercase tracking-widest text-muted-foreground">Your prediction</p>
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
          <ScoreStepper value={homeScore} onChange={setHomeScore} label={homeLabel} />
          <span className="text-2xl font-black text-muted-foreground">–</span>
          <ScoreStepper value={awayScore} onChange={setAwayScore} label={awayLabel} />
        </div>
        <p className="mt-3 text-center text-xs text-muted-foreground">{homeLabel} <strong className="text-foreground">{homeScore}–{awayScore}</strong> {awayLabel}</p>
        <button type="button" onClick={submit} disabled={saving || loading} className="mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary text-sm font-black text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : saved ? <Check className="h-4 w-4" /> : <LockKeyhole className="h-4 w-4" />}{saving ? "Saving prediction…" : saved ? "Prediction saved" : data?.myPrediction ? "Update prediction" : "Lock prediction"}</button>
        <p className="mt-2 flex items-center justify-center gap-1 text-[10px] text-muted-foreground"><Clock3 className="h-3 w-3" /> Closes at kickoff · {kickoffLabel}</p>
      </> : !isLoaded ? <div className="flex items-center justify-center py-5 text-sm text-muted-foreground"><Loader2 className="mr-2 h-4 w-4 animate-spin" />Loading account…</div> : !isSignedIn ? <div className="rounded-xl bg-muted/30 px-4 py-4 text-center"><p className="text-sm font-semibold text-foreground">Sign in to predict this match</p><p className="mt-1 text-xs text-muted-foreground">Your score and leaderboard points are saved to your account.</p><Link href="/sign-in"><span className="mt-3 inline-flex h-10 items-center rounded-xl bg-primary px-5 text-xs font-black text-primary-foreground">Sign in</span></Link></div> : data?.locked ? <div className="rounded-xl bg-muted/30 px-4 py-4 text-center"><LockKeyhole className="mx-auto mb-2 h-5 w-5 text-muted-foreground" /><p className="text-sm font-bold text-foreground">Predictions locked</p><p className="mt-1 text-xs text-muted-foreground">This match has reached kick-off.</p></div> : null}
      {data?.myPrediction && <div className="mt-4 rounded-xl border border-primary/20 bg-primary/5 px-3 py-3"><p className="text-[10px] font-black uppercase tracking-widest text-primary">{hasResult ? "Prediction result" : "Your prediction"}</p><div className="mt-1 flex items-center justify-between gap-3"><span className="text-sm font-bold text-foreground">{homeLabel} {data.myPrediction.homeScore}–{data.myPrediction.awayScore} {awayLabel}</span>{hasResult && <span className="flex items-center gap-1 text-sm font-black text-primary"><Trophy className="h-4 w-4" /> +{data.myPrediction.points || 0}</span>}</div>{data.result && <p className="mt-1 text-xs text-muted-foreground">Actual result: {data.result.homeScore}–{data.result.awayScore} · {data.result.label}</p>}</div>}
      {loading ? <div className="mt-5 h-16 animate-pulse rounded-xl bg-muted/40" /> : data && data.distribution.length > 0 ? <div className="mt-5 border-t border-border pt-4"><div className="mb-2 flex items-center justify-between"><p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Community predictions</p><span className="text-[10px] text-muted-foreground">before kick-off: aggregate only</span></div><div className="space-y-2">{data.distribution.slice(0, 5).map((item) => <div key={item.homeScore + "-" + item.awayScore} className="flex items-center gap-2 text-xs"><span className="w-10 font-black tabular-nums text-foreground">{item.homeScore}–{item.awayScore}</span><div className="h-2 flex-1 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary transition-all" style={{ width: Math.max(5, item.percentage || 0) + "%" }} /></div><span className="w-10 text-right text-[10px] font-semibold text-muted-foreground">{item.percentage || 0}%</span></div>)}</div></div> : null}
      {error && <p className="mt-3 text-center text-xs font-semibold text-red-500">{error}</p>}
    </div>
  </section>;
}

function ScoreStepper({ value, onChange, label }: { value: number; onChange: (value: number) => void; label: string }) {
  return <div className="flex flex-col items-center gap-1"><span className="max-w-full truncate text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</span><div className="flex items-center gap-2"><button type="button" aria-label={"Decrease " + label + " score"} onClick={() => onChange(Math.max(0, value - 1))} className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-background text-muted-foreground transition hover:border-primary hover:text-primary"><Minus className="h-4 w-4" /></button><span className="flex h-12 w-12 items-center justify-center rounded-xl border border-primary/30 bg-primary/10 text-2xl font-black tabular-nums text-foreground">{value}</span><button type="button" aria-label={"Increase " + label + " score"} onClick={() => onChange(Math.min(20, value + 1))} className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-background text-muted-foreground transition hover:border-primary hover:text-primary"><Plus className="h-4 w-4" /></button></div></div>;
}
