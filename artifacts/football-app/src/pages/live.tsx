import { useEffect } from "react";
import { useListLiveMatches } from "@workspace/api-client-react";
import { MatchCard } from "@/components/match-card";
import { MatchRow } from "@/components/match-row";
import { Skeleton } from "@/components/ui/skeleton";
import { BannerSlot } from "@/components/banner-slot";

export default function LiveMatches() {
  const { data: matches, isLoading, refetch } = useListLiveMatches();

  // Poll every 30 s so the live minute counter stays current
  useEffect(() => {
    const id = setInterval(() => refetch(), 3000);
    return () => clearInterval(id);
  }, [refetch]);

  return (
    <div className="pb-6">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-4 pb-3">
        <div className="flex items-center gap-2">
          <span className="live-dot inline-block w-2.5 h-2.5 rounded-full bg-red-500 shrink-0" />
          <h1 className="text-xl font-black text-foreground">Live Matches</h1>
        </div>
        {matches && (
          <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full min-w-[22px] text-center">
            {matches.length}
          </span>
        )}
      </div>

      <BannerSlot position="top_live" />

      {isLoading ? (
        <div className="px-4 space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-52 w-full rounded-2xl" />
          ))}
        </div>
      ) : matches && matches.length > 0 ? (
        <div className="space-y-3">
          {/* Featured card for first live match */}
          <div className="px-4">
            <MatchCard match={matches[0]} />
          </div>

          {/* Rest as compact list */}
          {matches.length > 1 && (
            <div className="bg-card rounded-xl mx-4 border border-border overflow-hidden">
              <div className="px-4 py-2.5 border-b border-border">
                <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">More Live</span>
              </div>
              <div className="divide-y divide-border/50">
                {matches.slice(1).map((match, i) => (
                  <MatchRow key={match.id} match={match} index={i} />
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="px-4 mt-8 flex flex-col items-center text-center text-muted-foreground gap-3">
          <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
            <span className="text-3xl opacity-30">⚽</span>
          </div>
          <p className="font-semibold text-foreground">No live matches right now</p>
          <p className="text-sm max-w-xs">Check back at kickoff time or browse upcoming fixtures on the home page.</p>
        </div>
      )}
    </div>
  );
}
