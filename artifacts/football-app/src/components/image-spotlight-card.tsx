import { type Spotlight } from "@workspace/api-client-react";
import { ExternalLink, Star } from "lucide-react";
import { motion } from "framer-motion";

export function ImageSpotlightCard({ spotlight }: { spotlight: Spotlight }) {
  const inner = (
    <div className="relative mx-4 rounded-2xl overflow-hidden border border-white/8 shadow-2xl" style={{ minHeight: 220 }}>
      <img
        src={spotlight.imageUrl}
        alt={spotlight.title}
        className="absolute inset-0 w-full h-full object-cover"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent" />

      <div className="relative flex flex-col h-full p-4" style={{ minHeight: 220 }}>
        <div className="flex items-center gap-1.5 bg-white/10 rounded-full px-2.5 py-1 w-fit">
          <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
          <span className="text-[10px] font-black text-white/90 uppercase tracking-widest">Spotlight</span>
        </div>

        <div className="mt-auto">
          <h3 className="text-white font-black text-xl leading-tight drop-shadow">{spotlight.title}</h3>
          {spotlight.subtitle && (
            <p className="text-white/70 text-sm mt-1 leading-snug">{spotlight.subtitle}</p>
          )}
          {spotlight.linkUrl && (
            <div className="flex items-center gap-1 mt-2">
              <ExternalLink className="w-3 h-3 text-white/50 shrink-0" />
              <span className="text-[10px] text-white/50 truncate">{spotlight.linkUrl}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  if (spotlight.linkUrl) {
    return (
      <motion.a
        href={spotlight.linkUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="block cursor-pointer"
        whileHover={{ scale: 1.01 }}
        transition={{ duration: 0.15 }}
      >
        {inner}
      </motion.a>
    );
  }

  return (
    <motion.div whileHover={{ scale: 1.01 }} transition={{ duration: 0.15 }}>
      {inner}
    </motion.div>
  );
}
