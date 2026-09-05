"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { File, FileText, SpinnerGap, WarningCircle, CheckCircle, Download } from "@phosphor-icons/react";
import { PageHeader } from "@/components/page-header";
import { LoadingSection, EmptyState } from "@/components/states";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type ExportFormat = "csv" | "xlsx" | "html";

const FORMAT_OPTIONS: { value: ExportFormat; label: string; icon: typeof File; desc: string }[] = [
  { value: "csv", label: "CSV", icon: File, desc: "Kompatibel Excel, ringan" },
  { value: "xlsx", label: "XLSX", icon: File, desc: "Format Excel native" },
  { value: "html", label: "HTML / PDF", icon: FileText, desc: "Siap cetak & arsip" },
];

const STATUS_OPTIONS = [
  { value: "all" as const, label: "Semua Status" },
  { value: "baru" as const, label: "Baru" },
  { value: "dalam_koordinasi" as const, label: "Dalam Koordinasi" },
  { value: "selesai" as const, label: "Selesai" },
];

export default function ExportPage() {
  const router = useRouter();
  const [rumahSakitId, setRumahSakitId] = useState<number | null>(null);
  const [rumahSakitList, setRumahSakitList] = useState<{ id: number; nama: string }[]>([]);
  const [dari, setDari] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d;
  });
  const [sampai, setSampai] = useState(new Date());
  const [formatExport, setFormatExport] = useState<ExportFormat>("csv");
  const [statusFilter, setStatusFilter] = useState<"all" | "baru" | "dalam_koordinasi" | "selesai">("all");
  const [loading, setLoading] = useState(false);
  const [fetchingRs, setFetchingRs] = useState(true);
  const [exportSuccess, setExportSuccess] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);

  const fetchRumahSakit = async () => {
    try {
      const res = await fetch("/api/rumah-sakit");
      const data = await res.json();
      if (data.rumahSakit?.length) {
        const list = data.rumahSakit.map((rs: { id: number; nama: string }) => ({
          id: rs.id,
          nama: rs.nama,
        }));
        setRumahSakitList(list);
        if (!rumahSakitId && list[0]) {
          setRumahSakitId(list[0].id);
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setFetchingRs(false);
    }
  };

  const handleExport = async (fmt: ExportFormat) => {
    if (!rumahSakitId) {
      setExportError("Silakan pilih rumah sakit terlebih dahulu");
      setTimeout(() => setExportError(null), 3000);
      return;
    }
    setLoading(true);
    setFormatExport(fmt);
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
        }),
      });
      if (!res.ok) throw new Error("Gagal ekspor");
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const ext = fmt === "csv" ? "csv" : fmt === "xlsx" ? "xlsx" : "html";
      a.download = `laporan-mutu-${format(dari, "yyyyMMdd")}-${format(sampai, "yyyyMMdd")}.${ext}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      setExportSuccess(`Ekspor ${fmt.toUpperCase()} berhasil diunduh`);
    } catch {
      setExportError("Gagal mengunduh file ekspor");
      setTimeout(() => setExportError(null), 5000);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchRumahSakit();
  }, []);

  if (fetchingRs) {
    return <LoadingSection rows={2} />;
  }

  if (rumahSakitList.length === 0) {
    return (
      <div className="max-w-[1400px] mx-auto px-4 py-8">
        <PageHeader
          title="Ekspor Laporan Mutu"
          description="Generate laporan periodik untuk komite mutu dan direksi."
        />
        <EmptyState
          icon={File}
          title="Belum ada rumah sakit terdaftar"
          description="Tambah rumah sakit di halaman Pengaturan RS sebelum melakukan ekspor laporan."
          action={
            <Button size="lg" onClick={() => router.push("/pengaturan")}>
              Buka Pengaturan RS
              <Download className="size-4" />
            </Button>
          }
        />
      </div>
    );
  }

  const selectedRs = rumahSakitList.find((rs) => rs.id === rumahSakitId);

  return (
    <div className="max-w-[1400px] mx-auto px-4 py-8">
      <PageHeader
        title="Ekspor Laporan Mutu"
        description="Generate laporan periodik untuk komite mutu dan direksi."
      >
        <div className="flex items-center gap-2">
          <Select value={rumahSakitId ? String(rumahSakitId) : ""} onValueChange={(v) => setRumahSakitId(v ? Number(v) : null)} disabled={loading}>
            <SelectTrigger className="w-[280px]">
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
      </PageHeader>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="reveal lg:col-span-2" style={{ animationDelay: "60ms" }}>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <File className="size-5 text-primary" />
                Konfigurasi Ekspor
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="dari">Dari Tanggal</Label>
                  <Input
                    id="dari"
                    type="date"
                    value={format(dari, "yyyy-MM-dd")}
                    onChange={(e) => setDari(new Date(e.target.value))}
                    disabled={loading}
                    aria-label="Tanggal mulai periode ekspor"
                    max={format(sampai, "yyyy-MM-dd")}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="sampai">Sampai Tanggal</Label>
                  <Input
                    id="sampai"
                    type="date"
                    value={format(sampai, "yyyy-MM-dd")}
                    onChange={(e) => setSampai(new Date(e.target.value))}
                    disabled={loading}
                    aria-label="Tanggal akhir periode ekspor"
                    min={format(dari, "yyyy-MM-dd")}
                    max={format(new Date(), "yyyy-MM-dd")}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="format">Format Ekspor</Label>
                <Select value={formatExport} onValueChange={(v) => setFormatExport(v as ExportFormat)} disabled={loading}>
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih format" />
                  </SelectTrigger>
                  <SelectContent>
                    {FORMAT_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        <opt.icon className="size-4 mr-2" />
                        <div className="flex flex-col">
                          <span>{opt.label}</span>
                          <span className="text-xs text-muted-foreground">{opt.desc}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="status">Filter Status Tindak Lanjut</Label>
                <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as "all" | "baru" | "dalam_koordinasi" | "selesai")} disabled={loading}>
                  <SelectTrigger>
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
            </CardContent>
          </Card>
        </div>

        <div className="reveal" style={{ animationDelay: "120ms" }}>
          <Card className="h-full">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Download className="size-5 text-primary" />
                Ekspor Laporan
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {FORMAT_OPTIONS.map((opt) => (
                <Button
                  key={opt.value}
                  variant={formatExport === opt.value ? "default" : "outline"}
                  onClick={() => handleExport(opt.value)}
                  disabled={loading || !rumahSakitId}
                  className="w-full justify-start gap-3"
                >
                  <opt.icon className="size-4 shrink-0" />
                  <div className="flex-1 text-left">
                    <div className="font-medium">{opt.label}</div>
                    <div className="text-xs text-muted-foreground">{opt.desc}</div>
                  </div>
                  {loading && formatExport === opt.value && (
                    <SpinnerGap className="size-4 animate-spin" weight="duotone" />
                  )}
                </Button>
              ))}

              {exportSuccess && (
                <div className="mt-2 p-3 rounded-lg bg-emerald-50 text-emerald-900 border border-emerald-200 animate-fade-in flex items-center gap-2">
                  <CheckCircle className="size-4 shrink-0" weight="duotone" />
                  <span className="text-sm">{exportSuccess}</span>
                </div>
              )}

              {exportError && (
                <div className="mt-2 p-3 rounded-lg bg-rose-50 text-rose-900 border border-rose-200 animate-fade-in flex items-center gap-2">
                  <WarningCircle className="size-4 shrink-0" weight="duotone" />
                  <span className="text-sm">{exportError}</span>
                </div>
              )}

              <div className="pt-2 border-t border-border">
                <p className="text-xs text-muted-foreground">
                  Periode: <span className="font-mono">{format(dari, "dd MMM yyyy")}</span>{" "}
                  &mdash; <span className="font-mono">{format(sampai, "dd MMM yyyy")}</span>
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Rumah sakit: <span className="font-medium">{selectedRs?.nama ?? "-"}</span>
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}