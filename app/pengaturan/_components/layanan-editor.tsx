"use client";

import { useCallback, useEffect, useState } from "react";
import {
  CheckCircle,
  FloppyDisk,
  MapPin,
  Plus,
  SpinnerGap,
  Trash,
  WarningCircle,
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { JenisLokasiLayanan } from "@/lib/service-taxonomy";

type LayananItem = {
  id?: number;
  localId: string;
  nama: string;
  jenis: JenisLokasiLayanan;
  kataKunci: string[];
  aktif: boolean;
  urutan: number;
};

const JENIS_LABEL: Record<JenisLokasiLayanan, string> = {
  poli: "Poli",
  ruangan: "Ruangan",
  unit: "Unit layanan",
  fasilitas: "Fasilitas",
};

function denganLocalId(item: Omit<LayananItem, "localId">): LayananItem {
  return { ...item, localId: item.id ? `db-${item.id}` : crypto.randomUUID() };
}

export function LayananEditor({ rumahSakitId }: { rumahSakitId: number | null }) {
  const [items, setItems] = useState<LayananItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const load = useCallback(async () => {
    if (!rumahSakitId) {
      setItems([]);
      return;
    }
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/rumah-sakit/${rumahSakitId}/layanan`);
      const data = await res.json() as { layanan?: Array<Omit<LayananItem, "localId">>; diklasifikasi?: number; error?: string };
      if (!res.ok) throw new Error(data.error || "Gagal memuat daftar layanan.");
      setItems((data.layanan ?? []).filter((item) => item.aktif).map(denganLocalId));
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "Gagal memuat daftar layanan." });
    } finally {
      setLoading(false);
    }
  }, [rumahSakitId]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const update = (localId: string, patch: Partial<LayananItem>) => {
    setItems((current) => current.map((item) => item.localId === localId ? { ...item, ...patch } : item));
    setMessage(null);
  };

  const add = () => {
    setItems((current) => [
      ...current,
      denganLocalId({
        nama: "",
        jenis: "poli",
        kataKunci: [],
        aktif: true,
        urutan: current.length + 1,
      }),
    ]);
  };

  const save = async () => {
    if (!rumahSakitId) return;
    if (items.some((item) => !item.nama.trim())) {
      setMessage({ type: "error", text: "Semua nama poli atau ruangan wajib diisi." });
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/rumah-sakit/${rumahSakitId}/layanan`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          layanan: items.map((item, index) => ({
            id: item.id,
            nama: item.nama,
            jenis: item.jenis,
            kataKunci: item.kataKunci,
            aktif: item.aktif,
            urutan: index + 1,
          })),
        }),
      });
      const data = await res.json() as { layanan?: Array<Omit<LayananItem, "localId">>; diklasifikasi?: number; error?: string };
      if (!res.ok) throw new Error(data.error || "Gagal menyimpan daftar layanan.");
      setItems((data.layanan ?? []).filter((item) => item.aktif).map(denganLocalId));
      setMessage({
        type: "success",
        text: `${items.length} poli/ruangan tersimpan. ${data.diklasifikasi ?? 0} kecocokan pada review lama diperbarui.`,
      });
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "Gagal menyimpan daftar layanan." });
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="rounded-xl border border-border bg-muted/20" aria-labelledby="layanan-heading">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-4 py-4">
        <div className="flex min-w-0 gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-border bg-background">
            <MapPin className="size-4 text-primary" weight="duotone" aria-hidden="true" />
          </span>
          <div>
            <h4 id="layanan-heading" className="text-sm font-semibold">Unit Layanan, Poli & Ruangan</h4>
            <p className="mt-1 max-w-2xl text-xs leading-5 text-muted-foreground">
              Nama dan alias dipakai untuk mengenali lokasi yang disebut dalam review. Jumlah dapat disesuaikan dengan struktur RS.
            </p>
          </div>
        </div>
        <span className="rounded-full border border-border bg-background px-2.5 py-1 text-xs font-medium tabular-nums text-muted-foreground">
          {items.length}/200 lokasi
        </span>
      </div>

      {!rumahSakitId ? (
        <p className="px-4 py-8 text-center text-sm text-muted-foreground">
          Simpan data rumah sakit terlebih dahulu sebelum mengatur poli dan ruangan.
        </p>
      ) : loading ? (
        <div className="flex items-center justify-center gap-2 px-4 py-8 text-sm text-muted-foreground">
          <SpinnerGap className="size-4 animate-spin" /> Memuat daftar layanan…
        </div>
      ) : (
        <div className="space-y-3 p-4">
          {items.length === 0 && (
            <p className="rounded-lg border border-dashed border-border bg-background px-4 py-6 text-center text-sm text-muted-foreground">
              Belum ada lokasi layanan. Tambahkan lokasi pertama untuk mulai mengelompokkan review.
            </p>
          )}

          {items.map((item, index) => (
            <div key={item.localId} className="grid gap-3 rounded-lg border border-border bg-background p-3 lg:grid-cols-[minmax(180px,1fr)_150px_minmax(240px,1.4fr)_auto] lg:items-end">
              <div className="space-y-1.5">
                <Label htmlFor={`layanan-nama-${item.localId}`} className="text-xs">Nama lokasi</Label>
                <Input
                  id={`layanan-nama-${item.localId}`}
                  value={item.nama}
                  onChange={(event) => update(item.localId, { nama: event.target.value })}
                  placeholder="Contoh: Ruang Anggrek"
                  maxLength={100}
                  className="h-11 text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={`layanan-jenis-${item.localId}`} className="text-xs">Jenis</Label>
                <select
                  id={`layanan-jenis-${item.localId}`}
                  value={item.jenis}
                  onChange={(event) => update(item.localId, { jenis: event.target.value as JenisLokasiLayanan })}
                  className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {Object.entries(JENIS_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={`layanan-kunci-${item.localId}`} className="text-xs">Alias/kata kunci</Label>
                <Input
                  id={`layanan-kunci-${item.localId}`}
                  value={item.kataKunci.join(", ")}
                  onChange={(event) => update(item.localId, {
                    kataKunci: event.target.value.split(",").map((value) => value.trim()).filter(Boolean).slice(0, 20),
                  })}
                  placeholder="ruang operasi, kamar operasi, OK"
                  className="h-11 text-sm"
                />
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={() => setItems((current) => current.filter((entry) => entry.localId !== item.localId))}
                className="h-11 gap-2 text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                aria-label={`Hapus ${item.nama || `baris ${index + 1}`}`}
              >
                <Trash className="size-4" aria-hidden="true" />
                <span className="lg:sr-only">Hapus</span>
              </Button>
            </div>
          ))}

          {message && (
            <div role="status" className={`flex items-start gap-2 rounded-lg border px-3 py-2.5 text-xs ${message.type === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-rose-200 bg-rose-50 text-rose-800"}`}>
              {message.type === "success" ? <CheckCircle className="mt-0.5 size-4 shrink-0" /> : <WarningCircle className="mt-0.5 size-4 shrink-0" />}
              <span>{message.text}</span>
            </div>
          )}

          <div className="flex flex-wrap justify-between gap-2 border-t border-border pt-3">
            <Button type="button" variant="outline" onClick={add} disabled={items.length >= 200 || saving} className="h-11 gap-2">
              <Plus className="size-4" /> Tambah Poli/Ruangan
            </Button>
            <Button type="button" onClick={save} disabled={saving} className="h-11 gap-2">
              {saving ? <SpinnerGap className="size-4 animate-spin" /> : <FloppyDisk className="size-4" />}
              {saving ? "Menyimpan…" : "Simpan Daftar Layanan"}
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}
