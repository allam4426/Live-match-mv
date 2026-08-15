import { Link } from "wouter";
import {
  Users, UserRound, Star, BarChart3, Trophy, Play, Gamepad2, Newspaper,
  Bell, Phone, Mail, Globe, MessageCircle, Send, Instagram, Facebook,
  Heart, ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_TILES = [
  { label: "Teams", icon: Users, href: "/teams" },
  { label: "Players", icon: UserRound, href: "/players" },
  { label: "Spotlights", icon: Star, href: "/" },
  { label: "Stats Center", icon: BarChart3, href: "/tournaments" },
  { label: "Tournaments", icon: Trophy, href: "/tournaments" },
  { label: "Live streams", icon: Play, href: "/live" },
  { label: "Games", icon: Gamepad2, href: null },
  { label: "News", icon: Newspaper, href: null },
] as const;

function TileGrid() {
  return (
    <div className="grid grid-cols-4 gap-3 px-4 mb-6">
      {NAV_TILES.map((tile) => {
        const Icon = tile.icon;
        const inner = (
          <div className="flex flex-col items-center gap-2">
            <div className={cn(
              "w-14 h-14 rounded-2xl flex items-center justify-center",
              tile.href ? "bg-[#1a2a3a]" : "bg-[#141e28] opacity-40"
            )}>
              <Icon className="w-6 h-6 text-primary" />
            </div>
            <span className={cn(
              "text-[10px] font-medium text-center leading-tight",
              tile.href ? "text-foreground" : "text-muted-foreground"
            )}>
              {tile.label}
            </span>
          </div>
        );

        if (!tile.href) {
          return <div key={tile.label} className="cursor-not-allowed">{inner}</div>;
        }
        return (
          <Link key={tile.label} href={tile.href}>
            <div className="cursor-pointer active:scale-95 transition-transform">{inner}</div>
          </Link>
        );
      })}
    </div>
  );
}

function Row({ label, right }: { label: string; right: React.ReactNode }) {
  return (
    <div className="bg-card rounded-xl border border-border px-4 py-4 flex items-center justify-between">
      <span className="text-sm font-medium text-foreground">{label}</span>
      <div className="flex items-center gap-2">{right}</div>
    </div>
  );
}

function IconLink({ icon: Icon, href }: { icon: React.ElementType; href: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="w-9 h-9 rounded-full border border-border/60 bg-muted/30 flex items-center justify-center text-muted-foreground hover:text-primary transition-colors"
    >
      <Icon className="w-4 h-4" />
    </a>
  );
}

export default function MorePage() {
  return (
    <div className="pb-8">
      <div className="px-4 pt-5 pb-4">
        <h1 className="text-2xl font-black text-foreground">More</h1>
      </div>

      <TileGrid />

      <div className="px-4 space-y-2.5">
        <Link href="/notifications">
          <Row
            label="Notifications"
            right={<ChevronRight className="w-4 h-4 text-muted-foreground" />}
          />
        </Link>

        <Link href="/about">
          <Row
            label="About Us"
            right={<ChevronRight className="w-4 h-4 text-muted-foreground" />}
          />
        </Link>

        <Row
          label="Official"
          right={
            <>
              <IconLink icon={Phone} href="tel:+9603000000" />
              <IconLink icon={Mail} href="mailto:info@livematchmv.online" />
              <IconLink icon={Globe} href="https://livematchmv.online" />
            </>
          }
        />

        <Row
          label="Contact us"
          right={
            <>
              <IconLink icon={MessageCircle} href="https://wa.me/9603000000" />
              <IconLink icon={Send} href="https://t.me/livematchmv" />
              <IconLink icon={MessageCircle} href="#" />
            </>
          }
        />

        <Row
          label="Stay connected"
          right={
            <>
              <IconLink icon={Instagram} href="https://www.instagram.com/livematch.mv?igsh=MXFwMXc1eGUONm5OaA==" />
              <IconLink icon={Facebook} href="https://www.facebook.com/share/18okuiNThY/?mibextid=wwXIfr" />
            </>
          }
        />

        <Row
          label="Rate the app"
          right={<Heart className="w-5 h-5 text-muted-foreground" />}
        />

        <Row
          label="Version"
          right={<span className="text-sm text-muted-foreground font-medium">2.0.1</span>}
        />
      </div>
    </div>
  );
}
