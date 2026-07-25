import { useGetSquadPlayerStats } from "@workspace/api-client-react";
import { useParams, Link } from "wouter";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronLeft, User, Target, Handshake, Shield, AlertTriangle, CircleX, Swords } from "lucide-react";
import { cn } from "@/lib/utils";

function PlayerAvatar({ photoUrl, name }: { photoUrl?: string | null; name: string }) {
  const initials = name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
  const colors = ["bg-blue-600","bg-emerald-600","bg-purple-600","bg-orange-600","bg-teal-600","bg-red-600","bg-indigo-600","bg-pink-600"];
  const color = colors[name.charCodeAt(0) % colors.length];

  if (photoUrl) {
    return (
      <img
        src={photoUrl}
        alt={name}
        className="w-24 h-24 rounded-full object-cover border-4 border-white/10 shadow-2xl"
        onError={e => { (e.target as HTMLImageElement).style.display = "none"; }}
      />
    );
  }
  return (
    <div className={cn("w-24 h-24 rounded-full flex items-center justify-center text-3xl font-black text-white shadow-2xl border-4 border-white/10", color)}>
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

interface StatCardProps {
  value: number;
  label: string;
  icon: React.ReactNode;
  color?: string;
  bg?: string;
}
function StatCard({ value, label, icon, color = "text-foreground", bg = "bg-card" }: StatCardProps) {
  return (
    <div className={cn("border border-border rounded-2xl p-4 flex flex-col items-center gap-2", bg)}>
      <div className={cn("w-8 h-8 rounded-full flex items-center justify-center", bg === "bg-card" ? "bg-muted" : "bg-white/10")}>
        <span className={cn("w-4 h-4", color)}>{icon}</span>
      </div>
      <span className={cn("text-2xl font-black tabular-nums leading-none", color)}>{value}</span>
      <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider text-center leading-tight">{label}</span>
    </div>
  );
}

export default function PlayerProfilePage() {
  const { id } = useParams();
  const playerId = parseInt(id || "0", 10);

  const { data: stats, isLoading } = useGetSquadPlayerStats(playerId);

  if (isLoading) {
    return (
      <div className="space-y-4 px-4 pt-4 pb-8">
        <Skeleton className="h-8 w-20" />
        <Skeleton className="h-52 w-full rounded-2xl" />
        <div className="grid grid-cols-3 gap-3">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}
        </div>
        <Skeleton className="h-32 w-full rounded-2xl" />
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="py-24 text-center px-4">
        <User className="w-12 h-12 mx-auto mb-4 text-muted-foreground/30" />
        <h2 className="text-xl font-bold mb-3">Player not found</h2>
        <Link href="/players">
          <span className="text-primary text-sm font-semibold cursor-pointer">← Back to Players</span>
        </Link>
      </div>
    );
  }

  const { player, team, playedTeams, tournamentStats } = stats;
  const isCaptain = player.role === "captain";

  return (
    <div className="pb-10">
      {/* Back */}
      <div className="flex items-center gap-2 px-4 pt-4 pb-3">
        <Link href="/players">
          <span className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground cursor-pointer transition-colors">
            <ChevronLeft className="w-4 h-4" />
            Players
          </span>
        </Link>
      </div>

      {/* Hero card */}
      <div className="mx-4 featured-gradient rounded-2xl overflow-hidden border border-white/5 shadow-2xl mb-5">
        <div className="flex items-center gap-5 px-5 py-6">
          <div className="relative shrink-0">
            <PlayerAvatar photoUrl={player.photoUrl} name={player.playerName} />
            {isCaptain && (
              <span className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-amber-400 border-2 border-background flex items-center justify-center text-[10px] font-black text-black">C</span>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-black text-white leading-tight mb-1">{player.playerName}</h1>

            {/* Badges */}
            <div className="flex items-center gap-1.5 flex-wrap mb-3">
              {player.playerNumber && (
                <span className="text-xs font-bold text-primary bg-primary/20 border border-primary/30 rounded-lg px-2 py-0.5">
                  #{player.playerNumber}
                </span>
              )}
              {player.position && (
                <span className={cn("text-xs font-bold border rounded-lg px-2 py-0.5", posBadgeClass(player.position))}>
                  {player.position}
                </span>
              )}
              {isCaptain && (
                <span className="text-xs font-bold text-amber-400 bg-amber-500/15 border border-amber-500/25 rounded-lg px-2 py-0.5">
                  Captain
                </span>
              )}
            </div>

            {/* Current team */}
            {team && (
              <div className="flex items-center gap-2">
                {team.logoUrl && (
                  <img src={team.logoUrl} alt={team.name} className="w-5 h-5 object-contain rounded shrink-0" />
                )}
                <span className="text-sm font-semibold text-white/70">{team.name}</span>
              </div>
            )}
            {player.nationality && (
              <p className="text-xs text-white/40 mt-1">{player.nationality}</p>
            )}
          </div>
        </div>

        {/* Bio */}
        {player.bio && (
          <div className="px-5 pb-5 border-t border-white/10 pt-4">
            <p className="text-sm text-white/60 leading-relaxed">{player.bio}</p>
          </div>
        )}
      </div>

      {/* Stats grid */}
      <div className="px-4 mb-5">
        <h2 className="text-xs font-black text-muted-foreground uppercase tracking-wider mb-3">Career Stats</h2>
        <div className="grid grid-cols-3 gap-3">
          <StatCard
            value={stats.goals}
            label="Goals"
            icon={<Target className="w-4 h-4" />}
            color="text-primary"
          />
          <StatCard
            value={stats.assists}
            label="Assists"
            icon={<Handshake className="w-4 h-4" />}
            color="text-emerald-400"
          />
          <StatCard
            value={stats.appearances}
            label="Appearances"
            icon={<Swords className="w-4 h-4" />}
            color="text-sky-400"
          />
          <StatCard
            value={stats.yellowCards}
            label="Yellow Cards"
            icon={<AlertTriangle className="w-4 h-4" />}
            color="text-yellow-400"
          />
          <StatCard
            value={stats.redCards}
            label="Red Cards"
            icon={<CircleX className="w-4 h-4" />}
            color="text-red-400"
          />
          <StatCard
            value={stats.ownGoals}
            label="Own Goals"
            icon={<Shield className="w-4 h-4" />}
            color="text-muted-foreground"
          />
        </div>
      </div>

      {/* Tournament Breakdown */}
      {tournamentStats && tournamentStats.length > 0 && (
        <div className="px-4 mb-5">
          <h2 className="text-xs font-black text-muted-foreground uppercase tracking-wider mb-3">By Tournament</h2>
          <div className="space-y-2">
            {tournamentStats.map((ts, i) => (
              <div key={i} className="bg-card border border-border rounded-xl px-4 py-3">
                <div className="flex items-center gap-2 mb-2">
                  {ts.tournamentLogo ? (
                    <img src={ts.tournamentLogo} alt={ts.tournamentName} className="w-6 h-6 object-contain rounded shrink-0" />
                  ) : (
                    <div className="w-6 h-6 rounded bg-muted flex items-center justify-center shrink-0">
                      <Shield className="w-3.5 h-3.5 text-muted-foreground" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-foreground truncate">{ts.tournamentName}</p>
                    <p className="text-[10px] text-muted-foreground">{ts.teamName}</p>
                  </div>
                  <span className="text-[10px] font-semibold text-muted-foreground shrink-0">{ts.appearances} apps</span>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { v: ts.goals, label: "Goals", color: "text-primary" },
                    { v: ts.assists, label: "Assists", color: "text-emerald-400" },
                    { v: ts.yellowCards, label: "Yellow", color: "text-yellow-400" },
                    { v: ts.redCards, label: "Red", color: "text-red-400" },
                  ].map(s => (
                    <div key={s.label} className="text-center bg-muted/40 rounded-lg py-2">
                      <p className={cn("text-base font-black tabular-nums leading-none", s.color)}>{s.v}</p>
                      <p className="text-[9px] font-semibold text-muted-foreground mt-0.5">{s.label}</p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Played Teams */}
      {playedTeams && playedTeams.length > 0 && (
        <div className="px-4">
          <h2 className="text-xs font-black text-muted-foreground uppercase tracking-wider mb-3">
            Clubs Played For
          </h2>
          <div className="space-y-2">
            {playedTeams.map(t => (
              <div key={t.id} className="bg-card border border-border rounded-xl flex items-center gap-3 px-4 py-3">
                {t.logoUrl ? (
                  <img src={t.logoUrl} alt={t.name} className="w-9 h-9 object-contain rounded-lg shrink-0" />
                ) : (
                  <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
                    <Shield className="w-4 h-4 text-muted-foreground" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-foreground truncate">{t.name}</p>
                  {t.shortName && t.shortName !== t.name && (
                    <p className="text-[11px] text-muted-foreground">{t.shortName}</p>
                  )}
                </div>
                {t.sport && (
                  <span className={cn(
                    "text-[10px] font-bold border rounded-full px-2 py-0.5 shrink-0 capitalize",
                    t.sport === "football"
                      ? "bg-green-500/10 text-green-400 border-green-500/20"
                      : "bg-blue-500/10 text-blue-400 border-blue-500/20"
                  )}>
                    {t.sport === "football" ? "⚽" : "🥅"} {t.sport}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
