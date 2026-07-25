import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import { Switch, Route } from "wouter";
import Home from "./pages/home";
import LiveMatches from "./pages/live";
import MatchDetails from "./pages/match";
import AdminDashboard from "./pages/admin";
import NotFound from "./pages/not-found";
import StreamPage from "./pages/stream";
import TournamentPage from "./pages/tournament";
import TournamentsPage from "./pages/tournaments";
import PlayersPage from "./pages/players";
import PlayerProfilePage from "./pages/player";
import TeamProfilePage from "./pages/team";
import TeamsPage from "./pages/teams";
import MorePage from "./pages/more";
import NotificationsPage from "./pages/notifications";

const queryClient = new QueryClient();

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Layout>
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
      </Layout>
    </QueryClientProvider>
  );
}
