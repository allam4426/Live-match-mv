import { useListPlayers, useListTeams } from "@workspace/api-client-react";
import { Link } from "wouter";
import { Search, User, Users } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useState } from "react";

function PlayerAvatar({ photoUrl, name, size = "md" }: { photoUrl?: string | null; name: string; size?: "sm" | "md" | "lg" }) {
  const initials = name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
  const colors = ["bg-blue-600","bg-emerald-600","bg-purple-600","bg-orange-600","bg-teal-600","bg-red-600","bg-indigo-600","bg-pink-600"];
  const color = colors[name.charCodeAt(0) % colors.length];
  const sz = size === "sm" ? "w-10 h-10 text-sm" : size === "lg" ? "w-16 h-16 text-xl" : "w-12 h-12 text-base";

  if (photoUrl) {
    return (
      <img
        src={photoUrl}
        alt={name}
        className={cn(sz, "rounded-full object-cover border-2 border-white/10 shrink-0")}
        onError={e => { (e.target as HTMLImageElement).style.display = "none"; }}
      />
    );
  }
  return (
    <div className={cn(sz, "rounded-full flex items-center justify-center font-black text-white shrink-0", color)}>
      {initials}
    </div>
  );
}

const POSITION_BADGE: Record<string, string> = {
  GK: "bg-amber-500/15 text-amber-400 border-amber-500/25",
  RB: "bg-blue-500/15 text-blue-400 border-blue-500/25",
  LB: "bg-blue-500/15 text-blue-400 border-blue-500/25",
  CB: "bg-blue-500/15 text-blue-400 border-blue-500/25",
  CDM: "bg-cyan-500/15 text-cyan-400 border-cyan-500/25",
  CM: "bg-cyan-500/15 text-cyan-400 border-cyan-500/25",
  CAM: "bg-cyan-500/15 text-cyan-400 border-cyan-500/25",
  RM: "bg-cyan-500/15 text-cyan-400 border-cyan-500/25",
  LM: "bg-cyan-500/15 text-cyan-400 border-cyan-500/25",
  RW: "bg-emerald-500/15 text-emerald-400 border-emerald-500/25",
  LW: "bg-emerald-500/15 text-emerald-400 border-emerald-500/25",
  CF: "bg-red-500/15 text-red-400 border-red-500/25",
  ST: "bg-red-500/15 text-red-400 border-red-500/25",
};

function posBadgeClass(pos?: string | null) {
  if (!pos) return "bg-muted text-muted-foreground border-border";
  return POSITION_BADGE[pos.toUpperCase()] ?? "bg-muted text-muted-foreground border-border";
}

