import { useListHighlights } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Play, Eye, Clock } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { motion } from "framer-motion";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { TeamLogo } from "@/components/team-logo";

const COMPETITIONS = ["All", "Premier League", "Champions League", "La Liga", "Serie A", "Ligue 1"];

export default function Highlights() {
  const [activeComp, setActiveComp] = useState("All");
  const { data: highlights, isLoading } = useListHighlights({ limit: 30 });

  const filtered = highlights?.filter((h) =>
    activeComp === "All" ? true : h.competition === activeComp
  );

  return (
    <div className="pb-6">
      {/* Header */}
      <div className="px-4 pt-4 pb-3">
        <h1 className="text-xl font-black text-foreground">Highlights</h1>
      </div>

      {/* Competition Filter */}
      <div className="flex items-center gap-2 overflow-x-auto hide-scrollbar px-4 pb-4">
        {COMPETITIONS.map((comp) => {
          const isSelected = activeComp === comp;
          return (
            <button
              key={comp}
              onClick={() => setActiveComp(comp)}
              data-testid={`comp-filter-${comp.toLowerCase().replace(/\s+/g, "-")}`}
              className={cn(
                "shrink-0 rounded-full px-4 py-1.5 text-sm font-semibold border transition-all",
                isSelected
                  ? "bg-primary text-white border-primary"
                  : "bg-card text-muted-foreground border-border hover:border-primary/40"
              )}
            >
              {comp}
            </button>
          );
        })}
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="grid grid-cols-2 gap-3 px-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="aspect-video w-full rounded-xl" />
              <Skeleton className="h-3 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          ))}
        </div>
      ) : filtered && filtered.length > 0 ? (
        <motion.div
          className="grid grid-cols-2 gap-3 px-4 md:grid-cols-3"
          initial="hidden"
          animate="show"
          variants={{
            hidden: {},
            show: { transition: { staggerChildren: 0.06 } },
          }}
        >
          {filtered.map((highlight) => (
            <motion.div
              key={highlight.id}
              variants={{ hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0 } }}
              transition={{ duration: 0.2 }}
              className="group cursor-pointer"
              data-testid={`highlight-card-${highlight.id}`}
            >
              {/* Thumbnail */}
              <div className="relative aspect-video rounded-xl overflow-hidden bg-muted mb-2">
                <img
                  src={highlight.thumbnailUrl}
                  alt={highlight.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  onError={(e) => { (e.target as HTMLImageElement).src = ""; }}
                />
                {/* Overlay */}
                <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="w-9 h-9 rounded-full bg-primary/90 flex items-center justify-center shadow-lg">
                    <Play className="w-4 h-4 text-white ml-0.5" />
                  </div>
                </div>
                {/* Duration badge */}
                <div className="absolute bottom-1.5 right-1.5 bg-black/80 text-white text-[10px] font-bold px-1.5 py-0.5 rounded flex items-center gap-0.5">
                  <Clock className="w-2.5 h-2.5" />
                  {highlight.duration}
                </div>
                {/* Competition badge */}
                <div className="absolute top-1.5 left-1.5 bg-primary/90 text-white text-[9px] font-bold px-1.5 py-0.5 rounded">
                  {highlight.competition.split(" ")[0]}
                </div>
              </div>

              {/* Teams */}
              <div className="flex items-center gap-1.5 mb-1">
                <TeamLogo
                  url={highlight.homeTeam.logoUrl}
                  name={highlight.homeTeam.name}
                  shortName={highlight.homeTeam.shortName}
                  className="w-4 h-4"
                />
                <span className="text-xs font-bold text-foreground">{highlight.homeScore}</span>
                <span className="text-[10px] text-muted-foreground">-</span>
                <span className="text-xs font-bold text-foreground">{highlight.awayScore}</span>
                <TeamLogo
                  url={highlight.awayTeam.logoUrl}
                  name={highlight.awayTeam.name}
                  shortName={highlight.awayTeam.shortName}
                  className="w-4 h-4"
                />
              </div>

              <h3 className="text-xs font-semibold text-foreground line-clamp-2 leading-snug">{highlight.title}</h3>
              <div className="flex items-center gap-2 mt-1 text-[10px] text-muted-foreground">
                <span className="flex items-center gap-0.5">
                  <Eye className="w-2.5 h-2.5" />
                  {highlight.views ? (highlight.views >= 1000 ? `${Math.round(highlight.views / 1000)}K` : highlight.views) : 0}
                </span>
                <span>·</span>
                <span>{formatDistanceToNow(new Date(highlight.publishedAt), { addSuffix: true })}</span>
              </div>
            </motion.div>
          ))}
        </motion.div>
      ) : (
        <div className="py-16 text-center text-muted-foreground px-4">
          <p className="text-sm">No highlights available for this competition.</p>
        </div>
      )}
    </div>
  );
}
