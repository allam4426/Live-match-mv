import { Match } from "@workspace/api-client-react";
import { TeamLogo } from "./team-logo";
import { Link } from "wouter";
import { format } from "date-fns";
import { Play, MapPin, Star } from "lucide-react";
import { motion } from "framer-motion";

function MinuteBadge({ minute, status }: { minute?: string | null; status: string }) {
  if (status !== "live") return null;
  if (minute === "HT") return (
    <span className="text-xs font-bold text-yellow-300 tracking-wide">HALF TIME</span>
  );
  const m = minute?.split("+")[0];
  const half = Number(m) > 45 ? "2ND" : "1ST";
  return (
    <span className="text-xs font-semibold text-white/70">{half} · {minute}'</span>
  );
}

export function SpotlightCard({ match }: { match: Match }) {
  const isLive = match.status === "live";
  const isFinished = match.status === "finished";
  const isScheduled = match.status === "scheduled";

  return (
    <motion.div whileHover={{ scale: 1.01 }} transition={{ duration: 0.15 }}>
      <Link href={`/match/${match.id}`}>
        <div className="spotlight-gradient rounded-2xl overflow-hidden cursor-pointer border border-white/8 shadow-2xl relative mx-4">

          {/* Top bar: label + status */}
          <div className="flex items-center justify-between px-4 pt-4 pb-0">
            {/* Spotlight badge */}
            <div className="flex items-center gap-1.5 bg-white/10 rounded-full px-2.5 py-1">
              <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
              <span className="text-[10px] font-black text-white/90 uppercase tracking-widest">Spotlight</span>
            </div>

            {/* Status chip */}
            {isLive ? (
              <span className="flex items-center gap-1.5 bg-red-500/20 border border-red-500/40 text-red-400 text-xs font-bold px-3 py-1 rounded-full">
                <span className="live-dot w-1.5 h-1.5 rounded-full bg-red-500 inline-block" />
                Live
              </span>
            ) : isScheduled ? (
              <span className="text-xs font-semibold text-white/60 bg-white/8 rounded-full px-2.5 py-1">
                {format(new Date(match.kickoffAt), "HH:mm")}
              </span>
            ) : (
              <span className="text-[10px] font-bold text-white/40 uppercase tracking-wide">Full Time</span>
            )}
          </div>

          {/* Competition */}
          <div className="flex items-center justify-center gap-1.5 pt-2 pb-0">
            <span className="text-[11px] font-semibold text-white/50 text-center">{match.competition}</span>
          </div>

          {/* Teams + Score */}
          <div className="flex items-center px-5 py-5 gap-2">
            {/* Home team */}
            <div className="flex-1 flex flex-col items-center gap-2.5">
              <div className="relative">
                <div className="absolute inset-0 rounded-full bg-white/5 blur-md scale-125" />
                <TeamLogo
                  url={match.homeTeam.logoUrl}
                  name={match.homeTeam.name}
                  shortName={match.homeTeam.shortName}
                  className="w-[72px] h-[72px] relative drop-shadow-xl"
                />
              </div>
              <span className="text-[13px] font-bold text-white text-center leading-tight max-w-[90px]">
                {match.homeTeam.name}
              </span>
            </div>

            {/* Score / VS */}
            <div className="flex flex-col items-center justify-center shrink-0 gap-1 px-2">
              <MinuteBadge minute={match.minute} status={match.status} />
              {(isLive || isFinished) ? (
                <div className="text-[42px] font-black text-white tabular-nums tracking-tight leading-none">
                  {match.homeScore}<span className="text-white/30 mx-1">–</span>{match.awayScore}
                </div>
              ) : (
                <div className="flex flex-col items-center gap-0.5">
                  <span className="text-[28px] font-black text-white/40 leading-none">VS</span>
                  <span className="text-xs text-white/40">{format(new Date(match.kickoffAt), "d MMM")}</span>
                </div>
              )}
            </div>

            {/* Away team */}
            <div className="flex-1 flex flex-col items-center gap-2.5">
              <div className="relative">
                <div className="absolute inset-0 rounded-full bg-white/5 blur-md scale-125" />
                <TeamLogo
                  url={match.awayTeam.logoUrl}
                  name={match.awayTeam.name}
                  shortName={match.awayTeam.shortName}
                  className="w-[72px] h-[72px] relative drop-shadow-xl"
                />
              </div>
              <span className="text-[13px] font-bold text-white text-center leading-tight max-w-[90px]">
                {match.awayTeam.name}
              </span>
            </div>
          </div>

          {/* Footer: venue + watch */}
          <div className="flex items-center justify-between px-4 pb-4 gap-3">
            {match.venue ? (
              <div className="flex items-center gap-1 min-w-0">
                <MapPin className="w-3 h-3 text-white/30 shrink-0" />
                <span className="text-[10px] text-white/35 truncate">{match.venue}</span>
              </div>
            ) : <div />}

            {isLive && match.streamCount > 0 && (
              <div className="flex items-center gap-1.5 bg-white/10 border border-white/10 rounded-xl px-3 py-1.5 shrink-0">
                <Play className="w-3 h-3 text-white/80 fill-white/80" />
                <span className="text-[11px] font-semibold text-white/80">
                  Watch · {match.streamCount}
                </span>
              </div>
            )}
            {!isLive && match.streamCount > 0 && (
              <div className="flex items-center gap-1.5 bg-white/8 rounded-xl px-3 py-1.5 shrink-0">
                <Play className="w-3 h-3 text-white/50" />
                <span className="text-[11px] font-medium text-white/50">
                  {isFinished ? "Replay" : "Stream available"}
                </span>
              </div>
            )}
          </div>

          {/* Decorative glow orbs */}
          <div className="absolute -top-6 -left-6 w-32 h-32 rounded-full bg-primary/10 blur-2xl pointer-events-none" />
          <div className="absolute -bottom-6 -right-6 w-32 h-32 rounded-full bg-primary/8 blur-2xl pointer-events-none" />
        </div>
      </Link>
    </motion.div>
  );
}