export default function PlayersPage() {
  const [sport, setSport] = useState<"all" | "football" | "futsal">("all");
  const [teamId, setTeamId] = useState<number | "all">("all");
  const [q, setQ] = useState("");

  const { data: teams } = useListTeams(sport !== "all" ? { sport } : undefined);
  const { data: players, isLoading } = useListPlayers({
    ...(sport !== "all" && { sport }),
    ...(teamId !== "all" && { teamId }),
    ...(q.trim() && { q: q.trim() }),
  });

  const filtered = players ?? [];

  return (
    <div className="pb-6">
      {/* Header */}
      <div className="px-4 pt-5 pb-4">
        <div className="flex items-center gap-2 mb-1">
          <Users className="w-5 h-5 text-primary" />
          <h1 className="text-xl font-black text-foreground">Players</h1>
        </div>
        <p className="text-xs text-muted-foreground">{filtered.length} player{filtered.length !== 1 ? "s" : ""} found</p>
      </div>

      {/* Search */}
      <div className="px-4 mb-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="Search players, teams, nationality…"
            className="w-full bg-card border border-border rounded-xl pl-9 pr-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50"
          />
        </div>
      </div>

      {/* Sport filter */}
      <div className="flex gap-2 px-4 mb-3 overflow-x-auto pb-1">
        {(["all", "football", "futsal"] as const).map(s => (
          <button
            key={s}
            onClick={() => { setSport(s); setTeamId("all"); }}
            className={cn(
              "rounded-full px-3 py-1.5 text-xs font-semibold border whitespace-nowrap transition-all capitalize",
              sport === s ? "bg-primary text-white border-primary" : "bg-card text-muted-foreground border-border"
            )}
          >
            {s === "all" ? "All Sports" : s === "football" ? "⚽ Football" : "🥅 Futsal"}
          </button>
        ))}
      </div>

      {/* Team filter */}
      {teams && teams.length > 0 && (
        <div className="flex gap-2 px-4 mb-4 overflow-x-auto pb-1">
          <button
            onClick={() => setTeamId("all")}
            className={cn(
              "rounded-full px-3 py-1.5 text-xs font-semibold border whitespace-nowrap transition-all",
              teamId === "all" ? "bg-primary text-white border-primary" : "bg-card text-muted-foreground border-border"
            )}
          >
            All Teams
          </button>
          {teams.map(t => (
            <button
              key={t.id}
              onClick={() => setTeamId(t.id)}
              className={cn(
                "rounded-full px-3 py-1.5 text-xs font-semibold border whitespace-nowrap transition-all flex items-center gap-1.5",
                teamId === t.id ? "bg-primary text-white border-primary" : "bg-card text-muted-foreground border-border"
              )}
            >
              {t.logoUrl && <img src={t.logoUrl} alt="" className="w-3.5 h-3.5 object-contain rounded" />}
              {t.shortName || t.name}
            </button>
          ))}
        </div>
      )}

      {/* Player grid */}
      {isLoading ? (
        <div className="px-4 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-36 rounded-2xl" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-16 text-center px-4">
          <User className="w-10 h-10 mx-auto mb-3 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">No players found</p>
          {q && <p className="text-xs text-muted-foreground/60 mt-1">Try a different search term</p>}
        </div>
      ) : (
        <div className="px-4 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
          {filtered.map(player => (
            <Link key={player.id} href={`/player/${player.id}`}>
              <div className="bg-card border border-border rounded-2xl p-3.5 cursor-pointer hover:border-primary/40 active:scale-[0.97] transition-all">
                {/* Photo */}
                <div className="flex justify-center mb-3">
                  <div className="relative">
                    <PlayerAvatar photoUrl={player.photoUrl} name={player.playerName} size="lg" />
                    {player.role === "captain" && (
                      <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-amber-400 border-2 border-background flex items-center justify-center text-[9px] font-black text-black">C</span>
                    )}
                  </div>
                </div>

                {/* Name */}
                <p className="text-sm font-black text-foreground text-center leading-tight line-clamp-2 mb-1">
                  {player.playerName}
                </p>

                {/* Number + Position */}
                <div className="flex items-center justify-center gap-1.5 flex-wrap">
                  {player.playerNumber && (
                    <span className="text-[10px] font-bold text-primary bg-primary/10 border border-primary/20 rounded px-1.5 py-0.5">
                      #{player.playerNumber}
                    </span>
                  )}
                  {player.position && (
                    <span className={cn("text-[10px] font-bold border rounded px-1.5 py-0.5", posBadgeClass(player.position))}>
                      {player.position}
                    </span>
                  )}
                </div>

                {/* Team */}
                <div className="flex items-center justify-center gap-1 mt-2">
                  {player.teamLogoUrl && (
                    <img src={player.teamLogoUrl} alt="" className="w-3.5 h-3.5 object-contain rounded shrink-0" />
                  )}
                  <span className="text-[10px] text-muted-foreground truncate">
                    {player.teamShortName || player.teamName}
                  </span>
                </div>

                {/* Nationality flag */}
                {player.nationality && (
                  <p className="text-[10px] text-muted-foreground/60 text-center mt-0.5">{player.nationality}</p>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
