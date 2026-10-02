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

  return (
    <div className="mx-4 mt-3 h-20 rounded-xl overflow-hidden border border-border/40 shadow-sm relative">
      <div
        className="flex flex-col transition-transform duration-500 ease-out"
        style={{ transform: `translateY(-${idx * 5}rem)` }}
      >
        {active.map((banner) => {
          const img = (
            <img
              src={banner.imageUrl}
              alt="Advertisement"
              className="block h-20 w-full object-cover"
              onError={e => { (e.currentTarget.parentElement as HTMLElement | null)?.remove(); }}
            />
          );
          return (
            <div key={banner.id} className="h-20 w-full shrink-0">
              {banner.linkUrl ? (
                <a href={banner.linkUrl} target="_blank" rel="noopener noreferrer" className="block h-20 w-full">
                  {img}
                </a>
              ) : img}
            </div>
          );
        })}
      </div>
    </div>
  );
}
