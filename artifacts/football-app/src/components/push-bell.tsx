import { Bell, BellOff } from "lucide-react";
import { usePushNotifications } from "@/hooks/use-push-notifications";
import { cn } from "@/lib/utils";

export function PushBell({ className }: { className?: string }) {
  const { permission, subscribed, loading, subscribe, unsubscribe } = usePushNotifications();

  if (permission === "unsupported") return null;

  const handleClick = () => {
    if (subscribed) unsubscribe();
    else subscribe();
  };

  return (
    <button
      onClick={handleClick}
      disabled={loading || permission === "denied"}
      title={
        permission === "denied"
          ? "Notifications blocked — enable in browser settings"
          : subscribed
          ? "Turn off match alerts"
          : "Get notified when matches go live"
      }
      className={cn(
        "w-8 h-8 rounded-full flex items-center justify-center transition-colors",
        subscribed
          ? "text-primary hover:bg-primary/10"
          : "text-muted-foreground hover:text-foreground hover:bg-muted",
        permission === "denied" && "opacity-40 cursor-not-allowed",
        className,
      )}
    >
      {subscribed
        ? <Bell className="w-4 h-4 fill-current" />
        : <BellOff className="w-4 h-4" />}
    </button>
  );
}
