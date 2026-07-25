export function PenaltyIcon({
  outcome,
  className = "",
}: {
  outcome: "goal" | "missed";
  className?: string;
}) {
  const isGoal = outcome === "goal";
  return (
    <span className={`relative inline-flex items-center justify-center ${className}`}>
      <span className="text-[22px] leading-none select-none">⚽</span>
      <span
        className={`absolute -bottom-1 -right-1.5 w-4 h-4 rounded-full flex items-center justify-center border-[2px] ${
          isGoal
            ? "bg-emerald-500 border-[#141e2e]"
            : "bg-red-500 border-[#141e2e]"
        }`}
      >
        {isGoal ? (
          <svg viewBox="0 0 12 12" className="w-2.5 h-2.5" fill="none">
            <path d="M2 6l2.5 2.5L10 3.5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        ) : (
          <svg viewBox="0 0 12 12" className="w-2.5 h-2.5" fill="none">
            <path d="M3 3l6 6M9 3l-6 6" stroke="white" strokeWidth="2" strokeLinecap="round" />
          </svg>
        )}
      </span>
    </span>
  );
}

export function PenaltyTileIcon({ outcome }: { outcome: "goal" | "missed" }) {
  const isGoal = outcome === "goal";
  return (
    <span className="relative inline-flex items-center justify-center">
      <span className="text-3xl leading-none select-none">⚽</span>
      <span
        className={`absolute -bottom-1.5 -right-2 w-5 h-5 rounded-full flex items-center justify-center border-[2.5px] ${
          isGoal
            ? "bg-emerald-500 border-[#0d3060]"
            : "bg-red-500 border-[#4a1a1a]"
        }`}
      >
        {isGoal ? (
          <svg viewBox="0 0 12 12" className="w-3 h-3" fill="none">
            <path d="M2 6l2.5 2.5L10 3.5" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        ) : (
          <svg viewBox="0 0 12 12" className="w-3 h-3" fill="none">
            <path d="M3 3l6 6M9 3l-6 6" stroke="white" strokeWidth="2.2" strokeLinecap="round" />
          </svg>
        )}
      </span>
    </span>
  );
}
