import { cn } from "@/lib/utils";

export function LivePulse({ className, text = "Live" }: { className?: string; text?: string }) {
  return (
    <div className={cn("flex items-center gap-1.5", className)}>
      <span className="live-dot inline-block w-2 h-2 rounded-full bg-red-500 shrink-0" />
      <span className="text-[11px] font-semibold text-red-400 tracking-wide">{text}</span>
    </div>
  );
}
