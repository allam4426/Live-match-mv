import { useState } from "react";
import { useListTeams, useCreateTeam, useUpdateTeam, useDeleteTeam, getListTeamsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { Trash2, Plus, X, ChevronDown, Pencil, Check } from "lucide-react";
import { TeamLogo } from "@/components/team-logo";
import { SquadPanel } from "@/components/admin/squad-panel";
import { cn } from "@/lib/utils";

type Sport = "football" | "futsal";
const EMPTY = { name: "", shortName: "", country: "", logoUrl: "", sport: "football" as Sport };

export function TeamsTab() {
  const qc = useQueryClient();
  const [sport, setSport] = useState<"all" | Sport>("all");
  const [form, setForm] = useState({ ...EMPTY });
  const [showForm, setShowForm] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState({ ...EMPTY });

  const { data: teams, isLoading } = useListTeams(sport === "all" ? undefined : { sport });
  const createTeam = useCreateTeam();
  const updateTeam = useUpdateTeam();
  const deleteTeam = useDeleteTeam();

  const invalidate = () => qc.invalidateQueries({ queryKey: getListTeamsQueryKey() });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.shortName || !form.country) return;
    createTeam.mutate({ data: { ...form } }, {
      onSuccess: () => { setForm({ ...EMPTY }); setShowForm(false); invalidate(); },
    });
  };

  const handleEditStart = (team: typeof EMPTY & { id: number }) => {
    setEditingId(team.id);
    setEditForm({ name: team.name, shortName: team.shortName, country: team.country, logoUrl: team.logoUrl ?? "", sport: (team.sport ?? "football") as Sport });
    setExpandedId(null);
  };

  const handleEditSave = (id: number) => {
    if (!editForm.name || !editForm.shortName || !editForm.country) return;
    updateTeam.mutate({ id, data: { ...editForm } }, {
      onSuccess: () => { setEditingId(null); invalidate(); },
    });
  };

  const handleDelete = (id: number) => {
    if (!confirm("Delete this team and all its squad data?")) return;
    deleteTeam.mutate({ id }, { onSuccess: () => { if (expandedId === id) setExpandedId(null); invalidate(); } });
  };

  return (
    <div className="space-y-4">
      {/* Sport filter + Add button */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          {(["all", "football", "futsal"] as const).map(s => (
            <button key={s} onClick={() => setSport(s)}
              className={cn("rounded-full px-3 py-1 text-xs font-semibold border transition-all capitalize",
                sport === s ? "bg-primary text-white border-primary" : "bg-card text-muted-foreground border-border"
              )}>{s}</button>
          ))}
        </div>
        <button onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-1.5 bg-primary text-white rounded-xl px-3 py-2 text-xs font-bold">
          {showForm ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
          {showForm ? "Cancel" : "Add Team"}
        </button>
      </div>

      {/* Add team form */}
      {showForm && (
        <form onSubmit={handleCreate} className="bg-card border border-border rounded-xl p-4 space-y-3">
          <p className="text-sm font-bold text-foreground">New Team</p>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] font-semibold text-muted-foreground uppercase block mb-1">Name *</label>
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="Manchester City" className="admin-input" />
            </div>
            <div>
              <label className="text-[10px] font-semibold text-muted-foreground uppercase block mb-1">Short Name *</label>
              <input value={form.shortName} onChange={e => setForm(f => ({ ...f, shortName: e.target.value }))}
                placeholder="MCI" className="admin-input" />
            </div>
            <div>
              <label className="text-[10px] font-semibold text-muted-foreground uppercase block mb-1">Country *</label>
              <input value={form.country} onChange={e => setForm(f => ({ ...f, country: e.target.value }))}
                placeholder="England" className="admin-input" />
            </div>
            <div>
              <label className="text-[10px] font-semibold text-muted-foreground uppercase block mb-1">Sport *</label>
              <select value={form.sport} onChange={e => setForm(f => ({ ...f, sport: e.target.value as Sport }))} className="admin-input">
                <option value="football">Football</option>
                <option value="futsal">Futsal</option>
              </select>
            </div>
            <div className="col-span-2">
              <label className="text-[10px] font-semibold text-muted-foreground uppercase block mb-1">Logo URL</label>
              <input value={form.logoUrl} onChange={e => setForm(f => ({ ...f, logoUrl: e.target.value }))}
                placeholder="https://..." className="admin-input" />
            </div>
          </div>
          <button type="submit" disabled={createTeam.isPending}
            className="w-full bg-primary text-white rounded-xl py-2.5 text-sm font-bold disabled:opacity-50">
            {createTeam.isPending ? "Adding..." : "Add Team"}
          </button>
        </form>
      )}

      {/* Teams list */}
      {isLoading ? (
        <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-14 rounded-xl" />)}</div>
      ) : teams && teams.length > 0 ? (
        <div className="space-y-2">
          {teams.map(team => (
            <div key={team.id} className="bg-card rounded-xl border border-border overflow-hidden">
              {editingId === team.id ? (
                /* ── Inline edit form ── */
                <div className="p-4 space-y-3">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-sm font-bold text-foreground">Edit Team</p>
                    <button onClick={() => setEditingId(null)} className="text-muted-foreground hover:text-foreground p-1">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] font-semibold text-muted-foreground uppercase block mb-1">Name *</label>
                      <input value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
                        className="admin-input" />
                    </div>
                    <div>
                      <label className="text-[10px] font-semibold text-muted-foreground uppercase block mb-1">Short Name *</label>
                      <input value={editForm.shortName} onChange={e => setEditForm(f => ({ ...f, shortName: e.target.value }))}
                        className="admin-input" />
                    </div>
                    <div>
                      <label className="text-[10px] font-semibold text-muted-foreground uppercase block mb-1">Country *</label>
                      <input value={editForm.country} onChange={e => setEditForm(f => ({ ...f, country: e.target.value }))}
                        className="admin-input" />
                    </div>
                    <div>
                      <label className="text-[10px] font-semibold text-muted-foreground uppercase block mb-1">Sport</label>
                      <select value={editForm.sport} onChange={e => setEditForm(f => ({ ...f, sport: e.target.value as Sport }))} className="admin-input">
                        <option value="football">Football</option>
                        <option value="futsal">Futsal</option>
                      </select>
                    </div>
                    <div className="col-span-2">
                      <label className="text-[10px] font-semibold text-muted-foreground uppercase block mb-1">Logo URL</label>
                      <input value={editForm.logoUrl} onChange={e => setEditForm(f => ({ ...f, logoUrl: e.target.value }))}
                        placeholder="https://..." className="admin-input" />
                      {editForm.logoUrl && (
                        <div className="mt-2 flex items-center gap-2">
                          <TeamLogo url={editForm.logoUrl} name={editForm.name} shortName={editForm.shortName || "?"} className="w-10 h-10" />
                          <span className="text-[10px] text-muted-foreground">Preview</span>
                        </div>
                      )}
                    </div>
                  </div>
                  <button onClick={() => handleEditSave(team.id)} disabled={updateTeam.isPending}
                    className="w-full bg-primary text-white rounded-xl py-2.5 text-sm font-bold disabled:opacity-50 flex items-center justify-center gap-2">
                    <Check className="w-4 h-4" />
                    {updateTeam.isPending ? "Saving..." : "Save Changes"}
                  </button>
                </div>
              ) : (
                /* ── Normal row ── */
                <>
                  <div className="flex items-center gap-3 px-4 py-3">
                    <TeamLogo url={team.logoUrl} name={team.name} shortName={team.shortName} className="w-8 h-8 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">{team.name}</p>
                      <p className="text-xs text-muted-foreground">{team.shortName} · {team.country} · <span className="capitalize">{team.sport}</span></p>
                    </div>
                    <button
                      onClick={() => setExpandedId(expandedId === team.id ? null : team.id)}
                      className={cn("flex items-center gap-1 text-[10px] font-bold px-2.5 py-1.5 rounded-xl border transition-all",
                        expandedId === team.id
                          ? "bg-primary text-white border-primary"
                          : "bg-muted text-muted-foreground border-border hover:border-primary/40"
                      )}>
                      <ChevronDown className={cn("w-3.5 h-3.5 transition-transform", expandedId === team.id && "rotate-180")} />
                      Squad
                    </button>
                    <button onClick={() => handleEditStart(team as typeof EMPTY & { id: number })}
                      className="text-muted-foreground hover:text-blue-400 transition-colors p-1 ml-1" title="Edit team">
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleDelete(team.id)} className="text-muted-foreground hover:text-red-400 transition-colors p-1">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  {expandedId === team.id && (
                    <SquadPanel teamId={team.id} teamName={team.name} />
                  )}
                </>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="py-12 text-center text-muted-foreground text-sm bg-card rounded-xl border border-dashed border-border">
          No teams yet. Add your first team above.
        </div>
      )}
    </div>
  );
}
