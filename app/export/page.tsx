"use client";

import { useState, useEffect, useRef } from "react";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import {
  FilePdf,
  FileXls,
  FileDoc,
  SpinnerGap,
  WarningCircle,
  CheckCircle,
  Download,
  Calendar as CalendarIcon,
  Image as ImageIcon,
  X,
  FloppyDisk,
  Trash,
} from "@phosphor-icons/react";
import { PageHeader } from "@/components/page-header";
import { LoadingSection, EmptyState } from "@/components/states";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";

type ExportFormat = "pdf" | "xlsx" | "docx";

interface RumahSakitItem {
  id: number;
  nama: string;
  kopSurat?: string | null;
}

const FORMAT_OPTIONS: {
  value: ExportFormat;
  label: string;
  desc: string;
  icon: typeof FilePdf;
  color: string;
}[] = [
  {
    value: "pdf",
    label: "PDF",
    desc: "Siap cetak & arsip",
    icon: FilePdf,
    color: "text-rose-600",
  },
  {
    value: "xlsx",
    label: "Excel",
    desc: "Format spreadsheet native",
    icon: FileXls,
    color: "text-emerald-600",
  },
  {
    value: "docx",
    label: "Word",
    desc: "Dokumen Microsoft Word",
    icon: FileDoc,
    color: "text-blue-600",
  },
];

const STATUS_OPTIONS = [
  { value: "all" as const, label: "Semua Status" },
  { value: "baru" as const, label: "Baru" },
  { value: "dalam_koordinasi" as const, label: "Dalam Koordinasi" },
  { value: "selesai" as const, label: "Selesai" },
];

