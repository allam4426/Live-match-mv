import { useState } from "react";
import {
  useGetTeamSquad, useAddSquadPlayer, useRemoveSquadPlayer, useUpdateSquadPlayer,
  getGetTeamSquadQueryKey, SquadPlayer
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { Trash2, Plus, X, Pencil, Check, Crown, UserCog } from "lucide-react";
import { cn } from "@/lib/utils";

type Role = "player" | "captain" | "coach";

const POSITIONS = ["GK", "CB", "LB", "RB", "LWB", "RWB", "CDM", "CM", "CAM", "LM", "RM", "LW", "RW", "ST", "CF", "SS"];
const EMPTY = { playerNumber: "", playerName: "", position: "", role: "player" as Role, isStarting: true };

const ROLE_CONFIG: Record<Role, { label: string; icon: React.ElementType; className: string }> = {
  player:  { label: "Player",  icon: () => <span className="text-[10px]">⚽</span>, className: "text-muted-foreground bg-muted border-border" },
  captain: { label: "Captain", icon: Crown,   className: "text-yellow-400 bg-yellow-500/15 border-yellow-500/30" },
  coach:   { label: "Coach",   icon: UserCog, className: "text-blue-400 bg-blue-500/15 border-blue-500/30" },
};

function RoleBadge({ role }: { role: Role }) {
  const cfg = ROLE_CONFIG[role] ?? ROLE_CONFIG.player;
  const Icon = cfg.icon;
  return (
    <span className={cn("inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full border", cfg.className)}>
      <Icon className="w-2.5 h-2.5" />
      {cfg.label}
    </span>
  );
}

function EditRow({ player, teamId, onDone }: { player: SquadPlayer; teamId: number; onDone: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    playerNumber: player.playerNumber,
    playerName: player.playerName,
    position: player.position ?? "",
    role: (player.role as Role) ?? "player",
    isStarting: player.isStarting,
  });
  const update = useUpdateSquadPlayer();

  const save = () => {
    update.mutate({
      id: teamId,
      playerId: player.id,
      data: { ...form, position: form.position || undefined },
    }, {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getGetTeamSquadQueryKey(teamId) });
        onDone();
      },
    });
  };

  return (
    <div className="bg-muted/30 border-t border-border px-3 py-2.5 space-y-2">
      <div className="grid grid-cols-3 gap-1.5">
        <input value={form.playerNumber} onChange={e => setForm(f => ({ ...f, playerNumber: e.target.value }))}
          placeholder="#" className="admin-input text-center text-xs" />
        <input value={form.playerName} onChange={e => setForm(f => ({ ...f, playerName: e.target.value }))}
          placeholder="Name" className="admin-input col-span-2 text-xs" />
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        <select value={form.position} onChange={e => setForm(f => ({ ...f, position: e.target.value }))} className="admin-input text-xs">
          <option value="">Position</option>
          {POSITIONS.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value as Role }))} className="admin-input text-xs">
          <option value="player">Player</option>
          <option value="captain">Captain</option>
          <option value="coach">Coach</option>
        </select>
      </div>
      <div className="flex items-center justify-between">
        <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <input type="checkbox" checked={form.isStarting}
            onChange={e => setForm(f => ({ ...f, isStarting: e.target.checked }))} className="w-3.5 h-3.5 rounded" />
          Starting XI
        </label>
        <div className="flex gap-1.5">
          <button onClick={onDone} className="text-[10px] font-semibold text-muted-foreground px-2 py-1 rounded-lg border border-border">Cancel</button>
          <button onClick={save} disabled={update.isPending}
            className="flex items-center gap-1 text-[10px] font-bold bg-primary text-white px-2.5 py-1 rounded-lg disabled:opacity-50">
            <Check className="w-3 h-3" />Save
          </button>
        </div>
      </div>
    </div>
  );
}

