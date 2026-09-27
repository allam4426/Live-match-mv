import { useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/useAuth";

export default function ProfilePage() {
  const { user, isLoaded, isSignedIn, logout } = useAuth();
  const [, navigate] = useLocation();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  if (isLoaded && !isSignedIn) {
    navigate("/sign-in");
    return null;
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess(false);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json() as { error?: string };
      if (!res.ok) throw new Error(data.error || "Could not change password");
      setSuccess(true);
      setCurrentPassword("");
      setNewPassword("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not change password");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-sm px-4 py-8">
      <h1 className="mb-1 text-xl font-black text-foreground">Profile</h1>
      <p className="mb-6 text-sm text-muted-foreground">Manage your account.</p>

      <div className="mb-6 rounded-xl border border-border bg-card p-4">
        <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Username</p>
        <p className="mb-3 text-sm font-semibold text-foreground">{user?.username}</p>
        <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Email</p>
        <p className="text-sm font-semibold text-foreground">{user?.email}</p>
      </div>

      <h2 className="mb-3 text-sm font-black text-foreground">Change password</h2>
      <form onSubmit={submit} className="space-y-3">
        <div>
          <label className="mb-1 block text-xs font-bold text-muted-foreground">Current password</label>
          <input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required
            className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-bold text-muted-foreground">New password</label>
          <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required minLength={6}
            className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground" />
        </div>
        {error && <p className="text-xs font-semibold text-red-500">{error}</p>}
        {success && <p className="text-xs font-semibold text-emerald-500">Password updated.</p>}
        <button type="submit" disabled={loading}
          className="h-11 w-full rounded-xl bg-primary text-sm font-black text-primary-foreground disabled:opacity-60">
          {loading ? "Saving…" : "Update password"}
        </button>
      </form>

      <button onClick={() => logout()} className="mt-6 w-full rounded-xl border border-red-500/30 bg-red-500/10 py-3 text-sm font-bold text-red-500">
        Log out
      </button>
    </div>
  );
}
