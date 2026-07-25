import { useState } from "react";
import {
  useListMatches, useUpdateMatch, getListMatchesQueryKey, type Match,
  useListSpotlights, useCreateSpotlight, useUpdateSpotlight, useDeleteSpotlight,
  getListSpotlightsQueryKey, type Spotlight,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { TeamLogo } from "@/components/team-logo";
import { Skeleton } from "@/components/ui/skeleton";
import { Star, StarOff, Zap, Plus, Trash2, Pencil, Check, X, Image, ToggleLeft, ToggleRight } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

/* ─── Match spotlight helpers ─── */
const STATUS_ORDER = { live: 0, scheduled: 1, finished: 2, postponed: 3 };

function StatusBadge({ status, minute }: { status: string; minute?: string | null }) {
  if (status === "live") {
    return (
      <span className="flex items-center gap-1 text-[10px] font-bold text-red-400 bg-red-500/10 border border-red-500/25 px-2 py-0.5 rounded-full">
        <span className="live-dot w-1.5 h-1.5 rounded-full bg-red-500 inline-block shrink-0" />
        {minute && minute !== "HT" && minute !== "PSO" ? `${minute}'` : minute === "HT" ? "HT" : minute === "PSO" ? "PSO" : "Live"}
      </span>
    );
  }
  if (status === "scheduled") return <span className="text-[10px] font-bold text-blue-400 bg-blue-500/10 border border-blue-500/25 px-2 py-0.5 rounded-full">Scheduled</span>;
  if (status === "finished") return <span className="text-[10px] font-bold text-muted-foreground bg-muted/50 border border-border px-2 py-0.5 rounded-full">FT</span>;
  return <span className="text-[10px] font-bold text-yellow-400 bg-yellow-500/10 border border-yellow-500/25 px-2 py-0.5 rounded-full capitalize">{status}</span>;
}

function MatchRow({ match, isCurrent, onSet, onUnset, isPending }: {
  match: Match; isCurrent: boolean; onSet: () => void; onUnset: () => void; isPending: boolean;
}) {
  return (
    <div className={cn(
      "flex items-center gap-3 p-3 rounded-xl border transition-all",
      isCurrent ? "bg-amber-500/8 border-amber-500/30" : "bg-card border-border"
    )}>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <StatusBadge status={match.status} minute={match.minute} />
          {match.matchGroup && (
            <span className="text-[9px] font-semibold text-muted-foreground/60 bg-muted/40 border border-border rounded px-1.5 py-0.5">{match.matchGroup}</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <TeamLogo url={match.homeTeam.logoUrl} name={match.homeTeam.name} shortName={match.homeTeam.shortName} className="w-5 h-5 shrink-0" />
          <span className="text-[13px] font-bold text-foreground">{match.homeTeam.shortName}</span>
          {(match.status === "live" || match.status === "finished")
            ? <span className="text-[13px] font-black text-muted-foreground tabular-nums mx-0.5">{match.homeScore}–{match.awayScore}</span>
            : <span className="text-[11px] text-muted-foreground/50 mx-0.5">vs</span>}
          <span className="text-[13px] font-bold text-foreground">{match.awayTeam.shortName}</span>
          <TeamLogo url={match.awayTeam.logoUrl} name={match.awayTeam.name} shortName={match.awayTeam.shortName} className="w-5 h-5 shrink-0" />
        </div>
        <p className="text-[10px] text-muted-foreground/60 mt-0.5 truncate">{match.competition} · {format(new Date(match.kickoffAt), "d MMM, HH:mm")}</p>
      </div>
      {isCurrent ? (
        <button onClick={onUnset} disabled={isPending}
          className="flex items-center gap-1.5 text-[11px] font-bold text-amber-400 bg-amber-500/10 border border-amber-500/30 hover:bg-amber-500/20 px-3 py-2 rounded-xl transition-all disabled:opacity-40 shrink-0">
          <Star className="w-4 h-4 fill-amber-400" /> Active
        </button>
      ) : (
        <button onClick={onSet} disabled={isPending}
          className="flex items-center gap-1.5 text-[11px] font-bold text-muted-foreground bg-muted/40 border border-border hover:bg-amber-500/10 hover:border-amber-500/30 hover:text-amber-400 px-3 py-2 rounded-xl transition-all disabled:opacity-40 shrink-0">
          <StarOff className="w-4 h-4" /> Set
        </button>
      )}
    </div>
  );
}

/* ─── Image Spotlight form ─── */
interface SpotlightForm {
  title: string;
  subtitle: string;
  imageUrl: string;
  linkUrl: string;
  sortOrder: string;
}

const emptyForm: SpotlightForm = { title: "", subtitle: "", imageUrl: "", linkUrl: "", sortOrder: "0" };

function ImageSpotlightItem({ spotlight, onToggle, onEdit, onDelete }: {
  spotlight: Spotlight;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className={cn(
      "flex items-start gap-3 p-3 rounded-xl border transition-all",
      spotlight.active ? "bg-primary/5 border-primary/20" : "bg-card border-border opacity-60"
    )}>
      {/* Thumbnail */}
      <div className="w-16 h-14 rounded-lg overflow-hidden bg-muted shrink-0 border border-border">
        <img src={spotlight.imageUrl} alt={spotlight.title} className="w-full h-full object-cover" onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-foreground leading-tight truncate">{spotlight.title}</p>
        {spotlight.subtitle && <p className="text-[11px] text-muted-foreground truncate mt-0.5">{spotlight.subtitle}</p>}
        {spotlight.linkUrl && <p className="text-[10px] text-primary/70 truncate mt-0.5">{spotlight.linkUrl}</p>}
        <p className="text-[10px] text-muted-foreground/50 mt-1">Order: {spotlight.sortOrder}</p>
      </div>

      {/* Actions */}
      <div className="flex flex-col gap-1.5 shrink-0">
        <button onClick={onToggle} title={spotlight.active ? "Deactivate" : "Activate"}
          className={cn("p-1.5 rounded-lg border transition-all",
            spotlight.active ? "text-primary border-primary/30 bg-primary/10" : "text-muted-foreground border-border bg-muted/30"
          )}>
          {spotlight.active ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
        </button>
        <button onClick={onEdit} title="Edit" className="p-1.5 rounded-lg border border-border bg-card hover:bg-muted/50 text-muted-foreground transition-all">
          <Pencil className="w-3.5 h-3.5" />
        </button>
        <button onClick={onDelete} title="Delete" className="p-1.5 rounded-lg border border-red-500/20 bg-red-500/5 hover:bg-red-500/15 text-red-400 transition-all">
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

function SpotlightFormPanel({ form, setForm, onSave, onCancel, saving }: {
  form: SpotlightForm;
  setForm: (f: SpotlightForm) => void;
  onSave: () => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const field = (key: keyof SpotlightForm, label: string, placeholder: string, required?: boolean) => (
    <div>
      <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide block mb-1">
        {label}{required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      <input
        value={form[key]}
        onChange={e => setForm({ ...form, [key]: e.target.value })}
        placeholder={placeholder}
        className="w-full bg-muted/40 border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/50"
      />
    </div>
  );

  return (
    <div className="bg-muted/20 border border-border rounded-xl p-4 space-y-3">
      {field("title", "Title", "e.g. Athif Mohamed — Best Coach 2026", true)}
      {field("subtitle", "Subtitle", "e.g. Maldives Business School")}
      {field("imageUrl", "Image URL", "https://... (photo URL)", true)}
      {field("linkUrl", "Link URL", "https://... (optional — tapping the card opens this)")}
      <div>
        <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide block mb-1">Order</label>
        <input
          type="number"
          value={form.sortOrder}
          onChange={e => setForm({ ...form, sortOrder: e.target.value })}
          className="w-24 bg-muted/40 border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary/50"
          min={0}
        />
        <span className="text-[10px] text-muted-foreground/60 ml-2">Lower = shown first</span>
      </div>

      {/* Preview */}
      {form.imageUrl && (
        <div>
          <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide mb-1">Preview</p>
          <div className="relative h-28 rounded-xl overflow-hidden border border-border">
            <img src={form.imageUrl} alt="preview" className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
            <div className="absolute bottom-2 left-3">
              <p className="text-white font-black text-sm leading-tight">{form.title || "Title"}</p>
              {form.subtitle && <p className="text-white/70 text-xs">{form.subtitle}</p>}
            </div>
          </div>
        </div>
      )}

      <div className="flex gap-2 pt-1">
        <button onClick={onSave} disabled={saving || !form.title || !form.imageUrl}
          className="flex items-center gap-1.5 bg-primary text-white text-xs font-bold px-4 py-2 rounded-xl disabled:opacity-40 transition-all">
          <Check className="w-3.5 h-3.5" /> Save
        </button>
        <button onClick={onCancel} className="flex items-center gap-1.5 bg-muted/40 border border-border text-muted-foreground text-xs font-bold px-4 py-2 rounded-xl transition-all">
          <X className="w-3.5 h-3.5" /> Cancel
        </button>
      </div>
    </div>
  );
}

/* ─── Main Tab ─── */
type Sport = "all" | "football" | "futsal";

export function SpotlightsTab() {
  const queryClient = useQueryClient();

  /* custom spotlights */
  const { data: imageSpotlights, isLoading: imgLoading } = useListSpotlights();
  const createSpotlight = useCreateSpotlight();
  const updateSpotlight = useUpdateSpotlight();
  const deleteSpotlight = useDeleteSpotlight();

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<SpotlightForm>(emptyForm);
  const [saving, setSaving] = useState(false);

  const invalidateSpotlights = () => queryClient.invalidateQueries({ queryKey: getListSpotlightsQueryKey() });

  const handleCreateOrEdit = () => {
    setSaving(true);
    const payload = {
      title: form.title,
      subtitle: form.subtitle || undefined,
      imageUrl: form.imageUrl,
      linkUrl: form.linkUrl || undefined,
      active: true,
      sortOrder: Number(form.sortOrder) || 0,
    };
    if (editingId !== null) {
      updateSpotlight.mutate({ id: editingId, data: payload }, {
        onSuccess: () => { invalidateSpotlights(); setShowForm(false); setEditingId(null); setForm(emptyForm); setSaving(false); },
        onError: () => setSaving(false),
      });
    } else {
      createSpotlight.mutate({ data: payload }, {
        onSuccess: () => { invalidateSpotlights(); setShowForm(false); setForm(emptyForm); setSaving(false); },
        onError: () => setSaving(false),
      });
    }
  };

  const handleEdit = (s: Spotlight) => {
    setEditingId(s.id);
    setForm({ title: s.title, subtitle: s.subtitle ?? "", imageUrl: s.imageUrl, linkUrl: s.linkUrl ?? "", sortOrder: String(s.sortOrder) });
    setShowForm(true);
  };

  const handleDelete = (id: number) => {
    deleteSpotlight.mutate({ id }, { onSuccess: invalidateSpotlights });
  };

  const handleToggle = (s: Spotlight) => {
    updateSpotlight.mutate({ id: s.id, data: { active: !s.active } }, { onSuccess: invalidateSpotlights });
  };

  /* match spotlights */
  const [sport, setSport] = useState<Sport>("all");
  const { data: matches, isLoading: matchesLoading } = useListMatches(
    { sport: sport === "all" ? undefined : sport },
    { query: { queryKey: [...getListMatchesQueryKey(), sport] } }
  );
  const updateMatch = useUpdateMatch();
  const [pendingId, setPendingId] = useState<number | null>(null);

  const invalidateMatches = () => {
    queryClient.invalidateQueries({ queryKey: getListMatchesQueryKey() });
    setPendingId(null);
  };

  const handleSetMatch = (match: Match) => {
    setPendingId(match.id);
    updateMatch.mutate({ id: match.id, data: { featured: true } }, { onSuccess: invalidateMatches, onError: () => setPendingId(null) });
  };
  const handleUnsetMatch = (match: Match) => {
    setPendingId(match.id);
    updateMatch.mutate({ id: match.id, data: { featured: false } }, { onSuccess: invalidateMatches, onError: () => setPendingId(null) });
  };

  const sortedMatches = [...(matches ?? [])].sort(
    (a, b) => (STATUS_ORDER[a.status as keyof typeof STATUS_ORDER] ?? 9) - (STATUS_ORDER[b.status as keyof typeof STATUS_ORDER] ?? 9)
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-2 pt-1">
        <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/25 flex items-center justify-center">
          <Zap className="w-4 h-4 text-amber-400" />
        </div>
        <div>
          <p className="text-sm font-black text-foreground">Spotlights</p>
          <p className="text-[10px] text-muted-foreground">Image cards + featured matches — auto-scroll every 5s on home</p>
        </div>
      </div>

      {/* ── Section 1: Custom Image Spotlights ── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Image className="w-4 h-4 text-primary" />
            <span className="text-xs font-black text-foreground uppercase tracking-wide">Image Spotlights</span>
            {(imageSpotlights?.length ?? 0) > 0 && (
              <span className="text-[10px] bg-primary/15 text-primary border border-primary/25 px-1.5 py-0.5 rounded-full font-bold">
                {imageSpotlights!.length}
              </span>
            )}
          </div>
          {!showForm && (
            <button
              onClick={() => { setShowForm(true); setEditingId(null); setForm(emptyForm); }}
              className="flex items-center gap-1.5 text-xs font-bold text-primary bg-primary/10 border border-primary/25 hover:bg-primary/20 px-3 py-1.5 rounded-xl transition-all"
            >
              <Plus className="w-3.5 h-3.5" /> Add Image
            </button>
          )}
        </div>

        {/* Form */}
        {showForm && (
          <SpotlightFormPanel
            form={form}
            setForm={setForm}
            onSave={handleCreateOrEdit}
            onCancel={() => { setShowForm(false); setEditingId(null); setForm(emptyForm); }}
            saving={saving}
          />
        )}

        {/* List */}
        {imgLoading ? (
          <div className="space-y-2">{Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}</div>
        ) : (imageSpotlights?.length ?? 0) === 0 && !showForm ? (
          <div className="rounded-xl border border-dashed border-border bg-muted/20 py-6 text-center">
            <Image className="w-6 h-6 text-muted-foreground/30 mx-auto mb-1.5" />
            <p className="text-xs font-semibold text-muted-foreground">No image spotlights yet</p>
            <p className="text-[10px] text-muted-foreground/60 mt-0.5">Add a photo card with a title, subtitle, and optional link</p>
          </div>
        ) : (
          <div className="space-y-2">
            {(imageSpotlights ?? []).map(s => (
              <ImageSpotlightItem
                key={s.id}
                spotlight={s}
                onToggle={() => handleToggle(s)}
                onEdit={() => handleEdit(s)}
                onDelete={() => handleDelete(s.id)}
              />
            ))}
          </div>
        )}
      </div>

      <div className="border-t border-border" />

      {/* ── Section 2: Featured Match Spotlights ── */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
          <span className="text-xs font-black text-foreground uppercase tracking-wide">Featured Matches</span>
          <span className="text-[10px] text-muted-foreground/60">shown after image spotlights</span>
        </div>

        {/* Sport filter */}
        <div className="flex gap-1.5">
          {(["all", "football", "futsal"] as Sport[]).map(s => (
            <button key={s} onClick={() => setSport(s)}
              className={cn(
                "rounded-full px-3.5 py-1.5 text-xs font-semibold border transition-all capitalize",
                sport === s ? "bg-primary text-white border-primary" : "bg-card text-muted-foreground border-border"
              )}>{s === "all" ? "All Sports" : s.charAt(0).toUpperCase() + s.slice(1)}</button>
          ))}
        </div>

        {matchesLoading ? (
          <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}</div>
        ) : sortedMatches.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground text-sm">No matches found.</div>
        ) : (
          <div className="space-y-2">
            {sortedMatches.map(match => (
              <MatchRow
                key={match.id}
                match={match}
                isCurrent={match.featured === true}
                onSet={() => handleSetMatch(match)}
                onUnset={() => handleUnsetMatch(match)}
                isPending={pendingId === match.id}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