export function SquadPanel({ teamId, teamName }: { teamId: number; teamName: string }) {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ ...EMPTY });
  const [editingId, setEditingId] = useState<number | null>(null);

  const { data: squad, isLoading } = useGetTeamSquad(teamId, {
    query: { enabled: true, queryKey: getGetTeamSquadQueryKey(teamId) }
  });
  const addPlayer = useAddSquadPlayer();
  const removePlayer = useRemoveSquadPlayer();

  const invalidate = () => qc.invalidateQueries({ queryKey: getGetTeamSquadQueryKey(teamId) });

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.playerName) return;
    addPlayer.mutate({
      id: teamId,
      data: {
        ...form,
        playerNumber: form.playerNumber || undefined,
        position: form.position || undefined,
      }
    }, { onSuccess: () => { setForm({ ...EMPTY }); setShowForm(false); invalidate(); } });
  };

  const handleRemove = (playerId: number) => {
    removePlayer.mutate({ id: teamId, playerId }, { onSuccess: invalidate });
  };

  // Sort: coach first, captain second, then starters, then subs
  const sorted = [...(squad ?? [])].sort((a, b) => {
    const roleOrder: Record<string, number> = { coach: 0, captain: 1, player: 2 };
    const ro = (roleOrder[a.role] ?? 2) - (roleOrder[b.role] ?? 2);
    if (ro !== 0) return ro;
    if (a.isStarting !== b.isStarting) return a.isStarting ? -1 : 1;
    return (Number(a.playerNumber) || 99) - (Number(b.playerNumber) || 99);
  });

  const starters = sorted.filter(p => p.role !== "coach" && p.isStarting);
  const subs = sorted.filter(p => p.role !== "coach" && !p.isStarting);
  const coaches = sorted.filter(p => p.role === "coach");

  return (
    <div className="border-t border-border">
      {/* Squad header */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-muted/20">
        <div>
          <p className="text-xs font-bold text-foreground">{teamName} Squad</p>
          <p className="text-[10px] text-muted-foreground">{squad?.length ?? 0} members</p>
        </div>
        <button onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-1 bg-primary text-white rounded-xl px-2.5 py-1.5 text-[10px] font-bold">
          {showForm ? <X className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
          {showForm ? "Cancel" : "Add"}
        </button>
      </div>

      {/* Add form */}
      {showForm && (
        <form onSubmit={handleAdd} className="px-4 py-3 bg-card border-b border-border space-y-2">
          <div className="grid grid-cols-3 gap-1.5">
            <input value={form.playerNumber} onChange={e => setForm(f => ({ ...f, playerNumber: e.target.value }))}
              placeholder="#" className="admin-input text-center" />
            <input value={form.playerName} onChange={e => setForm(f => ({ ...f, playerName: e.target.value }))}
              placeholder="Full name *" className="admin-input col-span-2" />
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            <select value={form.position} onChange={e => setForm(f => ({ ...f, position: e.target.value }))} className="admin-input">
              <option value="">Position</option>
              {POSITIONS.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
            <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value as Role }))} className="admin-input">
              <option value="player">Player</option>
              <option value="captain">⭐ Captain</option>
              <option value="coach">🧑‍💼 Coach</option>
            </select>
            <label className="flex items-center gap-1.5 text-[10px] text-muted-foreground font-semibold px-1">
              <input type="checkbox" checked={form.isStarting}
                onChange={e => setForm(f => ({ ...f, isStarting: e.target.checked }))} className="w-3.5 h-3.5 rounded" />
              Starting
            </label>
          </div>
          <button type="submit" disabled={addPlayer.isPending}
            className="w-full bg-primary text-white rounded-xl py-2 text-xs font-bold disabled:opacity-50">
            {addPlayer.isPending ? "Adding..." : "Add to Squad"}
          </button>
        </form>
      )}

      {/* Squad list */}
      {isLoading ? (
        <div className="px-4 py-3 space-y-1.5">
          {[1,2,3].map(i => <Skeleton key={i} className="h-9 w-full rounded-lg" />)}
        </div>
      ) : squad && squad.length > 0 ? (
        <div>
          {/* Coach section */}
          {coaches.length > 0 && (
            <div className="border-b border-border/50">
              <p className="text-[9px] font-bold text-blue-400 uppercase tracking-wider px-4 pt-2 pb-1">Coaching Staff</p>
              {coaches.map((p, i) => (
                <div key={p.id}>
                  <div className={cn("flex items-center gap-2.5 px-4 py-2", i > 0 && "border-t border-border/30")}>
                    <span className="text-[10px] font-bold text-muted-foreground w-6 text-right shrink-0">—</span>
                    <span className="text-xs font-semibold text-foreground flex-1">{p.playerName}</span>
                    <RoleBadge role="coach" />
                    {p.position && <span className="text-[9px] bg-muted text-muted-foreground rounded px-1.5 py-0.5 font-bold">{p.position}</span>}
                    <button onClick={() => setEditingId(editingId === p.id ? null : p.id)} className="text-muted-foreground hover:text-primary p-0.5">
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => handleRemove(p.id)} className="text-muted-foreground hover:text-red-400 p-0.5">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  {editingId === p.id && <EditRow player={p} teamId={teamId} onDone={() => setEditingId(null)} />}
                </div>
              ))}
            </div>
          )}

          {/* Starters */}
          {starters.length > 0 && (
            <div className={subs.length > 0 ? "border-b border-border/50" : ""}>
              <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider px-4 pt-2 pb-1">Starting XI ({starters.length})</p>
              {starters.map((p, i) => (
                <div key={p.id}>
                  <div className={cn("flex items-center gap-2.5 px-4 py-2", i > 0 && "border-t border-border/30")}>
                    <span className="text-[10px] font-black text-primary w-6 text-right shrink-0">#{p.playerNumber}</span>
                    <span className="text-xs font-semibold text-foreground flex-1">{p.playerName}</span>
                    {p.role === "captain" && <RoleBadge role="captain" />}
                    {p.position && <span className="text-[9px] bg-muted text-muted-foreground rounded px-1.5 py-0.5 font-bold">{p.position}</span>}
                    <button onClick={() => setEditingId(editingId === p.id ? null : p.id)} className="text-muted-foreground hover:text-primary p-0.5">
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => handleRemove(p.id)} className="text-muted-foreground hover:text-red-400 p-0.5">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  {editingId === p.id && <EditRow player={p} teamId={teamId} onDone={() => setEditingId(null)} />}
                </div>
              ))}
            </div>
          )}

          {/* Substitutes */}
          {subs.length > 0 && (
            <div>
              <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider px-4 pt-2 pb-1">Substitutes ({subs.length})</p>
              {subs.map((p, i) => (
                <div key={p.id}>
                  <div className={cn("flex items-center gap-2.5 px-4 py-2", i > 0 && "border-t border-border/30")}>
                    <span className="text-[10px] font-bold text-muted-foreground w-6 text-right shrink-0">#{p.playerNumber}</span>
                    <span className="text-xs font-medium text-muted-foreground flex-1">{p.playerName}</span>
                    {p.role === "captain" && <RoleBadge role="captain" />}
                    {p.position && <span className="text-[9px] bg-muted text-muted-foreground rounded px-1.5 py-0.5 font-bold">{p.position}</span>}
                    <button onClick={() => setEditingId(editingId === p.id ? null : p.id)} className="text-muted-foreground hover:text-primary p-0.5">
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => handleRemove(p.id)} className="text-muted-foreground hover:text-red-400 p-0.5">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  {editingId === p.id && <EditRow player={p} teamId={teamId} onDone={() => setEditingId(null)} />}
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <p className="px-4 py-4 text-xs text-muted-foreground text-center">No players yet. Add your first squad member above.</p>
      )}
    </div>
  );
}
