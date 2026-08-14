import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListTrophies, useCreateTrophy, useUpdateTrophy, useDeleteTrophy,
  useListTeams,
  getListTrophiesQueryKey,
} from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, X, Trash2, Pencil, Check, Trophy as TrophyIcon } from "lucide-react";

const EMPTY = { teamId: 0, title: "", season: "", imageUrl: "" };

export function TrophiesTab() {
  const qc = useQueryClient();
  const [form, setForm] = useState({ ...EMPTY });
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState({ title: "", season: "", imageUrl: "" });

  const { data: trophies, isLoading } = useListTrophies();
  const { data: teams } = useListTeams();
  const createTrophy = useCreateTrophy();
  const updateTrophy = useUpdateTrophy();
  const deleteTrophy = useDeleteTrophy();

  const invalidate = () => qc.invalidateQueries({ queryKey: getListTrophiesQueryKey() });

  const teamName = (id: number) => teams?.find(t => t.id === id)?.name ?? `Team #${id}`;

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.teamId || !form.title) return;
    createTrophy.mutate({ data: { ...form } }, {
      onSuccess: () => { setForm({ ...EMPTY }); setShowForm(false); invalidate(); },
    });
  };

  const handleEditStart = (t: { id: number; title: string; season?: string | null; imageUrl?: string | null }) => {
    setEditingId(t.id);
    setEditForm({ title: t.title, season: t.season ?? "", imageUrl: t.imageUrl ?? "" });
  };

  const handleEditSave = (id: number) => {
    if (!editForm.title) return;
    updateTrophy.mutate({ id, data: { ...editForm } }, {
      onSuccess: () => { setEditingId(null); invalidate(); },
    });
  };

  const handleDelete = (id: number) => {
    if (!confirm("Delete this trophy?")) return;
    deleteTrophy.mutate({ id }, { onSuccess: invalidate });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">{trophies?.length ?? 0} trophies</p>
        <button onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-1.5 bg-primary text-white rounded-xl px-3 py-2 text-xs font-bold">
          {showForm ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
          {showForm ? "Cancel" : "Add Trophy"}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="bg-card border border-border rounded-xl p-4 space-y-3">
          <p className="text-sm font-bold text-foreground">New Trophy</p>
          <div className="space-y-2">
            <div>
              <label className="text-[10px] font-semibold text-muted-foreground uppercase block mb-1">Team *</label>
              <select value={form.teamId} onChange={e => setForm(f => ({ ...f, teamId: Number(e.target.value) }))} className="admin-input">
                <option value={0}>Select a team...</option>
                {teams?.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-semibold text-muted-foreground uppercase block mb-1">Trophy Title *</label>
              <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                placeholder="e.g. Cup Winners Cup 2026" className="admin-input" />
            </div>
            <div>
              <label className="text-[10px] font-semibold text-muted-foreground uppercase block mb-1">Season (optional)</label>
              <input value={form.season} onChange={e => setForm(f => ({ ...f, season: e.target.value }))}
                placeholder="e.g. 2026" className="admin-input" />
            </div>
            <div>
              <label className="text-[10px] font-semibold text-muted-foreground uppercase block mb-1">Trophy Image URL (optional)</label>
              <input value={form.imageUrl} onChange={e => setForm(f => ({ ...f, imageUrl: e.target.value }))}
                placeholder="https://example.com/trophy.png" className="admin-input" />
            </div>
            {form.imageUrl && (
              <div className="rounded-xl overflow-hidden border border-border bg-muted/30 w-16 h-16 flex items-center justify-center">
                <img src={form.imageUrl} alt="Preview" className="max-w-full max-h-full object-contain"
                  onError={e => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
              </div>
            )}
          </div>
          <button type="submit" disabled={createTrophy.isPending}
            className="w-full bg-primary text-white rounded-xl py-2.5 text-sm font-bold disabled:opacity-50">
            {createTrophy.isPending ? "Adding..." : "Add Trophy"}
          </button>
        </form>
      )}

      {isLoading ? (
        <div className="space-y-2">{Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}</div>
      ) : trophies && trophies.length > 0 ? (
        <div className="space-y-3">
          {trophies.map(t => (
            <div key={t.id} className="bg-card rounded-xl border border-border overflow-hidden">
              {editingId === t.id ? (
                <div className="p-4 space-y-3">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-sm font-bold text-foreground">Edit Trophy</p>
                    <button onClick={() => setEditingId(null)} className="text-muted-foreground hover:text-foreground p-1"><X className="w-4 h-4" /></button>
                  </div>
                  <div className="space-y-2">
                    <div>
                      <label className="text-[10px] font-semibold text-muted-foreground uppercase block mb-1">Trophy Title *</label>
                      <input value={editForm.title} onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))} className="admin-input" />
                    </div>
                    <div>
                      <label className="text-[10px] font-semibold text-muted-foreground uppercase block mb-1">Season</label>
                      <input value={editForm.season} onChange={e => setEditForm(f => ({ ...f, season: e.target.value }))} className="admin-input" />
                    </div>
                    <div>
                      <label className="text-[10px] font-semibold text-muted-foreground uppercase block mb-1">Trophy Image URL</label>
                      <input value={editForm.imageUrl} onChange={e => setEditForm(f => ({ ...f, imageUrl: e.target.value }))} className="admin-input" />
                    </div>
                  </div>
                  <button onClick={() => handleEditSave(t.id)} disabled={updateTrophy.isPending}
                    className="w-full bg-primary text-white rounded-xl py-2.5 text-sm font-bold disabled:opacity-50 flex items-center justify-center gap-2">
                    <Check className="w-4 h-4" />
                    {updateTrophy.isPending ? "Saving..." : "Save Changes"}
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-3 px-4 py-3">
                  <div className="w-12 h-12 rounded-lg bg-muted/50 flex items-center justify-center shrink-0 overflow-hidden">
                    {t.imageUrl ? (
                      <img src={t.imageUrl} alt={t.title} className="max-w-full max-h-full object-contain" />
                    ) : (
                      <TrophyIcon className="w-5 h-5 text-primary" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">{t.title}</p>
                    <p className="text-[11px] text-muted-foreground truncate">
                      {teamName(t.teamId)}{t.season ? ` · ${t.season}` : ""}
                    </p>
                  </div>
                  <button onClick={() => handleEditStart(t)}
                    className="text-muted-foreground hover:text-blue-400 transition-colors p-1.5 rounded-lg">
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => handleDelete(t.id)}
                    className="text-muted-foreground hover:text-red-400 transition-colors p-1.5 rounded-lg">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="py-12 text-center text-muted-foreground text-sm bg-card rounded-xl border border-dashed border-border">
          <TrophyIcon className="w-8 h-8 mx-auto mb-2 opacity-30" />
          No trophies yet. Add a team\'s first trophy above.
        </div>
      )}
    </div>
  );
}
