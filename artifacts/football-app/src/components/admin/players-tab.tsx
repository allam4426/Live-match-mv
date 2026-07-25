import { useState } from "react";
import {
  useListTeams,
  useGetTeamSquad,
  useAddSquadPlayer,
  useUpdateSquadPlayer,
  useRemoveSquadPlayer,
  getGetTeamSquadQueryKey,
  SquadPlayer,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { Trash2, Plus, X, Pencil, Check, User, Users } from "lucide-react";
import { TeamLogo } from "@/components/team-logo";
import { cn } from "@/lib/utils";

type Role = "player" | "coach" | "captain";
const ROLES: Role[] = ["player", "captain", "coach"];
const POSITIONS = ["GK", "RB", "CB", "LB", "CDM", "CM", "CAM", "RM", "LM", "RW", "LW", "CF", "ST"];

const EMPTY_FORM = {
  playerName: "",
  playerNumber: "",
  playerCode: "",
  position: "",
  role: "player" as Role,
  isStarting: false,
  photoUrl: "",
  nationality: "",
  bio: "",
};

export function PlayersTab() {
  const qc = useQueryClient();
  const [selectedTeamId, setSelectedTeamId] = useState<number | null>(null);
  const [sportFilter, setSportFilter] = useState<"all" | "football" | "futsal">("all");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [editPlayer, setEditPlayer] = useState<SquadPlayer | null>(null);
  const [editForm, setEditForm] = useState({ ...EMPTY_FORM });

  const { data: teams, isLoading: teamsLoading } = useListTeams(
    sportFilter !== "all" ? { sport: sportFilter } : undefined
  );
  const { data: squad, isLoading: squadLoading } = useGetTeamSquad(
    selectedTeamId ?? 0,
    { query: { enabled: !!selectedTeamId, queryKey: getGetTeamSquadQueryKey(selectedTeamId ?? 0) } }
  );

  const addPlayer = useAddSquadPlayer();
  const updatePlayer = useUpdateSquadPlayer();
  const removePlayer = useRemoveSquadPlayer();

  const invalidateSquad = () => {
    if (selectedTeamId) qc.invalidateQueries({ queryKey: getGetTeamSquadQueryKey(selectedTeamId) });
  };

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTeamId || !form.playerName.trim()) return;
    addPlayer.mutate({
      id: selectedTeamId,
      data: {
        playerName: form.playerName.trim(),
        playerNumber: form.playerNumber.trim() || undefined,
        playerCode: form.playerCode.trim() || undefined,
        position: form.position || undefined,
        role: form.role,
        isStarting: form.isStarting,
        photoUrl: form.photoUrl.trim() || undefined,
        nationality: form.nationality.trim() || undefined,
        bio: form.bio.trim() || undefined,
      },
    }, {
      onSuccess: () => {
        setForm({ ...EMPTY_FORM });
        setShowForm(false);
        invalidateSquad();
      },
    });
  };

  const handleUpdate = () => {
    if (!selectedTeamId || !editPlayer) return;
    updatePlayer.mutate({
      id: selectedTeamId,
      playerId: editPlayer.id,
      data: {
        playerName: editForm.playerName.trim(),
        playerNumber: editForm.playerNumber.trim() || undefined,
        playerCode: editForm.playerCode.trim() || undefined,
        position: editForm.position || undefined,
        role: editForm.role,
        isStarting: editForm.isStarting,
        photoUrl: editForm.photoUrl.trim() || undefined,
        nationality: editForm.nationality.trim() || undefined,
        bio: editForm.bio.trim() || undefined,
      },
    }, {
      onSuccess: () => { setEditPlayer(null); invalidateSquad(); },
    });
  };

  const handleDelete = (playerId: number) => {
    if (!selectedTeamId || !confirm("Remove this player?")) return;
    removePlayer.mutate({ id: selectedTeamId, playerId }, { onSuccess: invalidateSquad });
  };

  const openEdit = (p: SquadPlayer) => {
    setEditPlayer(p);
    setEditForm({
      playerName: p.playerName,
      playerNumber: p.playerNumber ?? "",
      playerCode: p.playerCode ?? "",
      position: p.position ?? "",
      role: p.role as Role,
      isStarting: p.isStarting,
      photoUrl: p.photoUrl ?? "",
      nationality: p.nationality ?? "",
      bio: p.bio ?? "",
    });
  };

  const selectedTeam = teams?.find(t => t.id === selectedTeamId);

  const roleColor: Record<Role, string> = {
    player: "text-blue-400 bg-blue-500/10 border-blue-500/25",
    captain: "text-yellow-400 bg-yellow-500/10 border-yellow-500/25",
    coach: "text-purple-400 bg-purple-500/10 border-purple-500/25",
  };

  const starters = squad?.filter(p => p.isStarting) ?? [];
  const subs = squad?.filter(p => !p.isStarting && p.role === "player") ?? [];
  const staff = squad?.filter(p => p.role === "coach") ?? [];

  return (
    <div className="space-y-4">
      {/* Sport filter + team selector */}
      <div className="flex items-center gap-2 flex-wrap">
        {(["all", "football", "futsal"] as const).map(s => (
          <button key={s} onClick={() => { setSportFilter(s); setSelectedTeamId(null); }}
            className={cn("rounded-full px-3 py-1 text-xs font-semibold border transition-all capitalize",
              sportFilter === s ? "bg-primary text-white border-primary" : "bg-card text-muted-foreground border-border"
            )}>{s}</button>
        ))}
      </div>

      {/* Team picker */}
      {teamsLoading ? (
        <Skeleton className="h-10 w-full rounded-xl" />
      ) : (
        <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
          {teams?.map(team => (
            <button key={team.id} onClick={() => { setSelectedTeamId(team.id); setShowForm(false); setEditPlayer(null); }}
              className={cn(
                "flex items-center gap-2 rounded-xl border px-3 py-2.5 text-left transition-all",
                selectedTeamId === team.id
                  ? "border-primary bg-primary/10 text-foreground"
                  : "border-border bg-card text-muted-foreground hover:border-primary/40"
              )}>
              <TeamLogo url={team.logoUrl} name={team.name} shortName={team.shortName} className="w-6 h-6 shrink-0" />
              <div className="min-w-0">
                <p className="text-xs font-bold truncate">{team.name}</p>
                <p className="text-[10px] capitalize opacity-60">{team.sport}</p>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Squad panel */}
      {selectedTeamId && selectedTeam && (
        <div className="space-y-3">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TeamLogo url={selectedTeam.logoUrl} name={selectedTeam.name} shortName={selectedTeam.shortName} className="w-7 h-7" />
              <div>
                <p className="text-sm font-black text-foreground">{selectedTeam.name} Squad</p>
                <p className="text-[10px] text-muted-foreground">{squad?.length ?? 0} players</p>
              </div>
            </div>
            <button onClick={() => { setShowForm(!showForm); setEditPlayer(null); }}
              className="flex items-center gap-1.5 bg-primary text-white rounded-xl px-3 py-2 text-xs font-bold">
              {showForm ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
              {showForm ? "Cancel" : "Add Player"}
            </button>
          </div>

          {/* Add form */}
          {showForm && (
            <form onSubmit={handleAdd} className="bg-card border border-border rounded-xl p-4 space-y-3">
              <p className="text-xs font-bold text-foreground">New Player / Staff</p>
              <div className="grid grid-cols-2 gap-2">
                <div className="col-span-2">
                  <label className="text-[10px] font-semibold text-muted-foreground uppercase block mb-1">Full Name *</label>
                  <input value={form.playerName} onChange={e => setForm(f => ({ ...f, playerName: e.target.value }))}
                    placeholder="e.g. Lionel Messi" className="admin-input" required />
                </div>
                <div>
                  <label className="text-[10px] font-semibold text-muted-foreground uppercase block mb-1">Number</label>
                  <input value={form.playerNumber} onChange={e => setForm(f => ({ ...f, playerNumber: e.target.value }))}
                    placeholder="10" className="admin-input" />
                </div>
                <div>
                  <label className="text-[10px] font-semibold text-muted-foreground uppercase block mb-1">Player Code (optional)</label>
                  <input value={form.playerCode} onChange={e => setForm(f => ({ ...f, playerCode: e.target.value }))}
                    placeholder="e.g. messi-10" className="admin-input" />
                </div>
                <div>
                  <label className="text-[10px] font-semibold text-muted-foreground uppercase block mb-1">Position</label>
                  <select value={form.position} onChange={e => setForm(f => ({ ...f, position: e.target.value }))} className="admin-input">
                    <option value="">— Select —</option>
                    {POSITIONS.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-semibold text-muted-foreground uppercase block mb-1">Role</label>
                  <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value as Role }))} className="admin-input">
                    {ROLES.map(r => <option key={r} value={r} className="capitalize">{r}</option>)}
                  </select>
                </div>
                <div className="flex items-center gap-2 pt-5">
                  <input type="checkbox" id="isStarting" checked={form.isStarting}
                    onChange={e => setForm(f => ({ ...f, isStarting: e.target.checked }))} className="w-4 h-4 rounded" />
                  <label htmlFor="isStarting" className="text-xs font-semibold text-muted-foreground">Starter (XI)</label>
                </div>
                <div className="col-span-2">
                  <label className="text-[10px] font-semibold text-muted-foreground uppercase block mb-1">Photo URL (optional)</label>
                  <input value={form.photoUrl} onChange={e => setForm(f => ({ ...f, photoUrl: e.target.value }))}
                    placeholder="https://…" className="admin-input" />
                </div>
                <div className="col-span-2">
                  <label className="text-[10px] font-semibold text-muted-foreground uppercase block mb-1">Nationality (optional)</label>
                  <input value={form.nationality} onChange={e => setForm(f => ({ ...f, nationality: e.target.value }))}
                    placeholder="e.g. Maldivian" className="admin-input" />
                </div>
                <div className="col-span-2">
                  <label className="text-[10px] font-semibold text-muted-foreground uppercase block mb-1">Bio (optional)</label>
                  <textarea value={form.bio} onChange={e => setForm(f => ({ ...f, bio: e.target.value }))}
                    placeholder="Short player biography…" rows={2} className="admin-input resize-none" />
                </div>
              </div>
              <button type="submit" disabled={addPlayer.isPending}
                className="w-full bg-primary text-white rounded-xl py-2.5 text-sm font-bold disabled:opacity-50">
                {addPlayer.isPending ? "Adding..." : "Add to Squad"}
              </button>
            </form>
          )}

          {/* Player list */}
          {squadLoading ? (
            <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-14 rounded-xl" />)}</div>
          ) : squad && squad.length > 0 ? (
            <div className="space-y-4">
              {[
                { label: "Starting XI", players: starters, icon: <Users className="w-3.5 h-3.5" /> },
                { label: "Substitutes", players: subs, icon: <User className="w-3.5 h-3.5" /> },
                { label: "Staff / Coaching", players: staff, icon: <User className="w-3.5 h-3.5" /> },
              ].filter(g => g.players.length > 0).map(group => (
                <div key={group.label} className="space-y-1.5">
                  <div className="flex items-center gap-1.5 text-[10px] font-bold text-muted-foreground uppercase tracking-wider px-1">
                    {group.icon} {group.label} ({group.players.length})
                  </div>
                  {group.players.map(player => (
                    <div key={player.id} className="bg-card rounded-xl border border-border overflow-hidden">
                      <div className="flex items-center gap-3 px-3 py-2.5">
                        <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
                          <span className="text-xs font-black text-foreground">{player.playerNumber || "—"}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-foreground truncate">{player.playerName}</p>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            {player.position && (
                              <span className="text-[10px] font-bold text-muted-foreground bg-muted/50 border border-border rounded px-1.5 py-0.5">
                                {player.position}
                              </span>
                            )}
                            <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded border capitalize", roleColor[player.role as Role])}>
                              {player.role}
                            </span>
                          </div>
                        </div>
                        <button onClick={() => openEdit(player)} className="text-muted-foreground hover:text-primary p-1 transition-colors">
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => handleDelete(player.id)} className="text-muted-foreground hover:text-red-400 p-1 transition-colors">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      {/* Inline edit */}
                      {editPlayer?.id === player.id && (
                        <div className="border-t border-border px-3 pb-3 pt-2.5 bg-muted/20 space-y-2">
                          <p className="text-[10px] font-bold text-foreground">Edit Player</p>
                          <div className="grid grid-cols-2 gap-2">
                            <div className="col-span-2">
                              <label className="text-[10px] font-semibold text-muted-foreground uppercase block mb-1">Full Name</label>
                              <input value={editForm.playerName}
                                onChange={e => setEditForm(f => ({ ...f, playerName: e.target.value }))}
                                className="admin-input" />
                            </div>
                            <div>
                              <label className="text-[10px] font-semibold text-muted-foreground uppercase block mb-1">Number</label>
                              <input value={editForm.playerNumber}
                                onChange={e => setEditForm(f => ({ ...f, playerNumber: e.target.value }))}
                                className="admin-input" placeholder="10" />
                            </div>
                            <div>
                              <label className="text-[10px] font-semibold text-muted-foreground uppercase block mb-1">Player Code</label>
                              <input value={editForm.playerCode}
                                onChange={e => setEditForm(f => ({ ...f, playerCode: e.target.value }))}
                                className="admin-input" placeholder="e.g. messi-10" />
                            </div>
                            <div>
                              <label className="text-[10px] font-semibold text-muted-foreground uppercase block mb-1">Position</label>
                              <select value={editForm.position}
                                onChange={e => setEditForm(f => ({ ...f, position: e.target.value }))} className="admin-input">
                                <option value="">— None —</option>
                                {POSITIONS.map(p => <option key={p} value={p}>{p}</option>)}
                              </select>
                            </div>
                            <div>
                              <label className="text-[10px] font-semibold text-muted-foreground uppercase block mb-1">Role</label>
                              <select value={editForm.role}
                                onChange={e => setEditForm(f => ({ ...f, role: e.target.value as Role }))} className="admin-input">
                                {ROLES.map(r => <option key={r} value={r} className="capitalize">{r}</option>)}
                              </select>
                            </div>
                            <div className="flex items-center gap-2 pt-4">
                              <input type="checkbox" id={`st-${player.id}`} checked={editForm.isStarting}
                                onChange={e => setEditForm(f => ({ ...f, isStarting: e.target.checked }))} className="w-4 h-4 rounded" />
                              <label htmlFor={`st-${player.id}`} className="text-xs font-semibold text-muted-foreground">Starter (XI)</label>
                            </div>
                            <div className="col-span-2">
                              <label className="text-[10px] font-semibold text-muted-foreground uppercase block mb-1">Photo URL</label>
                              <input value={editForm.photoUrl}
                                onChange={e => setEditForm(f => ({ ...f, photoUrl: e.target.value }))}
                                className="admin-input" placeholder="https://…" />
                            </div>
                            <div className="col-span-2">
                              <label className="text-[10px] font-semibold text-muted-foreground uppercase block mb-1">Nationality</label>
                              <input value={editForm.nationality}
                                onChange={e => setEditForm(f => ({ ...f, nationality: e.target.value }))}
                                className="admin-input" placeholder="e.g. Maldivian" />
                            </div>
                            <div className="col-span-2">
                              <label className="text-[10px] font-semibold text-muted-foreground uppercase block mb-1">Bio</label>
                              <textarea value={editForm.bio}
                                onChange={e => setEditForm(f => ({ ...f, bio: e.target.value }))}
                                className="admin-input resize-none" rows={2} placeholder="Short biography…" />
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <button onClick={handleUpdate} disabled={updatePlayer.isPending}
                              className="flex items-center gap-1.5 bg-primary text-white rounded-xl px-3 py-2 text-xs font-bold disabled:opacity-50">
                              <Check className="w-3.5 h-3.5" />
                              {updatePlayer.isPending ? "Saving..." : "Save"}
                            </button>
                            <button onClick={() => setEditPlayer(null)}
                              className="text-xs font-semibold text-muted-foreground hover:text-foreground px-3 py-2 rounded-xl bg-muted/50">
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          ) : (
            <div className="py-12 text-center text-muted-foreground text-sm bg-card rounded-xl border border-dashed border-border">
              <User className="w-8 h-8 mx-auto mb-2 opacity-30" />
              No players yet. Add the first one above.
            </div>
          )}
        </div>
      )}

      {!selectedTeamId && !teamsLoading && (
        <div className="py-12 text-center text-muted-foreground text-sm bg-card rounded-xl border border-dashed border-border">
          <Users className="w-8 h-8 mx-auto mb-2 opacity-30" />
          Select a team above to manage its squad.
        </div>
      )}
    </div>
  );
}
