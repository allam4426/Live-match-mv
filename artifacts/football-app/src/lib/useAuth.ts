import { useEffect, useState, useCallback } from "react";

export type AuthUser = { id: string; username: string; email: string; name: string } | null;

export function useAuth() {
  const [user, setUser] = useState<AuthUser>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/me", { credentials: "include" });
      const data = await res.json() as { user: AuthUser };
      setUser(data.user);
    } finally {
      setIsLoaded(true);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const logout = useCallback(async () => {
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    setUser(null);
  }, []);

  return { user, isSignedIn: Boolean(user), isLoaded, refresh, logout };
}
