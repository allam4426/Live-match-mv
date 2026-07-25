import { useState, useEffect, useCallback } from "react";
import { Link } from "wouter";
import { ChevronLeft, Bell, BellOff, Search, X, Check } from "lucide-react";
import { useListTournaments } from "@workspace/api-client-react";
import { usePushNotifications } from "@/hooks/use-push-notifications";
import { TeamLogo } from "@/components/team-logo";
import { cn } from "@/lib/utils";

const PREF_KEY = "livemv_notif_prefs";

interface Prefs {
  tournaments: number[];
  teams: number[];
}

function loadPrefs(): Prefs {
  try {
    const raw = localStorage.getItem(PREF_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return { tournaments: [], teams: [] };
}

function savePrefs(p: Prefs) {
  try { localStorage.setItem(PREF_KEY, JSON.stringify(p)); } catch { /* ignore */ }
}

/* ── Toggle switch ── */
function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={cn(
        "relative inline-flex h-7 w-12 items-center rounded-full transition-colors duration-200",
        checked ? "bg-primary" : "bg-muted-foreground/30"
      )}
    >
      <span className={cn(
        "inline-block h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-200",
        checked ? "translate-x-6" : "translate-x-1"
      )} />
    </button>
  );
}

/* ── Tournament logo chip ── */
function TournamentChip({
  t, selected, onToggle,
}: {
  t: { id: number; name: string; logoUrl?: string | null; season: string };
  selected: boolean;
  onToggle: () => void;
}) {
  const shortName = t.name.replace(/\s+\d{4}.*$/, "").trim();
  const year = t.season.slice(0, 4);
  return (
    <button
      type="button"
      onClick={onToggle}
      className={cn(
        "flex flex-col items-center gap-1.5 p-2 rounded-2xl border-2 transition-all min-w-[64px]",
        selected
          ? "border-primary bg-primary/10"
          : "border-transparent bg-muted/30 hover:bg-muted/50"
      )}
    >
      <div className="relative w-12 h-12 rounded-xl overflow-hidden bg-muted/40 flex items-center justify-center">
        {t.logoUrl ? (
          <img src={t.logoUrl} alt={t.name} className="w-10 h-10 object-contain" />
        ) : (
          <span className="text-xl">🏆</span>
        )}
        {selected && (
          <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
            <Check className="w-4 h-4 text-primary" />
          </div>
        )}
      </div>
      <span className="text-[10px] font-semibold text-center leading-tight text-foreground max-w-[60px] truncate">
        {shortName} {year}
      </span>
    </button>
  );
}

