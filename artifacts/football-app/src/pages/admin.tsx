import { useAdminMe, useAdminLogin, useAdminLogout, getAdminMeQueryKey, useGetStatsSummary } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { TeamsTab } from "@/components/admin/teams-tab";
import { TournamentsTab } from "@/components/admin/tournaments-tab";
import { MatchesTab } from "@/components/admin/matches-tab";
import { EventsTab } from "@/components/admin/events-tab";
import { LineupTab } from "@/components/admin/lineup-tab";
import { StreamsTab } from "@/components/admin/streams-tab";
import { PlayersTab } from "@/components/admin/players-tab";
import { BannersTab } from "@/components/admin/banners-tab";
import { TrophiesTab } from "@/components/admin/trophies-tab";
import { SpotlightsTab } from "@/components/admin/spotlights-tab";
import { StaffTab } from "@/components/admin/staff-tab";
import { Activity, Calendar, CheckCircle2, Users, Trophy, LayoutGrid, LogOut, Lock, Image, UserCog, Mail } from "lucide-react";

const SUPERADMIN_TABS = ["Overview", "Spotlights", "Teams", "Players", "Tournaments", "Matches", "Live Events", "Lineup", "Streams", "Banners", "Staff"] as const;
const STAFF_TABS = ["Overview", "Spotlights", "Teams", "Players", "Tournaments", "Matches", "Live Events", "Lineup", "Streams", "Banners"] as const;
type Tab = typeof SUPERADMIN_TABS[number];

function LoginPage() {
  const [mode, setMode] = useState<"superadmin" | "staff">("superadmin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const queryClient = useQueryClient();
  const login = useAdminLogin();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const data = mode === "staff" ? { email, password } : { password };
    login.mutate({ data }, {
      onSuccess: (result) => {
        if (result.authenticated) {
          queryClient.invalidateQueries({ queryKey: getAdminMeQueryKey() });
        } else {
          setError("Wrong credentials. Try again.");
        }
      },
      onError: () => setError("Wrong credentials. Try again."),
    });
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-primary/15 border border-primary/30 flex items-center justify-center mx-auto mb-4">
            <Lock className="w-7 h-7 text-primary" />
          </div>
          <h1 className="text-2xl font-black text-foreground">Admin Access</h1>
          <p className="text-sm text-muted-foreground mt-1">Livematchmv control panel</p>
        </div>

        {/* Mode toggle */}
        <div className="flex rounded-xl border border-border overflow-hidden mb-4 bg-card">
          <button
            type="button"
            onClick={() => { setMode("superadmin"); setError(""); }}
            className={cn(
              "flex-1 py-2 text-xs font-semibold transition-all",
              mode === "superadmin" ? "bg-primary text-white" : "text-muted-foreground"
            )}
          >
            Master Admin
          </button>
          <button
            type="button"
            onClick={() => { setMode("staff"); setError(""); }}
            className={cn(
              "flex-1 py-2 text-xs font-semibold transition-all",
              mode === "staff" ? "bg-primary text-white" : "text-muted-foreground"
            )}
          >
            Staff Login
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          {mode === "staff" && (
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1.5">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="staff@livematchmv.online"
                  required
                  className="w-full pl-10 pr-4 py-3 bg-card border border-border rounded-xl text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary text-sm"
                />
              </div>
            </div>
          )}
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1.5">Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Enter password"
              data-testid="input-admin-password"
              className="w-full bg-card border border-border rounded-xl px-4 py-3 text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary text-sm"
            />
          </div>
          {error && <p className="text-xs text-red-400 font-medium">{error}</p>}
          <button
            type="submit"
            disabled={login.isPending}
            data-testid="button-admin-login"
            className="w-full bg-primary text-white font-bold py-3 rounded-xl text-sm hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {login.isPending ? "Signing in..." : "Sign In"}
          </button>
        </form>

      </div>
    </div>
  );
}

