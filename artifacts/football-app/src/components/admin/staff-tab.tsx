import { useState } from "react";
import { useListAdminStaff, useCreateAdminStaff, useDeleteAdminStaff, getListAdminStaffQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { UserCog, Trash2, Plus, Mail, User, Lock, X } from "lucide-react";
import { cn } from "@/lib/utils";

export function StaffTab() {
  const queryClient = useQueryClient();
  const { data: staff, isLoading } = useListAdminStaff();
  const createStaff = useCreateAdminStaff();
  const deleteStaff = useDeleteAdminStaff();

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: getListAdminStaffQueryKey() });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    createStaff.mutate(
      { data: { name: form.name, email: form.email, password: form.password } },
      {
        onSuccess: () => {
          invalidate();
          setForm({ name: "", email: "", password: "" });
          setShowForm(false);
        },
        onError: () => setError("Email already exists or invalid input."),
      }
    );
  };

  const handleDelete = (id: number) => {
    setDeletingId(id);
    deleteStaff.mutate(
      { id },
      {
        onSuccess: () => { invalidate(); setDeletingId(null); },
        onError: () => setDeletingId(null),
      }
    );
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-violet-500/15 border border-violet-500/30 flex items-center justify-center">
            <UserCog className="w-4 h-4 text-violet-400" />
          </div>
          <div>
            <p className="text-sm font-black text-foreground">Staff Accounts</p>
            <p className="text-[10px] text-muted-foreground">Staff can log in with email & password</p>
          </div>
        </div>
        <button
          onClick={() => { setShowForm(v => !v); setError(""); }}
          className={cn(
            "flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl border transition-all",
            showForm
              ? "bg-muted text-muted-foreground border-border"
              : "bg-primary text-white border-primary hover:bg-primary/90"
          )}
        >
          {showForm ? <><X className="w-3.5 h-3.5" /> Cancel</> : <><Plus className="w-3.5 h-3.5" /> Add Staff</>}
        </button>
      </div>

      {/* Add form */}
      {showForm && (
        <form onSubmit={handleCreate} className="rounded-2xl border border-border bg-card p-4 space-y-3">
          <p className="text-xs font-bold text-foreground">New Staff Account</p>
          <div className="space-y-2">
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <input
                type="text"
                placeholder="Full name"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                required
                className="w-full pl-9 pr-3 py-2 text-sm bg-background border border-border rounded-xl text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary"
              />
            </div>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <input
                type="email"
                placeholder="Email address"
                value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                required
                className="w-full pl-9 pr-3 py-2 text-sm bg-background border border-border rounded-xl text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary"
              />
            </div>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <input
                type="password"
                placeholder="Password (min 6 chars)"
                value={form.password}
                onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                required
                minLength={6}
                className="w-full pl-9 pr-3 py-2 text-sm bg-background border border-border rounded-xl text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary"
              />
            </div>
          </div>
          {error && <p className="text-xs text-red-400">{error}</p>}
          <button
            type="submit"
            disabled={createStaff.isPending}
            className="w-full bg-primary text-white text-sm font-bold py-2 rounded-xl hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {createStaff.isPending ? "Creating..." : "Create Staff Account"}
          </button>
        </form>
      )}

      {/* Staff list */}
      {isLoading ? (
        <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-14 rounded-xl" />)}</div>
      ) : staff?.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-muted/20 py-10 text-center">
          <UserCog className="w-7 h-7 text-muted-foreground/30 mx-auto mb-2" />
          <p className="text-sm font-bold text-muted-foreground">No staff accounts yet</p>
          <p className="text-[11px] text-muted-foreground/60 mt-1">Add staff members so they can manage content</p>
        </div>
      ) : (
        <div className="space-y-2">
          {staff?.map(s => (
            <div key={s.id} className="flex items-center justify-between bg-card border border-border rounded-xl px-4 py-3">
              <div>
                <p className="text-sm font-bold text-foreground">{s.name}</p>
                <p className="text-xs text-muted-foreground">{s.email}</p>
              </div>
              <button
                onClick={() => handleDelete(s.id)}
                disabled={deletingId === s.id}
                className="p-1.5 rounded-lg text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-40"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
