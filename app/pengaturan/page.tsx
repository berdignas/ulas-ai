"use client";

import { Suspense, useEffect, useState } from "react";
import {
  Building,
  Cpu,
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
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
  aiModel?: string | null;
  aiApiKey?: string | null;
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
    aiModel: "Google Gemini (Antigravity)",
    aiApiKey: "AIzaSyBBHXVSTwd83YPx1LKpavG2VTqL9yGdU4o",
  });

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [lastAction, setLastAction] = useState<"saved" | "deleted" | null>(null);
  const [testResult, setTestResult] = useState<{ sukses: boolean; pesan: string } | null>(null);
  const [testing, setTesting] = useState(false);
  const [testingAI, setTestingAI] = useState(false);

  const loadLocalAIConfig = () => {
    if (typeof window !== "undefined") {
      const model = localStorage.getItem("ulas_ai_model") || "Google Gemini (Antigravity)";
      const key = localStorage.getItem("ulas_ai_key") || "AIzaSyBBHXVSTwd83YPx1LKpavG2VTqL9yGdU4o";
      return { model, key };
    }
    return { model: "Google Gemini (Antigravity)", key: "AIzaSyBBHXVSTwd83YPx1LKpavG2VTqL9yGdU4o" };
  };

  const fetchList = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/rumah-sakit");
      const data = await res.json();
      const list: RumahSakit[] = data.rumahSakit ?? [];
      setRumahSakitList(list);

      const aiCfg = loadLocalAIConfig();

      if (rsId && list.some((rs) => String(rs.id) === rsId)) {
        const rs = list.find((rs) => String(rs.id) === rsId);
        if (rs) {
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
            aiModel: rs.aiModel || aiCfg.model,
            aiApiKey: rs.aiApiKey ?? aiCfg.key,
          });
          if (rs.aiModel && typeof window !== "undefined") {
            localStorage.setItem("ulas_ai_model", rs.aiModel);
            window.dispatchEvent(new Event("ulas_ai_config_updated"));
          }
        }
      } else if (list[0] && !selectedId) {
        setSelectedId(list[0].id);
        const firstRs = list[0];
        setForm({
          nama: firstRs.nama,
          kode: firstRs.kode,
          googleMapsPlaceId: firstRs.googleMapsPlaceId ?? "",
          apifyActorId: firstRs.apifyActorId ?? "compass/google-maps-reviews-scraper",
          apifyToken: firstRs.apifyToken ?? "",
          aktif: Boolean(firstRs.aktif),
          zonaWaktu: firstRs.zonaWaktu ?? "Asia/Jakarta",
          jamSinkron: firstRs.jamSinkron ?? 6,
          aiModel: firstRs.aiModel || aiCfg.model,
          aiApiKey: firstRs.aiApiKey ?? aiCfg.key,
        });
        if (firstRs.aiModel && typeof window !== "undefined") {
          localStorage.setItem("ulas_ai_model", firstRs.aiModel);
          window.dispatchEvent(new Event("ulas_ai_config_updated"));
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchList();
  }, [rsId]);

  const handleSelect = (rs: RumahSakit) => {
    setSelectedId(rs.id);
    const aiCfg = loadLocalAIConfig();
    setForm({
      nama: rs.nama,
      kode: rs.kode,
      googleMapsPlaceId: rs.googleMapsPlaceId ?? "",
      apifyActorId: rs.apifyActorId ?? "compass/google-maps-reviews-scraper",
      apifyToken: rs.apifyToken ?? "",
      aktif: Boolean(rs.aktif),
      zonaWaktu: rs.zonaWaktu ?? "Asia/Jakarta",
      jamSinkron: rs.jamSinkron ?? 6,
      aiModel: rs.aiModel || aiCfg.model,
      aiApiKey: rs.aiApiKey ?? aiCfg.key,
    });
    if (rs.aiModel && typeof window !== "undefined") {
      localStorage.setItem("ulas_ai_model", rs.aiModel);
      window.dispatchEvent(new Event("ulas_ai_config_updated"));
    }
    setLastAction(null);
    setTestResult(null);
  };

  const handleNew = () => {
    setSelectedId(null);
    const aiCfg = loadLocalAIConfig();
    setForm({
      nama: "",
      kode: "",
      googleMapsPlaceId: "",
      apifyActorId: "compass/google-maps-reviews-scraper",
      apifyToken: "",
      aktif: true,
      zonaWaktu: "Asia/Jakarta",
      jamSinkron: 6,
      aiModel: aiCfg.model,
      aiApiKey: aiCfg.key,
    });
    setLastAction(null);
    setTestResult(null);
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

      if (typeof window !== "undefined") {
        localStorage.setItem("ulas_ai_model", form.aiModel || "NVIDIA Nemotron");
        localStorage.setItem("ulas_ai_key", form.aiApiKey || "");
        window.dispatchEvent(new Event("ulas_ai_config_updated"));
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
        body: JSON.stringify({ rumahSakitId: selectedId, tipePemicu: "manual", periode: "1d" }),
      });
      const data = await res.json();
      setTestResult({ sukses: data.sukses, pesan: data.sukses ? `Koneksi Apify Berhasil. ${data.ulasanBaru} ulasan baru ditemukan.` : `Gagal: ${data.pesanError}` });
    } catch (e) {
      setTestResult({ sukses: false, pesan: e instanceof Error ? e.message : "Gagal menguji koneksi Apify" });
    } finally {
      setTesting(false);
    }
  };

  const handleTestAI = async () => {
    if (!form.aiApiKey && !form.aiModel) {
      setTestResult({ sukses: false, pesan: "Nama Model AI dan API Key wajib diisi" });
      return;
    }
    setTestingAI(true);
    setTestResult(null);
    try {
      const res = await fetch("/api/ai/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: form.aiModel, apiKey: form.aiApiKey }),
      });
      const data = await res.json();
      setTestResult({
        sukses: data.sukses,
        pesan: data.pesan || (data.sukses ? "Koneksi Model AI berhasil." : "Koneksi Model AI gagal."),
      });
    } catch (e) {
      setTestResult({
        sukses: false,
        pesan: e instanceof Error ? e.message : "Gagal menguji koneksi Model AI",
      });
    } finally {
      setTestingAI(false);
    }
  };

  if (loading) {
    return <LoadingSection rows={3} />;
  }

  const isNew = selectedId === null;

  return (
    <div className="max-w-[1400px] mx-auto px-4 py-8 space-y-6">
      <PageHeader
        title="Pengaturan Rumah Sakit"
        description="Kelola konfigurasi rumah sakit, koneksi Model AI, Apify, dan jadwal sinkronisasi otomatis"
      >
        <Button variant="default" size="sm" onClick={handleNew} className="gap-2 text-xs h-9 shadow-xs">
          <Plus className="size-4" weight="bold" />
          Tambah Rumah Sakit
        </Button>
      </PageHeader>

      {(lastAction === "saved" || lastAction === "deleted") && (
        <Alert className="reveal bg-emerald-500/10 border-emerald-500/30 text-emerald-900 text-xs" style={{ animationDelay: "60ms" }}>
          <Shield className="size-4 text-emerald-600" weight="duotone" />
          <AlertTitle className="text-emerald-900 font-semibold text-xs">Berhasil</AlertTitle>
          <AlertDescription className="text-emerald-800 text-xs">
            {lastAction === "saved" ? "Pengaturan rumah sakit & Model AI berhasil disimpan" : "Rumah sakit berhasil dihapus"}
          </AlertDescription>
        </Alert>
      )}

      {testResult && (
        <Alert className={cn("reveal text-xs", testResult.sukses ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-900" : "bg-rose-500/10 border-rose-500/30 text-rose-900")} style={{ animationDelay: "100ms" }}>
          <Shield className={cn("size-4", testResult.sukses ? "text-emerald-600" : "text-rose-600")} weight="duotone" />
          <AlertTitle className={cn("font-semibold text-xs", testResult.sukses ? "text-emerald-900" : "text-rose-900")}>
            {testResult.sukses ? "Koneksi Berhasil" : "Koneksi Gagal"}
          </AlertTitle>
          <AlertDescription className={testResult.sukses ? "text-emerald-800 text-xs" : "text-rose-800 text-xs"}>{testResult.pesan}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-6 lg:grid-cols-4">
        {/* Left Column: Daftar RS */}
        <div className="reveal lg:col-span-1" style={{ animationDelay: "60ms" }}>
          <Card className="h-full border shadow-xs">
            <CardHeader className="pb-3 border-b border-border/60">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Building className="size-4 text-primary" weight="duotone" />
                Daftar Rumah Sakit
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3 space-y-2">
              {rumahSakitList.length === 0 ? (
                <EmptyState
                  icon={Building}
                  title="Belum ada RS"
                  description="Gunakan tombol Tambah Rumah Sakit di kanan atas."
                />
              ) : (
                <div className="space-y-1.5">
                  {rumahSakitList.map((rs) => {
                    const isSelected = selectedId === rs.id;
                    return (
                      <button
                        key={rs.id}
                        onClick={() => handleSelect(rs)}
                        className={cn(
                          "w-full flex items-center justify-between rounded-xl px-3 py-2.5 text-left transition-all duration-200 border group",
                          isSelected
                            ? "bg-primary/10 text-primary border-primary/40 shadow-xs ring-1 ring-primary/20"
                            : "bg-background text-muted-foreground border-border/50 hover:bg-accent/60 hover:text-foreground hover:border-border"
                        )}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div
                            className={cn(
                              "flex size-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold font-mono tracking-wider transition-colors",
                              isSelected
                                ? "bg-primary text-primary-foreground shadow-xs"
                                : "bg-muted text-muted-foreground group-hover:bg-accent group-hover:text-foreground"
                            )}
                          >
                            {rs.kode}
                          </div>
                          <div className="flex flex-col min-w-0">
                            <span className={cn("text-xs font-semibold truncate leading-tight", isSelected ? "text-primary" : "text-foreground")}>
                              {rs.kode}
                            </span>
                            <span className="text-[11px] font-normal text-muted-foreground truncate opacity-80">{rs.nama}</span>
                          </div>
                        </div>

                        {rs.aktif ? (
                          <span
                            className={cn(
                              "inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border transition-colors shrink-0",
                              isSelected
                                ? "bg-emerald-500/20 text-emerald-700 border-emerald-500/40"
                                : "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                            )}
                          >
                            <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            Aktif
                          </span>
                        ) : (
                          <span
                            className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border bg-muted/60 text-muted-foreground border-border/80 shrink-0"
                          >
                            Nonaktif
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Detail Konfigurasi */}
        <div className="reveal lg:col-span-3" style={{ animationDelay: "100ms" }}>
          <Card className="h-full border shadow-xs">
            <CardHeader className="pb-4 border-b border-border/60">
              <CardTitle className="text-sm font-semibold tracking-tight">
                {isNew ? "Tambah Rumah Sakit Baru" : "Detail Konfigurasi"}
              </CardTitle>
            </CardHeader>

            <CardContent className="p-6 space-y-4">
              {/* Row 1: Nama Rumah Sakit */}
              <div className="space-y-1.5">
                <Label htmlFor="nama" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Nama Rumah Sakit *
                </Label>
                <Input
                  id="nama"
                  name="nama"
                  value={form.nama}
                  onChange={handleChange}
                  placeholder="Contoh: RSUD Dr. Soetomo"
                  disabled={saving}
                  className="h-9 text-xs"
                />
              </div>

              {/* Row 2: Kode Singkat */}
              <div className="space-y-1.5">
                <Label htmlFor="kode" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Kode Singkat *
                </Label>
                <Input
                  id="kode"
                  name="kode"
                  value={form.kode}
                  onChange={handleChange}
                  placeholder="Contoh: RSDS"
                  maxLength={10}
                  disabled={saving}
                  className="h-9 text-xs"
                />
              </div>

              {/* Row 3: Google Maps Place ID */}
              <div className="space-y-1.5">
                <Label htmlFor="googleMapsPlaceId" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Google Maps Place ID *
                </Label>
                <Input
                  id="googleMapsPlaceId"
                  name="googleMapsPlaceId"
                  value={form.googleMapsPlaceId}
                  onChange={handleChange}
                  placeholder="Contoh: ChIJN1t_tDeuEmsRUsoyG83frY4"
                  disabled={saving || testing}
                  className="h-9 font-mono text-xs"
                />
                <p className="text-[11px] text-muted-foreground">
                  Dapatkan dari URL detail Google Maps di browser
                </p>
              </div>

              {/* Row 4: Actor ID Apify */}
              <div className="space-y-1.5">
                <Label htmlFor="apifyActorId" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Actor ID Apify
                </Label>
                <Input
                  id="apifyActorId"
                  name="apifyActorId"
                  value={form.apifyActorId}
                  onChange={handleChange}
                  placeholder="compass/google-maps-reviews-scraper"
                  disabled={saving}
                  className="h-9 font-mono text-xs"
                />
              </div>

              {/* Row 5: API Token Apify */}
              <div className="space-y-1.5">
                <Label htmlFor="apifyToken" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  API Token Apify *
                </Label>
                <Input
                  id="apifyToken"
                  name="apifyToken"
                  type="password"
                  value={form.apifyToken}
                  onChange={handleChange}
                  placeholder="apify_xxxxxxxxxxxxxxxxxxxxxxxx"
                  disabled={saving || testing}
                  className="h-9 font-mono text-xs"
                />
                <p className="text-[11px] text-muted-foreground">
                  Dapatkan dari Apify Console → Integrations
                </p>
              </div>

              {/* Row 6: Konfigurasi Model AI Gateway */}
              <div className="p-4 rounded-xl border border-blue-200/80 bg-blue-50/40 dark:bg-blue-950/20 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Cpu className="size-4 text-blue-600" weight="duotone" />
                    <h4 className="text-xs font-bold uppercase tracking-wider text-blue-950 dark:text-blue-200">
                      Konfigurasi Model AI Gateway
                    </h4>
                  </div>
                  <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                    Aktif: {form.aiModel.includes("Gemini") || form.aiModel.includes("Antigravity") ? "Google Gemini (Antigravity)" : form.aiModel}
                  </span>
                </div>

                {/* Pilihan Cepat Provider AI */}
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <span className="text-xs text-muted-foreground mr-1">Preset:</span>
                  <button
                    type="button"
                    onClick={() =>
                      setForm((prev) => ({
                        ...prev,
                        aiModel: "Google Gemini (Antigravity)",
                        aiApiKey: "AIzaSyBBHXVSTwd83YPx1LKpavG2VTqL9yGdU4o",
                      }))
                    }
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all cursor-pointer ${
                      form.aiModel.includes("Gemini") || form.aiModel.includes("Antigravity")
                        ? "bg-blue-600 text-white border-blue-600 shadow-xs"
                        : "bg-background border-border text-foreground hover:bg-muted"
                    }`}
                  >
                    ✦ Google Gemini (Antigravity)
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setForm((prev) => ({
                        ...prev,
                        aiModel: "NVIDIA Nemotron",
                      }))
                    }
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all cursor-pointer ${
                      form.aiModel.includes("Nemotron") || form.aiModel.includes("NVIDIA")
                        ? "bg-blue-600 text-white border-blue-600 shadow-xs"
                        : "bg-background border-border text-foreground hover:bg-muted"
                    }`}
                  >
                    NVIDIA Nemotron
                  </button>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 pt-1">
                  <div className="space-y-1.5 sm:col-span-1">
                    <Label htmlFor="aiModel" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Nama Model AI *
                    </Label>
                    <Input
                      id="aiModel"
                      name="aiModel"
                      value={form.aiModel}
                      onChange={handleChange}
                      placeholder="Contoh: Google Gemini (Antigravity)"
                      disabled={saving}
                      className="h-9 text-xs bg-background font-medium"
                    />
                  </div>

                  <div className="space-y-1.5 sm:col-span-1">
                    <Label htmlFor="aiApiKey" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      API Key Model AI *
                    </Label>
                    <Input
                      id="aiApiKey"
                      name="aiApiKey"
                      type="password"
                      value={form.aiApiKey}
                      onChange={handleChange}
                      placeholder="AIzaSy... atau nvapi-..."
                      disabled={saving}
                      className="h-9 font-mono text-xs bg-background"
                    />
                  </div>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Model AI dan API Key ini digunakan untuk analisis sentimen, ekstraksi unit layanan, krisis medis, dan saran draf balasan ulasan.
                </p>
              </div>

              {/* Row 7: Zona Waktu, Jam Sinkron, Toggle Otomatis Sinkron */}
              <div className="grid gap-4 sm:grid-cols-3 pt-2">
                <div className="space-y-1.5">
                  <Label htmlFor="zonaWaktu" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Zona Waktu
                  </Label>
                  <Input
                    id="zonaWaktu"
                    name="zonaWaktu"
                    value={form.zonaWaktu}
                    onChange={handleChange}
                    disabled={saving}
                    className="h-9 text-xs"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="jamSinkron" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Jam Sinkron (0-23)
                  </Label>
                  <Input
                    id="jamSinkron"
                    name="jamSinkron"
                    type="number"
                    min="0"
                    max="23"
                    value={form.jamSinkron}
                    onChange={handleChange}
                    disabled={saving}
                    className="h-9 text-xs"
                  />
                </div>
                <div className="space-y-1.5 flex flex-col justify-end">
                  <div className="flex items-center justify-between gap-3 rounded-lg border border-border/80 px-3 py-1.5 h-9 bg-muted/20">
                    <Label htmlFor="aktif" className="text-xs font-medium cursor-pointer mb-0 truncate">
                      Toggle Otomatis Sinkron
                    </Label>
                    <Switch
                      id="aktif"
                      name="aktif"
                      checked={form.aktif}
                      onCheckedChange={(checked) => setForm((p) => ({ ...p, aktif: checked }))}
                      disabled={saving}
                    />
                  </div>
                </div>
              </div>

              {/* Row 8: Buttons (Uji Koneksi Apify, Uji Koneksi Model AI, dan Simpan) */}
              <div className="flex flex-wrap items-center justify-end gap-3 pt-5 border-t border-border/80">
                <Button
                  variant="outline"
                  type="button"
                  onClick={handleTestApify}
                  disabled={testing || !form.apifyToken || !form.googleMapsPlaceId || saving || testingAI}
                  className="gap-2 h-9 px-4 text-xs cursor-pointer"
                >
                  <TestTube className="size-4 text-muted-foreground" weight="duotone" />
                  {testing ? (
                    <>
                      <SpinnerGap className="size-4 animate-spin" weight="duotone" />
                      Menguji Apify...
                    </>
                  ) : (
                    "Uji Koneksi Apify"
                  )}
                </Button>

                <Button
                  variant="outline"
                  type="button"
                  onClick={handleTestAI}
                  disabled={testingAI || !form.aiApiKey || saving || testing}
                  className="gap-2 h-9 px-4 text-xs border-blue-200 hover:bg-blue-50/60 dark:border-blue-800 dark:hover:bg-blue-950/30 text-blue-700 dark:text-blue-300 cursor-pointer"
                >
                  <Cpu className="size-4 text-blue-600" weight="duotone" />
                  {testingAI ? (
                    <>
                      <SpinnerGap className="size-4 animate-spin text-blue-600" weight="duotone" />
                      Menguji Model AI...
                    </>
                  ) : (
                    "Uji Koneksi Model AI"
                  )}
                </Button>

                <Button
                  onClick={handleSave}
                  disabled={saving}
                  className="gap-2 h-9 px-5 text-xs font-semibold shadow-xs"
                >
                  <FloppyDisk className="size-4" weight="bold" />
                  {saving ? (
                    <>
                      <SpinnerGap className="size-4 animate-spin" weight="duotone" />
                      Menyimpan...
                    </>
                  ) : (
                    "Simpan"
                  )}
                </Button>
              </div>

              {/* Delete RS Danger Zone */}
              {selectedId && (
                <div className="pt-5 border-t border-border/60">
                  <div className="flex items-center justify-between flex-wrap gap-3">
                    <div>
                      <h4 className="text-xs font-semibold uppercase tracking-wider text-rose-600">Zona Hapus Data</h4>
                      <p className="text-xs text-muted-foreground">
                        Hapus rumah sakit ini beserta seluruh ulasan dan analisis terkait secara permanen.
                      </p>
                    </div>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => setShowDeleteConfirm(true)}
                      disabled={deleting}
                      className="gap-2 text-xs h-8"
                    >
                      <Trash className="size-4" weight="duotone" />
                      Hapus RS
                    </Button>
                  </div>

                  {showDeleteConfirm && (
                    <Alert className="mt-4 bg-rose-500/10 border-rose-500/30 text-rose-900">
                      <WarningCircle className="size-4 text-rose-600" weight="duotone" />
                      <AlertTitle className="font-semibold text-rose-900 text-xs">Konfirmasi Hapus</AlertTitle>
                      <AlertDescription className="text-rose-800 text-xs">
                        Yakin ingin menghapus rumah sakit <strong>{form.nama} ({form.kode})</strong> ini?
                        Tindakan ini tidak dapat dibatalkan.
                      </AlertDescription>
                      <div className="mt-4 flex gap-2">
                        <Button variant="destructive" size="sm" onClick={handleDelete} disabled={deleting} className="gap-2 text-xs h-8">
                          <Trash className="size-4" />
                          {deleting ? "Menghapus..." : "Ya, Hapus Permanen"}
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => setShowDeleteConfirm(false)} disabled={deleting} className="text-xs h-8">
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