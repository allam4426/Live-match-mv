import { useEffect, useState } from "react";
import { Link } from "wouter";
import { Trophy } from "lucide-react";

type Tournament = {
  id: number;
  name: string;
  logoUrl: string | null;
  active: boolean;
  matchStatus: string;
};

export default function Games() {
  const [tournaments, setTournaments] = useState<Tournament[]>([]);

  useEffect(() => {
    fetch("/api/tournaments/active")
      .then(r => r.json())
      .then((data: Tournament[]) => {
        setTournaments(data.filter(t => t.active && t.matchStatus !== "finished"));
      });
  }, []);

  return (
    <div className="max-w-md mx-auto p-4 space-y-4">
      <div>
        <p className="text-xs font-bold uppercase tracking-widest text-primary">Livematch Games</p>
        <h1 className="text-2xl font-black mt-1">Games</h1>
        <p className="text-sm text-muted-foreground mt-1">Join a tournament prediction game and guess the final scores.</p>
      </div>

      {tournaments.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-10">No ongoing or upcoming tournaments right now.</p>
      )}

      {tournaments.map(t => (
        <Link key={t.id} href={`/games/tournament/${t.id}`}>
          <div className="bg-card border border-border rounded-2xl p-4 flex items-center gap-4 cursor-pointer hover:brightness-110 transition-all">
            <div className="w-14 h-14 rounded-xl bg-muted flex items-center justify-center overflow-hidden shrink-0">
              {t.logoUrl ? (
                <img src={t.logoUrl} alt={t.name} className="w-full h-full object-contain" />
              ) : (
                <Trophy className="w-6 h-6 text-muted-foreground" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-sm leading-tight">{t.name}</p>
              <p className="text-xs text-muted-foreground mt-0.5 capitalize">{t.matchStatus}</p>
              <p className="text-xs text-primary font-semibold mt-1.5">Guess the score →</p>
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}
