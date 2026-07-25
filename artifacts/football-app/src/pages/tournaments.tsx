import { useListActiveTournaments } from "@workspace/api-client-react";
import { Link } from "wouter";
import { Trophy, Layers, Search } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useState } from "react";

const FORMAT_LABELS: Record<string, string> = {
  league: "League",
  group_stage: "Group Stage",
  knockout: "Knockout",
};

const STATUS_BADGE: Record<string, { label: string; className: string; dot?: boolean }> = {
  live:     { label: "Live",     className: "bg-red-500/15 text-red-400 border-red-500/25",    dot: true  },
  upcoming: { label: "Upcoming", className: "bg-blue-500/10 text-blue-400 border-blue-500/25"             },
  ongoing:  { label: "Ongoing",  className: "bg-emerald-500/10 text-emerald-400 border-emerald-500/25"    },
  finished: { label: "Finished", className: "bg-muted text-muted-foreground border-border"                },
};

export default function TournamentsPage() {
  const { data: tournaments, isLoading } = useListActiveTournaments();
  const [sport, setSport] = useState<"All" | "football" | "futsal">("All");
  const [q, setQ] = useState("");

  const filtered = tournaments?.filter(t => {
    const sportOk = sport === "All" || t.sport === sport;
    const qOk = !q || t.name.toLowerCase().includes(q.toLowerCase());
    return sportOk && qOk;
  }) ?? [];

  const ongoing  = filtered.filter(t => t.matchStatus === "ongoing" || t.matchStatus === "live");
  const upcoming = filtered.filter(t => t.matchStatus === "upcoming");
  const finished = filtered.filter(t => t.matchStatus === "finished");

  function TournamentCard({ t }: { t: typeof filtered[0] }) {
    const badge = STATUS_BADGE[t.matchStatus ?? "finished"] ?? STATUS_BADGE.finished!;
    return (
      <Link href={`/tournament/${t.id}`}>
        <div className="bg-card border border-border rounded-2xl p-4 cursor-pointer hover:border-primary/50 transition-all active:scale-[0.98]">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center shrink-0 overflow-hidden">
              {t.logoUrl ? (
                <img src={t.logoUrl} alt={t.name} className="w-10 h-10 object-contain" />
              ) : (
                <Trophy className="w-6 h-6 text-muted-foreground" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-black text-foreground leading-tight line-clamp-2">{t.name}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5 capitalize">{t.sport} · {t.season}</p>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <span className={cn(
              "inline-flex items-center gap-1.5 text-[10px] font-bold px-2 py-0.5 rounded-full border",
              badge.className
            )}>
              {badge.dot && <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />}
              {badge.label}
            </span>
            <div className="flex items-center gap-1 text-muted-foreground">
              <Layers className="w-3 h-3" />
              <span className="text-[10px] font-semibold">{FORMAT_LABELS[t.format] ?? t.format}</span>
            </div>
          </div>

          {t.description && (
            <p className="text-[10px] text-muted-foreground/60 mt-2 line-clamp-1">{t.description}</p>
          )}
        </div>
      </Link>
    );
  }

  function Section({ title, items }: { title: string; items: typeof filtered }) {
    if (items.length === 0) return null;
    return (
      <div>
        <h2 className="text-xs font-black text-muted-foreground uppercase tracking-wider px-4 mb-2">{title}</h2>
        <div className="grid grid-cols-1 gap-2 px-4">
          {items.map(t => <TournamentCard key={t.id} t={t} />)}
        </div>
      </div>
    );
  }

  return (
    <div className="pb-6 pt-2">
      {/* Header */}
      <div className="px-4 mb-4">
        <h1 className="text-xl font-black text-foreground">Tournaments</h1>
        <p className="text-sm text-muted-foreground mt-0.5">All competitions and leagues</p>
      </div>

      {/* Search */}
      <div className="px-4 mb-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="Search tournaments..."
            className="w-full bg-card border border-border rounded-xl py-2.5 pl-9 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50"
          />
        </div>
      </div>

      {/* Sport filter */}
      <div className="flex items-center gap-2 px-4 mb-4">
        {(["All", "football", "futsal"] as const).map(s => (
          <button key={s} onClick={() => setSport(s)}
            className={cn(
              "rounded-full px-4 py-1.5 text-xs font-semibold border transition-all capitalize",
              sport === s
                ? "bg-primary text-white border-primary"
                : "bg-card text-muted-foreground border-border hover:border-primary/40"
            )}>{s}</button>
        ))}
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="grid grid-cols-1 gap-2 px-4">
          {[1,2,3,4,5].map(i => <Skeleton key={i} className="h-24 w-full rounded-2xl" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-20 text-center px-4">
          <Trophy className="w-10 h-10 mx-auto mb-3 opacity-20" />
          <p className="text-sm font-medium text-muted-foreground">No tournaments found</p>
        </div>
      ) : (
        <div className="space-y-5">
          <Section title="Live & Ongoing" items={ongoing} />
          <Section title="Upcoming" items={upcoming} />
          <Section title="Finished" items={finished} />
        </div>
      )}
    </div>
  );
}
