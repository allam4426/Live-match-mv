import {
  useGetTournament,
  useGetTournamentStandings,
  useGetTournamentMatches,
  useGetTournamentTopScorers,
  getGetTournamentQueryKey,
  getGetTournamentStandingsQueryKey,
  getGetTournamentMatchesQueryKey,
  getGetTournamentTopScorersQueryKey,
  type TournamentPlayerStat,
  type TopScorer,
} from "@workspace/api-client-react";
import { useParams, Link } from "wouter";
import { Skeleton } from "@/components/ui/skeleton";
import { TeamLogo } from "@/components/team-logo";
import { BannerSlot } from "@/components/banner-slot";
import { Trophy, ChevronLeft, Calendar, GitBranch, Users, BarChart2 } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { type Match } from "@workspace/api-client-react";

/* ─── form dot ─── */
function FormDot({ result }: { result: string }) {
  const colors: Record<string, string> = { W: "bg-emerald-500", D: "bg-slate-500", L: "bg-red-500" };
  return (
    <span className={cn(
      "w-4 h-4 rounded-full inline-flex items-center justify-center text-[8px] font-black text-white shrink-0",
      colors[result] ?? "bg-white/10"
    )}>
      {result}
    </span>
  );
}

/* ─── constants ─── */
const FORMAT_LABELS: Record<string, string> = {
  league: "League",
  group_stage: "Group Stage",
  knockout: "Knockout",
};

const ROUND_ORDER = [
  "round of 128",
  "round of 64",
  "round of 32",
  "round of 16",
  "round of 8",
  "quarter-final",
  "quarter-finals",
  "quarterfinal",
  "quarterfinals",
  "qf",
  "semi-final",
  "semi-finals",
  "semifinal",
  "semifinals",
  "sf",
  "third place",
  "third-place",
  "third place playoff",
  "playoff",
  "play-off",
  "final",
  "grand final",
  "championship",
];

function normalizeRound(s: string) {
  return s.toLowerCase().replace(/[-_\s]+/g, " ").trim();
}

function roundOrder(name: string): number {
  const n = normalizeRound(name);
  const idx = ROUND_ORDER.findIndex(r => normalizeRound(r) === n);
  return idx === -1 ? 999 : idx;
}

/* ─── BracketMatchCard ─── */
const CARD_H = 76; // px — height of each bracket card

type MatchItem = {
  id: number;
  homeTeam: { id: number; name: string; shortName: string | null; logoUrl: string | null };
  awayTeam: { id: number; name: string; shortName: string | null; logoUrl: string | null };
  homeScore: number | null;
  awayScore: number | null;
  status: string;
  minute: string | null;
  matchGroup?: string | null;
  kickoffAt: string;
};

/* ─── Inline card indicators ─── */
const _CY = "bg-[#FFE600]";
const _CR = "bg-[#E91E63]";
function TFCards({ y, r }: { y: number; r: number }) {
  if (y === 0 && r === 0) return null;
  return (
    <span className="flex items-center gap-[2px] shrink-0 mx-0.5">
      {Array.from({ length: Math.min(r, 3) }).map((_, i) => <span key={`r${i}`} className={`inline-block w-[5px] h-[8px] rounded-[1px] ${_CR}`} />)}
      {Array.from({ length: Math.min(y, 3) }).map((_, i) => <span key={`y${i}`} className={`inline-block w-[5px] h-[8px] rounded-[1px] ${_CY}`} />)}
    </span>
  );
}

/* ─── Tournament fixture row (reference-style layout) ─── */
function TournamentFixtureRow({ match }: { match: Match }) {
  const isLive = match.status === "live";
  const isFinished = match.status === "finished";
  const showScore = isLive || isFinished;
  return (
    <Link href={`/match/${match.id}`}>
      <div className="flex items-center px-4 py-3 hover:bg-white/[0.03] cursor-pointer transition-colors">
        {/* Teams + scores */}
        <div className="flex-1 min-w-0 flex flex-col gap-[7px]">
          <div className="flex items-center gap-2">
            <TeamLogo url={match.homeTeam.logoUrl} name={match.homeTeam.name} shortName={match.homeTeam.shortName} className="w-[18px] h-[18px] shrink-0" />
            <span className="flex-1 min-w-0 text-[13px] font-semibold text-foreground/90 truncate">{match.homeTeam.name}</span>
            <TFCards y={match.homeYellowCards} r={match.homeRedCards} />
            {showScore && <span className="text-[15px] font-black tabular-nums shrink-0 w-6 text-right">{match.homeScore}</span>}
          </div>
          <div className="flex items-center gap-2">
            <TeamLogo url={match.awayTeam.logoUrl} name={match.awayTeam.name} shortName={match.awayTeam.shortName} className="w-[18px] h-[18px] shrink-0" />
            <span className="flex-1 min-w-0 text-[13px] font-semibold text-foreground/60 truncate">{match.awayTeam.name}</span>
            <TFCards y={match.awayYellowCards} r={match.awayRedCards} />
            {showScore && <span className="text-[15px] font-black tabular-nums shrink-0 w-6 text-right text-foreground/60">{match.awayScore}</span>}
          </div>
        </div>
        {/* Divider */}
        <div className="w-px self-stretch bg-border/40 mx-3" />
        {/* Status + group */}
        <div className="flex flex-col items-end gap-0.5 w-[68px] shrink-0">
          {isLive ? (
            <span className="text-[11px] font-black text-red-400 tabular-nums">{match.minute ? `${match.minute}'` : "Live"}</span>
          ) : isFinished ? (
            <span className="text-[11px] font-bold text-muted-foreground">FT</span>
          ) : (
            <span className="text-[11px] font-bold text-primary tabular-nums">{format(new Date(match.kickoffAt), "HH:mm")}</span>
          )}
          {match.matchGroup && (
            <span className="text-[10px] text-muted-foreground/50 text-right leading-tight capitalize">{match.matchGroup}</span>
          )}
        </div>
      </div>
    </Link>
  );
}

