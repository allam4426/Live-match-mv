import { useState } from "react";
import { useListMatches, useListStreams, useCreateStream, useDeleteStream, getListStreamsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { Trash2, Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";

type Quality = "HD" | "SD" | "FHD";
const EMPTY = { label: "", url: "", quality: "HD" as Quality, language: "EN", embedCode: "" };

export function StreamsTab() {
  const qc = useQueryClient();
  const [selectedMatchId, setSelectedMatchId] = useState<number>(0);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ ...EMPTY });

  const { data: allMatches } = useListMatches({ limit: 100 });
  const match = allMatches?.find(m => m.id === selectedMatchId);

  const { data: streams, isLoading } = useListStreams(
    selectedMatchId ? { matchId: selectedMatchId } : undefined,
    { query: { enabled: !!selectedMatchId, queryKey: getListStreamsQueryKey({ matchId: selectedMatchId }) } }
  );

  const createStream = useCreateStream();
  const deleteStream = useDeleteStream();

  const invalidate = () => qc.invalidateQueries({ queryKey: getListStreamsQueryKey({ matchId: selectedMatchId }) });

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMatchId || !form.label || !form.url) return;
    createStream.mutate({
      data: {
        matchId: selectedMatchId,
        ...form,
        embedCode: form.embedCode || undefined,
      }
    }, { onSuccess: () => { setForm({ ...EMPTY }); setShowForm(false); invalidate(); } });
  };

  const handleDelete = (id: number) => {
    deleteStream.mutate({ id }, { onSuccess: invalidate });
  };

  const QUALITY_COLORS: Record<Quality, string> = {
    FHD: "text-green-400 bg-green-500/10 border-green-500/25",
    HD: "text-blue-400 bg-blue-500/10 border-blue-500/25",
    SD: "text-muted-foreground bg-muted/50 border-border",
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="text-[10px] font-semibold text-muted-foreground uppercase block mb-1.5">Select Match</label>
        <select value={selectedMatchId} onChange={e => { setSelectedMatchId(Number(e.target.value)); setShowForm(false); }} className="admin-input">
          <option value={0}>— Choose match —</option>
          {allMatches?.map(m => (
            <option key={m.id} value={m.id}>
              {m.homeTeam.shortName} vs {m.awayTeam.shortName} · {m.competition} · {m.status}
            </option>
          ))}
        </select>
      </div>

      {selectedMatchId > 0 && (
        <>
          {match && (
            <div className="bg-card rounded-xl border border-border px-4 py-3">
              <p className="text-sm font-bold text-foreground">{match.homeTeam.name} vs {match.awayTeam.name}</p>
              <p className="text-xs text-muted-foreground">{match.competition} · {streams?.length ?? 0} streams</p>
            </div>
          )}

          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Streams</p>
            <button onClick={() => setShowForm(!showForm)}
              className="flex items-center gap-1.5 bg-primary text-white rounded-xl px-3 py-2 text-xs font-bold">
              {showForm ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
              {showForm ? "Cancel" : "Add Stream"}
            </button>
          </div>

          {showForm && (
            <form onSubmit={handleAdd} className="bg-card border border-border rounded-xl p-4 space-y-3">
              <p className="text-sm font-bold text-foreground">New Stream</p>
              <div className="grid grid-cols-2 gap-2">
                <div className="col-span-2">
                  <label className="text-[10px] font-semibold text-muted-foreground uppercase block mb-1">Label *</label>
                  <input value={form.label} onChange={e => setForm(f => ({ ...f, label: e.target.value }))}
                    placeholder="Stream 1 - HD English" className="admin-input" />
                </div>
                <div className="col-span-2">
                  <label className="text-[10px] font-semibold text-muted-foreground uppercase block mb-1">Stream URL *</label>
                  <input value={form.url} onChange={e => setForm(f => ({ ...f, url: e.target.value }))}
                    placeholder="https://..." className="admin-input" />
                </div>
                <div>
                  <label className="text-[10px] font-semibold text-muted-foreground uppercase block mb-1">Quality *</label>
                  <select value={form.quality} onChange={e => setForm(f => ({ ...f, quality: e.target.value as Quality }))} className="admin-input">
                    <option value="FHD">FHD</option>
                    <option value="HD">HD</option>
                    <option value="SD">SD</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-semibold text-muted-foreground uppercase block mb-1">Language *</label>
                  <input value={form.language} onChange={e => setForm(f => ({ ...f, language: e.target.value }))}
                    placeholder="EN" className="admin-input" />
                </div>
                <div className="col-span-2">
                  <label className="text-[10px] font-semibold text-muted-foreground uppercase block mb-1">Embed Code (optional)</label>
                  <textarea value={form.embedCode} onChange={e => setForm(f => ({ ...f, embedCode: e.target.value }))}
                    placeholder='<iframe src="..." allowfullscreen></iframe>'
                    rows={2} className="admin-input resize-none" />
                </div>
              </div>
              <button type="submit" disabled={createStream.isPending}
                className="w-full bg-primary text-white rounded-xl py-2.5 text-sm font-bold disabled:opacity-50">
                {createStream.isPending ? "Adding..." : "Add Stream"}
              </button>
            </form>
          )}

          {isLoading ? (
            <Skeleton className="h-24 w-full rounded-xl" />
          ) : streams && streams.length > 0 ? (
            <div className="bg-card rounded-xl border border-border overflow-hidden">
              {streams.map((stream, i) => (
                <div key={stream.id} className={cn("flex items-center gap-3 px-4 py-3", i > 0 && "border-t border-border/50")}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-sm font-semibold text-foreground truncate">{stream.label}</span>
                      <span className={cn("text-[9px] font-black px-1.5 py-0.5 rounded border", QUALITY_COLORS[stream.quality as Quality])}>
                        {stream.quality}
                      </span>
                    </div>
                    <p className="text-[10px] text-muted-foreground truncate">{stream.language} · {stream.url}</p>
                  </div>
                  <button onClick={() => handleDelete(stream.id)} className="text-muted-foreground hover:text-red-400 p-1 transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-8 text-center text-muted-foreground text-sm bg-card rounded-xl border border-dashed border-border">
              No streams added. Use the form above.
            </div>
          )}
        </>
      )}
    </div>
  );
}
