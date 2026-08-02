import { Match } from "@workspace/api-client-react";
import { LivePulse } from "./live-pulse";
import { TeamLogo } from "./team-logo";
import { Link } from "wouter";
import { format } from "date-fns";
import { motion } from "framer-motion";
import { Play } from "lucide-react";
import { useLiveStopwatch } from "@/hooks/use-live-stopwatch";

export function MatchCard({ match }: { match: Match }) {
  const isLive = match.status === "live";
  const stopwatch = useLiveStopwatch(match.id, match.minute, isLive, match.sport, match.clockAnchorMs);

  return (
    <motion.div whileHover={{ scale: 1.01 }} transition={{ duration: 0.15 }}>
      <Link href={`/match/${match.id}`}>
        <div className="featured-gradient rounded-2xl overflow-hidden cursor-pointer border border-white/5 shadow-2xl relative">
          {/* Top bar */}
          <div className="flex items-center justify-between px-4 pt-4 pb-2">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center overflow-hidden">
                <span className="text-[10px] font-bold text-white/70">
                  {match.competition.slice(0, 2).toUpperCase()}
                </span>
              </div>
              <span className="text-sm font-semibold text-white/90">{match.competition}</span>
            </div>
            {isLive ? (
              <span className="flex items-center gap-1.5 bg-red-500/20 border border-red-500/40 text-red-400 text-xs font-bold px-3 py-1 rounded-full">
                <span className="live-dot w-1.5 h-1.5 rounded-full bg-red-500 inline-block" />
                Live
              </span>
            ) : match.status === "scheduled" ? (
              <span className="text-xs font-medium text-white/60">
                {format(new Date(match.kickoffAt), "HH:mm")}
              </span>
            ) : (
              <span className="text-xs font-semibold text-white/50 uppercase">FT</span>
            )}
          </div>

          {/* Score area */}
          <div className="flex items-center justify-between px-6 py-4">
            <div className="flex flex-col items-center gap-2 flex-1">
              <TeamLogo
                url={match.homeTeam.logoUrl}
                name={match.homeTeam.name}
                shortName={match.homeTeam.shortName}
                className="w-16 h-16 drop-shadow-lg"
              />
              <span className="text-sm font-bold text-white text-center leading-tight">{match.homeTeam.shortName}</span>
            </div>

            <div className="flex flex-col items-center justify-center px-4 gap-1 shrink-0">
              {isLive && match.minute && (() => {
                const m = match.minute;
                if (m === "HT") return <span className="text-[11px] font-medium text-yellow-400/80 mb-1">Half Time</span>;
                if (m === "ET_HT") return <span className="text-[11px] font-medium text-orange-400/80 mb-1">ET Half Time</span>;
                if (m === "PSO") return <span className="text-[11px] font-bold text-purple-400/90 mb-1">Penalties</span>;
                const n = Number(m.split("+")[0]);
                const phase = n > 105 ? "ET 2nd" : n > 90 ? "ET 1st" : n > 45 ? "H2" : "H1";
                const timeStr = stopwatch ? `${stopwatch.main}${stopwatch.extra ?? ""}` : `${m}'`;
                return <span className="text-[11px] font-medium text-white/60 mb-1">{phase} · {timeStr}</span>;
              })()}
              {(isLive || match.status === "finished") ? (
                <div className="text-4xl font-black text-white tabular-nums tracking-tight">
                  {match.homeScore} - {match.awayScore}
                </div>
              ) : (
                <div className="flex flex-col items-center gap-1">
                  <div className="text-3xl font-black text-white/80">VS</div>
                  <span className="text-xs text-white/50">{format(new Date(match.kickoffAt), "HH:mm")}</span>
                </div>
              )}
            </div>

            <div className="flex flex-col items-center gap-2 flex-1">
              <TeamLogo
                url={match.awayTeam.logoUrl}
                name={match.awayTeam.name}
                shortName={match.awayTeam.shortName}
                className="w-16 h-16 drop-shadow-lg"
              />
              <span className="text-sm font-bold text-white text-center leading-tight">{match.awayTeam.shortName}</span>
            </div>
          </div>

          {/* Watch button bar */}
          {(isLive && match.streamCount > 0) && (
            <div className="px-4 pb-4">
              <div className="flex items-center justify-center gap-2 bg-white/10 border border-white/10 rounded-xl py-2">
                <Play className="w-3.5 h-3.5 text-white/80" />
                <span className="text-xs font-semibold text-white/80">Watch · {match.streamCount} stream{match.streamCount > 1 ? "s" : ""}</span>
              </div>
            </div>
          )}
        </div>
      </Link>
    </motion.div>
  );
}
