import { useListBanners } from "@workspace/api-client-react";
import { useState, useEffect } from "react";

export function BannerSlot({ position }: { position: "top_home" | "top_live" }) {
  const { data: banners } = useListBanners({ position });
  const active = banners?.filter(b => b.isActive && b.position === position) ?? [];
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    if (active.length <= 1) return;
    const id = setInterval(() => setIdx(i => (i + 1) % active.length), 5000);
    return () => clearInterval(id);
  }, [active.length]);

  if (active.length === 0) return null;
  const banner = active[idx % active.length]!;

  const inner = (
    <div className="mx-4 mt-3 rounded-xl overflow-hidden border border-border/40 shadow-sm transition-opacity duration-500">
      <img
        key={banner.id}
        src={banner.imageUrl}
        alt="Advertisement"
        className="w-full object-cover max-h-20"
        onError={e => { (e.currentTarget.parentElement as HTMLElement | null)?.remove(); }}
      />
    </div>
  );

  if (banner.linkUrl) {
    return (
      <a href={banner.linkUrl} target="_blank" rel="noopener noreferrer" className="block">
        {inner}
      </a>
    );
  }

  return inner;
}
