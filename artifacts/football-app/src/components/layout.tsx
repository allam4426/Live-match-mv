import { cn } from "@/lib/utils";
import { Link, useLocation } from "wouter";
import { Home as HomeIcon, Gamepad2, LayoutGrid, Sun, Moon, Trophy, Users, Lock, MoreHorizontal } from "lucide-react";
import { useAdminMe } from "@workspace/api-client-react";
import { useTheme } from "@/hooks/use-theme";
import { PushBell } from "./push-bell";

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { data: auth } = useAdminMe();
  const isAdmin = auth?.authenticated === true;
  const { theme, toggle } = useTheme();

  const topNav = [
    { href: "/", label: "Home" },
    { href: "/teams", label: "Teams" },
    { href: "/live", label: "Live" },
    { href: "/tournaments", label: "Tournaments" },
    { href: "/players", label: "Players" },
  { href: "/about", label: "About Us" },
  { href: "/privacy", label: "Privacy Policy" },
    ...(isAdmin ? [{ href: "/admin", label: "Admin" }] : []),
  ];

  const bottomNav = [
    { href: "/", label: "Home", icon: HomeIcon },
    { href: "/live", label: "Live", icon: Gamepad2 },
    { href: "/tournaments", label: "Cups", icon: Trophy },
    { href: "/players", label: "Players", icon: Users },
    { href: "/more", label: "More", icon: MoreHorizontal },
    ...(isAdmin ? [{ href: "/admin", label: "Admin", icon: LayoutGrid }] : []),
  ];

  return (
    <div className="min-h-[100dvh] bg-background text-foreground flex flex-col font-sans">
      {/* Top Nav */}
      <header className="sticky top-0 z-50 w-full bg-card border-b border-border">
        <div className="max-w-lg mx-auto md:max-w-7xl flex h-12 items-center justify-between px-4">
          <Link href="/">
            <span className="flex items-center gap-2 cursor-pointer">
              <img src="/logo.png" alt="Livematchmv" className="h-8 w-8 object-contain rounded-lg" />
              <span className="font-black text-xl tracking-tight leading-none">
                <span className="text-primary">Live</span><span className="text-foreground">matchmv</span>
              </span>
            </span>
          </Link>
          <div className="flex items-center gap-4">
            <nav className="hidden md:flex items-center gap-6">
              {topNav.map((item) => (
                <Link key={item.href} href={item.href}>
                  <span className={cn(
                    "text-sm font-medium transition-colors hover:text-primary cursor-pointer",
                    location === item.href ? "text-primary" : "text-muted-foreground"
                  )}>
                    {item.label}
                  </span>
                </Link>
              ))}
              {!isAdmin && (
                <Link href="/admin">
                  <span className={cn(
                    "flex items-center gap-1 text-sm font-medium transition-colors hover:text-primary cursor-pointer",
                    location === "/admin" ? "text-primary" : "text-muted-foreground/50"
                  )}>
                    <Lock className="w-3.5 h-3.5" />
                  </span>
                </Link>
              )}
            </nav>
            <PushBell />
            <button
              onClick={toggle}
              title={theme === "dark" ? "Switch to Day mode" : "Switch to Night mode"}
              className="w-8 h-8 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 pb-20 md:pb-6">
        <div className="max-w-lg mx-auto md:max-w-7xl px-0 md:px-4 md:py-6">
          {children}
        </div>
      </main>

      {/* Desktop Footer */}
      <footer className="hidden md:block border-t border-border py-6 text-center text-sm text-muted-foreground">
        © 2026 Livematchmv. All rights reserved.
      </footer>

      {/* Bottom Mobile Nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 flex items-center justify-around bg-card border-t border-border px-2 pt-2 pb-5">
        {bottomNav.map((item) => {
          const Icon = item.icon;
          const isActive = item.href === "/" ? location === "/" : location === item.href || (location.startsWith(item.href + "/") && item.href !== "/");
          return (
            <Link key={item.href} href={item.href}>
              <span className={cn(
                "flex flex-col items-center justify-center gap-0.5 w-14 cursor-pointer",
                isActive ? "text-primary" : "text-muted-foreground"
              )}>
                <Icon className="h-5 w-5" strokeWidth={isActive ? 2.5 : 1.8} />
                <span className="text-[9px] font-medium mt-0.5">{item.label}</span>
              </span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
