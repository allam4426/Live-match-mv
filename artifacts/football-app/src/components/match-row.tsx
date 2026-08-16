import { Match } from "@workspace/api-client-react";
import { TeamLogo } from "./team-logo";
import { Link } from "wouter";
import { format } from "date-fns";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { useLiveStopwatch } from "@/hooks/use-live-stopwatch";

function StatusCol({ match }: { match: Match }) {
  const isLive = match.status === "live";
  const isFinished = match.status === "finished";
  const stopwatch = useLiveStopwatch(match.id, match.minute, isLive, match.sport, match.clockAnchorMs);

  if (isLive) {
    const m = match.minute;
    const label =
      m === "HT" ? "HT"
      : m === "ET_HT" ? "ET"
      : m === "PSO" ? "PSO"
      : stopwatch ? stopwatch.main
      : m ? `${m}'`
      : "Live";
    return (
      <div className="flex flex-col items-center gap-1.5 w-[46px] shrink-0">
        <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
        <span className="text-[11px] font-black text-red-400 tabular-nums leading-none">{label}</span>
      </div>
    );
  }

  if (isFinished) {
    return (
      <div className="flex items-center justify-center w-[46px] shrink-0">
        <span className="text-[11px] font-bold text-muted-foreground/60 leading-none">FT</span>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center w-[46px] shrink-0">
      <span className="text-[12px] font-bold text-primary tabular-nums leading-none">
        {format(new Date(match.kickoffAt), "HH:mm")}
      </span>
    </div>
  );
}

const CARD_Y = "bg-[#FFE600]";
const CARD_R = "bg-[#E91E63]";

function CardIndicators({ yellow, red }: { yellow: number; red: number }) {
  if (yellow === 0 && red === 0) return null;
  return (
    <span className="flex items-center gap-[2px] shrink-0 ml-0.5">
      {Array.from({ length: Math.min(red, 3) }).map((_, i) => (
        <span key={`r${i}`} className={`inline-block w-[6px] h-[9px] rounded-[2px] ${CARD_R}`} />
      ))}
      {Array.from({ length: Math.min(yellow, 3) }).map((_, i) => (
        <span key={`y${i}`} className={`inline-block w-[6px] h-[9px] rounded-[2px] ${CARD_Y}`} />
      ))}
    </span>
  );
}

export function MatchRow({
  match,
  index = 0,
  showDate = false,
}: {
  match: Match;
  index?: number;
  showDate?: boolean;
}) {
  const isLive = match.status === "live";
  const isFinished = match.status === "finished";
  const showScore = isLive || isFinished;

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, duration: 0.18 }}
    >
      <Link href={`/match/${match.id}`}>
        <div
          className={cn(
            "flex items-center px-3 py-3 cursor-pointer transition-colors",
            isLive && "bg-red-500/[0.04]"
          )}
          data-testid={`match-row-${match.id}`}
        >
          {/* Status column */}
          <StatusCol match={match} />

          {/* Vertical divider */}
          <div className="w-px self-stretch bg-border/60 mx-2.5" />

          {/* Teams stacked */}
          <div className="flex-1 min-w-0 flex flex-col gap-[9px]">
            {/* Home team */}
            <div className="flex items-center gap-2">
              <TeamLogo
                url={match.homeTeam.logoUrl}
                name={match.homeTeam.name}
                shortName={match.homeTeam.shortName}
                className="w-[18px] h-[18px] shrink-0"
              />
              <span className={cn(
                "text-[13px] font-semibold flex-1 min-w-0 truncate",
                isLive ? "text-foreground" : "text-foreground/90"
              )}>
                {match.homeTeam.name}
              </span>
              <CardIndicators yellow={match.homeYellowCards} red={match.homeRedCards} />
              {showScore ? (
                <>
                  <span className={cn(
                    "text-[14px] font-black tabular-nums shrink-0 ml-1 w-5 text-right",
                    isLive ? "text-foreground" : "text-muted-foreground"
                  )}>
                    {isFinished && (match as any).homePenGoals > 0
                      ? match.homeScore - (match as any).homePenGoals
                      : match.homeScore}
                  </span>
                  {isFinished && (match as any).homePenGoals > 0 && (
                    <span className="text-[10px] font-bold text-muted-foreground/60 shrink-0 ml-0.5">
                      ({(match as any).homePenGoals})
                    </span>
                  )}
                </>
              ) : showDate ? (
                <span className="text-[10px] text-muted-foreground/50 shrink-0 ml-1 tabular-nums">
                  {format(new Date(match.kickoffAt), "d MMM")}
                </span>
              ) : null}
            </div>

            {/* Away team */}
            <div className="flex items-center gap-2">
              <TeamLogo
                url={match.awayTeam.logoUrl}
                name={match.awayTeam.name}
                shortName={match.awayTeam.shortName}
                className="w-[18px] h-[18px] shrink-0"
              />
              <span className="text-[13px] font-semibold flex-1 min-w-0 truncate text-foreground/75">
                {match.awayTeam.name}
              </span>
              <CardIndicators yellow={match.awayYellowCards} red={match.awayRedCards} />
              {showScore && (
                <>
                  <span className={cn(
                    "text-[14px] font-black tabular-nums shrink-0 ml-1 w-5 text-right",
                    isLive ? "text-foreground" : "text-muted-foreground"
                  )}>
                    {isFinished && (match as any).awayPenGoals > 0
                      ? match.awayScore - (match as any).awayPenGoals
                      : match.awayScore}
                  </span>
                  {isFinished && (match as any).awayPenGoals > 0 && (
                    <span className="text-[10px] font-bold text-muted-foreground/60 shrink-0 ml-0.5">
                      ({(match as any).awayPenGoals})
                    </span>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}