function BracketMatchCard({ match }: { match: MatchItem }) {
  const isLive = match.status === "live";
  const isFinished = match.status === "finished";
  const homeWon = isFinished && (match.homeScore ?? 0) > (match.awayScore ?? 0);
  const awayWon = isFinished && (match.awayScore ?? 0) > (match.homeScore ?? 0);

  return (
    <Link href={`/match/${match.id}`}>
      <div className={cn(
        "w-full rounded-xl border overflow-hidden cursor-pointer hover:border-primary/50 transition-all active:scale-[0.98]",
        isLive ? "border-red-500/40 bg-red-500/5" : "border-border bg-card"
      )} style={{ height: CARD_H }}>
        {/* Home team */}
        <div className={cn(
          "flex items-center gap-2 px-2.5 border-b",
          "border-border/40",
          homeWon ? "bg-primary/8" : ""
        )} style={{ height: CARD_H / 2 }}>
          <TeamLogo
            url={match.homeTeam.logoUrl ?? ""}
            name={match.homeTeam.name}
            shortName={match.homeTeam.shortName ?? match.homeTeam.name}
            className="w-4 h-4 shrink-0"
          />
          <span className={cn(
            "text-xs flex-1 truncate font-semibold",
            homeWon ? "text-foreground font-black" : "text-muted-foreground"
          )}>
            {match.homeTeam.shortName || match.homeTeam.name}
          </span>
          {isLive ? (
            <span className="text-xs font-black text-red-400 shrink-0">{match.homeScore ?? 0}</span>
          ) : isFinished ? (
            <span className={cn("text-xs font-black shrink-0", homeWon ? "text-foreground" : "text-muted-foreground")}>
              {match.homeScore ?? 0}
            </span>
          ) : (
            <span className="text-[10px] text-muted-foreground/50 shrink-0">—</span>
          )}
        </div>
        {/* Away team */}
        <div className={cn(
          "flex items-center gap-2 px-2.5",
          awayWon ? "bg-primary/8" : ""
        )} style={{ height: CARD_H / 2 }}>
          <TeamLogo
            url={match.awayTeam.logoUrl ?? ""}
            name={match.awayTeam.name}
            shortName={match.awayTeam.shortName ?? match.awayTeam.name}
            className="w-4 h-4 shrink-0"
          />
          <span className={cn(
            "text-xs flex-1 truncate font-semibold",
            awayWon ? "text-foreground font-black" : "text-muted-foreground"
          )}>
            {match.awayTeam.shortName || match.awayTeam.name}
          </span>
          {isLive ? (
            <span className="text-xs font-black text-red-400 shrink-0">{match.awayScore ?? 0}</span>
          ) : isFinished ? (
            <span className={cn("text-xs font-black shrink-0", awayWon ? "text-foreground" : "text-muted-foreground")}>
              {match.awayScore ?? 0}
            </span>
          ) : (
            <span className="text-[10px] text-muted-foreground/50 shrink-0">—</span>
          )}
        </div>
      </div>
    </Link>
  );
}

/* ─── SingleGroupBracket ─── */
// Special bracket for group_stage tournaments with exactly 1 group:
// 1st place → BYE → directly to Final
// 2nd vs 3rd → Semi-Final → Final
type StandingTeam = { name: string; shortName: string | null; logoUrl: string | null; id: number };

