import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ClerkProvider, SignIn, SignUp } from "@clerk/react";
import { publishableKeyFromHost } from "@clerk/react/internal";
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
const AboutPage = lazy(() => import("./pages/about"));
const PrivacyPage = lazy(() => import("./pages/privacy"));
const TermsPage = lazy(() => import("./pages/terms"));
const PlayerProfilePage = lazy(() => import("./pages/player"));
const TeamProfilePage = lazy(() => import("./pages/team"));
const TeamsPage = lazy(() => import("./pages/teams"));
const MorePage = lazy(() => import("./pages/more"));
const NotificationsPage = lazy(() => import("./pages/notifications"));
const GamesPage = lazy(() => import("./pages/predictions"));
const clerkPubKey = publishableKeyFromHost(window.location.hostname, import.meta.env.VITE_CLERK_PUBLISHABLE_KEY);
const clerkAppearance = { variables: { colorPrimary: "#ff634d", colorBackground: "#12213b", colorForeground: "#f5f7fb", colorInput: "#172a49", colorInputForeground: "#f5f7fb", colorMutedForeground: "#95a4bb", borderRadius: "0.8rem" } };
const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: 5 * 60_000, gcTime: 30 * 60_000, refetchOnWindowFocus: false, refetchOnReconnect: false, retry: 1 } } });
function AuthPage({ mode }: { mode: "sign-in" | "sign-up" }) { return <div className="flex min-h-[calc(100dvh-5rem)] items-center justify-center px-4 py-8">{mode === "sign-in" ? <SignIn routing="path" path="/sign-in" signUpUrl="/sign-up" appearance={clerkAppearance} /> : <SignUp routing="path" path="/sign-up" signInUrl="/sign-in" appearance={clerkAppearance} />}</div>; }
export default function App() {
  if (!clerkPubKey) throw new Error("Missing VITE_CLERK_PUBLISHABLE_KEY");
  return <ClerkProvider publishableKey={clerkPubKey} signInUrl="/sign-in" signUpUrl="/sign-up" appearance={clerkAppearance}><QueryClientProvider client={queryClient}><Layout><Suspense fallback={null}><Switch><Route path="/sign-in/*?" component={() => <AuthPage mode="sign-in" />} /><Route path="/sign-up/*?" component={() => <AuthPage mode="sign-up" />} /><Route path="/" component={Home} /><Route path="/live" component={LiveMatches} /><Route path="/match/:id" component={MatchDetails} /><Route path="/stream/:id" component={StreamPage} /><Route path="/tournament/:id" component={TournamentPage} /><Route path="/tournaments" component={TournamentsPage} /><Route path="/players" component={PlayersPage} /><Route path="/about" component={AboutPage} /><Route path="/privacy" component={PrivacyPage} /><Route path="/terms" component={TermsPage} /><Route path="/player/:id" component={PlayerProfilePage} /><Route path="/team/:id" component={TeamProfilePage} /><Route path="/teams" component={TeamsPage} /><Route path="/more/games/:tournamentId?" component={GamesPage} /><Route path="/more" component={MorePage} /><Route path="/notifications" component={NotificationsPage} /><Route path="/admin" component={AdminDashboard} /><Route component={NotFound} /></Switch></Suspense></Layout></QueryClientProvider></ClerkProvider>;
}
