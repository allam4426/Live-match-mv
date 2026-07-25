import { useState } from "react";
import { cn } from "@/lib/utils";

interface TeamLogoProps {
  url: string;
  name: string;
  shortName?: string | null;
  className?: string;
}

export function TeamLogo({ url, name, shortName, className }: TeamLogoProps) {
  const [error, setError] = useState(false);
  const fallback = (shortName ?? name).slice(0, 3);

  if (error || !url) {
    return (
      <div className={cn("flex items-center justify-center bg-muted text-muted-foreground font-bold rounded-full overflow-hidden shrink-0", className)}>
        {fallback}
      </div>
    );
  }

  return (
    <img
      src={url}
      alt={`${name} logo`}
      onError={() => setError(true)}
      className={cn("object-contain shrink-0", className)}
    />
  );
}
