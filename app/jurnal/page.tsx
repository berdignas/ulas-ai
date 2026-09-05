"use client";

import { useEffect, useState, useCallback } from "react";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import {
  ArrowsClockwise,
  Bell,
  Calendar,
  CaretLeft,
  CaretRight,
  CheckCircle,
  Circle,
  Clock,
  Copy,
  DotsThreeVertical,
  Download,
  Funnel,
  Flag,
  MagnifyingGlass,
  Shield,
  Spinner,
  SpinnerGap,
  Trash,
  X,
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

type StatusTindakLanjut = "baru" | "dalam_koordinasi" | "selesai";
type StatusFilter = "all" | StatusTindakLanjut;
type Ulasan = {
  id: number;
  reviewId: string;
  namaPengulas: string | null;
  rating: number | null;
  teksUlasan: string;
  tanggalUlasan: string;
  unitLayanan: string | null;
  kategoriMasalah: string | null;
  sentimen: string | null;
  faktorUrgensiMedis: number;
  saranDrafBalasan: string | null;
  statusTindakLanjut: StatusTindakLanjut;
  ditinjauPada: string | null;
  ditinjauOleh: string | null;
  catatanInternal: string | null;
};

const STATUS_LABEL: Record<StatusTindakLanjut, string> = {
  baru: "Baru",
  dalam_koordinasi: "Dalam Koordinasi",
  selesai: "Selesai",
};

const STATUS_VARIANT: Record<StatusTindakLanjut, "default" | "secondary" | "success" | "warning" | "danger"> = {
  baru: "default",
  dalam_koordinasi: "warning",
  selesai: "success",
};

const SENTIMEN_VARIANT: Record<string, "default" | "success" | "warning" | "danger"> = {
  positif: "success",
  netral: "warning",
  negatif: "danger",
};

export default function JurnalPage() {
  const [rumahSakitId, setRumahSakitId] = useState<number | null>(null);
  const [tanggal, setTanggal] = useState(new Date());
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const setStatusFilterSafe = (value: StatusFilter | null) => {
    setStatusFilter(value ?? "all");
  };
  const [searchQuery, setSearchQuery] = useState("");
  const [ulasans, setUlasans] = useState<Ulasan[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [statistik, setStatistik] = useState<{ total: number; positif: number; negatif: number; netral: number; krisis: number; belumDitinjau: number } | null>(null);
  const [krisisCount, setKrisisCount] = useState(0);
  const [syncLoading, setSyncLoading] = useState(false);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 20;

  const fetchData = useCallback(async () => {
    if (!rumahSakitId) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({
        rumahSakitId: String(rumahSakitId),
        limit: String(PAGE_SIZE),
        offset: String(page * PAGE_SIZE),
      });
      if (tanggal) params.set("tanggal", format(tanggal, "yyyy-MM-dd"));
      if (statusFilter !== "all") params.set("status", statusFilter);

      const res = await fetch(`/api/jurnal?${params}`);
      const data = await res.json();
      setUlasans(data.ulasan);
      setTotal(data.total);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [rumahSakitId, tanggal, statusFilter, page]);

  const fetchStatistik = useCallback(async () => {
    if (!rumahSakitId || !tanggal) return;
    try {
      const res = await fetch(`/api/jurnal?action=statistik_harian&rumahSakitId=${rumahSakitId}&tanggal=${format(tanggal, "yyyy-MM-dd")}`);
      const data = await res.json();
      setStatistik(data);
    } catch (e) {
      console.error(e);
    }
  }, [rumahSakitId, tanggal]);

  const fetchKrisisCount = useCallback(async () => {
    if (!rumahSakitId) return;
    try {
      const res = await fetch(`/api/jurnal?action=krisis_belum_ditinjau&rumahSakitId=${rumahSakitId}`);
      const data = await res.json();
      setKrisisCount(data.krisis?.length ?? 0);
    } catch (e) {
      console.error(e);
    }
  }, [rumahSakitId]);

  const fetchLastSync = useCallback(async () => {
    if (!rumahSakitId) return;
    try {
      const res = await fetch(`/api/sinkron?rumahSakitId=${rumahSakitId}&limit=1`);
      const data = await res.json();
      if (data.riwayat?.[0]?.selesaiPada) {
        setLastSync(format(new Date(data.riwayat[0].selesaiPada), "HH:mm", { locale: localeId }));
      }
    } catch (e) {
      console.error(e);
    }
  }, [rumahSakitId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchData();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchStatistik();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchKrisisCount();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchLastSync();
  }, [fetchData, fetchStatistik, fetchKrisisCount, fetchLastSync]);

  const handleSync = async () => {
    if (!rumahSakitId) return;
    setSyncLoading(true);
    try {
      const res = await fetch("/api/sinkron", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rumahSakitId, tipePemicu: "manual" }),
      });
      const data = await res.json();
      if (data.sukses) {
        alert(`Sinkronisasi selesai. ${data.ulasanBaru} ulasan baru.`);
        fetchData();
        fetchStatistik();
        fetchKrisisCount();
        fetchLastSync();
      } else {
        alert(`Gagal: ${data.pesanError}`);
      }
    } catch (e) {
      alert("Terjadi kesalahan saat sinkronisasi");
    } finally {
      setSyncLoading(false);
    }
  };

  const handleStatusChange = async (ulasanId: number, newStatus: StatusTindakLanjut) => {
    try {
      await fetch("/api/jurnal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "perbarui_status", ulasanId, status: newStatus }),
      });
      fetchData();
      fetchStatistik();
    } catch (e) {
      alert("Gagal memperbarui status");
    }
  };

  const copyToClipboard = async (text: string) => {
    await navigator.clipboard.writeText(text);
    alert("Draf balasan disalin ke clipboard");
  };

  const formatTanggalWaktu = (iso: string) => {
    const d = new Date(iso);
    return format(d, "HH:mm", { locale: localeId });
  };

  const getSentimenIcon = (s: string | null) => {
    switch (s) {
      case "positif": return <CheckCircle className="size-4 text-emerald-600" weight="fill" />;
      case "negatif": return <Flag className="size-4 text-rose-600" weight="fill" />;
      case "netral": return <Circle className="size-4 text-amber-600" weight="fill" />;
      default: return <Circle className="size-4 text-muted-foreground" weight="fill" />;
    }
  };

  if (!rumahSakitId) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-center">
        <Shield className="size-12 text-muted-foreground" weight="duotone" />
        <h2 className="mt-4 text-xl font-semibold">Pilih Rumah Sakit</h2>
        <p className="mt-2 text-muted-foreground">Silakan konfigurasi rumah sakit di menu Pengaturan RS terlebih dahulu.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Jurnal Harian Ulasan</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Dokumentasi dan tindak lanjut ulasan Google Maps harian
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="gap-2">
                <Calendar className="size-4" />
                <span>{format(tanggal, "dd MMM yyyy", { locale: localeId })}</span>
                <CaretRight className="size-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <div className="p-2">
                <input
                  type="date"
                  value={format(tanggal, "yyyy-MM-dd")}
                  onChange={(e) => setTanggal(new Date(e.target.value))}
                  className="rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </div>
            </PopoverContent>
          </Popover>

          <Select value={statusFilter} onValueChange={setStatusFilterSafe}>
            <SelectTrigger>
              <SelectValue placeholder="Semua Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Status</SelectItem>
              <SelectItem value="baru">Baru</SelectItem>
              <SelectItem value="dalam_koordinasi">Dalam Koordinasi</SelectItem>
              <SelectItem value="selesai">Selesai</SelectItem>
            </SelectContent>
          </Select>

          <div className="relative">
            <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              placeholder="Cari nama, teks, unit..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 w-[280px]"
            />
          </div>

