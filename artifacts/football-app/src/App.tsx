import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import { Switch, Route } from "wouter";
import { lazy, Suspense } from "react";
import Home from "./pages/home";

const LiveMatches = lazy(() => import("./pages/live"));
const MatchDetails = lazy(() => import("./pages/match"));
const AdminDashboard = lazy(() => import("./pages/admin"));
const NotFound = lazy(() => import("./pages/not-found"));
const StreamPage = lazy(() => import("./pages/stream"));
const TournamentPage = lazy(() => import("./pages/tournament"));
const TournamentsPage = lazy(() => import("./pages/tournaments"));
const PlayersPage = lazy(() => import("./pages/players"));
const PlayerProfilePage = lazy(() => import("./pages/player"));
const TeamProfilePage = lazy(() => import("./pages/team"));
const TeamsPage = lazy(() => import("./pages/teams"));
const MorePage = lazy(() => import("./pages/more"));
const NotificationsPage = lazy(() => import("./pages/notifications"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 10_000,
      gcTime: 5 * 60_000,
    },
  },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Layout>
        <Suspense fallback={null}>
          <Switch>
            <Route path="/" component={Home} />
            <Route path="/live" component={LiveMatches} />
            <Route path="/match/:id" component={MatchDetails} />
            <Route path="/stream/:id" component={StreamPage} />
            <Route path="/tournament/:id" component={TournamentPage} />
            <Route path="/tournaments" component={TournamentsPage} />
            <Route path="/players" component={PlayersPage} />
            <Route path="/player/:id" component={PlayerProfilePage} />
            <Route path="/team/:id" component={TeamProfilePage} />
            <Route path="/teams" component={TeamsPage} />
            <Route path="/more" component={MorePage} />
            <Route path="/notifications" component={NotificationsPage} />
            <Route path="/admin" component={AdminDashboard} />
            <Route component={NotFound} />
          </Switch>
        </Suspense>
      </Layout>
    </QueryClientProvider>
  );
}
