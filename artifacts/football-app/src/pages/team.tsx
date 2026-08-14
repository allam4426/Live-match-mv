import { useParams, Link, useLocation } from "wouter";
import {
  useGetTeam,
  useGetTeamSquad,
  useListTrophies,
  getGetTeamQueryKey,
  getGetTeamSquadQueryKey,
} from "@workspace/api-client-react";
import { useState, useEffect } from "react";
import { ChevronLeft, Trophy, Info } from "lucide-react";
import { TeamLogo } from "@/components/team-logo";
import { BannerSlot } from "@/components/banner-slot";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

type TeamMatch = {
  id: number;
  homeScore: number;
  awayScore: number;
  status: string;
  kickoffAt: string;
  competition: string;
  minute: string | null;
  homeTeam: { id: number; name: string; logoUrl: string; shortName: string | null } | null;
  awayTeam: { id: number; name: string; logoUrl: string; shortName: string | null } | null;
  tournamentId: number | null;
};

type TeamTournament = {
  id: number;
  name: string;
  logoUrl: string | null;
  sport: string;
  season: string | null;
};

type TournamentStat = {
  tournamentId: number;
  tournamentName: string;
  tournamentLogo: string | null;
  tournamentSport: string;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  goalsScored: number;
  goalsConceded: number;
  yellowCards: number;
  redCards: number;
  winRate: number;
  goalPerGame: number;
};

function useTeamMatches(teamId: number) {
  const [data, setData] = useState<TeamMatch[] | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!teamId) return;
    setLoading(true);
    fetch(`/api/teams/${teamId}/matches`)
      .then(r => r.json())
      .then(setData)
      .catch(() => setData([]))
      .finally(() => setLoading(false));
  }, [teamId]);
  return { data, loading };
}

function useTeamTournaments(teamId: number) {
  const [data, setData] = useState<TeamTournament[] | null>(null);
  useEffect(() => {
    if (!teamId) return;
    fetch(`/api/teams/${teamId}/tournaments`)
      .then(r => r.json())
      .then(setData)
      .catch(() => setData([]));
  }, [teamId]);
  return { data };
}

function useTeamStats(teamId: number) {
  const [data, setData] = useState<TournamentStat[] | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!teamId) return;
    setLoading(true);
    fetch(`/api/teams/${teamId}/stats`)
      .then(r => r.json())
      .then(setData)
      .catch(() => setData([]))
      .finally(() => setLoading(false));
  }, [teamId]);
  return { data, loading };
}

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "results", label: "Results" },
  { id: "fixtures", label: "Fixtures" },
  { id: "players", label: "Players" },
  { id: "news", label: "News" },
] as const;

type TabId = (typeof TABS)[number]["id"];

function StatCard({ value, label, full }: { value: string | number; label: string; full?: boolean }) {
  return (
    <div className={cn(
      "bg-card rounded-xl border border-border/60 flex flex-col items-center justify-center py-5 gap-1",
      full ? "col-span-2" : "col-span-1"
    )}>
      <span className="text-2xl font-black text-foreground tabular-nums">{value}</span>
      <span className="text-[11px] text-muted-foreground font-medium">{label}</span>
    </div>
  );
}

