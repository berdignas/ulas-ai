"use client";

import { Suspense, useEffect, useState } from "react";
import {
  Building,
  FloppyDisk,
  Globe,
  Shield,
  SpinnerGap,
  TestTube,
  Trash,
  Plus,
  WarningCircle,
  X,
} from "@phosphor-icons/react";
import { PageHeader } from "@/components/page-header";
import { LoadingSection, EmptyState } from "@/components/states";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useSearchParams } from "next/navigation";

type RumahSakit = {
  id: number;
  nama: string;
  kode: string;
  googleMapsPlaceId: string | null;
  apifyActorId: string | null;
  apifyToken: string | null;
  aktif: number;
  zonaWaktu: string;
  jamSinkron: number;
};

function PengaturanContent() {
  const searchParams = useSearchParams();

  const [rumahSakitList, setRumahSakitList] = useState<RumahSakit[]>([]);
  const [rsId] = useState<string | null>(searchParams?.get("rs") ?? null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [form, setForm] = useState({
    nama: "",
    kode: "",
    googleMapsPlaceId: "",
    apifyActorId: "compass/google-maps-reviews-scraper",
    apifyToken: "",
    aktif: true,
    zonaWaktu: "Asia/Jakarta",
    jamSinkron: 6,
  });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [lastAction, setLastAction] = useState<"saved" | "deleted" | null>(null);
  const [testResult, setTestResult] = useState<{ sukses: boolean; pesan: string } | null>(null);
  const [testing, setTesting] = useState(false);

  const fetchList = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/rumah-sakit");
      const data = await res.json();
      setRumahSakitList(data.rumahSakit ?? []);
      if (rsId && data.rumahSakit?.some((rs: RumahSakit) => String(rs.id) === rsId)) {
        setSelectedId(Number(rsId));
        const rs = data.rumahSakit.find((rs: RumahSakit) => String(rs.id) === rsId);
        if (rs) {
          setForm({
            nama: rs.nama,
            kode: rs.kode,
            googleMapsPlaceId: rs.googleMapsPlaceId ?? "",
            apifyActorId: rs.apifyActorId ?? "compass/google-maps-reviews-scraper",
            apifyToken: rs.apifyToken ?? "",
            aktif: Boolean(rs.aktif),
            zonaWaktu: rs.zonaWaktu ?? "Asia/Jakarta",
            jamSinkron: rs.jamSinkron ?? 6,
          });
        }
      } else if (data.rumahSakit?.[0] && !selectedId) {
        setSelectedId(data.rumahSakit[0].id);
        setForm({
          nama: data.rumahSakit[0].nama,
          kode: data.rumahSakit[0].kode,
          googleMapsPlaceId: data.rumahSakit[0].googleMapsPlaceId ?? "",
          apifyActorId: data.rumahSakit[0].apifyActorId ?? "compass/google-maps-reviews-scraper",
          apifyToken: data.rumahSakit[0].apifyToken ?? "",
          aktif: Boolean(data.rumahSakit[0].aktif),
          zonaWaktu: data.rumahSakit[0].zonaWaktu ?? "Asia/Jakarta",
          jamSinkron: data.rumahSakit[0].jamSinkron ?? 6,
        });
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchList();
  }, [rsId]);

  const handleSelect = (rs: RumahSakit) => {
    setSelectedId(rs.id);
    setForm({
      nama: rs.nama,
      kode: rs.kode,
      googleMapsPlaceId: rs.googleMapsPlaceId ?? "",
      apifyActorId: rs.apifyActorId ?? "compass/google-maps-reviews-scraper",
      apifyToken: rs.apifyToken ?? "",
      aktif: Boolean(rs.aktif),
      zonaWaktu: rs.zonaWaktu ?? "Asia/Jakarta",
      jamSinkron: rs.jamSinkron ?? 6,
    });
    setLastAction(null);
  };

  const handleNew = () => {
    setSelectedId(null);
    setForm({
      nama: "",
      kode: "",
      googleMapsPlaceId: "",
      apifyActorId: "compass/google-maps-reviews-scraper",
      apifyToken: "",
      aktif: true,
      zonaWaktu: "Asia/Jakarta",
      jamSinkron: 6,
    });
    setLastAction(null);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? (e.target as HTMLInputElement).checked : value,
    }));
  };

  const handleSave = async () => {
    if (!form.nama || !form.kode) return alert("Nama dan kode wajib diisi");
    setSaving(true);
    try {
      if (selectedId) {
        const res = await fetch("/api/rumah-sakit", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...form, id: selectedId }),
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error ?? "Gagal menyimpan");
        }
      } else {
        const res = await fetch("/api/rumah-sakit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error ?? "Gagal menyimpan");
        }
      }
      fetchList();
      setSaving(false);
      setLastAction("saved");
    } catch (e) {
      alert(e instanceof Error ? e.message : "Gagal menyimpan");
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedId) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/rumah-sakit?id=${selectedId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Gagal menghapus");
      }
      fetchList();
      setSelectedId(null);
      setLastAction("deleted");
    } catch (e) {
      alert(e instanceof Error ? e.message : "Gagal menghapus");
    } finally {
      setDeleting(false);
    }
  };

  const handleTestApify = async () => {
    if (!selectedId) {
      setTestResult({ sukses: false, pesan: "Pilih rumah sakit dari daftar kiri terlebih dahulu" });
      return;
    }
    if (!form.apifyToken || !form.googleMapsPlaceId) {
      setTestResult({ sukses: false, pesan: "Token Apify dan Place ID wajib diisi" });
      return;
    }
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch("/api/sinkron", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rumahSakitId: selectedId, tipePemicu: "manual" }),
      });
      const data = await res.json();
      setTestResult({ sukses: data.sukses, pesan: data.sukses ? `Berhasil. ${data.ulasanBaru} ulasan baru ditemukan.` : `Gagal: ${data.pesanError}` });
    } catch (e) {
      setTestResult({ sukses: false, pesan: e instanceof Error ? e.message : "Gagal menguji koneksi" });
    } finally {
      setTesting(false);
    }
  };

  if (loading) {
    return <LoadingSection rows={3} />;
  }

  const isNew = selectedId === null;

  return (
    <div className="max-w-[1400px] mx-auto px-4 py-8">
      <PageHeader
        title="Pengaturan Rumah Sakit"
        description="Kelola konfigurasi rumah sakit, koneksi Apify, dan jadwal sinkronisasi otomatis"
      >
        <Button variant="outline" size="sm" onClick={handleNew}>
          <Plus className="size-4" />
          Tambah Baru
        </Button>
      </PageHeader>

      {(lastAction === "saved" || lastAction === "deleted") && (
        <Alert className="reveal mb-6 bg-emerald-50 border-emerald-200" style={{ animationDelay: "60ms" }}>
          <Shield className="size-4 text-emerald-600" />
          <AlertTitle className="text-emerald-900">Berhasil</AlertTitle>
          <AlertDescription>
            {lastAction === "saved" ? "Pengaturan rumah sakit disimpan" : "Rumah sakit dihapus"}
          </AlertDescription>
        </Alert>
      )}

      {testResult && (
        <Alert className={cn("reveal mb-6", testResult.sukses ? "bg-emerald-50 border-emerald-200" : "bg-rose-50 border-rose-200")} style={{ animationDelay: "100ms" }}>
          <Shield className={cn("size-4", testResult.sukses ? "text-emerald-600" : "text-rose-600")} />
          <AlertTitle className={cn(testResult.sukses ? "text-emerald-900" : "text-rose-900")}>
            {testResult.sukses ? "Koneksi Berhasil" : "Koneksi Gagal"}
          </AlertTitle>
          <AlertDescription>{testResult.pesan}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-6 lg:grid-cols-4">
        <div className="reveal lg:col-span-1" style={{ animationDelay: "60ms" }}>
          <Card className="h-full">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building className="size-5 text-primary" />
                Daftar Rumah Sakit
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 p-0">
              {rumahSakitList.length === 0 ? (
                <EmptyState
                  icon={Building}
                  title="Belum ada rumah sakit"
                  description="Tambah rumah sakit pertama untuk memulai konfigurasi."
                  action={
                    <Button variant="outline" size="sm" className="w-full" onClick={handleNew}>
                      <Plus className="size-3.5" />
                      Tambah Rumah Sakit
                    </Button>
                  }
                />
              ) : (
                <div className="p-2 space-y-1">
                  {rumahSakitList.map((rs) => (
                    <button
                      key={rs.id}
                      onClick={() => handleSelect(rs)}
                      className={cn(
                        "w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                        selectedId === rs.id
                          ? "bg-primary text-primary-foreground"
                          : "text-muted-foreground hover:bg-accent hover:text-foreground"
                      )}
                    >
                      <Building className="size-5 shrink-0" weight={selectedId === rs.id ? "fill" : "regular"} />
                      <div className="flex-1 min-w-0 truncate">{rs.nama}</div>
                      <span className="text-xs font-mono opacity-60">{rs.kode}</span>
                      {rs.aktif && <Badge variant="secondary" className="size-2 p-0 text-[10px] h-5">Aktif</Badge>}
                    </button>
                  ))}
                  <Button
                    variant="outline"
                    className="w-full justify-start gap-2 mt-2"
                    onClick={handleNew}
                  >
                    <Plus className="size-4" />
                    Tambah Baru
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="reveal lg:col-span-3" style={{ animationDelay: "100ms" }}>
          <Card className="h-full">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {isNew ? <Building className="size-5 text-primary" /> : <TestTube className="size-5 text-primary" />}
                {isNew ? "Tambah Rumah Sakit Baru" : "Detail Konfigurasi"}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Globe className="size-4 text-primary" />
                  <span>Konfigurasi Apify (Google Maps Scraper)</span>
                </Label>
              </div>

              <div className="space-y-2">
                <Label htmlFor="nama">Nama Rumah Sakit *</Label>
                <Input
                  id="nama"
                  name="nama"
                  value={form.nama}
                  onChange={handleChange}
                  placeholder="Contoh: RSUD Dr. Soetomo"
                  disabled={saving}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="kode">Kode Singkat *</Label>
                <Input
                  id="kode"
                  name="kode"
                  value={form.kode}
                  onChange={handleChange}
                  placeholder="Contoh: RSDS"
                  maxLength={10}
                  disabled={saving}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="googleMapsPlaceId">Google Maps Place ID *</Label>
                <Input
                  id="googleMapsPlaceId"
                  name="googleMapsPlaceId"
                  value={form.googleMapsPlaceId}
                  onChange={handleChange}
                  placeholder="Contoh: ChIJN1t_tDeuEmsRUsoyG83frY4"
                  aria-describedby="place-id-help"
                  disabled={saving || testing}
                />
                <p className="text-xs text-muted-foreground" id="place-id-help">
                  Dapatkan dari halaman detail Google Maps di browser
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="apifyActorId">Actor ID Apify</Label>
                <Input
                  id="apifyActorId"
                  name="apifyActorId"
                  value={form.apifyActorId}
                  onChange={handleChange}
                  placeholder="compass/google-maps-reviews-scraper"
                  disabled={saving}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="apifyToken">API Token Apify *</Label>
                <Input
                  id="apifyToken"
                  name="apifyToken"
                  type="password"
                  value={form.apifyToken}
                  onChange={handleChange}
                  placeholder="apify_xxxxxxxxxxxxxxxxxxxxxxxx"
                  aria-describedby="apify-token-help"
                  disabled={saving || testing}
                />
                <p className="text-xs text-muted-foreground" id="apify-token-help">
                  Dapatkan dari Apify Console → Integrations
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <Button
                  variant="outline"
                  onClick={handleTestApify}
                  disabled={testing || !form.apifyToken || !form.googleMapsPlaceId || saving}
                  className="gap-2"
                >
                  <TestTube className="size-4" />
                  {testing ? (
                    <>
                      <SpinnerGap className="size-4 animate-spin" weight="duotone" />
                      Menguji...
                    </>
                  ) : (
                    "Uji Koneksi Apify"
                  )}
                </Button>

                <Button
                  onClick={handleSave}
                  disabled={saving}
                  className="gap-2"
                >
                  <FloppyDisk className="size-4" />
                  {saving ? (
                    <>
                      <SpinnerGap className="size-4 animate-spin" weight="duotone" />
                      Menyimpan...
                    </>
                  ) : (
                    "Simpan Perubahan"
                  )}
                </Button>
              </div>

              <Separator />

              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="zonaWaktu">Zona Waktu</Label>
                  <Input id="zonaWaktu" name="zonaWaktu" value={form.zonaWaktu} onChange={handleChange} disabled={saving} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="jamSinkron">Jam Sinkron Otomatis (0-23)</Label>
                  <Input
                    id="jamSinkron"
                    name="jamSinkron"
                    type="number"
                    min="0"
                    max="23"
                    value={form.jamSinkron}
                    onChange={handleChange}
                    disabled={saving}
                  />
                </div>
                <div className="space-y-2 flex items-end">
                  <div className="flex items-center gap-2 w-full">
                    <Switch
                      id="aktif"
                      name="aktif"
                      checked={form.aktif}
                      onCheckedChange={(checked) => setForm((p) => ({ ...p, aktif: checked }))}
                      disabled={saving}
                    />
                    <Label htmlFor="aktif" className="mb-0">Aktifkan Sinkron Otomatis Harian</Label>
                  </div>
                </div>
              </div>

              {selectedId && (
                <div className="pt-4 border-t border-border">
                  <div className="flex items-center gap-3 flex-wrap">
                    <Button
                      variant="destructive"
                      onClick={() => setShowDeleteConfirm(true)}
                      disabled={deleting}
                      className="gap-2"
                    >
                      <Trash className="size-4" />
                      Hapus Rumah Sakit
                    </Button>
                    <p className="text-xs text-muted-foreground">
                      Akan menghapus semua data ulasan, analisis, dan log sinkron terkait. Tindakan tidak bisa dibatalkan.
                    </p>
                  </div>

                  {showDeleteConfirm && (
                    <Alert className="mt-4 bg-rose-50 border-rose-200">
                      <WarningCircle className="size-4 text-rose-600" />
                      <AlertTitle className="text-rose-900">Konfirmasi Hapus</AlertTitle>
                      <AlertDescription>
                        Yakin ingin menghapus rumah sakit <strong>{form.nama}</strong> ini?
                        Semua data ulasan, analisis, dan log sinkron terkait akan ikut terhapus secara permanen.
                        Tindakan ini tidak dapat dibatalkan.
                      </AlertDescription>
                      <div className="mt-4 flex gap-2">
                        <Button variant="destructive" onClick={handleDelete} disabled={deleting} className="gap-2">
                          <Trash className="size-4" />
                          {deleting ? "Menghapus..." : "Ya, Hapus Permanen"}
                        </Button>
                        <Button variant="outline" onClick={() => setShowDeleteConfirm(false)} disabled={deleting}>
                          <X className="size-4 mr-2" />
                          Batal
                        </Button>
                      </div>
                    </Alert>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

export default function PengaturanPage() {
  return (
    <Suspense fallback={<LoadingSection rows={3} />}>
      <PengaturanContent />
    </Suspense>
  );
}