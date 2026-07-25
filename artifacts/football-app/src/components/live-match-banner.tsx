import { type Match } from "@workspace/api-client-react";
import { TeamLogo } from "./team-logo";
import { Link } from "wouter";
import { Play, MapPin, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

function halfLabel(minute: string | null | undefined, sport?: string | null): string {
  if (!minute) return "";
  if (minute === "HT") return "HT";
  if (minute === "PSO") return "PSO";
  const base = parseInt(minute.split("+")[0] ?? "0", 10);
  if (isNaN(base)) return "";
  const isFutsal = sport === "futsal";
  if (isFutsal) {
    if (base > 40) return "ET";
    if (base > 20) return "2ND";
    return "1ST";
  }
  if (base > 105) return "ET2";
  if (base > 90) return "ET1";
  if (base > 45) return "2ND";
  return "1ST";
}

function LiveMinute({ minute, sport }: { minute?: string | null; sport?: string | null }) {
  const half = halfLabel(minute, sport);
  const isHT = minute === "HT" || minute === "PSO";
  return (
    <div className="flex items-center justify-center gap-1.5 mb-1">
      {!isHT && half && (
        <span className="text-[10px] font-black text-teal-300/80 uppercase tracking-widest bg-teal-300/10 px-2 py-0.5 rounded-full">
          {half}
        </span>
      )}
      <span className={cn(
        "text-[11px] font-black tabular-nums tracking-wide",
        isHT ? "text-yellow-300" : "text-white/70"
      )}>
        {isHT ? (minute === "PSO" ? "PSO" : "HALF TIME") : `${minute}'`}
      </span>
    </div>
  );
}

function BannerCard({ match, dim }: { match: Match; dim?: boolean }) {
  return (
    <Link href={`/match/${match.id}`}>
      <div className={cn(
        "relative overflow-hidden cursor-pointer transition-all active:scale-[0.99]",
        "featured-gradient rounded-2xl border border-white/10 shadow-2xl",
        dim && "opacity-50"
      )}>
        {/* Glow orbs */}
        <div className="absolute -top-8 -left-8 w-40 h-40 rounded-full bg-teal-400/10 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-8 -right-8 w-40 h-40 rounded-full bg-cyan-400/8 blur-3xl pointer-events-none" />

        {/* Top bar */}
        <div className="flex items-center justify-between px-4 pt-4 pb-0">
          <span className="text-[11px] font-bold text-white/60 truncate max-w-[200px]">
            {match.competition}
          </span>
          <span className="flex items-center gap-1.5 bg-red-500/20 border border-red-500/40 text-red-400 text-[10px] font-black px-2.5 py-0.5 rounded-full shrink-0 ml-2">
            <span className="live-dot w-1.5 h-1.5 rounded-full bg-red-500 inline-block" />
            Live
          </span>
        </div>

        {/* Minute */}
        <div className="pt-2.5 px-4">
          <LiveMinute minute={match.minute} sport={match.sport} />
        </div>

        {/* Teams + Score */}
        <div className="flex items-center px-5 pb-4 gap-2">
          {/* Home */}
          <div className="flex-1 flex flex-col items-center gap-2">
            <TeamLogo
              url={match.homeTeam.logoUrl}
              name={match.homeTeam.name}
              shortName={match.homeTeam.shortName}
              className="w-[60px] h-[60px] drop-shadow-xl"
            />
            <span className="text-[12px] font-bold text-white text-center leading-tight max-w-[90px] line-clamp-2">
              {match.homeTeam.name}
            </span>
          </div>

          {/* Score */}
          <div className="flex flex-col items-center shrink-0 px-2">
            <div className="text-[46px] font-black text-white tabular-nums tracking-tight leading-none">
              {match.homeScore}
              <span className="text-white/25 mx-1.5">–</span>
              {match.awayScore}
            </div>
          </div>

          {/* Away */}
          <div className="flex-1 flex flex-col items-center gap-2">
            <TeamLogo
              url={match.awayTeam.logoUrl}
              name={match.awayTeam.name}
              shortName={match.awayTeam.shortName}
              className="w-[60px] h-[60px] drop-shadow-xl"
            />
            <span className="text-[12px] font-bold text-white text-center leading-tight max-w-[90px] line-clamp-2">
              {match.awayTeam.name}
            </span>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 pb-4 gap-3">
          {match.venue ? (
            <div className="flex items-center gap-1 min-w-0">
              <MapPin className="w-3 h-3 text-white/30 shrink-0" />
              <span className="text-[10px] text-white/35 truncate">{match.venue}</span>
            </div>
          ) : <div />}
          {match.streamCount > 0 && (
            <div className="flex items-center gap-1.5 bg-white/10 border border-white/10 rounded-xl px-3 py-1.5 shrink-0">
              <Play className="w-3 h-3 text-white/80 fill-white/80" />
              <span className="text-[11px] font-semibold text-white/80">Watch · {match.streamCount}</span>
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}

export function LiveMatchBanner({ matches }: { matches: Match[] }) {
  const current = matches[0];
  if (!current) return null;
  const extra = matches.length - 1;

  return (
    <div className="px-4 pt-4 pb-2">
      <BannerCard match={current} />
      {extra > 0 && (
        <div className="flex justify-center mt-2">
          <Link href="/live">
            <span className="flex items-center gap-0.5 text-[11px] font-bold text-red-400">
              +{extra} more live <ChevronRight className="w-3 h-3" />
            </span>
          </Link>
        </div>
      )}
    </div>
  );
}
