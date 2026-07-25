import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListBanners, useCreateBanner, useUpdateBanner, useDeleteBanner,
  getListBannersQueryKey,
} from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, X, Trash2, Pencil, Check, Eye, EyeOff, Image } from "lucide-react";
import { cn } from "@/lib/utils";

type Position = "top_home" | "top_live";

const POSITION_LABELS: Record<Position, string> = {
  top_home: "Top of Home page",
  top_live: "Top of Live page",
};

const EMPTY = { imageUrl: "", linkUrl: "", position: "top_home" as Position, isActive: true };

export function BannersTab() {
  const qc = useQueryClient();
  const [form, setForm] = useState({ ...EMPTY });
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState({ ...EMPTY });

  const { data: banners, isLoading } = useListBanners();
  const createBanner = useCreateBanner();
  const updateBanner = useUpdateBanner();
  const deleteBanner = useDeleteBanner();

  const invalidate = () => qc.invalidateQueries({ queryKey: getListBannersQueryKey() });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.imageUrl) return;
    createBanner.mutate({ data: { ...form } }, {
      onSuccess: () => { setForm({ ...EMPTY }); setShowForm(false); invalidate(); },
    });
  };

  const handleEditStart = (b: { id: number; imageUrl: string; linkUrl: string; position: string; isActive: boolean }) => {
    setEditingId(b.id);
    setEditForm({ imageUrl: b.imageUrl, linkUrl: b.linkUrl, position: b.position as Position, isActive: b.isActive });
  };

  const handleEditSave = (id: number) => {
    if (!editForm.imageUrl) return;
    updateBanner.mutate({ id, data: { ...editForm } }, {
      onSuccess: () => { setEditingId(null); invalidate(); },
    });
  };

  const handleToggle = (id: number, current: boolean) => {
    updateBanner.mutate({ id, data: { isActive: !current } }, { onSuccess: invalidate });
  };

  const handleDelete = (id: number) => {
    if (!confirm("Delete this banner?")) return;
    deleteBanner.mutate({ id }, { onSuccess: invalidate });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">{banners?.length ?? 0} banners</p>
        <button onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-1.5 bg-primary text-white rounded-xl px-3 py-2 text-xs font-bold">
          {showForm ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
          {showForm ? "Cancel" : "Add Banner"}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="bg-card border border-border rounded-xl p-4 space-y-3">
          <p className="text-sm font-bold text-foreground">New Banner</p>
          <div className="space-y-2">
            <div>
              <label className="text-[10px] font-semibold text-muted-foreground uppercase block mb-1">Image URL *</label>
              <input value={form.imageUrl} onChange={e => setForm(f => ({ ...f, imageUrl: e.target.value }))}
                placeholder="https://example.com/banner.jpg" className="admin-input" />
            </div>
            {form.imageUrl && (
              <div className="rounded-xl overflow-hidden border border-border bg-muted/30">
                <img src={form.imageUrl} alt="Preview" className="w-full max-h-24 object-cover"
                  onError={e => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
              </div>
            )}
            <div>
              <label className="text-[10px] font-semibold text-muted-foreground uppercase block mb-1">Click URL (optional)</label>
              <input value={form.linkUrl} onChange={e => setForm(f => ({ ...f, linkUrl: e.target.value }))}
                placeholder="https://..." className="admin-input" />
            </div>
            <div>
              <label className="text-[10px] font-semibold text-muted-foreground uppercase block mb-1">Position</label>
              <select value={form.position} onChange={e => setForm(f => ({ ...f, position: e.target.value as Position }))} className="admin-input">
                <option value="top_home">Top of Home page</option>
                <option value="top_live">Top of Live page</option>
              </select>
            </div>
          </div>
          <button type="submit" disabled={createBanner.isPending}
            className="w-full bg-primary text-white rounded-xl py-2.5 text-sm font-bold disabled:opacity-50">
            {createBanner.isPending ? "Adding..." : "Add Banner"}
          </button>
        </form>
      )}

      {isLoading ? (
        <div className="space-y-2">{Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}</div>
      ) : banners && banners.length > 0 ? (
        <div className="space-y-3">
          {banners.map(b => (
            <div key={b.id} className={cn("bg-card rounded-xl border overflow-hidden", b.isActive ? "border-border" : "border-border/40 opacity-60")}>
              {editingId === b.id ? (
                <div className="p-4 space-y-3">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-sm font-bold text-foreground">Edit Banner</p>
                    <button onClick={() => setEditingId(null)} className="text-muted-foreground hover:text-foreground p-1"><X className="w-4 h-4" /></button>
                  </div>
                  <div className="space-y-2">
                    <div>
                      <label className="text-[10px] font-semibold text-muted-foreground uppercase block mb-1">Image URL *</label>
                      <input value={editForm.imageUrl} onChange={e => setEditForm(f => ({ ...f, imageUrl: e.target.value }))} className="admin-input" />
                    </div>
                    {editForm.imageUrl && (
                      <div className="rounded-xl overflow-hidden border border-border bg-muted/30">
                        <img src={editForm.imageUrl} alt="Preview" className="w-full max-h-24 object-cover"
                          onError={e => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
                      </div>
                    )}
                    <div>
                      <label className="text-[10px] font-semibold text-muted-foreground uppercase block mb-1">Click URL</label>
                      <input value={editForm.linkUrl} onChange={e => setEditForm(f => ({ ...f, linkUrl: e.target.value }))} placeholder="https://..." className="admin-input" />
                    </div>
                    <div>
                      <label className="text-[10px] font-semibold text-muted-foreground uppercase block mb-1">Position</label>
                      <select value={editForm.position} onChange={e => setEditForm(f => ({ ...f, position: e.target.value as Position }))} className="admin-input">
                        <option value="top_home">Top of Home page</option>
                        <option value="top_live">Top of Live page</option>
                      </select>
                    </div>
                  </div>
                  <button onClick={() => handleEditSave(b.id)} disabled={updateBanner.isPending}
                    className="w-full bg-primary text-white rounded-xl py-2.5 text-sm font-bold disabled:opacity-50 flex items-center justify-center gap-2">
                    <Check className="w-4 h-4" />
                    {updateBanner.isPending ? "Saving..." : "Save Changes"}
                  </button>
                </div>
              ) : (
                <div>
                  <div className="relative bg-muted/30">
                    <img src={b.imageUrl} alt="Banner" className="w-full max-h-24 object-cover"
                      onError={e => { (e.currentTarget as HTMLImageElement).style.opacity = "0"; }} />
                  </div>
                  <div className="flex items-center gap-2 px-3 py-2.5">
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] font-bold text-foreground">
                        {POSITION_LABELS[b.position as Position] ?? b.position}
                      </p>
                      {b.linkUrl && (
                        <p className="text-[9px] text-muted-foreground truncate">{b.linkUrl}</p>
                      )}
                    </div>
                    <button onClick={() => handleToggle(b.id, b.isActive)}
                      title={b.isActive ? "Hide banner" : "Show banner"}
                      className={cn("p-1.5 rounded-lg transition-colors", b.isActive ? "text-emerald-400 hover:bg-emerald-500/10" : "text-muted-foreground hover:text-foreground")}>
                      {b.isActive ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                    </button>
                    <button onClick={() => handleEditStart(b)}
                      className="text-muted-foreground hover:text-blue-400 transition-colors p-1.5 rounded-lg">
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => handleDelete(b.id)}
                      className="text-muted-foreground hover:text-red-400 transition-colors p-1.5 rounded-lg">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="py-12 text-center text-muted-foreground text-sm bg-card rounded-xl border border-dashed border-border">
          <Image className="w-8 h-8 mx-auto mb-2 opacity-30" />
          No banners yet. Add your first ad banner above.
        </div>
      )}
    </div>
  );
}
