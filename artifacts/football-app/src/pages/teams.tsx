import { useListTeams, getListTeamsQueryKey } from "@workspace/api-client-react";
import { Link } from "wouter";
import { useState } from "react";
import { Search, Users } from "lucide-react";
import { TeamLogo } from "@/components/team-logo";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const SPORTS = [
  { id: "all", label: "All" },
  { id: "football", label: "Football" },
  { id: "futsal", label: "Futsal" },
] as const;

export default function TeamsPage() {
  const [sport, setSport] = useState<"all" | "football" | "futsal">("all");
  const [search, setSearch] = useState("");

  const { data: teams, isLoading } = useListTeams(
    { sport: sport === "all" ? undefined : sport },
    { query: { queryKey: getListTeamsQueryKey({ sport: sport === "all" ? undefined : sport }) } }
  );

  const filtered = (teams ?? []).filter(t =>
    !search || t.name.toLowerCase().includes(search.toLowerCase()) ||
    (t.shortName?.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="pb-8">
      <div className="px-4 pt-5 pb-4">
        <h1 className="text-2xl font-black text-foreground">Teams</h1>
      </div>

      {/* Search */}
      <div className="px-4 mb-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search teams…"
            className="w-full bg-card border border-border rounded-xl pl-9 pr-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary transition-colors"
          />
        </div>
      </div>

      {/* Sport filter */}
      <div className="flex gap-2 px-4 mb-4">
        {SPORTS.map(s => (
          <button
            key={s.id}
            onClick={() => setSport(s.id)}
            className={cn(
              "px-4 py-1.5 rounded-full text-sm font-semibold transition-colors",
              sport === s.id
                ? "bg-primary text-white"
                : "bg-card border border-border text-muted-foreground hover:text-foreground"
            )}
          >
            {s.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="px-4 grid grid-cols-2 gap-3">
          {[0,1,2,3,4,5].map(i => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-16 text-center px-4 text-muted-foreground">
          <Users className="w-10 h-10 mx-auto mb-3 opacity-20" />
          <p className="text-sm">No teams found</p>
        </div>
      ) : (
        <div className="px-4 grid grid-cols-2 gap-3">
          {filtered.map(team => (
            <Link key={team.id} href={`/team/${team.id}`}>
              <div className="bg-card border border-border rounded-xl p-4 flex flex-col items-center gap-3 cursor-pointer hover:border-primary/40 transition-colors active:scale-95">
                <div className="w-14 h-14 bg-white rounded-xl p-1.5 flex items-center justify-center shadow-sm shrink-0">
                  <TeamLogo
                    url={team.logoUrl ?? ""}
                    name={team.name}
                    shortName={team.shortName ?? null}
                    className="w-full h-full"
                  />
                </div>
                <div className="text-center min-w-0 w-full">
                  <p className="text-sm font-bold text-foreground leading-tight line-clamp-2">{team.name}</p>
                  {team.shortName && (
                    <p className="text-[11px] text-muted-foreground mt-0.5">{team.shortName}</p>
                  )}
                  <span className={cn(
                    "inline-block mt-1 text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full",
                    team.sport === "futsal"
                      ? "bg-violet-500/15 text-violet-400"
                      : "bg-emerald-500/15 text-emerald-400"
                  )}>
                    {team.sport === "futsal" ? "Futsal" : "Football"}
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
