import { useState, useEffect, useCallback } from "react";

type PermissionState = "default" | "granted" | "denied" | "unsupported";

export function usePushNotifications() {
  const [permission, setPermission] = useState<PermissionState>("default");
  const [subscribed, setSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!("Notification" in window) || !("serviceWorker" in navigator)) {
      setPermission("unsupported");
      return;
    }
    setPermission(Notification.permission as PermissionState);

    let cancelled = false;
    const syncExistingSubscription = async () => {
      try {
        const reg = await navigator.serviceWorker.register("/sw.js");
        let sub = await reg.pushManager.getSubscription();

        const keyRes = await fetch("/api/push/vapid-public-key");
        if (!keyRes.ok) throw new Error("Push notifications are not configured");
        const { publicKey } = await keyRes.json();
        const serverKey = urlBase64ToUint8Array(publicKey);
        const subscriptionKey = sub.options.applicationServerKey;

        if (subscriptionKey && !keysMatch(subscriptionKey, serverKey)) {
          await sub.unsubscribe();
          sub = null;
        }

        if (!sub && Notification.permission === "granted") {
          sub = await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: serverKey as unknown as ArrayBuffer,
          });
        }

        if (!sub) {
          if (!cancelled) setSubscribed(false);
          return;
        }

        const syncRes = await fetch("/api/push/subscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(sub.toJSON()),
          credentials: "include",
        });
        if (!syncRes.ok) throw new Error(`Subscription sync failed (${syncRes.status})`);
        if (!cancelled) setSubscribed(true);
      } catch (err) {
        console.error("Push subscription sync failed:", err);
        if (!cancelled) setSubscribed(false);
      }
    };

    void syncExistingSubscription();
    return () => { cancelled = true; };
  }, []);

  const subscribe = useCallback(async () => {
    if (!("serviceWorker" in navigator)) return;
    setLoading(true);
    try {
      const keyRes = await fetch("/api/push/vapid-public-key");
      if (!keyRes.ok) throw new Error("Push notifications are not configured");
      const { publicKey } = await keyRes.json();
      const serverKey = urlBase64ToUint8Array(publicKey);

      const perm = await Notification.requestPermission();
      setPermission(perm as PermissionState);
      if (perm !== "granted") return;

      const reg = await navigator.serviceWorker.ready;
      let sub = await reg.pushManager.getSubscription();
      const subscriptionKey = sub?.options.applicationServerKey;
      if (sub && subscriptionKey && !keysMatch(subscriptionKey, serverKey)) {
        await sub.unsubscribe();
        sub = null;
      }
      sub ??= await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: serverKey as unknown as ArrayBuffer,
        });

      const subscribeRes = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sub.toJSON()),
        credentials: "include",
      });
      if (!subscribeRes.ok) throw new Error(`Subscription registration failed (${subscribeRes.status})`);
      setSubscribed(true);
    } catch (err) {
      console.error("Push subscribe failed:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  const unsubscribe = useCallback(async () => {
    if (!("serviceWorker" in navigator)) return;
    setLoading(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (!sub) return;
      await fetch("/api/push/unsubscribe", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint: sub.endpoint }),
        credentials: "include",
      });
      await sub.unsubscribe();
      setSubscribed(false);
    } catch (err) {
      console.error("Push unsubscribe failed:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  return { permission, subscribed, loading, subscribe, unsubscribe };
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

function keysMatch(subscriptionKey: ArrayBuffer, serverKey: Uint8Array): boolean {
  const current = new Uint8Array(subscriptionKey);
  return current.length === serverKey.length && current.every((byte, index) => byte === serverKey[index]);
}
