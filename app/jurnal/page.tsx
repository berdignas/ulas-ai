"use client";

import { useEffect, useState, useCallback } from "react";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import {
  ArrowsClockwise,
  Calendar as CalendarIcon,
  CaretLeft,
  CaretRight,
  CheckCircle,
  Circle,
  Clock,
  Copy,
  DotsThreeVertical,
  Download,
  Eye,
  Flag,
  MagnifyingGlass,
  Shield,
  Sparkle,
  SpinnerGap,
  Star,
  Warning,
  X,
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

type StatusTindakLanjut = "baru" | "dalam_koordinasi" | "selesai";
type StatusFilter = "all" | StatusTindakLanjut;

type RumahSakit = {
  id: number;
  nama: string;
  kode: string;
  aktif: boolean;
};

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
  faktorUrgensiMedis: boolean;
  saranDrafBalasan: string | null;
  statusTindakLanjut: StatusTindakLanjut;
  ditinjauPada: string | null;
  ditinjauOleh: string | null;
  catatanInternal: string | null;
  dataMentah?: string | null;
};

const STATUS_LABELS: Record<StatusTindakLanjut, string> = {
  baru: "Baru",
  dalam_koordinasi: "Dalam Koordinasi",
  selesai: "Selesai",
};

export default function JurnalPage() {
  const [rumahSakitId, setRumahSakitId] = useState<number | null>(null);
  const [tanggal, setTanggal] = useState<Date | null>(null); // default null -> Semua Waktu
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const setStatusFilterSafe = (value: StatusFilter | null) => {
    setStatusFilter(value ?? "all");
  };
  const [ratingFilter, setRatingFilter] = useState<string>("all");
  const setRatingFilterSafe = (value: string | null) => {
    setRatingFilter(value ?? "all");
  };
  const [searchQuery, setSearchQuery] = useState("");
  const [ulasans, setUlasans] = useState<Ulasan[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [statistik, setStatistik] = useState<{ total: number; positif: number; negatif: number; netral: number; krisis: number; belumDitinjau: number } | null>(null);
  const [krisisCount, setKrisisCount] = useState(0);
  const [krisisOnly, setKrisisOnly] = useState(false);
  const [syncLoading, setSyncLoading] = useState(false);
  const [lastSyncStr, setLastSyncStr] = useState<string | null>(null);
  const [lastSyncDate, setLastSyncDate] = useState<Date | null>(null);
  const [syncAlertMessage, setSyncAlertMessage] = useState<string | null>(null);
  const [selectedUlasanDetail, setSelectedUlasanDetail] = useState<Ulasan | null>(null);
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 20;
  const [analisisManualJalan, setAnalisisManualJalan] = useState<number | null>(null);
  const [analisisManualPesan, setAnalisisManualPesan] = useState<{ id: number; pesan: string; tipe: "sukses" | "error" | "peringatan" } | null>(null);

  // Auto-fetch active RS on mount
  useEffect(() => {
    async function loadRS() {
      try {
        const res = await fetch("/api/rumah-sakit");
        const data = await res.json();
        if (data.rumahSakit && data.rumahSakit.length > 0) {
          const aktif = data.rumahSakit.find((r: RumahSakit) => r.aktif) || data.rumahSakit[0];
          setRumahSakitId(aktif.id);
        }
      } catch (e) {
        console.error("Gagal memuat data rumah sakit:", e);
      }
    }
    loadRS();
  }, []);

  const fetchData = useCallback(async () => {
    if (!rumahSakitId) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({
        rumahSakitId: String(rumahSakitId),
        limit: String(PAGE_SIZE),
        offset: String(page * PAGE_SIZE),
      });
      if (krisisOnly) {
        params.set("krisis", "true");
      }
      if (tanggal) params.set("tanggal", format(tanggal, "yyyy-MM-dd"));
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (ratingFilter !== "all") params.set("rating", ratingFilter);

      const res = await fetch(`/api/jurnal?${params}`);
      const data = await res.json();
      setUlasans(data.ulasan ?? []);
      setTotal(data.total ?? 0);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [rumahSakitId, tanggal, statusFilter, ratingFilter, page, krisisOnly]);

  const fetchStatistik = useCallback(async () => {
    if (!rumahSakitId) return;
    try {
      const params = new URLSearchParams({
        action: "statistik_harian",
        rumahSakitId: String(rumahSakitId),
      });
      if (tanggal) params.set("tanggal", format(tanggal, "yyyy-MM-dd"));

      const res = await fetch(`/api/jurnal?${params}`);
      const data = await res.json();
      if (!data.error) {
        setStatistik(data);
      }
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
        const d = new Date(data.riwayat[0].selesaiPada);
        setLastSyncDate(d);
        setLastSyncStr(format(d, "HH:mm", { locale: localeId }));
      }
    } catch (e) {
      console.error(e);
    }
  }, [rumahSakitId]);

  useEffect(() => {
    fetchData();
    fetchStatistik();
    fetchKrisisCount();
    fetchLastSync();
  }, [fetchData, fetchStatistik, fetchKrisisCount, fetchLastSync]);

  const isSyncedToday = useCallback(() => {
    if (!lastSyncDate) return false;
    const now = new Date();
    return (
      lastSyncDate.getDate() === now.getDate() &&
      lastSyncDate.getMonth() === now.getMonth() &&
      lastSyncDate.getFullYear() === now.getFullYear()
    );
  }, [lastSyncDate]);

  const handleSync = async () => {
    if (!rumahSakitId) return;
    setSyncAlertMessage(null);

    // Cek apakah hari ini sudah pernah dilakukan penarikan data
    if (isSyncedToday()) {
      setSyncAlertMessage("Hari ini sudah dilakukan penarikan data.");
      return;
    }

    setSyncLoading(true);
    try {
      const res = await fetch("/api/sinkron", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rumahSakitId, tipePemicu: "manual", periode: "1d" }),
      });
      const data = await res.json();
      if (data.sukses) {
        alert(`Sinkronisasi harian selesai. ${data.ulasanBaru} ulasan baru ditemukan.`);
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
    alert("Teks disalin ke clipboard");
  };

  const handleAnalisisManual = async (u: Ulasan) => {
    if (analisisManualJalan !== null) return;
    setAnalisisManualJalan(u.id);
    setAnalisisManualPesan(null);
    try {
      const res = await fetch("/api/jurnal/analisis-manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ulasanId: u.id }),
      });
      const data = await res.json();
      if (data.sukses) {
        const tipe = data.pesanError ? "peringatan" : "sukses";
        setAnalisisManualPesan({
          id: u.id,
          pesan: data.pesanError
            ? data.pesanError
            : `Analisis selesai. Sentimen: ${data.sentimen ?? "-"}`,
          tipe,
        });
        fetchData();
        fetchStatistik();
      } else {
        setAnalisisManualPesan({ id: u.id, pesan: data.error ?? "Analisis gagal.", tipe: "error" });
      }
    } catch {
      setAnalisisManualPesan({ id: u.id, pesan: "Terjadi kesalahan jaringan.", tipe: "error" });
    } finally {
      setAnalisisManualJalan(null);
      setTimeout(() => setAnalisisManualPesan(null), 6000);
    }
  };

  const formatTanggalWaktu = (iso?: string | null, rawObj?: any) => {
    const target = iso || (rawObj && (rawObj.tanggal_ulasan || rawObj.tanggalUlasan));
    if (!target) return "-";
    try {
      const d = new Date(target);
      if (isNaN(d.getTime())) return String(target);
      return format(d, "dd MMM yyyy, HH:mm", { locale: localeId });
    } catch {
      return String(target);
    }
  };

  const getRatingDisplay = (u: Ulasan) => {
    if (u.rating !== null && u.rating !== undefined) return u.rating;
    if (u.dataMentah) {
      try {
        const raw = JSON.parse(u.dataMentah);
        const r = raw.stars ?? raw.rating ?? raw.star ?? raw.score;
        if (r !== undefined && r !== null) return Number(r);
      } catch {
        // ignore
      }
    }
    return "-";
  };

  const getSentimenDot = (s: string | null) => {
    switch (s) {
      case "positif":
        return <Circle className="size-2.5 fill-emerald-500 text-emerald-500 shrink-0" weight="fill" />;
      case "negatif":
        return <Circle className="size-2.5 fill-rose-500 text-rose-500 shrink-0" weight="fill" />;
      case "netral":
        return <Circle className="size-2.5 fill-amber-500 text-amber-500 shrink-0" weight="fill" />;
      default:
        return <Circle className="size-2.5 fill-muted-foreground text-muted-foreground shrink-0" weight="fill" />;
    }
  };

  const getSentimenTextColor = (s: string | null) => {
    switch (s) {
      case "positif": return "text-emerald-700 font-medium";
      case "negatif": return "text-rose-700 font-medium";
      case "netral": return "text-amber-700 font-medium";
      default: return "text-muted-foreground font-medium";
    }
  };

  const filteredUlasans = ulasans.filter((u) => {
    if (krisisOnly && !u.faktorUrgensiMedis) return false;
    if (ratingFilter !== "all") {
      const r = getRatingDisplay(u);
      if (String(r) !== ratingFilter) return false;
    }
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      (u.namaPengulas && u.namaPengulas.toLowerCase().includes(q)) ||
      (u.teksUlasan && u.teksUlasan.toLowerCase().includes(q)) ||
      (u.unitLayanan && u.unitLayanan.toLowerCase().includes(q)) ||
      (u.kategoriMasalah && u.kategoriMasalah.toLowerCase().includes(q))
    );
  });

  if (!rumahSakitId) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-center">
        <SpinnerGap className="size-10 text-primary animate-spin" />
        <h2 className="mt-4 text-lg font-medium">Memuat Data Rumah Sakit...</h2>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Jurnal Harian Ulasan</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Dokumentasi dan tindak lanjut ulasan Google Maps harian
          </p>
        </div>

        {/* Toolbar Controls */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Date Picker Popover */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-9 px-3 gap-2 text-xs font-normal">
                <CalendarIcon className="size-3.5 text-muted-foreground" />
                <span>{tanggal ? format(tanggal, "dd MMM yyyy", { locale: localeId }) : "Semua Waktu"}</span>
                {tanggal && (
                  <span
                    onClick={(e) => {
                      e.stopPropagation();
                      setTanggal(null);
                    }}
                    className="ml-1 p-0.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
                  >
                    <X className="size-3" />
                  </span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0 border shadow-md" align="start">
              <div className="px-3 py-2 border-b flex items-center justify-between text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                <span>Filter Tanggal</span>
                {tanggal && (
                  <Button variant="ghost" size="sm" onClick={() => setTanggal(null)} className="h-auto p-0 text-xs text-rose-600 hover:text-rose-700 font-medium">
                    Reset
                  </Button>
                )}
              </div>
              <Calendar
                mode="single"
                selected={tanggal || undefined}
                onSelect={(d) => setTanggal(d || null)}
                disabled={{ after: new Date() }}
                className="border-0 shadow-none p-2"
                captionLayout="dropdown"
              />
              <div className="p-2 border-t">
                <Button variant="secondary" size="sm" className="w-full text-xs h-7 font-medium" onClick={() => setTanggal(null)}>
                  Tampilkan Semua Waktu
                </Button>
              </div>
            </PopoverContent>
          </Popover>

          {/* Rating Filter Dropdown */}
          <Select value={ratingFilter} onValueChange={setRatingFilterSafe}>
            <SelectTrigger className="w-[140px] h-9 text-xs">
              <div className="flex items-center gap-1.5 truncate">
                <Star className="size-3.5 fill-amber-400 text-amber-400 shrink-0" weight="fill" />
                <SelectValue placeholder="Semua Rating">
                  {ratingFilter === "all" ? "Semua Rating" : `★ ${ratingFilter} Bintang`}
                </SelectValue>
              </div>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Rating</SelectItem>
              <SelectItem value="5">★ 5 Bintang</SelectItem>
              <SelectItem value="4">★ 4 Bintang</SelectItem>
              <SelectItem value="3">★ 3 Bintang</SelectItem>
              <SelectItem value="2">★ 2 Bintang</SelectItem>
              <SelectItem value="1">★ 1 Bintang</SelectItem>
            </SelectContent>
          </Select>

          {/* Status Filter */}
          <Select value={statusFilter} onValueChange={setStatusFilterSafe}>
            <SelectTrigger className="w-[150px] h-9 text-xs">
              <SelectValue placeholder="Semua Status">
                {statusFilter === "all" ? "Semua Status" : STATUS_LABELS[statusFilter] ?? statusFilter}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Status</SelectItem>
              <SelectItem value="baru">Baru</SelectItem>
              <SelectItem value="dalam_koordinasi">Dalam Koordinasi</SelectItem>
              <SelectItem value="selesai">Selesai</SelectItem>
            </SelectContent>
          </Select>

          {/* Search Input */}
          <div className="relative">
            <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
            <Input
              placeholder="Cari pengulas, ulasan, unit..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 w-[200px] h-9 text-xs"
            />
          </div>

          {/* Tarik Data Button Moved to Far Right */}
          <Button variant="outline" size="sm" onClick={handleSync} disabled={syncLoading} className="h-9 px-3.5 gap-2 text-xs font-medium">
            <ArrowsClockwise className={cn("size-3.5", syncLoading && "animate-spin")} weight="duotone" />
            <span>Tarik Data</span>
          </Button>
        </div>
      </div>

      {/* Sync Notification Banner */}
      {syncAlertMessage && (
        <div className="flex items-center justify-between rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs text-amber-900 shadow-2xs">
          <div className="flex items-center gap-2">
            <Clock className="size-4 text-amber-600 shrink-0" />
            <span>{syncAlertMessage}</span>
          </div>
          <Button variant="ghost" size="sm" onClick={() => setSyncAlertMessage(null)} className="h-auto p-0 text-amber-700 hover:text-amber-950">
            <X className="size-3.5" />
          </Button>
        </div>
      )}

      {/* Notifikasi hasil analisis manual */}
      {analisisManualPesan && (
        <div className={cn(
          "flex items-center justify-between rounded-lg border px-4 py-2.5 text-xs shadow-2xs",
          analisisManualPesan.tipe === "sukses" && "border-emerald-200 bg-emerald-50 text-emerald-900",
          analisisManualPesan.tipe === "error" && "border-rose-200 bg-rose-50 text-rose-900",
          analisisManualPesan.tipe === "peringatan" && "border-amber-200 bg-amber-50 text-amber-900",
        )}>
          <div className="flex items-center gap-2">
            <Sparkle className="size-3.5 shrink-0" weight="duotone" />
            <span>{analisisManualPesan.pesan}</span>
          </div>
          <Button variant="ghost" size="sm" onClick={() => setAnalisisManualPesan(null)} className="h-auto p-0 text-muted-foreground hover:text-foreground">
            <X className="size-3.5" />
          </Button>
        </div>
      )}

      {/* Alert Status & Last Sync */}
      <div className="flex flex-wrap items-center gap-3">
        {krisisCount > 0 ? (
          <button
            type="button"
            onClick={() => {
              setKrisisOnly((prev) => !prev);
              setTanggal(null);
              setPage(0);
            }}
            className={cn(
              "group flex items-center gap-2.5 rounded-lg px-3.5 py-2 border text-xs font-medium transition-all cursor-pointer select-none",
              krisisOnly
                ? "bg-rose-600 border-rose-700 text-white shadow-xs hover:bg-rose-700"
                : "bg-rose-50 border-rose-200 text-rose-800 hover:bg-rose-100/80 hover:border-rose-300 active:scale-[0.99]"
            )}
          >
            <span className="relative flex size-2 shrink-0">
              <span
                className={cn(
                  "absolute inline-flex h-full w-full rounded-full bg-rose-500",
                  !krisisOnly && "animate-ping opacity-75"
                )}
              />
              <span className="relative inline-flex size-2 rounded-full bg-rose-500" />
            </span>
            <Shield className={cn("size-4 shrink-0", krisisOnly ? "text-white" : "text-rose-600")} weight="duotone" />
            <span>
              {krisisOnly
                ? `Menampilkan ${krisisCount} ulasan krisis belum ditinjau`
                : `${krisisCount} ulasan krisis belum ditinjau`}
            </span>
            <span
              className={cn(
                "ml-1.5 inline-flex items-center gap-1 rounded px-2 py-0.5 text-[11px] font-semibold transition-colors",
                krisisOnly
                  ? "bg-rose-700/80 text-white hover:bg-rose-800"
                  : "bg-rose-200/80 text-rose-900 group-hover:bg-rose-300/80"
              )}
            >
              {krisisOnly ? "Kembali ke Semua Ulasan ×" : "Lihat Ulasan Kritis →"}
            </span>
          </button>
        ) : (
          <div className="flex items-center gap-2 rounded-lg px-3 py-2 border border-emerald-200 bg-emerald-50 text-emerald-800 text-xs font-medium">
            <Shield className="size-4 shrink-0 text-emerald-600" weight="duotone" />
            <span>Tidak ada ulasan krisis yang membutuhkan tindakan mendesak</span>
          </div>
        )}

        {lastSyncStr && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Clock className="size-3.5" />
            <span>Sinkron terakhir: {lastSyncStr} WIB</span>
          </div>
        )}
      </div>

      {/* Statistics Cards */}
      {statistik && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <StatCard label="Total Ulasan" value={statistik.total} icon={<Circle className="size-5" weight="duotone" />} />
          <StatCard label="Positif" value={statistik.positif} icon={<CheckCircle className="size-5" weight="duotone" />} variant="success" />
          <StatCard label="Negatif" value={statistik.negatif} icon={<Flag className="size-5" weight="duotone" />} variant="danger" />
          <StatCard label="Netral" value={statistik.netral} icon={<Circle className="size-5" weight="duotone" />} variant="warning" />
          <StatCard
            label="Krisis"
            value={statistik.krisis}
            icon={<Shield className="size-5" weight="duotone" />}
            variant="danger"
            onClick={() => {
              setKrisisOnly((prev) => !prev);
              setTanggal(null);
              setPage(0);
            }}
            active={krisisOnly}
          />
          <StatCard label="Belum Ditinjau" value={statistik.belumDitinjau} icon={<Clock className="size-5" weight="duotone" />} variant="warning" />
        </div>
      )}

      {/* Krisis Filter Active Banner */}
      {krisisOnly && (
        <div className="flex items-center justify-between rounded-lg border border-rose-200 bg-rose-50/80 px-4 py-2.5 text-xs text-rose-900 shadow-2xs">
          <div className="flex items-center gap-2">
            <Shield className="size-4 text-rose-600 shrink-0" weight="fill" />
            <span className="font-semibold">Filter Ulasan Kritis Aktif:</span>
            <span>Menampilkan seluruh ulasan dengan indikasi urgensi medis tanpa batasan hari.</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setKrisisOnly(false);
              setPage(0);
            }}
            className="h-7 px-2.5 text-xs font-semibold text-rose-700 hover:bg-rose-100 hover:text-rose-950"
          >
            Tampilkan Semua Ulasan
          </Button>
        </div>
      )}

      {/* Review Table Card */}
      <Card className="overflow-hidden border shadow-xs">
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div>
            <CardTitle className="text-sm font-semibold">
              {krisisOnly ? "Daftar Ulasan Krisis" : "Daftar Ulasan"} {total > 0 && `(${total})`}
            </CardTitle>
            {krisisOnly ? (
              <p className="text-xs text-rose-600 mt-0.5 font-medium">
                Menampilkan ulasan kritis yang memerlukan perhatian segera (semua waktu)
              </p>
            ) : tanggal ? (
              <p className="text-xs text-muted-foreground mt-0.5">
                Menampilkan ulasan untuk tanggal {format(tanggal, "dd MMMM yyyy", { locale: localeId })}
              </p>
            ) : null}
          </div>
          <div className="flex items-center gap-2">
            <a
              href={`/export?rumahSakitId=${rumahSakitId}&format=html`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 rounded-md border border-input bg-background px-3 py-1.5 text-xs font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              <Download className="size-3.5 mr-1" />
              Ekspor (HTML/PDF)
            </a>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="relative w-full overflow-auto max-h-[calc(100vh-360px)]">
            <Table className="w-full text-sm border-collapse">
              <TableHeader className="sticky top-0 z-20 bg-muted/90 backdrop-blur-xs">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-[140px]">Tanggal & Waktu</TableHead>
                  <TableHead className="w-[150px]">Nama Pengulas</TableHead>
                  <TableHead className="w-[80px]">Rating</TableHead>
                  {/* Smaller max width for Teks Ulasan */}
                  <TableHead className="w-[200px] max-w-[200px]">Teks Ulasan</TableHead>
                  <TableHead className="w-[140px]">Unit / Kategori</TableHead>
                  <TableHead className="w-[130px]">Sentimen</TableHead>
                  <TableHead className="w-[130px]">Status</TableHead>
                  <TableHead className="w-[80px] text-center pr-3">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="py-12 text-center">
                      <SpinnerGap className="size-6 animate-spin mx-auto text-muted-foreground" weight="duotone" />
                      <span className="mt-2 block text-xs text-muted-foreground">Memuat daftar ulasan...</span>
                    </TableCell>
                  </TableRow>
                ) : filteredUlasans.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="py-12 text-center text-muted-foreground">
                      {searchQuery || ratingFilter !== "all" ? "Tidak ada ulasan yang cocok dengan kriteria filter" : "Belum ada ulasan yang tersedia untuk kriteria ini"}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredUlasans.map((u) => (
                    <TableRow
                      key={u.id}
                      className={cn(
                        "group transition-colors relative",
                        u.faktorUrgensiMedis
                          ? "bg-rose-50/60 hover:bg-rose-50 border-l-2 border-l-rose-500"
                          : "border-l-2 border-l-transparent"
                      )}
                    >
                      <TableCell className="text-xs text-muted-foreground font-mono whitespace-nowrap">
                        {formatTanggalWaktu(u.tanggalUlasan, u)}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        <div className="font-semibold text-xs text-foreground truncate max-w-[140px]">
                          {u.namaPengulas || "Pengulas Google"}
                        </div>
                        <div className="text-[10px] font-mono text-muted-foreground/70 truncate max-w-[120px]">
                          {u.reviewId}
                        </div>
                        {u.faktorUrgensiMedis && (
                          <div className="mt-1 flex items-center gap-1.5">
                            {/* Pulsing dot */}
                            <span className="relative flex size-2 shrink-0">
                              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-500 opacity-60" />
                              <span className="relative inline-flex size-2 rounded-full bg-rose-500" />
                            </span>
                            <span className="inline-flex items-center gap-1 rounded-sm bg-rose-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-rose-700">
                              <Warning className="size-2.5" weight="fill" />
                              Kritis
                            </span>
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        <div className="flex items-center gap-1 text-xs font-semibold text-amber-600">
                          <Star className="size-3.5 fill-amber-400 text-amber-400 shrink-0" weight="fill" />
                          <span>{getRatingDisplay(u)}</span>
                        </div>
                      </TableCell>
                      {/* Compact Teks Ulasan */}
                      <TableCell className="w-[200px] max-w-[200px]">
                        <div className="truncate text-xs text-foreground/90" title={u.teksUlasan}>
                          {u.teksUlasan || "(Ulasan tanpa teks)"}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs whitespace-nowrap">
                        <div className="font-medium text-foreground truncate max-w-[130px]">{u.unitLayanan || "Lainnya"}</div>
                        <div className="text-muted-foreground truncate max-w-[130px]">{u.kategoriMasalah || "Lainnya"}</div>
                      </TableCell>

                      {/* Sentimen Display: Circle Icon & Text Color only (No solid blue hover/badge) */}
                      <TableCell className="whitespace-nowrap">
                        <div className={cn("flex items-center gap-1.5 text-xs capitalize", getSentimenTextColor(u.sentimen))}>
                          {getSentimenDot(u.sentimen)}
                          <span>{u.sentimen ?? "Belum dianalisis"}</span>
                        </div>
                        {u.faktorUrgensiMedis && (
                          <div className="mt-0.5 flex items-center gap-1 text-[10px] font-medium text-rose-600">
                            <Warning className="size-3 shrink-0" weight="fill" />
                            <span>Urgensi medis</span>
                          </div>
                        )}
                      </TableCell>

                      {/* Status Column */}
                      <TableCell className="whitespace-nowrap">
                        <Select value={u.statusTindakLanjut} onValueChange={(v) => handleStatusChange(u.id, v as StatusTindakLanjut)}>
                          <SelectTrigger className="w-[125px] h-8 text-xs">
                            <SelectValue>{STATUS_LABELS[u.statusTindakLanjut] ?? u.statusTindakLanjut}</SelectValue>
                          </SelectTrigger>
                          <SelectContent align="start">
                            <SelectItem value="baru">Baru</SelectItem>
                            <SelectItem value="dalam_koordinasi">Dalam Koordinasi</SelectItem>
                            <SelectItem value="selesai">Selesai</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>

                      {/* Action Column */}
                      <TableCell className="text-center whitespace-nowrap pr-3 w-[80px]">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="sm" className="h-8 px-2 text-xs gap-1 font-medium shadow-2xs">
                              <span>Aksi</span>
                              <DotsThreeVertical className="size-3.5" weight="bold" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-52">
                            <DropdownMenuItem
                              onClick={() => setSelectedUlasanDetail(u)}
                              className="flex items-center gap-2 cursor-pointer"
                            >
                              <Eye className="size-4 text-muted-foreground" weight="duotone" />
                              Lihat Ulasan
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => copyToClipboard(u.teksUlasan)}
                              className="flex items-center gap-2 cursor-pointer"
                            >
                              <Copy className="size-4 text-muted-foreground" weight="duotone" />
                              Salin Ulasan
                            </DropdownMenuItem>
                            {u.saranDrafBalasan && (
                              <DropdownMenuItem
                                onClick={() => copyToClipboard(u.saranDrafBalasan!)}
                                className="flex items-center gap-2 cursor-pointer"
                              >
                                <Copy className="size-4 text-emerald-600" weight="duotone" />
                                Salin Draf Balasan
                              </DropdownMenuItem>
                            )}
                            {!u.sentimen && (
                              <>
                                <div className="my-1 h-px bg-border" />
                                <DropdownMenuItem
                                  onClick={() => handleAnalisisManual(u)}
                                  disabled={analisisManualJalan !== null}
                                  className="flex items-center gap-2 cursor-pointer text-primary focus:text-primary"
                                >
                                  {analisisManualJalan === u.id ? (
                                    <SpinnerGap className="size-4 animate-spin" weight="duotone" />
                                  ) : (
                                    <Sparkle className="size-4" weight="duotone" />
                                  )}
                                  {analisisManualJalan === u.id ? "Menganalisis..." : "Analisis dengan AI"}
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {total > PAGE_SIZE && (
            <div className="flex items-center justify-between border-t border-border px-4 py-3">
              <span className="text-xs text-muted-foreground">
                Menampilkan {page * PAGE_SIZE + 1} - {Math.min((page + 1) * PAGE_SIZE, total)} dari {total} ulasan
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

      {/* Modal Dialog Lihat Detail Ulasan */}
      <Dialog open={!!selectedUlasanDetail} onOpenChange={(open) => !open && setSelectedUlasanDetail(null)}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between gap-2 pr-6">
              <span>Detail Ulasan</span>
              {selectedUlasanDetail && getRatingDisplay(selectedUlasanDetail) !== "-" && (
                <div className="flex items-center gap-1 text-amber-600 text-sm font-semibold">
                  <Star className="size-4 fill-amber-400 text-amber-400" weight="fill" />
                  <span>{getRatingDisplay(selectedUlasanDetail)} / 5</span>
                </div>
              )}
            </DialogTitle>
            <DialogDescription className="text-xs">
              {selectedUlasanDetail && formatTanggalWaktu(selectedUlasanDetail.tanggalUlasan, selectedUlasanDetail)}
            </DialogDescription>
          </DialogHeader>

          {selectedUlasanDetail && (
            <div className="space-y-4 pt-2">
              {/* Crisis Alert Banner */}
              {selectedUlasanDetail.faktorUrgensiMedis && (
                <div className="flex items-center gap-2.5 rounded-lg border border-rose-200 bg-rose-50 px-3.5 py-2.5">
                  <span className="relative flex size-2.5 shrink-0">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-500 opacity-60" />
                    <span className="relative inline-flex size-2.5 rounded-full bg-rose-500" />
                  </span>
                  <div>
                    <p className="text-xs font-semibold text-rose-900">Ulasan Mengandung Urgensi Medis</p>
                    <p className="text-[10px] text-rose-700/80 mt-0.5">Ulasan ini terindikasi mengandung keluhan serius yang memerlukan tindak lanjut segera.</p>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between text-xs border-b pb-2">
                <div>
                  <div className="font-semibold text-xs text-foreground">{selectedUlasanDetail.namaPengulas || "Pengulas Google"}</div>
                  <div className="font-mono text-muted-foreground text-[10px]">{selectedUlasanDetail.reviewId}</div>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className={cn("flex items-center gap-1.5 text-xs font-medium capitalize", getSentimenTextColor(selectedUlasanDetail.sentimen))}>
                    {getSentimenDot(selectedUlasanDetail.sentimen)}
                    <span>{selectedUlasanDetail.sentimen || "Belum dianalisis"}</span>
                  </span>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-semibold uppercase text-muted-foreground tracking-wider">Teks Ulasan Lengkap</label>
                <div className="p-3.5 bg-muted/30 rounded-lg text-xs leading-relaxed text-foreground whitespace-pre-wrap border">
                  {selectedUlasanDetail.teksUlasan || "(Ulasan tanpa teks)"}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-2.5 rounded-lg border bg-background">
                  <span className="text-muted-foreground block text-[10px] uppercase font-semibold">Unit Layanan</span>
                  <span className="font-medium text-foreground">{selectedUlasanDetail.unitLayanan || "Lainnya"}</span>
                </div>
                <div className="p-2.5 rounded-lg border bg-background">
                  <span className="text-muted-foreground block text-[10px] uppercase font-semibold">Kategori Masalah</span>
                  <span className="font-medium text-foreground">{selectedUlasanDetail.kategoriMasalah || "Lainnya"}</span>
                </div>
              </div>

              {selectedUlasanDetail.saranDrafBalasan && (
                <div className="space-y-1.5 pt-2 border-t">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-semibold uppercase text-muted-foreground tracking-wider">Saran Draf Balasan</label>
                    <Button variant="ghost" size="sm" className="h-6 text-xs px-2" onClick={() => copyToClipboard(selectedUlasanDetail.saranDrafBalasan!)}>
                      <Copy className="size-3 mr-1" /> Salin Draf
                    </Button>
                  </div>
                  <div className="p-3 bg-emerald-50/50 border border-emerald-200 rounded-lg text-xs leading-relaxed text-emerald-950">
                    {selectedUlasanDetail.saranDrafBalasan}
                  </div>
                </div>
              )}
            </div>
          )}

          <DialogFooter className="pt-2">
            <Button variant="outline" size="sm" onClick={() => setSelectedUlasanDetail(null)}>
              Tutup
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
  variant = "default",
  onClick,
  active = false,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  variant?: "default" | "success" | "warning" | "danger";
  onClick?: () => void;
  active?: boolean;
}) {
  const variantClasses = {
    default: "border-border bg-card",
    success: "border-emerald-200 bg-emerald-50/60 dark:bg-emerald-950/20",
    warning: "border-amber-200 bg-amber-50/60 dark:bg-amber-950/20",
    danger: "border-rose-200 bg-rose-50/60 dark:bg-rose-950/20",
  };
  return (
    <div
      onClick={onClick}
      className={cn(
        "rounded-xl border p-4 transition-all shadow-xs",
        variantClasses[variant],
        onClick && "cursor-pointer hover:shadow-sm hover:scale-[1.01] active:scale-[0.99]",
        active && "ring-2 ring-rose-500 border-rose-400 bg-rose-100/80 dark:bg-rose-950/40"
      )}
    >
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs font-medium text-muted-foreground">{label}</div>
          <div className="mt-1 text-2xl font-bold tabular-nums tracking-tight">{value}</div>
        </div>
        <div className="text-muted-foreground/70">{icon}</div>
      </div>
    </div>
  );
}