function OverviewTab({ stats, loading }: { stats: TournamentStat[] | null; loading: boolean }) {
  if (loading) {
    return (
      <div className="space-y-4">
        {[0, 1].map(i => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-6 w-48" />
            <div className="grid grid-cols-2 gap-2">
              {[0, 1, 2, 3, 4, 5].map(j => <Skeleton key={j} className="h-20 rounded-xl" />)}
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (!stats || stats.length === 0) {
    return (
      <div className="py-16 text-center text-muted-foreground">
        <Trophy className="w-10 h-10 mx-auto mb-3 opacity-20" />
        <p className="text-sm">No match stats yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {stats.map(s => (
        <div key={s.tournamentId}>
          <div className="flex items-center gap-2.5 mb-3">
            {s.tournamentLogo ? (
              <img src={s.tournamentLogo} alt={s.tournamentName} className="w-8 h-8 object-contain rounded-lg" />
            ) : (
              <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center shrink-0">
                <Trophy className="w-4 h-4 text-primary" />
              </div>
            )}
            <div>
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[10px] font-bold uppercase text-primary/80 tracking-wide">
                  {s.tournamentSport === "futsal" ? "Futsal" : "Football"}
                </span>
                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-muted text-muted-foreground">Finished</span>
              </div>
              <p className="text-sm font-bold text-foreground leading-tight">{s.tournamentName}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <StatCard value={s.played} label="Total matches" />
            <StatCard value={s.wins} label="Wins" />
            <StatCard value={s.draws} label="Draws" />
            <StatCard value={s.losses} label="Loss" />
            <StatCard value={`${s.winRate}%`} label="Win %" full />
            <StatCard value={s.yellowCards} label="Yellow cards" />
            <StatCard value={s.redCards} label="Red cards" />
            <StatCard value={s.goalsScored} label="Goals scored" />
            <StatCard value={s.goalsConceded} label="Goals conceded" />
            <StatCard value={s.goalPerGame} label="Goal per game" full />
          </div>
        </div>
      ))}
    </div>
  );
}

function MatchResultRow({ match, teamId }: { match: TeamMatch; teamId: number }) {
  const isHome = match.homeTeam?.id === teamId;
  const home = match.homeTeam;
  const away = match.awayTeam;

  return (
    <Link href={`/match/${match.id}`}>
      <div className="bg-card rounded-xl border border-border/60 overflow-hidden px-4 py-3 cursor-pointer hover:bg-muted/20 transition-colors">
        <div className="flex items-center gap-3">
          <div className="flex-1 flex items-center gap-2 min-w-0">
            <TeamLogo url={home?.logoUrl ?? ""} name={home?.name ?? "?"} shortName={home?.shortName ?? null} className="w-7 h-7 shrink-0" />
            <span className={cn(
              "text-sm font-semibold truncate",
              isHome ? "text-foreground" : "text-muted-foreground"
            )}>{home?.name ?? "?"}</span>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <span className="text-base font-black tabular-nums text-foreground">{match.homeScore}</span>
            <span className="text-muted-foreground font-bold mx-0.5">–</span>
            <span className="text-base font-black tabular-nums text-foreground">{match.awayScore}</span>
          </div>
          <div className="w-8 text-right shrink-0">
            <span className="text-[10px] font-bold text-muted-foreground">
              {match.status === "finished" ? "FT" : match.status === "live" ? "LIVE" : ""}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-3 mt-1">
          <div className="flex-1 flex items-center gap-2 min-w-0">
            <TeamLogo url={away?.logoUrl ?? ""} name={away?.name ?? "?"} shortName={away?.shortName ?? null} className="w-7 h-7 shrink-0" />
            <span className={cn(
              "text-sm font-semibold truncate",
              !isHome ? "text-foreground" : "text-muted-foreground"
            )}>{away?.name ?? "?"}</span>
          </div>
        </div>
      </div>
    </Link>
  );
}

function FixtureRow({ match }: { match: TeamMatch }) {
  const home = match.homeTeam;
  const away = match.awayTeam;
  const kickoff = new Date(match.kickoffAt);

  return (
    <Link href={`/match/${match.id}`}>
      <div className="bg-card rounded-xl border border-border/60 overflow-hidden px-4 py-3 cursor-pointer hover:bg-muted/20 transition-colors">
        <div className="flex items-center gap-3">
          <div className="flex-1 flex items-center gap-2 min-w-0">
            <TeamLogo url={home?.logoUrl ?? ""} name={home?.name ?? "?"} shortName={home?.shortName ?? null} className="w-7 h-7 shrink-0" />
            <span className="text-sm font-semibold truncate text-foreground">{home?.name ?? "?"}</span>
          </div>
          <div className="shrink-0 text-center">
            <p className="text-xs font-black text-primary tabular-nums">{format(kickoff, "HH:mm")}</p>
            <p className="text-[9px] text-muted-foreground">{format(kickoff, "d MMM")}</p>
          </div>
          <div className="flex-1 flex items-center gap-2 justify-end min-w-0">
            <span className="text-sm font-semibold truncate text-right text-foreground">{away?.name ?? "?"}</span>
            <TeamLogo url={away?.logoUrl ?? ""} name={away?.name ?? "?"} shortName={away?.shortName ?? null} className="w-7 h-7 shrink-0" />
          </div>
        </div>
        <p className="text-[10px] text-muted-foreground mt-1 text-center">{match.competition}</p>
      </div>
    </Link>
  );
}

function ResultsTab({ matches, teamId, loading }: { matches: TeamMatch[]; teamId: number; loading: boolean }) {
  const results = matches.filter(m => m.status === "finished" || m.status === "live")
    .sort((a, b) => new Date(b.kickoffAt).getTime() - new Date(a.kickoffAt).getTime());

  if (loading) {
    return <div className="space-y-2">{[0,1,2,3].map(i => <Skeleton key={i} className="h-20 rounded-xl" />)}</div>;
  }
  if (results.length === 0) {
    return (
      <div className="py-16 text-center text-muted-foreground">
        <p className="text-sm">No results yet</p>
      </div>
    );
  }

  const byDate: Record<string, { matches: TeamMatch[]; competition: string }> = {};
  for (const m of results) {
    const dk = format(new Date(m.kickoffAt), "MMMM d, yyyy");
    if (!byDate[dk]) byDate[dk] = { matches: [], competition: m.competition };
    byDate[dk]!.matches.push(m);
  }

  return (
    <div className="space-y-4">
      {Object.entries(byDate).map(([date, { matches: ms, competition }]) => (
        <div key={date}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide">{date}</span>
            <span className="text-[11px] text-muted-foreground">{competition}</span>
          </div>
          <div className="space-y-2">
            {ms.map(m => <MatchResultRow key={m.id} match={m} teamId={teamId} />)}
          </div>
        </div>
      ))}
    </div>
  );
}

function FixturesTab({ matches, loading }: { matches: TeamMatch[]; loading: boolean }) {
  const fixtures = matches.filter(m => m.status === "scheduled")
    .sort((a, b) => new Date(a.kickoffAt).getTime() - new Date(b.kickoffAt).getTime());

  if (loading) {
    return <div className="space-y-2">{[0,1,2].map(i => <Skeleton key={i} className="h-20 rounded-xl" />)}</div>;
  }
  if (fixtures.length === 0) {
    return (
      <div className="py-16 text-center text-muted-foreground">
        <p className="text-sm">No upcoming fixtures</p>
      </div>
    );
  }

  const byDate: Record<string, TeamMatch[]> = {};
  for (const m of fixtures) {
    const dk = format(new Date(m.kickoffAt), "MMMM d, yyyy");
    if (!byDate[dk]) byDate[dk] = [];
    byDate[dk]!.push(m);
  }

  return (
    <div className="space-y-4">
      {Object.entries(byDate).map(([date, ms]) => (
        <div key={date}>
          <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide mb-2">{date}</p>
          <div className="space-y-2">
            {ms.map(m => <FixtureRow key={m.id} match={m} />)}
          </div>
        </div>
      ))}
    </div>
  );
}

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

function PlayersTab({ squad, loading }: { squad: Array<{ id: number; playerName: string; position?: string | null; playerNumber?: string | null; nationality?: string | null }> | undefined; loading: boolean }) {
  if (loading) {
    return (
      <div className="grid grid-cols-2 gap-4">
        {[0,1,2,3,4,5].map(i => <Skeleton key={i} className="h-36 rounded-xl" />)}
      </div>
    );
  }
  if (!squad || squad.length === 0) {
    return (
      <div className="py-16 text-center text-muted-foreground">
        <p className="text-sm">No squad registered</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-4">
      {squad.map(player => (
        <Link key={player.id} href={`/player/${player.id}`}>
          <div className="flex flex-col items-center gap-2 py-4 cursor-pointer">
            <div className="w-[72px] h-[72px] rounded-full bg-primary flex items-center justify-center shadow-lg shadow-primary/25">
              <span className="text-xl font-black text-white tracking-wide">
                {getInitials(player.playerName)}
              </span>
            </div>
            <div className="text-center">
              <p className="text-sm font-bold text-foreground leading-tight">{player.playerName}</p>
              {player.position && (
                <p className="text-[11px] text-muted-foreground mt-0.5">{player.position}</p>
              )}
              {player.playerNumber && (
                <p className="text-[11px] text-muted-foreground">#{player.playerNumber}</p>
              )}
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}

function NewsTab() {
  return (
    <div className="py-16 text-center text-muted-foreground">
      <Newspaper className="w-10 h-10 mx-auto mb-3 opacity-20" />
      <p className="text-sm font-medium">News coming soon</p>
    </div>
  );
}

function Newspaper({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
      <path d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function TeamProfilePage() {
  const { id } = useParams();
  const [, navigate] = useLocation();
  const teamId = parseInt(id || "0", 10);
  const [tab, setTab] = useState<TabId>("overview");

  const { data: team, isLoading: teamLoading } = useGetTeam(teamId, {
    query: { enabled: !!teamId, queryKey: getGetTeamQueryKey(teamId) },
  });
  const { data: squad, isLoading: squadLoading } = useGetTeamSquad(teamId, {
    query: { enabled: !!teamId, queryKey: getGetTeamSquadQueryKey(teamId) },
  });
  const { data: matches, loading: matchesLoading } = useTeamMatches(teamId);
  const { data: tournaments } = useTeamTournaments(teamId);
  const { data: trophies } = useListTrophies({ teamId: teamId ? Number(teamId) : undefined });
  const { data: stats, loading: statsLoading } = useTeamStats(teamId);

  if (teamLoading) {
    return (
      <div className="space-y-4 px-4 py-6">
        <Skeleton className="h-8 w-24" />
        <Skeleton className="h-28 w-full rounded-2xl" />
        <Skeleton className="h-48 w-full rounded-2xl" />
      </div>
    );
  }

  if (!team) {
    return (
      <div className="py-24 text-center px-4">
        <h2 className="text-xl font-bold mb-3">Team not found</h2>
        <Link href="/"><span className="text-primary text-sm font-semibold cursor-pointer">Go Home</span></Link>
      </div>
    );
  }

  return (
    <div className="pb-8">
      {/* Header */}
      <div className="px-4 pt-4 pb-5">
        <button
          onClick={() => window.history.back()}
          className="w-9 h-9 rounded-full bg-muted/60 border border-border/60 flex items-center justify-center mb-4 hover:bg-muted transition-colors"
        >
          <ChevronLeft className="w-5 h-5 text-foreground" />
        </button>
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 bg-white rounded-xl shadow-md p-1.5 shrink-0 flex items-center justify-center">
            <TeamLogo
              url={team.logoUrl ?? ""}
              name={team.name}
              shortName={team.shortName ?? null}
              className="w-full h-full"
            />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl font-black text-foreground leading-tight truncate">{team.name}</h1>
            {team.shortName && (
              <p className="text-sm text-muted-foreground mt-0.5">{team.shortName}</p>
            )}
            {team.country && (
              <p className="text-sm text-muted-foreground">{team.country}</p>
            )}
          </div>
        </div>
      </div>

      {/* Trophy Cabinet */}
      {(trophies?.length ?? 0) > 0 && (
        <div className="px-4 mb-4">
          <div className="bg-card rounded-xl border border-border overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <span className="text-sm font-black text-foreground">Trophy Cabinet</span>
              <Info className="w-4 h-4 text-muted-foreground" />
            </div>
            <div className="divide-y divide-border/40">
              {(trophies ?? []).map(t => (
                <div key={t.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="w-10 h-10 rounded-lg bg-muted/50 flex items-center justify-center shrink-0 overflow-hidden">
                    {t.imageUrl ? (
                      <img src={t.imageUrl} alt={t.title} className="w-9 h-9 object-contain" />
                    ) : (
                      <Trophy className="w-5 h-5 text-primary" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">{t.title}</p>
                    {t.season && <p className="text-[11px] text-muted-foreground">{t.season}</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Banner */}
      <BannerSlot position="top_home" />

      {/* Tabs */}
      <div className="sticky top-12 z-40 bg-background border-b border-border mt-4">
        <div className="flex overflow-x-auto scrollbar-none">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                "flex-shrink-0 px-4 py-3 text-sm font-semibold transition-colors border-b-2 -mb-px",
                tab === t.id
                  ? "text-primary border-primary"
                  : "text-muted-foreground border-transparent hover:text-foreground"
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div className="px-4 pt-4">
        {tab === "overview" && (
          <OverviewTab stats={stats ?? null} loading={statsLoading} />
        )}
        {tab === "results" && (
          <ResultsTab matches={matches ?? []} teamId={teamId} loading={matchesLoading} />
        )}
        {tab === "fixtures" && (
          <FixturesTab matches={matches ?? []} loading={matchesLoading} />
        )}
        {tab === "players" && (
          <PlayersTab squad={squad} loading={squadLoading} />
        )}
        {tab === "news" && <NewsTab />}
      </div>
    </div>
  );
}