export default function NotificationsPage() {
  const { permission, subscribed, loading, subscribe, unsubscribe } = usePushNotifications();
  const { data: tournaments = [] } = useListTournaments();
  const [prefs, setPrefs] = useState<Prefs>(loadPrefs);
  const [teamSearch, setTeamSearch] = useState("");

  // Persist on change
  useEffect(() => { savePrefs(prefs); }, [prefs]);

  const toggleEnabled = useCallback(async (want: boolean) => {
    if (want) await subscribe();
    else await unsubscribe();
  }, [subscribe, unsubscribe]);

  const toggleTournament = (id: number) => {
    setPrefs(p => ({
      ...p,
      tournaments: p.tournaments.includes(id)
        ? p.tournaments.filter(t => t !== id)
        : [...p.tournaments, id],
    }));
  };

  // Collect unique teams from selected (or all) tournaments
  const selectedTournaments = prefs.tournaments.length > 0
    ? tournaments.filter(t => prefs.tournaments.includes(t.id))
    : tournaments;

  const isEnabled = subscribed;

  return (
    <div className="min-h-screen pb-24">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/90 backdrop-blur border-b border-border/40">
        <div className="flex items-center gap-3 px-4 py-4">
          <Link href="/more">
            <button className="w-8 h-8 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
              <ChevronLeft className="w-5 h-5" />
            </button>
          </Link>
          <h1 className="text-lg font-black text-foreground">Notifications</h1>
        </div>
      </div>

      <div className="px-4 pt-5 space-y-4">

        {/* Enable toggle card */}
        <div className="bg-card rounded-2xl border border-border px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {isEnabled
              ? <Bell className="w-5 h-5 text-primary" />
              : <BellOff className="w-5 h-5 text-muted-foreground" />
            }
            <div>
              <p className="text-sm font-semibold text-foreground">Enable notifications</p>
              {permission === "denied" && (
                <p className="text-[11px] text-red-400 mt-0.5">Blocked — enable in browser settings</p>
              )}
            </div>
          </div>
          <Toggle
            checked={isEnabled}
            onChange={toggleEnabled}
          />
        </div>

        {/* When disabled, show a hint */}
        {!isEnabled && permission !== "denied" && (
          <p className="text-[12px] text-muted-foreground text-center px-4">
            Enable notifications to get alerts when your favourite matches go live, goals are scored, and more.
          </p>
        )}

        {/* Tournament section */}
        <div className={cn("bg-card rounded-2xl border border-border overflow-hidden transition-opacity", !isEnabled && "opacity-40 pointer-events-none")}>
          <div className="px-4 pt-4 pb-2">
            <p className="text-sm font-bold text-foreground">Tournament</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">Choose which tournaments to follow</p>
          </div>
          {tournaments.length === 0 ? (
            <p className="px-4 pb-4 text-xs text-muted-foreground">No tournaments available</p>
          ) : (
            <div className="px-3 pb-4 overflow-x-auto">
              <div className="flex gap-2 w-max">
                {tournaments.map(t => (
                  <TournamentChip
                    key={t.id}
                    t={t}
                    selected={prefs.tournaments.includes(t.id)}
                    onToggle={() => toggleTournament(t.id)}
                  />
                ))}
              </div>
            </div>
          )}
          {prefs.tournaments.length > 0 && (
            <div className="px-4 pb-3 flex items-center gap-2 border-t border-border/40 pt-2">
              <span className="text-[11px] text-muted-foreground">{prefs.tournaments.length} selected</span>
              <button onClick={() => setPrefs(p => ({ ...p, tournaments: [] }))}
                className="text-[11px] text-primary font-semibold">
                Clear all
              </button>
            </div>
          )}
        </div>

        {/* Teams section */}
        <div className={cn("bg-card rounded-2xl border border-border overflow-hidden transition-opacity", !isEnabled && "opacity-40 pointer-events-none")}>
          <div className="px-4 pt-4 pb-3">
            <p className="text-sm font-bold text-foreground">Teams</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">Get notified for your favourite teams</p>
            <div className="mt-3 relative">
              <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                value={teamSearch}
                onChange={e => setTeamSearch(e.target.value)}
                placeholder="Search team"
                className="w-full bg-muted/40 border border-border rounded-xl pl-9 pr-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/50 transition-colors"
              />
              {teamSearch && (
                <button onClick={() => setTeamSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
          {prefs.tournaments.length === 0 && !teamSearch && (
            <p className="px-4 pb-4 text-xs text-muted-foreground">Select a tournament above to see teams, or search by name.</p>
          )}
        </div>

        {/* Notification types */}
        <div className={cn("bg-card rounded-2xl border border-border overflow-hidden transition-opacity", !isEnabled && "opacity-40 pointer-events-none")}>
          <div className="px-4 pt-4 pb-1">
            <p className="text-sm font-bold text-foreground">Alert types</p>
          </div>
          {[
            { icon: "🔴", label: "Match starts", desc: "When a selected match goes live" },
            { icon: "⚽", label: "Goals", desc: "Goal scored in a selected match" },
            { icon: "🥅", label: "Penalty shootout", desc: "When a penalty shootout begins" },
            { icon: "🏁", label: "Full time", desc: "When a match ends" },
          ].map((item, i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-3 border-t border-border/40">
              <span className="text-xl w-7 text-center">{item.icon}</span>
              <div className="flex-1">
                <p className="text-sm font-semibold text-foreground">{item.label}</p>
                <p className="text-[11px] text-muted-foreground">{item.desc}</p>
              </div>
              <Toggle checked={isEnabled} onChange={toggleEnabled} />
            </div>
          ))}
          <div className="pb-2" />
        </div>

      </div>
    </div>
  );
}
