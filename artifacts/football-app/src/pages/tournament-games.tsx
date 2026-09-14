import { useEffect, useState } from "react";
import { useRoute, Link } from "wouter";

type Match = {
  id: number;
  homeTeam?: { name: string } | null;
  awayTeam?: { name: string } | null;
  status: string;
  tournamentId: number | null;
};

type Tournament = {
  id: number;
  name: string;
  logoUrl: string | null;
};

export default function TournamentGames() {
  const [, params] = useRoute("/games/tournament/:id");
  const tournamentId = params?.id ? Number(params.id) : null;
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [matches, setMatches] = useState<Match[]>([]);

  useEffect(() => {
    if (!tournamentId) return;
    fetch("/api/tournaments").then(r => r.json()).then((all: Tournament[]) => {
      setTournament(all.find(t => t.id === tournamentId) ?? null);
    });
    fetch("/api/matches?limit=100").then(r => r.json()).then((all: Match[]) => {
      setMatches(all.filter(m => m.tournamentId === tournamentId && m.status === "scheduled"));
    });
  }, [tournamentId]);

  return (
    <div className="max-w-md mx-auto p-4 space-y-3">
      <div className="flex items-center gap-3">
        {tournament?.logoUrl && (
          <img src={tournament.logoUrl} alt={tournament.name} className="w-10 h-10 rounded-lg object-contain bg-muted" />
        )}
        <h1 className="text-lg font-black">{tournament?.name ?? "Tournament"}</h1>
      </div>

      {matches.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-10">No upcoming matches to predict in this tournament yet.</p>
      )}

      {matches.map(m => (
        <Link key={m.id} href={`/predict/${m.id}`}>
          <div className="bg-card border border-border rounded-2xl p-4 cursor-pointer hover:brightness-110 transition-all">
            <p className="font-bold text-sm">{m.homeTeam?.name ?? "TBD"} vs {m.awayTeam?.name ?? "TBD"}</p>
            <p className="text-xs text-primary font-semibold mt-2">Guess the score →</p>
          </div>
        </Link>
      ))}
    </div>
  );
}
