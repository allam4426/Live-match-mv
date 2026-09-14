import { useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/useAuth";

export default function AuthPage({ mode }: { mode: "sign-in" | "sign-up" }) {
  const [, navigate] = useLocation();
  const { refresh } = useAuth();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const isSignUp = mode === "sign-up";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const url = isSignUp ? "/api/auth/signup" : "/api/auth/login";
      const body = isSignUp ? { username, email, password } : { username, password };
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      const data = await res.json() as { error?: string };
      if (!res.ok) throw new Error(data.error || "Something went wrong");
      await refresh();
      navigate("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-[calc(100dvh-5rem)] max-w-sm flex-col justify-center px-4 py-8">
      <h1 className="mb-1 text-xl font-black text-foreground">{isSignUp ? "Create account" : "Sign in"}</h1>
      <p className="mb-6 text-sm text-muted-foreground">{isSignUp ? "Sign up to make predictions and join the leaderboard." : "Welcome back."}</p>
      <form onSubmit={submit} className="space-y-3">
        <div>
          <label className="mb-1 block text-xs font-bold text-muted-foreground">Username</label>
          <input value={username} onChange={(e) => setUsername(e.target.value)} required minLength={3}
            className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground" />
        </div>
        {isSignUp && (
          <div>
            <label className="mb-1 block text-xs font-bold text-muted-foreground">Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required
              className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground" />
          </div>
        )}
        <div>
          <label className="mb-1 block text-xs font-bold text-muted-foreground">Password</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6}
            className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground" />
        </div>
        {error && <p className="text-xs font-semibold text-red-500">{error}</p>}
        <button type="submit" disabled={loading}
          className="h-11 w-full rounded-xl bg-primary text-sm font-black text-primary-foreground disabled:opacity-60">
          {loading ? "Please wait…" : isSignUp ? "Sign up" : "Sign in"}
        </button>
      </form>
      <p className="mt-4 text-center text-xs text-muted-foreground">
        {isSignUp ? "Already have an account? " : "Don't have an account? "}
        <a href={isSignUp ? "/sign-in" : "/sign-up"} className="font-bold text-primary">{isSignUp ? "Sign in" : "Sign up"}</a>
      </p>
    </div>
  );
}