function SingleGroupBracket({
  bracketMatches,
  firstPlace,
}: {
  bracketMatches: MatchItem[];
  firstPlace: StandingTeam | undefined;
}) {
  const SG_CARD_H = 76;
  const SG_GAP = 20;
  const SG_CARD_W = 152;
  const SG_CONN_W = 36;

  const semiMatch = bracketMatches.find(m =>
    normalizeRound(m.matchGroup ?? "").includes("semi")
  );
  const finalMatch = bracketMatches.find(m =>
    normalizeRound(m.matchGroup ?? "").includes("final")
  );

  // Vertical midpoints of each left-column card
  const byeMidY   = SG_CARD_H / 2;
  const semiMidY  = SG_CARD_H + SG_GAP + SG_CARD_H / 2;
  const mergeY    = (byeMidY + semiMidY) / 2;
  const leftColH  = SG_CARD_H * 2 + SG_GAP;
  const finalTop  = mergeY - SG_CARD_H / 2;
  const HEADER_H  = 28; // approx px for column header

  const PlaceholderCard = ({ label }: { label: string }) => (
    <div
      style={{ height: SG_CARD_H, width: SG_CARD_W }}
      className="rounded-xl border border-dashed border-border flex flex-col items-center justify-center text-[11px] text-muted-foreground gap-0.5"
    >
      <span className="font-semibold">{label}</span>
      <span className="text-[9px]">Pending</span>
    </div>
  );

  return (
    <div className="px-4 overflow-x-auto pb-4">
      <div className="flex items-start">
        {/* ── Left column: BYE + Semi-Final ── */}
        <div style={{ width: SG_CARD_W, flexShrink: 0 }}>
          <div className="text-[9px] font-black text-primary uppercase tracking-widest text-center mb-2" style={{ height: HEADER_H }}>
            Semi-Final
          </div>
          {/* BYE — 1st place advances directly */}
          <div
            style={{ height: SG_CARD_H, width: SG_CARD_W }}
            className="rounded-xl border-2 border-dashed border-primary/40 bg-primary/5 px-3 flex flex-col justify-center mb-0"
          >
            <div className="text-[8px] font-black text-primary/60 uppercase tracking-widest mb-1.5">
              🏆 1st Place · Bye
            </div>
            {firstPlace ? (
              <div className="flex items-center gap-1.5">
                <TeamLogo
                  url={firstPlace.logoUrl ?? ""}
                  name={firstPlace.name}
                  shortName={firstPlace.shortName ?? ""}
                  className="w-5 h-5"
                />
                <span className="text-[11px] font-bold text-foreground truncate">{firstPlace.name}</span>
              </div>
            ) : (
              <span className="text-[11px] text-muted-foreground">Group Winner</span>
            )}
          </div>

          {/* Gap */}
          <div style={{ height: SG_GAP }} />

          {/* Semi-Final match */}
          {semiMatch
            ? <BracketMatchCard match={semiMatch} />
            : <PlaceholderCard label="2nd vs 3rd" />}
        </div>

        {/* ── Connector SVG ── */}
        <svg
          width={SG_CONN_W}
          height={leftColH}
          style={{ flexShrink: 0, marginTop: HEADER_H }}
          overflow="visible"
        >
          {/* Horiz lines from each card to the midpoint bar */}
          <line x1={0} y1={byeMidY}  x2={SG_CONN_W / 2} y2={byeMidY}  stroke="hsl(var(--border))" strokeWidth={2} />
          <line x1={0} y1={semiMidY} x2={SG_CONN_W / 2} y2={semiMidY} stroke="hsl(var(--border))" strokeWidth={2} />
          {/* Vertical bar joining the two */}
          <line x1={SG_CONN_W / 2} y1={byeMidY} x2={SG_CONN_W / 2} y2={semiMidY} stroke="hsl(var(--border))" strokeWidth={2} />
          {/* Horiz line out to Final */}
          <line x1={SG_CONN_W / 2} y1={mergeY} x2={SG_CONN_W} y2={mergeY} stroke="hsl(var(--border))" strokeWidth={2} />
        </svg>

        {/* ── Right column: Final ── */}
        <div style={{ width: SG_CARD_W, flexShrink: 0 }}>
          <div className="text-[9px] font-black text-primary uppercase tracking-widest text-center mb-2" style={{ height: HEADER_H }}>
            Final
          </div>
          <div style={{ marginTop: finalTop }}>
            {finalMatch
              ? <BracketMatchCard match={finalMatch} />
              : <PlaceholderCard label="Final" />}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Top2FinalBracket ─── */
// Special bracket for single-group tournaments where 1st vs 2nd go directly to Final
function Top2FinalBracket({
  bracketMatches,
  firstPlace,
  secondPlace,
}: {
  bracketMatches: MatchItem[];
  firstPlace: StandingTeam | undefined;
  secondPlace: StandingTeam | undefined;
}) {
  const T2_CARD_W = 152;
  const T2_CONN_W = 36;
  const T2_CARD_H = 76;

  const finalMatch = bracketMatches.find(m =>
    normalizeRound(m.matchGroup ?? "").includes("final")
  );

  const SeedCard = ({ rank, team }: { rank: string; team: StandingTeam | undefined }) => (
    <div
      style={{ height: T2_CARD_H, width: T2_CARD_W }}
      className="rounded-xl border-2 border-dashed border-primary/40 bg-primary/5 px-3 flex flex-col justify-center"
    >
      <div className="text-[8px] font-black text-primary/60 uppercase tracking-widest mb-1.5">
        {rank}
      </div>
      {team ? (
        <div className="flex items-center gap-1.5">
          <TeamLogo url={team.logoUrl ?? ""} name={team.name} shortName={team.shortName ?? ""} className="w-5 h-5" />
          <span className="text-[11px] font-bold text-foreground truncate">{team.name}</span>
        </div>
      ) : (
        <span className="text-[11px] text-muted-foreground">Group Finalist</span>
      )}
    </div>
  );

  const GAP = 20;
  const totalH = T2_CARD_H * 2 + GAP;
  const topMidY = T2_CARD_H / 2;
  const botMidY = T2_CARD_H + GAP + T2_CARD_H / 2;
  const mergeY = (topMidY + botMidY) / 2;
  const finalTop = mergeY - T2_CARD_H / 2;
  const HEADER_H = 28;

  return (
    <div className="px-4 overflow-x-auto pb-4">
      <div className="flex items-start">
        {/* Left column: 1st & 2nd seed cards */}
        <div style={{ width: T2_CARD_W, flexShrink: 0 }}>
          <div className="text-[9px] font-black text-primary uppercase tracking-widest text-center mb-2" style={{ height: HEADER_H }}>
            Group Standings
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: GAP }}>
            <SeedCard rank="🥇 1st Place" team={firstPlace} />
            <SeedCard rank="🥈 2nd Place" team={secondPlace} />
          </div>
        </div>

        {/* Connector SVG */}
        <svg width={T2_CONN_W} height={totalH} style={{ flexShrink: 0, marginTop: HEADER_H }} overflow="visible">
          <line x1={0} y1={topMidY} x2={T2_CONN_W / 2} y2={topMidY} stroke="hsl(var(--border))" strokeWidth={2} />
          <line x1={0} y1={botMidY} x2={T2_CONN_W / 2} y2={botMidY} stroke="hsl(var(--border))" strokeWidth={2} />
          <line x1={T2_CONN_W / 2} y1={topMidY} x2={T2_CONN_W / 2} y2={botMidY} stroke="hsl(var(--border))" strokeWidth={2} />
          <line x1={T2_CONN_W / 2} y1={mergeY} x2={T2_CONN_W} y2={mergeY} stroke="hsl(var(--border))" strokeWidth={2} />
        </svg>

        {/* Right column: Final */}
        <div style={{ width: T2_CARD_W, flexShrink: 0 }}>
          <div className="text-[9px] font-black text-primary uppercase tracking-widest text-center mb-2" style={{ height: HEADER_H }}>
            Final
          </div>
          <div style={{ marginTop: finalTop }}>
            {finalMatch ? (
              <BracketMatchCard match={finalMatch} />
            ) : (
              <div style={{ height: T2_CARD_H, width: T2_CARD_W }}
                className="rounded-xl border border-dashed border-border flex flex-col items-center justify-center text-[11px] text-muted-foreground gap-0.5">
                <span className="font-semibold">Final</span>
                <span className="text-[9px]">Pending</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── KnockoutBracket ─── */
const CONNECTOR_W = 24; // px — width of the right connector area
const CARD_W = 148;     // px — width of each bracket card
const COL_W = CARD_W + CONNECTOR_W; // total column width incl. connector area

function KnockoutBracket({ matches }: { matches: MatchItem[] }) {
  // Group matches by round
  const roundMap = new Map<string, MatchItem[]>();
  for (const m of matches) {
    const round = m.matchGroup ?? "Final";
    if (!roundMap.has(round)) roundMap.set(round, []);
    roundMap.get(round)!.push(m);
  }

  if (roundMap.size === 0) {
    return (
      <div className="py-12 text-center text-muted-foreground text-sm bg-card rounded-xl border border-dashed border-border mx-4">
        <GitBranch className="w-8 h-8 mx-auto mb-2 opacity-30" />
        No matches in the bracket yet. Add matches with round names (e.g. "Quarter-Final") to build the bracket.
      </div>
    );
  }

  // Sort rounds
  const sortedRounds = Array.from(roundMap.entries()).sort(
    ([a], [b]) => roundOrder(a) - roundOrder(b)
  );

  const maxInRound = Math.max(...sortedRounds.map(([, ms]) => ms.length));
  const BASE_SLOT_H = CARD_H + 8; // slot height for the densest round

  // Total bracket height = maxInRound * BASE_SLOT_H
  const totalH = maxInRound * BASE_SLOT_H;

  return (
    <div className="overflow-x-auto pb-4 px-4">
      <div className="flex items-start" style={{ minWidth: sortedRounds.length * COL_W + CONNECTOR_W }}>
        {sortedRounds.map(([roundName, roundMatches], roundIdx) => {
          const isLast = roundIdx === sortedRounds.length - 1;
          // How many slots does each match occupy in this round?
          const slotMultiplier = maxInRound / roundMatches.length;
          const slotH = slotMultiplier * BASE_SLOT_H;

          return (
            <div key={roundName} style={{ width: COL_W, flexShrink: 0 }}>
              {/* Round header */}
              <div className="text-center mb-3 px-1" style={{ width: CARD_W }}>
                <span className="text-[9px] font-black text-primary uppercase tracking-widest">{roundName}</span>
              </div>

              {/* Match slots */}
              <div style={{ height: totalH, position: "relative" }}>
                {roundMatches.map((match, matchIdx) => {
                  const slotTop = matchIdx * slotH;
                  const cardTop = slotTop + slotH / 2 - CARD_H / 2;

                  // Connector lines on the right side
                  // For even-indexed matches (top of pair): border right + bottom
                  // For odd-indexed matches (bottom of pair): border right + top
                  const isTopOfPair = matchIdx % 2 === 0;
                  const hasConnector = !isLast;

                  // The vertical connector line runs from the card center to the pair midpoint
                  // For top of pair: from center downward to slot bottom
                  // For bottom of pair: from slot top to center
                  const connectorFromY = isTopOfPair
                    ? cardTop + CARD_H / 2    // card center
                    : slotTop;                 // slot top (= prev card center)
                  const connectorToY = isTopOfPair
                    ? slotTop + slotH          // slot bottom (= next card center)
                    : cardTop + CARD_H / 2;    // card center

                  return (
                    <div key={match.id}>
                      {/* Card */}
                      <div
                        style={{
                          position: "absolute",
                          top: cardTop,
                          left: 0,
                          width: CARD_W,
                        }}
                      >
                        <BracketMatchCard match={match} />
                      </div>

                      {/* Horizontal line from card right edge to connector area */}
                      {hasConnector && (
                        <div
                          style={{
                            position: "absolute",
                            top: cardTop + CARD_H / 2 - 1,
                            left: CARD_W,
                            width: CONNECTOR_W / 2,
                            height: 2,
                            backgroundColor: "hsl(var(--border))",
                          }}
                        />
                      )}

                      {/* Vertical connector line (right half of CONNECTOR_W) */}
                      {hasConnector && (
                        <div
                          style={{
                            position: "absolute",
                            top: connectorFromY,
                            left: CARD_W + CONNECTOR_W / 2 - 1,
                            width: 2,
                            height: Math.abs(connectorToY - connectorFromY),
                            backgroundColor: "hsl(var(--border))",
                          }}
                        />
                      )}

                      {/* Horizontal line from vertical connector to next column */}
                      {hasConnector && !isTopOfPair && (
                        <div
                          style={{
                            position: "absolute",
                            top: (slotTop - slotH / 2) + slotH / 2 - 1,
                            left: CARD_W + CONNECTOR_W / 2 - 1,
                            width: CONNECTOR_W / 2 + 1,
                            height: 2,
                            backgroundColor: "hsl(var(--border))",
                          }}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ─── Main TournamentPage ─── */
export default function TournamentPage() {
  const { id } = useParams();
  const tournamentId = parseInt(id || "0", 10);

  const isKnockout = (fmt?: string | null) => fmt === "knockout";
  const isGroupStageOrKnockout = (fmt?: string | null) => fmt === "group_stage" || fmt === "knockout";

  type Tab = "matches" | "standings" | "bracket" | "teams" | "stats";
  const [activeTab, setActiveTab] = useState<Tab>("matches");

  const { data: tournament, isLoading: tLoading } = useGetTournament(tournamentId, {
    query: { enabled: !!tournamentId, queryKey: getGetTournamentQueryKey(tournamentId) },
  });
  const { data: matches, isLoading: mLoading } = useGetTournamentMatches(tournamentId, {
    query: { enabled: !!tournamentId, queryKey: getGetTournamentMatchesQueryKey(tournamentId) },
  });
  const { data: standings, isLoading: sLoading } = useGetTournamentStandings(tournamentId, {
    query: {
      enabled: !!tournamentId && (activeTab === "standings" || (tournament?.format === "group_stage" && activeTab === "bracket")),
      queryKey: getGetTournamentStandingsQueryKey(tournamentId),
    },
  });
  const { data: statsData, isLoading: statsLoading } = useGetTournamentTopScorers(tournamentId, {
    query: {
      enabled: !!tournamentId && activeTab === "stats",
      queryKey: getGetTournamentTopScorersQueryKey(tournamentId),
    },
  });

  if (tLoading) {
    return (
      <div className="space-y-4 pb-6 px-4 pt-4">
        <Skeleton className="h-8 w-24" />
        <Skeleton className="h-32 w-full rounded-2xl" />
        <Skeleton className="h-10 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  if (!tournament) {
    return (
      <div className="py-24 text-center px-4">
        <Trophy className="w-12 h-12 mx-auto mb-3 opacity-20" />
        <h2 className="text-xl font-bold mb-3">Tournament not found</h2>
        <Link href="/">
          <span className="text-primary text-sm font-semibold cursor-pointer">Back to Home</span>
        </Link>
      </div>
    );
  }

  const fmt = tournament.format;
  const isGroupStage = fmt === "group_stage";

  /* ── unique teams from matches ── */
  const teamMap = new Map<number, MatchItem["homeTeam"]>();
  if (matches) {
    for (const m of matches) {
      if (!teamMap.has(m.homeTeam.id)) teamMap.set(m.homeTeam.id, m.homeTeam);
      if (!teamMap.has(m.awayTeam.id)) teamMap.set(m.awayTeam.id, m.awayTeam);
    }
  }
  const participatingTeams = Array.from(teamMap.values())
    .filter(t => t.id !== 0 && !/^tba?d?$/i.test(t.name.trim()))
    .sort((a, b) => a.name.localeCompare(b.name));

  /* ── bracket matches (for group_stage: only knockout rounds) ── */
  const allMatchItems = (matches ?? []) as MatchItem[];
  const bracketMatches = isGroupStage
    ? allMatchItems.filter(m => m.matchGroup && roundOrder(m.matchGroup) !== 999)
    : allMatchItems;


  /* ── group matches for the Matches tab ── */
  const groupedMatches: Record<string, typeof matches> = {};
  if (matches) {
    for (const m of matches) {
      const key =
        isGroupStage && m.matchGroup
          ? m.matchGroup
          : isKnockout(fmt) && m.matchGroup
          ? m.matchGroup
          : format(new Date(m.kickoffAt), "EEEE, d MMMM yyyy");
      if (!groupedMatches[key]) groupedMatches[key] = [];
      groupedMatches[key]!.push(m);
    }
  }

  const sortedGroupKeys = Object.keys(groupedMatches).sort((a, b) => {
    if (isGroupStage || isKnockout(fmt)) {
      const oa = roundOrder(a);
      const ob = roundOrder(b);
      if (oa !== 999 || ob !== 999) return oa - ob;
      return a.localeCompare(b);
    }
    const da = new Date(groupedMatches[a]![0]!.kickoffAt);
    const db2 = new Date(groupedMatches[b]![0]!.kickoffAt);
    return da.getTime() - db2.getTime();
  });

  /* ── tabs config ── */
  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: "matches", label: "Matches", icon: <Calendar className="w-3.5 h-3.5" /> },
    ...(participatingTeams.length > 0
      ? [{ id: "teams" as Tab, label: "Teams", icon: <Users className="w-3.5 h-3.5" /> }]
      : []),
    ...(isGroupStageOrKnockout(fmt)
      ? [{ id: "bracket" as Tab, label: "Bracket", icon: <GitBranch className="w-3.5 h-3.5" /> }]
      : []),
    ...(!isKnockout(fmt)
      ? [{ id: "standings" as Tab, label: "Standings", icon: <Trophy className="w-3.5 h-3.5" /> }]
      : []),
    { id: "stats", label: "Stats", icon: <BarChart2 className="w-3.5 h-3.5" /> },
  ];

  return (
    <div className="pb-6">
      {/* Back */}
      <div className="flex items-center gap-2 px-4 pt-4 pb-3">
        <Link href="/">
          <span className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground cursor-pointer transition-colors">
            <ChevronLeft className="w-4 h-4" /> Back
          </span>
        </Link>
      </div>

      {/* Tournament Header */}
      <div
        className="mx-4 rounded-2xl overflow-hidden shadow-xl mb-3"
        style={{
          background: tournament.color
            ? `linear-gradient(135deg, ${tournament.color}ee 0%, ${tournament.color}99 70%, ${tournament.color}55 100%)`
            : "linear-gradient(135deg, #1e3a5f 0%, #0d2035 100%)",
        }}
      >
        <div className="px-5 pt-5 pb-6">
          {/* Sport + format badge row */}
          <div className="flex items-center gap-2 mb-4">
            <span className="text-[11px] font-bold bg-black/25 text-white/90 px-2.5 py-1 rounded-full capitalize tracking-wide">
              {tournament.sport}
            </span>
            <span className="text-[11px] font-bold bg-black/25 text-white/90 px-2.5 py-1 rounded-full tracking-wide">
              {FORMAT_LABELS[tournament.format] ?? tournament.format}
            </span>
          </div>

          {/* Logo + Name */}
          <div className="flex items-start gap-4">
            <div className="w-[68px] h-[68px] rounded-xl bg-white flex items-center justify-center shrink-0 overflow-hidden shadow-lg">
              {tournament.logoUrl ? (
                <img src={tournament.logoUrl} alt={tournament.name} className="w-14 h-14 object-contain" />
              ) : (
                <Trophy className="w-9 h-9 text-gray-400" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-xl font-black text-white leading-tight">{tournament.name}</h1>
              {tournament.description && (
                <p className="text-sm text-white/70 mt-1.5">by {tournament.description}</p>
              )}
              <p className="text-xs text-white/45 mt-1">{tournament.season}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Ad banner */}
      <BannerSlot position="top_home" />

      {/* Tabs — text underline style */}
      <div className="flex items-center border-b border-border/50 mt-4 overflow-x-auto hide-scrollbar">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "px-4 py-3 text-[13px] font-semibold border-b-2 transition-colors shrink-0 -mb-px",
              activeTab === tab.id
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Matches tab ── */}
      {activeTab === "matches" && (
        <div className="px-4 pt-4 space-y-4">
          {mLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}
            </div>
          ) : (matches && matches.length > 0) ? (
            (() => {
              const byDate: Record<string, typeof matches> = {};
              for (const m of matches) {
                const dk = format(new Date(m.kickoffAt), "MMMM d, yyyy");
                if (!byDate[dk]) byDate[dk] = [];
                byDate[dk]!.push(m);
              }
              const dateKeys = Object.keys(byDate).sort((a, b) =>
                new Date(byDate[a]![0]!.kickoffAt).getTime() - new Date(byDate[b]![0]!.kickoffAt).getTime()
              );
              return dateKeys.map(dk => (
                <div key={dk}>
                  <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide mb-2">{dk}</p>
                  <div className="flex flex-col gap-2">
                    {byDate[dk]?.map(m => (
                      <div key={m.id} className="bg-card rounded-xl border border-border overflow-hidden">
                        <TournamentFixtureRow match={m} />
                      </div>
                    ))}
                  </div>
                </div>
              ));
            })()
          ) : (
            <div className="py-12 text-center text-muted-foreground text-sm bg-card rounded-xl border border-dashed border-border">
              <Calendar className="w-8 h-8 mx-auto mb-2 opacity-30" />
              No matches scheduled yet.
            </div>
          )}
        </div>
      )}

      {/* ── Teams tab ── */}
      {activeTab === "teams" && (
        <div className="px-4">
          {mLoading ? (
            <div className="grid grid-cols-2 gap-2">
              {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)}
            </div>
          ) : participatingTeams.length > 0 ? (
            <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
              {participatingTeams.map(team => (
                <div key={team.id} className="bg-card rounded-xl border border-border p-3 flex items-center gap-3">
                  <TeamLogo
                    url={team.logoUrl ?? ""}
                    name={team.name}
                    shortName={team.shortName ?? team.name}
                    className="w-10 h-10 shrink-0"
                  />
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-foreground truncate">{team.name}</p>
                    {team.shortName && team.shortName !== team.name && (
                      <p className="text-[10px] text-muted-foreground">{team.shortName}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-12 text-center text-muted-foreground text-sm bg-card rounded-xl border border-dashed border-border">
              <Users className="w-8 h-8 mx-auto mb-2 opacity-30" />
              No matches scheduled yet — teams will appear here once matches are added.
            </div>
          )}
        </div>
      )}

      {/* ── Bracket tab ── */}
      {activeTab === "bracket" && (
        <>
          {mLoading ? (
            <div className="px-4">
              <Skeleton className="h-64 w-full rounded-xl" />
            </div>
          ) : (() => {
            const groupKeys = Object.keys(standings?.groups ?? {});
            const isSingleGroup = isGroupStage && groupKeys.length === 1;
            const sgFmt = tournament.singleGroupFormat;
            const groupRows = isSingleGroup ? (standings?.groups[groupKeys[0]!] ?? []) : [];
            const firstPlaceRow  = groupRows[0];
            const secondPlaceRow = groupRows[1];

            // top2_final: 1st vs 2nd → Final directly
            if (isSingleGroup && sgFmt === "top2_final") {
              return (
                <Top2FinalBracket
                  bracketMatches={bracketMatches}
                  firstPlace={firstPlaceRow?.team}
                  secondPlace={secondPlaceRow?.team}
                />
              );
            }
            // bye_semi (or no format set on a single-group tournament): 1st BYE, 2nd vs 3rd → Semi → Final
            if (isSingleGroup && (sgFmt === "bye_semi" || sgFmt == null)) {
              return (
                <SingleGroupBracket
                  bracketMatches={bracketMatches}
                  firstPlace={firstPlaceRow?.team}
                />
              );
            }
            // Multi-group or knockout: standard bracket
            return <KnockoutBracket matches={bracketMatches} />;
          })()}
        </>
      )}

      {/* ── Standings tab ── */}
      {activeTab === "standings" && (
        <div className="space-y-3 px-4">
          {sLoading ? (
            <Skeleton className="h-48 w-full rounded-xl" />
          ) : standings && Object.keys(standings.groups ?? {}).length > 0 ? (() => {
            const zones = (tournament.qualificationZones ?? []) as Array<{
              fromPos: number; toPos: number;
              type: "champion" | "qualified" | "qualified_playoff" | "relegated_playoff" | "relegated";
              label: string;
            }>;
            const ZONE_COLORS = {
              champion: "#f59e0b",
              qualified: "#22c55e",
              qualified_playoff: "#3b82f6",
              relegated_playoff: "#f97316",
              relegated: "#ef4444",
            } as const;
            const ZONE_BG = {
              champion: "rgba(245,158,11,0.08)",
              qualified: "rgba(34,197,94,0.08)",
              qualified_playoff: "rgba(59,130,246,0.08)",
              relegated_playoff: "rgba(249,115,22,0.08)",
              relegated: "rgba(239,68,68,0.08)",
            } as const;
            const getZone = (pos: number, total: number) => {
              for (const z of zones) {
                const from = z.fromPos < 0 ? total + z.fromPos + 1 : z.fromPos;
                const to = z.toPos < 0 ? total + z.toPos + 1 : z.toPos;
                const lo = Math.min(from, to);
                const hi = Math.max(from, to);
                if (pos >= lo && pos <= hi) return z;
              }
              return null;
            };
            return Object.entries(standings.groups).map(([groupName, rows]) => {
              const total = rows.length;
              const legendZones = zones.filter(z => {
                const from = z.fromPos < 0 ? total + z.fromPos + 1 : z.fromPos;
                const to = z.toPos < 0 ? total + z.toPos + 1 : z.toPos;
                return Math.min(from, to) >= 1 && Math.max(from, to) <= total;
              });
              const seenLabels = new Set<string>();
              const uniqueLegend = legendZones.filter(z => {
                if (seenLabels.has(z.label)) return false;
                seenLabels.add(z.label);
                return true;
              });
              return (
              <div key={groupName} className="bg-card rounded-xl border border-border overflow-hidden">
                <div className="px-4 py-2.5 border-b border-border bg-muted/30 flex items-center gap-2">
                  <Trophy className="w-3.5 h-3.5 text-primary" />
                  <span className="text-xs font-black text-foreground uppercase tracking-wide">{groupName}</span>
                </div>
                <div className="pb-0 pt-2 overflow-x-auto">
                  <table className="w-full text-xs min-w-[340px]">
                    <thead>
                      <tr className="text-muted-foreground">
                        <th className="text-left font-semibold pb-2 pl-3 w-5"></th>
                        <th className="text-left font-semibold pb-2 w-6">#</th>
                        <th className="text-left font-semibold pb-2">Team</th>
                        <th className="text-center font-semibold pb-2 w-7">P</th>
                        <th className="text-center font-semibold pb-2 w-7">W</th>
                        <th className="text-center font-semibold pb-2 w-7">D</th>
                        <th className="text-center font-semibold pb-2 w-7">L</th>
                        <th className="text-center font-semibold pb-2 w-8">GD</th>
                        <th className="text-center font-semibold pb-2 w-8 text-primary pr-3">Pts</th>
                        <th className="text-center font-semibold pb-2 pr-3">Form</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row) => {
                        const guide = row.formGuide ?? [];
                        const empties = Math.max(0, 5 - guide.length);
                        const zone = getZone(row.position, total);
                        const zoneColor = zone ? ZONE_COLORS[zone.type] : undefined;
                        const zoneBg = zone ? ZONE_BG[zone.type] : undefined;
                        return (
                        <tr
                          key={row.position}
                          className="border-t border-border/30"
                          style={zoneBg ? { backgroundColor: zoneBg } : undefined}
                        >
                          <td className="py-2 pl-0 w-1">
                            <div className="w-[3px] h-7 rounded-r-full" style={{ backgroundColor: zoneColor ?? "transparent" }} />
                          </td>
                          <td className="py-2 text-muted-foreground font-semibold">{row.position}</td>
                          <td className="py-2">
                            <div className="flex items-center gap-1.5">
                              <TeamLogo
                                url={row.team.logoUrl}
                                name={row.team.name}
                                shortName={row.team.shortName}
                                className="w-6 h-6"
                              />
                              <span className="font-semibold text-foreground truncate max-w-[80px]">
                                {row.team.shortName || row.team.name}
                              </span>
                            </div>
                          </td>
                          <td className="py-2 text-center text-muted-foreground">{row.played}</td>
                          <td className="py-2 text-center text-muted-foreground">{row.won}</td>
                          <td className="py-2 text-center text-muted-foreground">{row.drawn}</td>
                          <td className="py-2 text-center text-muted-foreground">{row.lost}</td>
                          <td className="py-2 text-center text-muted-foreground">
                            {row.goalDifference > 0 ? `+${row.goalDifference}` : row.goalDifference}
                          </td>
                          <td className="py-2 text-center font-black text-primary pr-3">{row.points}</td>
                          <td className="py-2 pr-3">
                            <div className="flex items-center gap-0.5 justify-center">
                              {Array.from({ length: empties }).map((_, j) => (
                                <span key={`e${j}`} className="w-4 h-4 rounded-full border border-white/15 inline-block" />
                              ))}
                              {guide.map((r, j) => <FormDot key={j} result={r} />)}
                            </div>
                          </td>
                        </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                {uniqueLegend.length > 0 && (
                  <div className="px-3 py-2 border-t border-border/30 flex flex-wrap gap-x-4 gap-y-1">
                    {uniqueLegend.map(z => (
                      <div key={z.label} className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: ZONE_COLORS[z.type] }} />
                        <span className="text-[10px] text-muted-foreground">{z.label}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              );
            });
          })() : (
            <div className="py-12 text-center text-muted-foreground text-sm bg-card rounded-xl border border-dashed border-border">
              <Trophy className="w-8 h-8 mx-auto mb-2 opacity-30" />
              No finished matches yet — standings will appear here.
            </div>
          )}
        </div>
      )}

      {/* ── Stats tab ── */}
      {activeTab === "stats" && (
        <div className="space-y-4 px-4">
          {statsLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-40 w-full rounded-xl" />)}
            </div>
          ) : !statsData ? null : (
            <>
              <StatSection
                title="⚽ Top Scorers"
                emptyMsg="No goals logged yet"
                rows={statsData.topScorers}
                renderValue={p => (
                  <div className="flex flex-col items-end">
                    <span className="text-sm font-black text-emerald-400">{p.goals}</span>
                    {p.assists > 0 && <span className="text-[10px] text-muted-foreground">{p.assists} ast</span>}
                  </div>
                )}
                colLabel="Goals"
              />
              <StatSection
                title="🟨 Yellow Cards"
                emptyMsg="No yellow cards logged yet"
                rows={statsData.yellowCards}
                renderValue={p => <span className="text-sm font-black text-yellow-400">{p.count}</span>}
                colLabel="YC"
              />
              <StatSection
                title="🟥 Red Cards"
                emptyMsg="No red cards logged yet"
                rows={statsData.redCards}
                renderValue={p => <span className="text-sm font-black text-red-400">{p.count}</span>}
                colLabel="RC"
              />
              {statsData.ownGoals.length > 0 && (
                <StatSection
                  title="🙈 Own Goals"
                  emptyMsg=""
                  rows={statsData.ownGoals}
                  renderValue={p => <span className="text-sm font-black text-muted-foreground">{p.count}</span>}
                  colLabel="OG"
                />
              )}
              <MvpSection players={statsData.mvp} />
            </>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── Stat helpers ─── */

function playerInitials(name: string) {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

const AVATAR_COLORS = [
  "bg-orange-500", "bg-blue-500", "bg-emerald-500", "bg-purple-500",
  "bg-rose-500", "bg-amber-500", "bg-cyan-500", "bg-pink-500",
];
function avatarColor(name: string) {
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) & 0xffff;
  return AVATAR_COLORS[h % AVATAR_COLORS.length]!;
}

type ScorerRow = TopScorer;
type StatRow = TournamentPlayerStat;

function PlayerRow<T extends { playerName: string; playerNumber?: string | null; teamName: string; teamLogoUrl?: string | null }>({
  player, rank, renderValue,
}: { player: T; rank: number; renderValue: (p: T) => React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-border/30 last:border-0">
      <span className="text-xs text-muted-foreground w-5 text-center shrink-0">{rank}</span>
      <div className={cn("w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-[11px] font-black text-white", avatarColor(player.playerName))}>
        {playerInitials(player.playerName)}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-foreground truncate">
          {player.playerNumber ? `#${player.playerNumber} ` : ""}{player.playerName}
        </p>
        <p className="text-[10px] text-muted-foreground truncate">{player.teamName}</p>
      </div>
      {renderValue(player)}
    </div>
  );
}

function StatSection<T extends ScorerRow | StatRow>({
  title, rows, renderValue, colLabel, emptyMsg,
}: {
  title: string;
  rows: T[];
  renderValue: (p: T) => React.ReactNode;
  colLabel: string;
  emptyMsg: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const PREVIEW = 5;
  const visible = expanded ? rows : rows.slice(0, PREVIEW);

  return (
    <div className="bg-card rounded-xl border border-border overflow-hidden">
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <span className="text-sm font-black text-foreground">{title}</span>
        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">{colLabel}</span>
      </div>
      <div className="px-4">
        {rows.length === 0 ? (
          <p className="py-6 text-center text-xs text-muted-foreground">{emptyMsg}</p>
        ) : (
          <>
            {visible.map((p, i) => (
              <PlayerRow key={`${p.playerName}::${'teamId' in p ? p.teamId : i}`} player={p} rank={i + 1} renderValue={renderValue} />
            ))}
            {rows.length > PREVIEW && (
              <button
                onClick={() => setExpanded(e => !e)}
                className="w-full py-2.5 text-xs font-bold text-primary hover:text-primary/80 transition-colors"
              >
                {expanded ? "Show less" : `View ${rows.length - PREVIEW} more`}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function MvpSection({ players }: { players: TopScorer[] }) {
  if (players.length === 0) return (
    <div className="bg-card rounded-xl border border-border p-4">
      <p className="text-sm font-black text-foreground mb-1">🏅 Player of the Match</p>
      <p className="text-xs text-muted-foreground">No MVP awards logged yet.</p>
    </div>
  );

  return (
    <div className="bg-card rounded-xl border border-border overflow-hidden">
      <div className="px-4 py-3 border-b border-border">
        <span className="text-sm font-black text-foreground">🏅 Player of the Match</span>
      </div>
      <div className="px-4">
        {players.map((p, i) => (
          <PlayerRow key={`${p.playerName}::${p.teamId}`} player={p} rank={i + 1} renderValue={() => null} />
        ))}
      </div>
    </div>
  );
}