function OverviewTab() {
  const { data: stats, isLoading } = useGetStatsSummary();
  const [seeding, setSeeding] = useState(false);
  const [seedMsg, setSeedMsg] = useState("");

  const handleSeed = async () => {
    if (!confirm("This will add demo teams, a tournament, and sample matches. Only works on an empty database. Continue?")) return;
    setSeeding(true);
    setSeedMsg("");
    try {
      const res = await fetch("/api/admin/seed", { method: "POST", credentials: "include" });
      const data = await res.json();
      setSeedMsg(res.ok ? "✅ " + data.message : "❌ " + (data.error ?? "Failed"));
      if (res.ok) window.location.reload();
    } catch {
      setSeedMsg("❌ Network error");
    } finally {
      setSeeding(false);
    }
  };

  const cards = [
    { label: "Live", value: stats?.liveMatchCount, icon: Activity, color: "text-red-400", bg: "bg-red-500/10" },
    { label: "Scheduled", value: stats?.scheduledMatchCount, icon: Calendar, color: "text-blue-400", bg: "bg-blue-500/10" },
    { label: "Finished", value: stats?.finishedMatchCount, icon: CheckCircle2, color: "text-muted-foreground", bg: "bg-muted/50" },
    { label: "Teams", value: stats?.totalTeams, icon: Users, color: "text-primary", bg: "bg-primary/10" },
    { label: "Streams", value: stats?.totalStreams, icon: Trophy, color: "text-yellow-400", bg: "bg-yellow-500/10" },
    { label: "Tournaments", value: stats?.totalTournaments, icon: LayoutGrid, color: "text-green-400", bg: "bg-green-500/10" },
  ];
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {isLoading ? Array.from({ length: 7 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />) :
          cards.map((c, i) => {
            const Icon = c.icon;
            return (
              <div key={i} className="bg-card rounded-xl border border-border p-4 flex flex-col gap-3">
                <div className={`w-9 h-9 rounded-xl ${c.bg} flex items-center justify-center`}>
                  <Icon className={`w-5 h-5 ${c.color}`} />
                </div>
                <div>
                  <div className="text-2xl font-black text-foreground">{c.value ?? 0}</div>
                  <div className="text-xs text-muted-foreground font-medium">{c.label}</div>
                </div>
              </div>
            );
          })}
      </div>

      {/* Seed demo data */}
      <div className="bg-card rounded-xl border border-border p-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-bold text-foreground">Seed Demo Data</p>
            <p className="text-xs text-muted-foreground mt-0.5">Populate the database with sample Maldivian teams, a tournament, and matches. Only works on an empty database.</p>
            {seedMsg && <p className="text-xs mt-2 font-medium">{seedMsg}</p>}
          </div>
          <button
            onClick={handleSeed}
            disabled={seeding}
            className="shrink-0 bg-primary/10 text-primary border border-primary/30 text-xs font-bold px-4 py-2 rounded-xl hover:bg-primary/20 transition-colors disabled:opacity-50"
          >
            {seeding ? "Seeding…" : "Seed Data"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AdminDashboard() {
  const { data: auth, isLoading } = useAdminMe();
  const logout = useAdminLogout();
  const queryClient = useQueryClient();
  const isSuperadmin = auth?.role === "superadmin";
  const TABS = isSuperadmin ? SUPERADMIN_TABS : STAFF_TABS;
  const [activeTab, setActiveTab] = useState<Tab>("Overview");

  const handleLogout = () => {
    logout.mutate(undefined, {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: getAdminMeQueryKey() }),
    });
  };

  if (isLoading) return (
    <div className="px-4 pt-4 space-y-4">
      <Skeleton className="h-10 w-full rounded-xl" />
      <div className="grid grid-cols-2 gap-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}</div>
    </div>
  );

  if (!auth?.authenticated) return <LoginPage />;

  const tabContent: Record<Tab, React.ReactNode> = {
    "Overview": <OverviewTab />,
    "Spotlights": <SpotlightsTab />,
    "Teams": <TeamsTab />,
    "Players": <PlayersTab />,
    "Tournaments": <TournamentsTab />,
    "Matches": <MatchesTab />,
    "Live Events": <EventsTab />,
    "Lineup": <LineupTab />,
    "Streams": <StreamsTab />,
    "Banners": <BannersTab />,
    "Trophies": <TrophiesTab />,
    "Staff": <StaffTab />,
  };

  return (
    <div className="pb-24">
      {/* Admin header */}
      <div className="flex items-center justify-between px-4 pt-4 pb-3">
        <div>
          <h1 className="text-xl font-black text-foreground">Admin Dashboard</h1>
          <p className="text-xs text-muted-foreground">
            {isSuperadmin ? "Master Admin" : auth?.name ?? auth?.email ?? "Staff"} • Logged in
          </p>
        </div>
        <button onClick={handleLogout} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground bg-muted rounded-xl px-3 py-2 transition-colors">
          <LogOut className="w-3.5 h-3.5" />
          Logout
        </button>
      </div>

      {/* Tab bar */}
      <div className="flex items-center gap-1.5 overflow-x-auto hide-scrollbar px-4 pb-3">
        {TABS.map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            data-testid={`admin-tab-${tab.toLowerCase().replace(/\s+/g, "-")}`}
            className={cn(
              "shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold border transition-all",
              activeTab === tab
                ? "bg-primary text-white border-primary"
                : "bg-card text-muted-foreground border-border hover:border-primary/40"
            )}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="px-4">
        {tabContent[activeTab as Tab]}
      </div>
    </div>
  );
}