<Button variant="outline" onClick={handleSync} disabled={syncLoading} className="gap-2">
              <ArrowsClockwise className={cn("size-4", syncLoading && "animate-spin")} weight="duotone" />
              <span>Tarik Data Sekarang</span>
            </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
          <Shield className="size-5 text-rose-600" weight="duotone" />
          <span className="text-sm font-medium text-rose-800">
            {krisisCount > 0
              ? `⚠ ${krisisCount} ulasan krisis belum ditinjau`
              : "Tidak ada ulasan krisis hari ini"}
          </span>
        </div>
        {lastSync && (
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Clock className="size-4" />
            <span>Sinkron terakhir: {lastSync} WIB</span>
          </div>
        )}
      </div>

      {statistik && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <StatCard label="Total" value={statistik.total} icon={<Circle className="size-5" weight="duotone" />} />
          <StatCard label="Positif" value={statistik.positif} icon={<CheckCircle className="size-5" weight="duotone" />} variant="success" />
          <StatCard label="Negatif" value={statistik.negatif} icon={<Flag className="size-5" weight="duotone" />} variant="danger" />
          <StatCard label="Netral" value={statistik.netral} icon={<Circle className="size-5" weight="duotone" />} variant="warning" />
<StatCard label="Krisis" value={statistik.krisis} icon={<Shield className="size-5" weight="duotone" />} variant="danger" />
          <StatCard label="Belum Ditinjau" value={statistik.belumDitinjau} icon={<Clock className="size-5" weight="duotone" />} variant="warning" />
        </div>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle>Daftar Ulasan ({total})</CardTitle>
          <div className="flex items-center gap-2">
              <a
                href={`/export?rumahSakitId=${rumahSakitId}&format=html`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
              >
                <Download className="size-4 mr-2" />
                Ekspor (HTML/PDF)
              </a>
            </div>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="h-[calc(100vh-400px)]">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Waktu</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Reviewer</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Rating</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Ulasan</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Unit / Kategori</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Sentimen</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center">
                      <SpinnerGap className="size-6 animate-spin mx-auto text-muted-foreground" weight="duotone" />
                    </td>
                  </tr>
                ) : ulasans.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">
                      Tidak ada ulasan untuk filter ini
                    </td>
                  </tr>
                ) : (
                  ulasans.map((u) => (
                    <tr key={u.id} className={cn("border-b border-border hover:bg-accent/50", u.faktorUrgensiMedis && "bg-rose-50")}>
                      <td className="px-4 py-3 text-sm text-muted-foreground whitespace-nowrap">{formatTanggalWaktu(u.tanggalUlasan)}</td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-sm">{u.namaPengulas ?? "Anonim"}</div>
                        <div className="text-xs text-muted-foreground">{u.reviewId}</div>
                      </td>
                      <td className="px-4 py-3 text-sm font-mono tabular-nums">{u.rating ?? "-"}</td>
                      <td className="px-4 py-3">
                        <div className="max-w-xs truncate text-sm">{u.teksUlasan}</div>
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <div className="text-muted-foreground">{u.unitLayanan ?? "-"}</div>
                        <div className="text-xs text-muted-foreground">{u.kategoriMasalah ?? "-"}</div>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={SENTIMEN_VARIANT[u.sentimen ?? ""]} className="gap-1">
                          {getSentimenIcon(u.sentimen)}
                          {u.sentimen ?? "-"}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <Select value={u.statusTindakLanjut} onValueChange={(v) => handleStatusChange(u.id, v as StatusTindakLanjut)}>
                          <SelectTrigger className="w-[160px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="baru">Baru</SelectItem>
                            <SelectItem value="dalam_koordinasi">Dalam Koordinasi</SelectItem>
                            <SelectItem value="selesai">Selesai</SelectItem>
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="px-4 py-3 text-right">
<DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <DotsThreeVertical className="size-4" weight="duotone" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-56">
                            {u.saranDrafBalasan && (
                              <DropdownMenuItem
                                onClick={() => copyToClipboard(u.saranDrafBalasan!)}
                                className="flex items-center gap-2"
                              >
<Copy className="size-4" weight="duotone" />
                                Salin Draf Balasan
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem
                              onClick={() => navigator.clipboard.writeText(u.teksUlasan)}
                              className="flex items-center gap-2"
                            >
                              <Copy className="size-4" weight="duotone" />
                              Salin Teks Ulasan
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </ScrollArea>

          {total > PAGE_SIZE && (
            <div className="flex items-center justify-between border-t border-border pt-4 mt-4">
              <span className="text-sm text-muted-foreground">
                Menampilkan {page * PAGE_SIZE + 1} - {Math.min((page + 1) * PAGE_SIZE, total)} dari {total}
              </span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0}>
                  <CaretLeft className="size-4" />
                </Button>
                <Button variant="outline" size="sm" onClick={() => setPage((p) => p + 1)} disabled={(page + 1) * PAGE_SIZE >= total}>
                  <CaretRight className="size-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({ label, value, icon, variant = "default" }: { label: string; value: number; icon: React.ReactNode; variant?: "default" | "success" | "warning" | "danger" }) {
  const variantClasses = {
    default: "border-border bg-card",
    success: "border-emerald-200 bg-emerald-50",
    warning: "border-amber-200 bg-amber-50",
    danger: "border-rose-200 bg-rose-50",
  };
  return (
    <div className={cn("rounded-xl border p-4", variantClasses[variant])}>
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs font-medium text-muted-foreground">{label}</div>
          <div className="mt-1 text-2xl font-bold tabular-nums">{value}</div>
        </div>
        <div className="text-muted-foreground">{icon}</div>
      </div>
    </div>
  );
}