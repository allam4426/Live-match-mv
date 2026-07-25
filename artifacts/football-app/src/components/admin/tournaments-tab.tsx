import { useState } from "react";
import {
  useListTournaments, useCreateTournament, useUpdateTournament, useDeleteTournament,
  useGetTournamentStandings,
  getListTournamentsQueryKey, getGetTournamentStandingsQueryKey
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { Trash2, Plus, X, Trophy, ChevronDown, Layers, Pencil, Check } from "lucide-react";
import { TeamLogo } from "@/components/team-logo";
import { cn } from "@/lib/utils";

type Sport = "football" | "futsal";
type Format = "league" | "group_stage" | "knockout";
type SingleGroupFmt = "bye_semi" | "top2_final" | "";
type ZoneType = "champion" | "qualified" | "qualified_playoff" | "relegated_playoff" | "relegated";

interface QualificationZone {
  fromPos: number;
  toPos: number;
  type: ZoneType;
  label: string;
}

const ZONE_TYPE_LABELS: Record<ZoneType, string> = {
  champion: "Champion / Direct Final",
  qualified: "Qualified (next round)",
  qualified_playoff: "Qualify via Play-off",
  relegated_playoff: "Relegation Play-off",
  relegated: "Relegated",
};

const ZONE_COLORS: Record<ZoneType, string> = {
  champion: "#f59e0b",
  qualified: "#22c55e",
  qualified_playoff: "#3b82f6",
  relegated_playoff: "#f97316",
  relegated: "#ef4444",
};

const EMPTY_ZONE: { fromPos: string; toPos: string; type: ZoneType; label: string } = {
  fromPos: "1", toPos: "1", type: "qualified", label: "",
};

const EMPTY = { name: "", sport: "football" as Sport, season: "", logoUrl: "", description: "", format: "league" as Format, singleGroupFormat: "" as SingleGroupFmt, color: "#e53935", qualificationZones: [] as QualificationZone[] };

const COLOR_PRESETS = [
  "#e53935", "#d81b60", "#8e24aa", "#3949ab",
  "#1e88e5", "#00acc1", "#00897b", "#43a047",
  "#fb8c00", "#f4511e", "#6d4c41", "#546e7a",
];
const FORMAT_LABELS: Record<Format, string> = { league: "League", group_stage: "Group Stage", knockout: "Knockout" };

/* ── Zone editor component ── */
function ZoneEditor({ zones, onChange }: { zones: QualificationZone[]; onChange: (z: QualificationZone[]) => void }) {
  const [newZone, setNewZone] = useState({ ...EMPTY_ZONE });

  const addZone = () => {
    const from = parseInt(newZone.fromPos);
    const to = parseInt(newZone.toPos);
    if (isNaN(from) || isNaN(to) || !newZone.label) return;
    onChange([...zones, { fromPos: from, toPos: to, type: newZone.type, label: newZone.label }]);
    setNewZone({ ...EMPTY_ZONE });
  };

  const removeZone = (i: number) => onChange(zones.filter((_, idx) => idx !== i));

  return (
    <div className="space-y-2">
      <label className="text-[10px] font-semibold text-muted-foreground uppercase block">Qualification Zones</label>

      {zones.length > 0 && (
        <div className="space-y-1">
          {zones.map((z, i) => (
            <div key={i} className="flex items-center gap-2 bg-muted/30 rounded-lg px-2 py-1.5">
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: ZONE_COLORS[z.type] }} />
              <span className="text-[11px] font-semibold text-foreground flex-1 truncate">{z.label}</span>
              <span className="text-[10px] text-muted-foreground shrink-0">
                pos {z.fromPos}{z.fromPos !== z.toPos ? `–${z.toPos}` : ""}
              </span>
              <button type="button" onClick={() => removeZone(i)} className="text-muted-foreground hover:text-red-400 p-0.5">
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="bg-muted/20 rounded-lg p-2 space-y-2 border border-border/50">
        <p className="text-[10px] text-muted-foreground font-semibold uppercase">Add Zone</p>
        <div className="grid grid-cols-2 gap-1.5">
          <div>
            <label className="text-[9px] text-muted-foreground uppercase block mb-0.5">From pos</label>
            <input type="number" value={newZone.fromPos}
              onChange={e => setNewZone(z => ({ ...z, fromPos: e.target.value }))}
              placeholder="1" className="admin-input text-xs py-1" />
          </div>
          <div>
            <label className="text-[9px] text-muted-foreground uppercase block mb-0.5">To pos</label>
            <input type="number" value={newZone.toPos}
              onChange={e => setNewZone(z => ({ ...z, toPos: e.target.value }))}
              placeholder="1" className="admin-input text-xs py-1" />
          </div>
        </div>
        <p className="text-[9px] text-muted-foreground">Use negative numbers to count from bottom (−1 = last place)</p>
        <div>
          <label className="text-[9px] text-muted-foreground uppercase block mb-0.5">Type</label>
          <select value={newZone.type} onChange={e => setNewZone(z => ({ ...z, type: e.target.value as ZoneType }))} className="admin-input text-xs py-1">
            {(Object.keys(ZONE_TYPE_LABELS) as ZoneType[]).map(t => (
              <option key={t} value={t}>{ZONE_TYPE_LABELS[t]}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-[9px] text-muted-foreground uppercase block mb-0.5">Label (shown in legend)</label>
          <input value={newZone.label}
            onChange={e => setNewZone(z => ({ ...z, label: e.target.value }))}
            placeholder="e.g. Direct to Final" className="admin-input text-xs py-1" />
        </div>
        <button type="button" onClick={addZone}
          disabled={!newZone.label || !newZone.fromPos || !newZone.toPos}
          className="w-full flex items-center justify-center gap-1 bg-muted border border-border rounded-lg py-1.5 text-[11px] font-semibold text-foreground disabled:opacity-40 hover:bg-muted/60 transition-colors">
          <Plus className="w-3 h-3" /> Add Zone
        </button>
      </div>
    </div>
  );
}

export function TournamentsTab() {
  const qc = useQueryClient();
  const [form, setForm] = useState({ ...EMPTY });
  const [showForm, setShowForm] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState({ ...EMPTY });

  const { data: tournaments, isLoading } = useListTournaments();
  const createTournament = useCreateTournament();
  const updateTournament = useUpdateTournament();
  const deleteTournament = useDeleteTournament();

  const invalidate = () => qc.invalidateQueries({ queryKey: getListTournamentsQueryKey() });

  const buildPayload = (f: typeof EMPTY) => {
    const { singleGroupFormat: sgf, qualificationZones, ...rest } = f;
    return {
      ...rest,
      ...(sgf ? { singleGroupFormat: sgf as "bye_semi" | "top2_final" } : {}),
      ...(qualificationZones.length > 0 ? { qualificationZones } : {}),
    };
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.season) return;
    createTournament.mutate({ data: buildPayload(form) }, {
      onSuccess: () => { setForm({ ...EMPTY }); setShowForm(false); invalidate(); },
    });
  };

  const handleEditStart = (t: {
    id: number; name: string; sport: string; season: string;
    logoUrl?: string | null; description?: string | null; format: string;
    singleGroupFormat?: string | null; color?: string | null;
    qualificationZones?: QualificationZone[] | null;
  }) => {
    setEditingId(t.id);
    setEditForm({
      name: t.name,
      sport: (t.sport ?? "football") as Sport,
      season: t.season,
      logoUrl: t.logoUrl ?? "",
      description: t.description ?? "",
      format: (t.format ?? "league") as Format,
      singleGroupFormat: (t.singleGroupFormat ?? "") as SingleGroupFmt,
      color: t.color ?? "#e53935",
      qualificationZones: (t.qualificationZones ?? []) as QualificationZone[],
    });
    setExpandedId(null);
  };

  const handleEditSave = (id: number) => {
    if (!editForm.name || !editForm.season) return;
    updateTournament.mutate({ id, data: buildPayload(editForm) }, {
      onSuccess: () => { setEditingId(null); invalidate(); },
    });
  };

  const handleDelete = (id: number) => {
    if (!confirm("Delete this tournament?")) return;
    deleteTournament.mutate({ id }, { onSuccess: invalidate });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">{tournaments?.length ?? 0} tournaments</p>
        <button onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-1.5 bg-primary text-white rounded-xl px-3 py-2 text-xs font-bold">
          {showForm ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
          {showForm ? "Cancel" : "Add Tournament"}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="bg-card border border-border rounded-xl p-4 space-y-3">
          <p className="text-sm font-bold text-foreground">New Tournament</p>
          <div className="grid grid-cols-2 gap-2">
            <div className="col-span-2">
              <label className="text-[10px] font-semibold text-muted-foreground uppercase block mb-1">Name *</label>
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="Premier League" className="admin-input" />
            </div>
            <div>
              <label className="text-[10px] font-semibold text-muted-foreground uppercase block mb-1">Sport *</label>
              <select value={form.sport} onChange={e => setForm(f => ({ ...f, sport: e.target.value as Sport }))} className="admin-input">
                <option value="football">Football</option>
                <option value="futsal">Futsal</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] font-semibold text-muted-foreground uppercase block mb-1">Season *</label>
              <input value={form.season} onChange={e => setForm(f => ({ ...f, season: e.target.value }))}
                placeholder="2024/25" className="admin-input" />
            </div>
            <div>
              <label className="text-[10px] font-semibold text-muted-foreground uppercase block mb-1">Format</label>
              <select value={form.format} onChange={e => setForm(f => ({ ...f, format: e.target.value as Format, singleGroupFormat: "" }))} className="admin-input">
                <option value="league">League</option>
                <option value="group_stage">Group Stage</option>
                <option value="knockout">Knockout</option>
              </select>
            </div>
            {form.format === "group_stage" && (
              <div className="col-span-2">
                <label className="text-[10px] font-semibold text-muted-foreground uppercase block mb-1">Single-Group Bracket Format</label>
                <select value={form.singleGroupFormat} onChange={e => setForm(f => ({ ...f, singleGroupFormat: e.target.value as SingleGroupFmt }))} className="admin-input">
                  <option value="">— Auto / Multiple Groups —</option>
                  <option value="bye_semi">1st BYE → Final · 2nd vs 3rd → Semi-Final</option>
                  <option value="top2_final">1st vs 2nd → Final directly</option>
                </select>
              </div>
            )}
            <div>
              <label className="text-[10px] font-semibold text-muted-foreground uppercase block mb-1">Logo URL</label>
              <input value={form.logoUrl} onChange={e => setForm(f => ({ ...f, logoUrl: e.target.value }))}
                placeholder="https://..." className="admin-input" />
            </div>
            <div className="col-span-2">
              <label className="text-[10px] font-semibold text-muted-foreground uppercase block mb-1">Description</label>
              <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Optional" className="admin-input" />
            </div>
            <div className="col-span-2">
              <label className="text-[10px] font-semibold text-muted-foreground uppercase block mb-1">Brand Color</label>
              <div className="flex items-center gap-2 flex-wrap">
                {COLOR_PRESETS.map(c => (
                  <button key={c} type="button" onClick={() => setForm(f => ({ ...f, color: c }))}
                    className="w-6 h-6 rounded-full border-2 transition-all shrink-0"
                    style={{ backgroundColor: c, borderColor: form.color === c ? "#fff" : "transparent" }} />
                ))}
                <input type="color" value={form.color} onChange={e => setForm(f => ({ ...f, color: e.target.value }))}
                  className="w-7 h-7 rounded-full cursor-pointer border border-border bg-transparent p-0.5" title="Custom color" />
                <div className="w-6 h-6 rounded-full border border-border shrink-0" style={{ backgroundColor: form.color }} />
              </div>
            </div>
            <div className="col-span-2">
              <ZoneEditor zones={form.qualificationZones} onChange={zones => setForm(f => ({ ...f, qualificationZones: zones }))} />
            </div>
          </div>
          <button type="submit" disabled={createTournament.isPending}
            className="w-full bg-primary text-white rounded-xl py-2.5 text-sm font-bold disabled:opacity-50">
            {createTournament.isPending ? "Adding..." : "Add Tournament"}
          </button>
        </form>
      )}

      {isLoading ? (
        <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)}</div>
      ) : tournaments && tournaments.length > 0 ? (
        <div className="space-y-2">
          {tournaments.map(t => (
            <div key={t.id} className="bg-card rounded-xl border border-border overflow-hidden">
              {editingId === t.id ? (
                <div className="p-4 space-y-3">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-sm font-bold text-foreground">Edit Tournament</p>
                    <button onClick={() => setEditingId(null)} className="text-muted-foreground hover:text-foreground p-1">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="col-span-2">
                      <label className="text-[10px] font-semibold text-muted-foreground uppercase block mb-1">Name *</label>
                      <input value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
                        className="admin-input" />
                    </div>
                    <div>
                      <label className="text-[10px] font-semibold text-muted-foreground uppercase block mb-1">Sport</label>
                      <select value={editForm.sport} onChange={e => setEditForm(f => ({ ...f, sport: e.target.value as Sport }))} className="admin-input">
                        <option value="football">Football</option>
                        <option value="futsal">Futsal</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] font-semibold text-muted-foreground uppercase block mb-1">Season *</label>
                      <input value={editForm.season} onChange={e => setEditForm(f => ({ ...f, season: e.target.value }))}
                        className="admin-input" />
                    </div>
                    <div>
                      <label className="text-[10px] font-semibold text-muted-foreground uppercase block mb-1">Format</label>
                      <select value={editForm.format} onChange={e => setEditForm(f => ({ ...f, format: e.target.value as Format, singleGroupFormat: "" }))} className="admin-input">
                        <option value="league">League</option>
                        <option value="group_stage">Group Stage</option>
                        <option value="knockout">Knockout</option>
                      </select>
                    </div>
                    {editForm.format === "group_stage" && (
                      <div className="col-span-2">
                        <label className="text-[10px] font-semibold text-muted-foreground uppercase block mb-1">Single-Group Bracket Format</label>
                        <select value={editForm.singleGroupFormat} onChange={e => setEditForm(f => ({ ...f, singleGroupFormat: e.target.value as SingleGroupFmt }))} className="admin-input">
                          <option value="">— Auto / Multiple Groups —</option>
                          <option value="bye_semi">1st BYE → Final · 2nd vs 3rd → Semi-Final</option>
                          <option value="top2_final">1st vs 2nd → Final directly</option>
                        </select>
                      </div>
                    )}
                    <div>
                      <label className="text-[10px] font-semibold text-muted-foreground uppercase block mb-1">Logo URL</label>
                      <input value={editForm.logoUrl} onChange={e => setEditForm(f => ({ ...f, logoUrl: e.target.value }))}
                        placeholder="https://..." className="admin-input" />
                    </div>
                    <div className="col-span-2">
                      <label className="text-[10px] font-semibold text-muted-foreground uppercase block mb-1">Description</label>
                      <input value={editForm.description} onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))}
                        placeholder="Optional" className="admin-input" />
                    </div>
                    <div className="col-span-2">
                      <label className="text-[10px] font-semibold text-muted-foreground uppercase block mb-1">Brand Color</label>
                      <div className="flex items-center gap-2 flex-wrap">
                        {COLOR_PRESETS.map(c => (
                          <button key={c} type="button" onClick={() => setEditForm(f => ({ ...f, color: c }))}
                            className="w-6 h-6 rounded-full border-2 transition-all shrink-0"
                            style={{ backgroundColor: c, borderColor: editForm.color === c ? "#fff" : "transparent" }} />
                        ))}
                        <input type="color" value={editForm.color} onChange={e => setEditForm(f => ({ ...f, color: e.target.value }))}
                          className="w-7 h-7 rounded-full cursor-pointer border border-border bg-transparent p-0.5" title="Custom color" />
                        <div className="w-6 h-6 rounded-full border border-border shrink-0" style={{ backgroundColor: editForm.color }} />
                      </div>
                    </div>
                    {editForm.logoUrl && (
                      <div className="col-span-2 flex items-center gap-3 bg-muted/30 rounded-xl p-2">
                        <img
                          src={editForm.logoUrl}
                          alt="Logo preview"
                          className="w-10 h-10 object-contain rounded"
                          onError={e => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                        />
                        <span className="text-[10px] text-muted-foreground">Logo preview</span>
                      </div>
                    )}
                    <div className="col-span-2">
                      <ZoneEditor zones={editForm.qualificationZones} onChange={zones => setEditForm(f => ({ ...f, qualificationZones: zones }))} />
                    </div>
                  </div>
                  <button onClick={() => handleEditSave(t.id)} disabled={updateTournament.isPending}
                    className="w-full bg-primary text-white rounded-xl py-2.5 text-sm font-bold disabled:opacity-50 flex items-center justify-center gap-2">
                    <Check className="w-4 h-4" />
                    {updateTournament.isPending ? "Saving..." : "Save Changes"}
                  </button>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-3 px-4 py-3">
                    <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0 overflow-hidden">
                      {t.logoUrl ? (
                        <img src={t.logoUrl} alt={t.name} className="w-6 h-6 object-contain"
                          onError={e => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
                      ) : (
                        <Trophy className="w-4 h-4 text-muted-foreground" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground">{t.name}</p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-[10px] text-muted-foreground capitalize">{t.sport} · {t.season}</span>
                        <span className="inline-flex items-center gap-0.5 text-[9px] font-bold bg-muted text-muted-foreground px-1.5 py-0.5 rounded-full border border-border">
                          <Layers className="w-2.5 h-2.5" />{FORMAT_LABELS[t.format as Format] ?? t.format}
                        </span>
                      </div>
                    </div>
                    <button onClick={() => setExpandedId(expandedId === t.id ? null : t.id)}
                      className={cn("text-muted-foreground hover:text-foreground p-1 transition-colors", expandedId === t.id && "text-primary")}>
                      <ChevronDown className={cn("w-4 h-4 transition-transform", expandedId === t.id && "rotate-180")} />
                    </button>
                    <button onClick={() => handleEditStart(t)}
                      className="text-muted-foreground hover:text-blue-400 transition-colors p-1" title="Edit tournament">
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleDelete(t.id)} className="text-muted-foreground hover:text-red-400 transition-colors p-1">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  {expandedId === t.id && <StandingsPanel tournamentId={t.id} format={(t.format as Format) ?? "league"} />}
                </>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="py-12 text-center text-muted-foreground text-sm bg-card rounded-xl border border-dashed border-border">
          No tournaments yet. Create one above.
        </div>
      )}
    </div>
  );
}

function StandingsPanel({ tournamentId, format }: { tournamentId: number; format: string }) {
  const { data: standings, isLoading } = useGetTournamentStandings(tournamentId, {
    query: { enabled: true, queryKey: getGetTournamentStandingsQueryKey(tournamentId) }
  });

  if (isLoading) return <div className="px-4 pb-3 pt-2"><Skeleton className="h-20 w-full rounded" /></div>;

  const groups = standings?.groups ?? {};
  const groupNames = Object.keys(groups);

  if (groupNames.length === 0 || groupNames.every(k => groups[k]?.length === 0)) {
    return <p className="px-4 pb-3 pt-1 text-xs text-muted-foreground">No finished matches yet — standings will appear here.</p>;
  }

  return (
    <div className="border-t border-border">
      {groupNames.map(groupName => {
        const rows = groups[groupName] ?? [];
        return (
          <div key={groupName}>
            <div className="flex items-center gap-2 px-4 py-2 bg-muted/20 border-b border-border/50">
              <Trophy className="w-3 h-3 text-primary" />
              <p className="text-[10px] font-black text-foreground uppercase tracking-wider">{groupName}</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs min-w-[320px]">
                <thead>
                  <tr className="text-muted-foreground px-4">
                    <th className="text-left font-semibold pb-1 pt-2 pl-4 w-6">#</th>
                    <th className="text-left font-semibold pb-1 pt-2">Team</th>
                    <th className="text-center font-semibold pb-1 pt-2 w-7">P</th>
                    <th className="text-center font-semibold pb-1 pt-2 w-7">W</th>
                    <th className="text-center font-semibold pb-1 pt-2 w-7">D</th>
                    <th className="text-center font-semibold pb-1 pt-2 w-7">L</th>
                    <th className="text-center font-semibold pb-1 pt-2 w-8">GD</th>
                    <th className="text-center font-semibold pb-1 pt-2 w-8 text-primary pr-4">Pts</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, idx) => (
                    <tr key={row.position}
                      className={cn("border-t border-border/30", format === "group_stage" && idx < 2 && "bg-primary/5")}>
                      <td className="py-1.5 pl-4 text-muted-foreground">{row.position}</td>
                      <td className="py-1.5">
                        <div className="flex items-center gap-1.5">
                          <TeamLogo url={row.team.logoUrl} name={row.team.name} shortName={row.team.shortName} className="w-4 h-4" />
                          <span className="font-semibold text-foreground truncate max-w-[80px]">{row.team.name}</span>
                        </div>
                      </td>
                      <td className="py-1.5 text-center text-muted-foreground">{row.played}</td>
                      <td className="py-1.5 text-center text-muted-foreground">{row.won}</td>
                      <td className="py-1.5 text-center text-muted-foreground">{row.drawn}</td>
                      <td className="py-1.5 text-center text-muted-foreground">{row.lost}</td>
                      <td className="py-1.5 text-center text-muted-foreground">{row.goalDifference > 0 ? `+${row.goalDifference}` : row.goalDifference}</td>
                      <td className="py-1.5 text-center font-black text-primary pr-4">{row.points}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}
    </div>
  );
}
