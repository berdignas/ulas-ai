"use client";

import { useEffect, useState } from "react";
import { Key, PencilSimple, Plus, ShieldCheck, SpinnerGap, Trash, UsersThree, X } from "@phosphor-icons/react";
import { PageHeader } from "@/components/page-header";
import { LoadingSection } from "@/components/states";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type Role = "admin" | "pkrs" | "pengaduan";
type User = { id: number; username: string; role: Role; dibuat_pada: string; terakhir_login: string | null };

const roleLabel: Record<Role, string> = { admin: "Admin", pkrs: "PKRS", pengaduan: "Pengaduan" };

export default function ManajemenAkunPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<User | null>(null);
  const [form, setForm] = useState({ username: "", password: "", role: "pkrs" as Role });

  async function loadUsers() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/users", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal memuat akun.");
      setUsers(data.users ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal memuat akun.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => void loadUsers(), 0);
    return () => window.clearTimeout(timer);
  }, []);

  function startCreate() {
    setEditing(null);
    setForm({ username: "", password: "", role: "pkrs" });
    setError(null);
  }

  function startEdit(user: User) {
    setEditing(user);
    setForm({ username: user.username, password: "", role: user.role });
    setError(null);
  }

  async function saveUser() {
    setSaving(true);
    setError(null);
    try {
      const endpoint = editing ? `/api/admin/users/${editing.id}` : "/api/admin/users";
      const res = await fetch(endpoint, {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal menyimpan akun.");
      await loadUsers();
      startCreate();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal menyimpan akun.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteUser(user: User) {
    if (!window.confirm(`Hapus akun ${user.username}?`)) return;
    setError(null);
    const res = await fetch(`/api/admin/users/${user.id}`, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok) setError(data.error || "Gagal menghapus akun.");
    else await loadUsers();
  }

  if (loading) return <LoadingSection rows={4} />;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Manajemen Akun"
        description="Kelola akun dan hak akses pengguna Ulas AI. Hanya admin yang dapat membuka halaman ini."
      >
        <Button onClick={startCreate} className="gap-2" variant={editing ? "outline" : "default"}>
          <Plus className="size-4" weight="bold" /> Akun Baru
        </Button>
      </PageHeader>

      {error && <Alert variant="danger"><AlertDescription>{error}</AlertDescription></Alert>}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <Card>
          <CardHeader className="border-b border-border/70">
            <CardTitle className="flex items-center gap-2 text-base"><UsersThree className="size-5" /> Daftar Akun</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-border/70">
              {users.map((user) => (
                <div key={user.id} className="flex flex-wrap items-center justify-between gap-4 px-5 py-4">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                      {user.username.slice(0, 1).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{user.username}</p>
                      <p className="text-xs text-muted-foreground">
                        Login terakhir: {user.terakhir_login ? new Date(user.terakhir_login).toLocaleString("id-ID") : "Belum pernah"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className={cn("text-[11px]", user.role === "admin" && "border-primary/40 bg-primary/5 text-primary")}>{roleLabel[user.role]}</Badge>
                    <Button variant="ghost" size="icon" onClick={() => startEdit(user)} aria-label={`Edit ${user.username}`}><PencilSimple className="size-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => void deleteUser(user)} aria-label={`Hapus ${user.username}`} className="text-destructive hover:text-destructive"><Trash className="size-4" /></Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="h-fit">
          <CardHeader className="border-b border-border/70">
            <CardTitle className="flex items-center justify-between text-base">
              <span className="flex items-center gap-2"><Key className="size-5" /> {editing ? "Edit Akun" : "Tambah Akun"}</span>
              {editing && <Button variant="ghost" size="icon" onClick={startCreate} aria-label="Batal edit"><X className="size-4" /></Button>}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 pt-5">
            <div className="space-y-1.5"><Label htmlFor="account-username">Username</Label><Input id="account-username" value={form.username} onChange={(e) => setForm((p) => ({ ...p, username: e.target.value }))} placeholder="contoh: pkrs" disabled={saving} /></div>
            <div className="space-y-1.5"><Label htmlFor="account-password">{editing ? "Password baru (opsional)" : "Password"}</Label><Input id="account-password" type="password" value={form.password} onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))} placeholder="Minimal 8 karakter" disabled={saving} /></div>
            <div className="space-y-1.5"><Label htmlFor="account-role">Role</Label><select id="account-role" value={form.role} onChange={(e) => setForm((p) => ({ ...p, role: e.target.value as Role }))} disabled={saving} className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm"><option value="admin">Admin — akses penuh</option><option value="pkrs">PKRS — tanpa Pengaturan RS</option><option value="pengaduan">Pengaduan — tanpa Pengaturan RS</option></select></div>
            <p className="flex gap-2 text-xs leading-relaxed text-muted-foreground"><ShieldCheck className="mt-0.5 size-4 shrink-0 text-emerald-600" /> Password disimpan dalam bentuk hash dan tidak pernah ditampilkan kembali.</p>
            <Button className="w-full gap-2" onClick={() => void saveUser()} disabled={saving || !form.username || (!editing && !form.password)}>{saving && <SpinnerGap className="size-4 animate-spin" />} {editing ? "Simpan Perubahan" : "Buat Akun"}</Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
