import type { Response } from "express";

/** In-memory SSE client registry, keyed by matchId */
const clients = new Map<number, Set<Response>>();

export function subscribeToMatch(matchId: number, res: Response) {
  if (!clients.has(matchId)) clients.set(matchId, new Set());
  clients.get(matchId)!.add(res);
}

export function unsubscribeFromMatch(matchId: number, res: Response) {
  clients.get(matchId)?.delete(res);
  if (clients.get(matchId)?.size === 0) clients.delete(matchId);
}

export function broadcastMatchUpdate(matchId: number, data: Record<string, unknown>) {
  const subs = clients.get(matchId);
  if (!subs || subs.size === 0) return;
  const msg = `data: ${JSON.stringify(data)}\n\n`;
  for (const res of subs) {
    try { res.write(msg); } catch { /* client disconnected */ }
  }
}
