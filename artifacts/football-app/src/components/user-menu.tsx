import { useState, useRef, useEffect } from "react";
import { Link } from "wouter";
import { User as UserIcon, LogOut, Settings } from "lucide-react";
import { useAuth } from "@/lib/useAuth";

export function UserMenu() {
  const { user, isSignedIn, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  if (!isSignedIn) {
    return (
      <Link href="/sign-in">
        <span className="rounded-full bg-primary px-3 py-1.5 text-xs font-black text-primary-foreground cursor-pointer">
          Sign in
        </span>
      </Link>
    );
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-8 h-8 rounded-full flex items-center justify-center bg-primary/15 text-primary font-black text-xs hover:bg-primary/25 transition-colors"
      >
        {(user?.name || user?.username || "?").slice(0, 1).toUpperCase()}
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-48 rounded-xl border border-border bg-card p-2 shadow-lg z-50">
          <div className="px-2 py-2 border-b border-border mb-1">
            <p className="text-sm font-bold text-foreground truncate">{user?.name || user?.username}</p>
            <p className="text-[11px] text-muted-foreground truncate">{user?.email}</p>
          </div>
          <Link href="/profile">
            <span onClick={() => setOpen(false)} className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm font-semibold text-foreground hover:bg-muted transition-colors cursor-pointer">
              <Settings className="w-4 h-4" /> Profile & password
            </span>
          </Link>
          <button
            onClick={() => { logout(); setOpen(false); }}
            className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm font-semibold text-red-500 hover:bg-red-500/10 transition-colors"
          >
            <LogOut className="w-4 h-4" /> Logout
          </button>
        </div>
      )}
    </div>
  );
}