export default function ExportPage() {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [rumahSakitId, setRumahSakitId] = useState<number | null>(null);
  const [rumahSakitList, setRumahSakitList] = useState<RumahSakitItem[]>([]);
  const [dari, setDari] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d;
  });
  const [sampai, setSampai] = useState(new Date());
  const [statusFilter, setStatusFilter] = useState<"all" | "baru" | "dalam_koordinasi" | "selesai">("all");
  const [loading, setLoading] = useState<ExportFormat | null>(null);
  const [fetchingRs, setFetchingRs] = useState(true);
  const [exportSuccess, setExportSuccess] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);

  // Kop surat state
  const [kopSuratBase64, setKopSuratBase64] = useState<string | null>(null);
  const [kopSuratPreview, setKopSuratPreview] = useState<string | null>(null);
  const [isKopSaved, setIsKopSaved] = useState<boolean>(false);
  const [savingKop, setSavingKop] = useState<boolean>(false);
  const [kopFeedback, setKopFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    fetch("/api/rumah-sakit")
      .then((res) => res.json())
      .then((data) => {
        if (data.rumahSakit?.length) {
          const list: RumahSakitItem[] = data.rumahSakit.map((rs: any) => ({
            id: rs.id,
            nama: rs.nama,
            kopSurat: rs.kopSurat ?? null,
          }));
          setRumahSakitList(list);
          const firstRs = list[0];
          setRumahSakitId(firstRs?.id ?? null);

          // Cek kop surat tersimpan di database atau localStorage
          const savedKop =
            firstRs?.kopSurat ||
            (typeof window !== "undefined"
              ? localStorage.getItem(`ulas_ai_kop_surat_${firstRs?.id}`)
              : null);

          if (savedKop) {
            const previewUrl = savedKop.startsWith("data:") ? savedKop : `data:image/png;base64,${savedKop}`;
            const base64Data = savedKop.includes(",") ? savedKop.split(",")[1] : savedKop;
            setKopSuratPreview(previewUrl);
            setKopSuratBase64(base64Data);
            setIsKopSaved(true);
          }
        }
      })
      .catch(console.error)
      .finally(() => setFetchingRs(false));
  }, []);

  const handleRumahSakitChange = (idStr: string | null) => {
    if (!idStr) {
      setRumahSakitId(null);
      setKopSuratPreview(null);
      setKopSuratBase64(null);
      setIsKopSaved(false);
      return;
    }
    const newId = Number(idStr);
    setRumahSakitId(newId);
    setKopFeedback(null);
    const rs = rumahSakitList.find((r) => r.id === newId);
    const savedKop =
      rs?.kopSurat ||
      (typeof window !== "undefined" ? localStorage.getItem(`ulas_ai_kop_surat_${newId}`) : null);

    if (savedKop) {
      const previewUrl = savedKop.startsWith("data:") ? savedKop : `data:image/png;base64,${savedKop}`;
      const base64Data = savedKop.includes(",") ? savedKop.split(",")[1] : savedKop;
      setKopSuratPreview(previewUrl);
      setKopSuratBase64(base64Data);
      setIsKopSaved(true);
    } else {
      setKopSuratPreview(null);
      setKopSuratBase64(null);
      setIsKopSaved(false);
    }
  };

  const handleKopSuratChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setKopFeedback({ type: "error", text: "File harus berupa gambar (PNG, JPG, dll)." });
      setTimeout(() => setKopFeedback(null), 4000);
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setKopFeedback({ type: "error", text: "Ukuran file gambar maksimal 2MB." });
      setTimeout(() => setKopFeedback(null), 4000);
      return;
    }

    const reader = new FileReader();
    reader.onload = (ev) => {
      const result = ev.target?.result as string;
      setKopSuratPreview(result);
      // Simpan base64 murni tanpa prefix data:image/...;base64,
      const base64 = result.split(",")[1];
      setKopSuratBase64(base64);
      setIsKopSaved(false); // Baru dipilih, belum disimpan permanen
      setKopFeedback(null);
    };
    reader.readAsDataURL(file);
  };

  const handleSimpanKopSurat = async () => {
    if (!rumahSakitId || !kopSuratBase64) return;
    setSavingKop(true);
    setKopFeedback(null);

    try {
      const res = await fetch("/api/rumah-sakit", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: rumahSakitId,
          kopSurat: kopSuratBase64,
        }),
      });

      if (!res.ok) {
        throw new Error("Gagal menyimpan ke server");
      }

      if (typeof window !== "undefined") {
        localStorage.setItem(`ulas_ai_kop_surat_${rumahSakitId}`, kopSuratBase64);
      }

      setRumahSakitList((prev) =>
        prev.map((r) => (r.id === rumahSakitId ? { ...r, kopSurat: kopSuratBase64 } : r))
      );

      setIsKopSaved(true);
      setKopFeedback({
        type: "success",
        text: "Kop surat berhasil disimpan permanen! Tidak perlu diinput berulang kali.",
      });
      setTimeout(() => setKopFeedback(null), 6000);
    } catch {
      setKopFeedback({
        type: "error",
        text: "Gagal menyimpan kop surat ke server. Coba lagi.",
      });
      setTimeout(() => setKopFeedback(null), 4000);
    } finally {
      setSavingKop(false);
    }
  };

  const removeKopSurat = async () => {
    setKopSuratBase64(null);
    setKopSuratPreview(null);
    setIsKopSaved(false);
    setKopFeedback(null);
    if (fileInputRef.current) fileInputRef.current.value = "";

    if (rumahSakitId) {
      if (typeof window !== "undefined") {
        localStorage.removeItem(`ulas_ai_kop_surat_${rumahSakitId}`);
      }
      try {
        await fetch("/api/rumah-sakit", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: rumahSakitId, kopSurat: null }),
        });
        setRumahSakitList((prev) =>
          prev.map((rs) => (rs.id === rumahSakitId ? { ...rs, kopSurat: null } : rs))
        );
      } catch (e) {
        console.error("Gagal menghapus kop surat dari DB:", e);
      }
    }
  };

  const handleExport = async (fmt: ExportFormat) => {
    if (!rumahSakitId) {
      setExportError("Silakan pilih rumah sakit terlebih dahulu.");
      setTimeout(() => setExportError(null), 3000);
      return;
    }
    setLoading(fmt);
    setExportError(null);
    setExportSuccess(null);
    try {
      const res = await fetch(`/api/export`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rumahSakitId,
          format: fmt,
          dari: format(dari, "yyyy-MM-dd"),
          sampai: format(sampai, "yyyy-MM-dd"),
          status: statusFilter,
          kopSuratBase64: kopSuratBase64 ?? null,
        }),
      });
      if (!res.ok) throw new Error("Gagal ekspor");
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const ext = fmt === "pdf" ? "html" : fmt === "xlsx" ? "xlsx" : "docx";
      a.download = `laporan-mutu-${format(dari, "yyyyMMdd")}-${format(sampai, "yyyyMMdd")}.${ext}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      setExportSuccess(`Ekspor ${fmt.toUpperCase()} berhasil diunduh.`);
      setTimeout(() => setExportSuccess(null), 5000);
    } catch {
      setExportError("Gagal mengunduh file ekspor. Coba lagi.");
      setTimeout(() => setExportError(null), 5000);
    } finally {
      setLoading(null);
    }
  };

  if (fetchingRs) return <LoadingSection rows={2} />;

  if (rumahSakitList.length === 0) {
    return (
      <div>
        <PageHeader
          title="Ekspor Laporan Mutu"
          description="Generate laporan periodik untuk komite mutu dan direksi."
        />
        <EmptyState
          icon={Download}
          title="Belum ada rumah sakit terdaftar"
          description="Tambah data rumah sakit di halaman Pengaturan RS sebelum mengekspor laporan."
        />
      </div>
    );
  }

  const selectedRs = rumahSakitList.find((rs) => rs.id === rumahSakitId);

  return (
    <div>
      <PageHeader
        title="Ekspor Laporan Mutu"
        description="Generate laporan periodik untuk komite mutu dan direksi."
      />

      <div className="reveal grid gap-6 lg:grid-cols-[1fr_220px]">
        {/* ── Kiri: Konfigurasi ── */}
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <Download className="size-4 text-primary" weight="duotone" />
              Konfigurasi Laporan
            </CardTitle>
          </CardHeader>

          <CardContent className="space-y-5">
            {/* Rumah Sakit */}
            {rumahSakitList.length > 1 && (
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground">Rumah Sakit</Label>
                <Select
                  value={rumahSakitId ? String(rumahSakitId) : ""}
                  onValueChange={handleRumahSakitChange}
                  disabled={loading !== null}
                >
                  <SelectTrigger className="h-9 w-full text-xs">
                    <SelectValue placeholder="Pilih rumah sakit" />
                  </SelectTrigger>
                  <SelectContent>
                    {rumahSakitList.map((rs) => (
                      <SelectItem key={rs.id} value={String(rs.id)}>
                        {rs.nama}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Kop Surat */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-medium text-muted-foreground">Kop Surat Resmi</Label>
                {isKopSaved && kopSuratPreview && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/60">
                    <CheckCircle className="size-3 text-emerald-600 dark:text-emerald-400" weight="fill" />
                    Tersimpan Otomatis
                  </span>
                )}
                {!isKopSaved && kopSuratPreview && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 dark:bg-amber-950/50 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:text-amber-300 border border-amber-200/60 dark:border-amber-800/60">
                    <WarningCircle className="size-3 text-amber-600 dark:text-amber-400" weight="fill" />
                    Belum Disimpan
                  </span>
                )}
              </div>

              {kopSuratPreview ? (
                <div className="space-y-3 rounded-lg border border-border bg-card p-3.5 shadow-2xs">
                  <div className="relative flex flex-col sm:flex-row items-center gap-3.5">
                    <div className="relative flex h-20 w-full sm:w-64 items-center justify-center rounded-md border border-border bg-white p-2 shadow-2xs">
                      <img
                        src={kopSuratPreview}
                        alt="Kop surat preview"
                        className="max-h-full max-w-full object-contain"
                      />
                    </div>
                    <div className="min-w-0 flex-1 space-y-1 text-center sm:text-left">
                      <p className="text-xs font-medium text-foreground">
                        {isKopSaved ? "Kop Surat Siap Digunakan" : "Kop Surat Baru Diunggah"}
                      </p>
                      <p className="text-[11px] leading-relaxed text-muted-foreground">
                        {isKopSaved
                          ? "Kop surat ini tersimpan di sistem dan akan otomatis disematkan pada setiap dokumen ekspor (PDF / DOCX)."
                          : "Klik tombol 'Simpan Kop Surat' di bawah agar tersimpan permanen dan tidak perlu diunggah ulang lagi."}
                      </p>
                    </div>
                  </div>

                  {kopFeedback && (
                    <div
                      className={cn(
                        "flex items-center gap-2 rounded-md px-3 py-2 text-xs",
                        kopFeedback.type === "success"
                          ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-800"
                          : "bg-destructive/10 text-destructive border border-destructive/20"
                      )}
                    >
                      {kopFeedback.type === "success" ? (
                        <CheckCircle className="size-4 shrink-0 text-emerald-600" weight="fill" />
                      ) : (
                        <WarningCircle className="size-4 shrink-0 text-destructive" weight="fill" />
                      )}
                      <span>{kopFeedback.text}</span>
                    </div>
                  )}

                  <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-border/60">
                    {!isKopSaved && (
                      <Button
                        type="button"
                        size="sm"
                        onClick={handleSimpanKopSurat}
                        disabled={savingKop}
                        className="h-8 gap-1.5 text-xs bg-primary text-primary-foreground hover:bg-primary/90 font-medium shadow-2xs"
                      >
                        {savingKop ? (
                          <>
                            <SpinnerGap className="size-3.5 animate-spin" />
                            <span>Menyimpan...</span>
                          </>
                        ) : (
                          <>
                            <FloppyDisk className="size-3.5" weight="duotone" />
                            <span>Simpan Kop Surat</span>
                          </>
                        )}
                      </Button>
                    )}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => fileInputRef.current?.click()}
                      className="h-8 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
                    >
                      <ImageIcon className="size-3.5" />
                      <span>Ganti Gambar</span>
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={removeKopSurat}
                      className="h-8 gap-1.5 text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10 ml-auto"
                    >
                      <Trash className="size-3.5" />
                      <span>Hapus</span>
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-muted/20 py-6 text-xs text-muted-foreground transition-all hover:bg-muted/50 hover:text-foreground hover:border-primary/40"
                  >
                    <div className="rounded-full bg-muted/60 p-2 text-primary">
                      <ImageIcon className="size-5" weight="duotone" />
                    </div>
                    <div className="text-center space-y-0.5">
                      <span className="font-medium text-foreground">Klik untuk unggah gambar kop surat</span>
                      <p className="text-[11px] text-muted-foreground">PNG, JPG — Maks. 2MB</p>
                    </div>
                  </button>
                  <p className="text-[11px] text-muted-foreground">
                    Tip: Cukup unggah sekali lalu klik <strong>Simpan Kop Surat</strong>, sistem akan otomatis menggunakannya setiap kali membuat laporan.
                  </p>
                </div>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleKopSuratChange}
              />
            </div>

            <Separator />

            {/* Date Range */}
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground">Dari Tanggal</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "h-9 w-full justify-start text-left text-xs font-normal",
                        !dari && "text-muted-foreground"
                      )}
                      disabled={loading !== null}
                    >
                      <CalendarIcon className="mr-2 size-3.5 text-muted-foreground" />
                      {dari
                        ? format(dari, "dd MMMM yyyy", { locale: localeId })
                        : "Pilih tanggal"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={dari}
                      onSelect={(d) => d && setDari(d)}
                      disabled={{ after: new Date() }}
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground">Sampai Tanggal</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "h-9 w-full justify-start text-left text-xs font-normal",
                        !sampai && "text-muted-foreground"
                      )}
                      disabled={loading !== null}
                    >
                      <CalendarIcon className="mr-2 size-3.5 text-muted-foreground" />
                      {sampai
                        ? format(sampai, "dd MMMM yyyy", { locale: localeId })
                        : "Pilih tanggal"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={sampai}
                      onSelect={(d) => d && setSampai(d)}
                      disabled={{ after: new Date() }}
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            {/* Status Filter */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">
                Filter Status Tindak Lanjut
              </Label>
              <Select
                value={statusFilter}
                onValueChange={(v) =>
                  setStatusFilter(v as "all" | "baru" | "dalam_koordinasi" | "selesai")
                }
                disabled={loading !== null}
              >
                <SelectTrigger className="h-9 w-full text-xs">
                  <SelectValue placeholder="Semua Status" />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Separator />

            {/* Export info summary */}
            <div className="rounded-lg bg-muted/40 px-4 py-3 text-xs text-muted-foreground">
              <div className="flex justify-between">
                <span>Rumah sakit</span>
                <span className="font-medium text-foreground">{selectedRs?.nama ?? "—"}</span>
              </div>
              <div className="mt-1.5 flex justify-between">
                <span>Periode</span>
                <span className="font-mono font-medium text-foreground">
                  {format(dari, "dd MMM yyyy", { locale: localeId })} —{" "}
                  {format(sampai, "dd MMM yyyy", { locale: localeId })}
                </span>
              </div>
              <div className="mt-1.5 flex justify-between">
                <span>Kop surat</span>
                <span className={cn("font-medium", kopSuratBase64 ? "text-emerald-600" : "text-foreground")}>
                  {kopSuratBase64 ? "Terpilih" : "Tidak digunakan"}
                </span>
              </div>
            </div>

          </CardContent>
        </Card>

        {/* ── Kanan: Unduh Laporan ── */}
        <div className="reveal flex flex-col" style={{ animationDelay: "80ms" }}>
          <Card className="flex h-full flex-col">
            <CardHeader className="pb-4">
              <CardTitle className="text-sm font-semibold">Unduh Laporan</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-1 flex-col gap-3">
              {FORMAT_OPTIONS.map((opt) => (
                <Button
                  key={opt.value}
                  variant="outline"
                  onClick={() => handleExport(opt.value)}
                  disabled={loading !== null || !rumahSakitId}
                  className="flex-1 h-auto w-full flex-col gap-2 py-5"
                >
                  {loading === opt.value ? (
                    <SpinnerGap className="size-7 animate-spin" weight="duotone" />
                  ) : (
                    <opt.icon className={cn("size-7", opt.color)} weight="duotone" />
                  )}
                  <span className="text-sm font-semibold">{opt.label}</span>
                </Button>
              ))}

              {exportSuccess && (
                <div className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-xs text-emerald-800">
                  <CheckCircle className="mt-0.5 size-3.5 shrink-0" weight="duotone" />
                  {exportSuccess}
                </div>
              )}
              {exportError && (
                <div className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2.5 text-xs text-rose-800">
                  <WarningCircle className="mt-0.5 size-3.5 shrink-0" weight="duotone" />
                  {exportError}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}