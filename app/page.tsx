"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDownRight,
  ArrowRight,
  ArrowsClockwise,
  ArrowUpRight,
  Broom,
  CaretDown,
  Chats,
  CheckCircle,
  ChartDonut,
  ChartLineUp,
  Clock,
  Download,
  Info,
  Minus,
  SpinnerGap,
  StopCircle,
  Tag,
  UploadSimple,
  WarningCircle,
} from "@phosphor-icons/react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { PageHeader } from "@/components/page-header";
import { Stat } from "@/components/metric";
import { EmptyState, LoadingSection } from "@/components/states";
import { SentimenDonut } from "@/components/sentimen-donut";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import {
  formatTanggal,
  formatDurasi,
  ekstraksiDurasiDariCatatan,
  bersihkanCatatanPeringatan,
  type AnalisisItem,
} from "@/lib/types";

type TrendPoint = {
  tanggal: string;
  label: string;
  total: number;
  persenPositif: number;
  persenNegatif: number;
  persenNetral: number;
};

export default function DashboardPage() {
  const [daftar, setDaftar] = useState<AnalisisItem[]>([]);
  const [memuat, setMemuat] = useState(true);
  const [dipilih, setDipilih] = useState<number | null>(null);
  const [periodeA, setPeriodeA] = useState<number | null>(null);
  const [periodeB, setPeriodeB] = useState<number | null>(null);
  const [prosesUlangJalan, setProsesUlangJalan] = useState(false);
  const [pesanProsesUlang, setPesanProsesUlang] = useState<string | null>(null);
  const [hentikanJalan, setHentikanJalan] = useState(false);
  const [waktuMulaiAnalisis, setWaktuMulaiAnalisis] = useState<Date | null>(null);
  const [elapsedDetik, setElapsedDetik] = useState(0);
  const [notifSelesai, setNotifSelesai] = useState<{
    id: number;
    totalUlasan: number;
    durasi: string;
  } | null>(null);
  const prevStatusRef = useRef<string | undefined>(undefined);
  const [logAktivitas, setLogAktivitas] = useState<{ waktu: string; pesan: string; tipe: "info" | "sukses" | "error" | "peringatan" }[]>([]);
  const [namaRS, setNamaRS] = useState<string>("Rumah Sakit Umum");
  const [rumahSakitId, setRumahSakitId] = useState<number | null>(null);
  const [syncLoading, setSyncLoading] = useState(false);
  const [pesanSukses, setPesanSukses] = useState<string | null>(null);
  const [trendPoints, setTrendPoints] = useState<TrendPoint[]>([]);

  const muatDaftar = useCallback(() => {
    return fetch("/api/analisis")
      .then((res) => res.json())
      .then((data: { analisis?: AnalisisItem[] }) => {
        const list = Array.isArray(data?.analisis) ? data.analisis : [];
        setDaftar(list);
        return list;
      })
      .catch(() => {
        setDaftar([]);
        return [];
      });
  }, []);

  useEffect(() => {
    fetch("/api/rumah-sakit")
      .then((res) => res.json())
      .then((data) => {
        if (data.rumahSakit?.[0]) {
          setNamaRS(data.rumahSakit[0].nama);
          setRumahSakitId(data.rumahSakit[0].id);
        }
      })
      .catch(() => undefined);

    fetch("/api/analisis")
      .then((res) => res.json())
      .then((data: { analisis?: AnalisisItem[] }) => {
        const list = Array.isArray(data?.analisis) ? data.analisis : [];
        setDaftar(list);
        const berjalan = list.find((a) => a.status === "berjalan");
        const selesai = list.filter((a) => a.status === "selesai");
        setDipilih(berjalan?.id ?? selesai[0]?.id ?? list[0]?.id ?? null);
        if (selesai.length >= 2) {
          setPeriodeA(selesai[1].id);
          setPeriodeB(selesai[0].id);
        } else if (selesai.length === 1) {
          setPeriodeA(selesai[0].id);
          setPeriodeB(selesai[0].id);
        }
      })
      .catch(() => setDaftar([]))
      .finally(() => setMemuat(false));
  }, []);

  const statusAktif = (Array.isArray(daftar) ? daftar : []).find((a) => a.id === dipilih)?.status;
  useEffect(() => {
    if (statusAktif !== "berjalan") return;
    const timer = setInterval(() => {
      muatDaftar().catch(() => undefined);
    }, 2500);
    return () => clearInterval(timer);
  }, [statusAktif, muatDaftar]);

  const tambahLog = useCallback((pesan: string, tipe: "info" | "sukses" | "error" | "peringatan" = "info") => {
    const waktu = new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    setLogAktivitas((prev) => [{ waktu, pesan, tipe }, ...prev].slice(0, 50));
  }, []);

  // Persist timer start time across navigations using localStorage.
  // Key includes analisisId so different sessions don't bleed into each other.
  const TIMER_KEY = dipilih !== null ? `analisis-timer-${dipilih}` : null;

  useEffect(() => {
    if (!TIMER_KEY || dipilih === null) {
      prevStatusRef.current = statusAktif;
      return;
    }

    if (statusAktif === "berjalan") {
      // Restore existing start time, or record a new one
      const stored = localStorage.getItem(TIMER_KEY);
      const startMs = stored ? Number(stored) : Date.now();
      if (!stored) localStorage.setItem(TIMER_KEY, String(startMs));

      const startDate = new Date(startMs);
      setWaktuMulaiAnalisis(startDate);
      setElapsedDetik(Math.floor((Date.now() - startMs) / 1000));
    } else if (statusAktif === "selesai") {
      const stored = localStorage.getItem(TIMER_KEY);
      const itemAktif = (Array.isArray(daftar) ? daftar : []).find((a) => a.id === dipilih);
      const durasiCatatan = ekstraksiDurasiDariCatatan(itemAktif?.catatan);

      if (prevStatusRef.current === "berjalan" || stored) {
        const durasiDetik = stored
          ? Math.max(1, Math.floor((Date.now() - Number(stored)) / 1000))
          : (elapsedDetik > 0 ? elapsedDetik : 0);
        const durasiTeks = durasiCatatan || formatDurasi(durasiDetik);

        setNotifSelesai({
          id: dipilih,
          totalUlasan: itemAktif?.totalUlasan ?? 0,
          durasi: durasiTeks,
        });

        tambahLog(
          `Analisis selesai: ${itemAktif?.totalUlasan ?? 0} ulasan berhasil dianalisis dalam waktu ${durasiTeks}.`,
          "sukses"
        );

        if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
          try {
            new Notification("Analisis Sentimen Selesai", {
              body: `${itemAktif?.totalUlasan ?? 0} ulasan selesai dianalisis dalam waktu ${durasiTeks}.`,
              icon: "/favicon.ico",
            });
          } catch {}
        }
      }

      localStorage.removeItem(TIMER_KEY);
      setWaktuMulaiAnalisis(null);
    } else {
      localStorage.removeItem(TIMER_KEY);
      setWaktuMulaiAnalisis(null);
    }

    prevStatusRef.current = statusAktif;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusAktif, TIMER_KEY, dipilih, daftar, tambahLog]);

  useEffect(() => {
    if (!waktuMulaiAnalisis) return;
    const interval = setInterval(() => {
      setElapsedDetik(Math.floor((Date.now() - waktuMulaiAnalisis.getTime()) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [waktuMulaiAnalisis]);

  useEffect(() => {
    if (dipilih === null) {
      return;
    }
    let aktif = true;
    fetch(`/api/analisis/${dipilih}/tren`)
      .then((res) => res.json())
      .then((data: { points?: TrendPoint[] }) => {
        if (aktif) setTrendPoints(Array.isArray(data.points) ? data.points : []);
      })
      .catch(() => {
        if (aktif) setTrendPoints([]);
      });
    return () => {
      aktif = false;
    };
  }, [dipilih, statusAktif]);

  const prosesUlangDenganAI = useCallback(async () => {
    if (dipilih === null || prosesUlangJalan) return;
    setProsesUlangJalan(true);
    setPesanProsesUlang(null);
    try {
      const res = await fetch(`/api/analisis/${dipilih}/process`, { method: "POST" });
      const data = (await res.json()) as { pakaiAI?: boolean; pesan?: string };
      if (res.ok && data.pakaiAI === false) {
        setPesanProsesUlang(data.pesan ?? "Kunci API AI belum diatur.");
        tambahLog("Analisis dimulai tanpa AI — sentimen ditentukan dari rating bintang.", "peringatan");
      } else {
        try {
          localStorage.setItem(`analisis-timer-${dipilih}`, String(Date.now()));
        } catch {}
        setNotifSelesai(null);
        if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "default") {
          Notification.requestPermission().catch(() => undefined);
        }
        tambahLog("Memulai proses analisis AI...", "info");
        await muatDaftar();
      }
    } catch {
      setPesanProsesUlang("Tidak dapat memulai proses ulang. Coba lagi.");
      tambahLog("Gagal memulai proses analisis. Periksa koneksi.", "error");
    } finally {
      setProsesUlangJalan(false);
    }
  }, [dipilih, prosesUlangJalan, muatDaftar]);

  const [konfirmasi, setKonfirmasi] = useState<"hapus" | "bersihkan" | null>(null);
  const [aksiJalan, setAksiJalan] = useState(false);
  const [pesanAksi, setPesanAksi] = useState<string | null>(null);

  const hentikanAnalisis = useCallback(async () => {
    if (dipilih === null || hentikanJalan) return;
    setHentikanJalan(true);
    try {
      const res = await fetch(`/api/analisis/${dipilih}/stop`, { method: "POST" });
      if (res.ok) {
        await muatDaftar().catch(() => undefined);
      } else {
        setPesanAksi("Tidak ada proses analisis yang sedang berjalan.");
      }
    } catch {
      setPesanAksi("Gagal menghentikan analisis. Coba lagi.");
    } finally {
      setHentikanJalan(false);
    }
  }, [dipilih, hentikanJalan, muatDaftar]);

  useEffect(() => {
    if (!konfirmasi) return;
    const timer = setTimeout(() => setKonfirmasi(null), 4000);
    return () => clearTimeout(timer);
  }, [konfirmasi]);

  const handleSync = async (periode: "1d" | "1w" | "1m" | "1y") => {
    if (!rumahSakitId) return;
    setSyncLoading(true);
    setPesanAksi(null);
    setPesanSukses(null);
    setNotifSelesai(null);
    if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "default") {
      Notification.requestPermission().catch(() => undefined);
    }
    tambahLog(`Memulai penarikan data Google Maps — periode: ${periode}`, "info");
    try {
      const res = await fetch("/api/sinkron", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rumahSakitId, tipePemicu: "manual", periode }),
      });
      const data = await res.json();
      if (data.sukses) {
        const list = await muatDaftar();
        if (list[0]) setDipilih(list[0].id);
        if (data.ulasanBaru === 0) {
          setPesanSukses("Sinkronisasi selesai: Tidak ditemukan ulasan baru untuk periode ini.");
          tambahLog("Tarik data selesai — tidak ada ulasan baru.", "info");
        } else {
          setPesanSukses(`Berhasil menarik ${data.ulasanBaru} ulasan baru dari Google Maps.`);
          tambahLog(`${data.ulasanBaru} ulasan baru berhasil ditarik dari Google Maps.`, "sukses");
        }
      } else {
        setPesanAksi(`Gagal tarik data: ${data.pesanError}`);
        tambahLog(`Tarik data gagal: ${data.pesanError}`, "error");
      }
    } catch {
      setPesanAksi("Terjadi kesalahan saat menarik data.");
      tambahLog("Kesalahan jaringan saat menarik data.", "error");
    } finally {
      setSyncLoading(false);
    }
  };

  const bersihkanSemua = useCallback(async () => {
    if (aksiJalan) return;
    if (konfirmasi !== "bersihkan") {
      setKonfirmasi("bersihkan");
      return;
    }
    setAksiJalan(true);
    setPesanAksi(null);
    try {
      const res = await fetch("/api/analisis", { method: "DELETE" });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setPesanAksi(data.error ?? "Gagal membersihkan data.");
        return;
      }
      await muatDaftar();
      setDipilih(null);
    } catch {
      setPesanAksi("Gagal membersihkan data. Coba lagi.");
    } finally {
      setAksiJalan(false);
      setKonfirmasi(null);
    }
  }, [aksiJalan, konfirmasi, muatDaftar]);

  const aktif = useMemo(() => (Array.isArray(daftar) ? daftar : []).find((a) => a.id === dipilih) ?? null, [daftar, dipilih]);
  const totalTerlabel = aktif ? aktif.totalPositif + aktif.totalNegatif + aktif.totalNetral : 0;
  const catatanPeringatan = useMemo(() => bersihkanCatatanPeringatan(aktif?.catatan), [aktif?.catatan]);
  const durasiTercatat = useMemo(() => ekstraksiDurasiDariCatatan(aktif?.catatan), [aktif?.catatan]);

  const selesaiUrutWaktu = useMemo(
    () =>
      [...daftar]
        .filter((a) => a.status === "selesai")
        .sort((a, b) => new Date(a.tanggalUnggah).getTime() - new Date(b.tanggalUnggah).getTime()),
    [daftar]
  );

  const dataGrafik = useMemo(
    () => trendPoints.map((point) => ({
      ...point,
      Positif: point.total > 0 ? point.persenPositif : null,
      Negatif: point.total > 0 ? point.persenNegatif : null,
      Netral: point.total > 0 ? point.persenNetral : null,
    })),
    [trendPoints]
  );

  const itemA = useMemo(() => daftar.find((a) => a.id === periodeA), [daftar, periodeA]);
  const itemB = useMemo(() => daftar.find((a) => a.id === periodeB), [daftar, periodeB]);

  if (memuat) {
    return <LoadingSection rows={2} />;
  }

  if (daftar.length === 0) {
    return (
      <div>
        <PageHeader
          title="Analisis Sentimen Ulasan"
          description={namaRS}
        >
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" disabled={syncLoading} className="gap-2">
                <ArrowsClockwise className={cn("size-4", syncLoading && "animate-spin")} weight="duotone" />
                <span>Tarik Data</span>
                <CaretDown className="size-3.5 opacity-70" weight="bold" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuLabel>Periode Penarikan</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => handleSync("1d")} className="cursor-pointer">
                1 Hari
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleSync("1w")} className="cursor-pointer">
                1 Minggu
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleSync("1m")} className="cursor-pointer">
                1 Bulan
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleSync("1y")} className="cursor-pointer">
                1 Tahun
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button
            variant="outline"
            size="sm"
            disabled={aksiJalan}
            onClick={bersihkanSemua}
            className={cn("gap-2", konfirmasi === "bersihkan" && "border-destructive/50 text-destructive")}
          >
            <Broom className="size-4" weight="duotone" />
            <span>{konfirmasi === "bersihkan" ? "Yakin? Klik lagi" : "Bersihkan Data"}</span>
          </Button>
        </PageHeader>

        {pesanAksi && (
          <div className="reveal mb-6 flex items-center gap-2.5 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-900">
            <WarningCircle className="size-4 shrink-0" weight="duotone" />
            {pesanAksi}
          </div>
        )}

        {pesanSukses && (
          <div className="reveal mb-6 flex items-center gap-2.5 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
            <CheckCircle className="size-4 shrink-0 text-emerald-600" weight="duotone" />
            {pesanSukses}
          </div>
        )}
        <EmptyState
          icon={UploadSimple}
          title="Belum ada data ulasan"
          description="Gunakan tombol Tarik Data di kanan atas atau unggah file ulasan CSV/Excel."
          action={
            <Button size="lg" render={<Link href="/unggah" />}>
              Unggah Data Ulasan
              <ArrowRight className="size-4" />
            </Button>
          }
        />
        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {[
            {
              icon: ChartDonut,
              title: "Proporsi sentimen",
              desc: "Jumlah dan sebaran ulasan positif, netral, dan negatif dalam satu dashboard.",
            },
            {
              icon: Tag,
              title: "Analisis berbasis aspek",
              desc: "Aspek pelayanan, kebersihan, harga, dan lainnya dikenali otomatis dari setiap ulasan.",
            },
            {
              icon: ChartLineUp,
              title: "Pantau tren antar periode",
              desc: "Bandingkan hasil analisis antar periode untuk melihat arah perbaikan layanan.",
            },
          ].map((item, i) => (
            <div
              key={item.title}
              className="reveal rounded-xl border border-border bg-card px-6 py-5"
              style={{ animationDelay: `${i * 70}ms` }}
            >
              <item.icon className="size-6 text-primary" weight="duotone" />
              <h3 className="mt-3 text-sm font-semibold">{item.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!aktif) return null;

  return (
    <div>
      <PageHeader
        title="Analisis Sentimen Ulasan"
        description={namaRS}
      >
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" disabled={syncLoading} className="gap-2">
              <ArrowsClockwise className={cn("size-4", syncLoading && "animate-spin")} weight="duotone" />
              <span>Tarik Data</span>
              <CaretDown className="size-3.5 opacity-70" weight="bold" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuLabel>Periode Penarikan</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => handleSync("1d")} className="cursor-pointer">
              1 Hari
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleSync("1w")} className="cursor-pointer">
              1 Minggu
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleSync("1m")} className="cursor-pointer">
              1 Bulan
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleSync("1y")} className="cursor-pointer">
              1 Tahun
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <Button
          variant="outline"
          size="sm"
          disabled={aksiJalan || (Array.isArray(daftar) && daftar.some((a) => a.status === "berjalan"))}
          onClick={bersihkanSemua}
          className={cn("gap-2", konfirmasi === "bersihkan" && "border-destructive/50 text-destructive")}
        >
          <Broom className="size-4" weight="duotone" />
          <span>{konfirmasi === "bersihkan" ? "Yakin? Klik lagi" : "Bersihkan Data"}</span>
        </Button>
      </PageHeader>

      {pesanAksi && (
        <div className="reveal mb-6 flex items-center gap-2.5 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-900">
          <WarningCircle className="size-4 shrink-0" weight="duotone" />
          {pesanAksi}
        </div>
      )}

      {pesanSukses && (
        <div className="reveal mb-6 flex items-center gap-2.5 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
          <CheckCircle className="size-4 shrink-0 text-emerald-600" weight="duotone" />
          {pesanSukses}
        </div>
      )}

      {notifSelesai && (
        <div className="reveal mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 rounded-xl border border-emerald-300 bg-emerald-50/95 p-4 shadow-sm text-emerald-950">
          <div className="flex items-center gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white shadow-sm">
              <CheckCircle className="size-6" weight="fill" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-semibold text-emerald-950">
                  Analisis Ulasan Selesai!
                </h4>
                <Badge variant="default" className="bg-emerald-600 hover:bg-emerald-600 text-[10px] text-white">
                  Selesai
                </Badge>
              </div>
              <p className="text-xs text-emerald-900/85 mt-0.5">
                Sebanyak <span className="font-semibold text-emerald-950">{notifSelesai.totalUlasan} ulasan</span> telah selesai dianalisis dalam waktu <span className="font-semibold font-mono bg-emerald-200/70 px-1.5 py-0.5 rounded text-emerald-950">{notifSelesai.durasi}</span>.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
            <Button
              size="sm"
              variant="outline"
              className="h-8 border-emerald-300 bg-white/85 text-xs text-emerald-800 hover:bg-emerald-100 hover:text-emerald-900"
              onClick={() => setNotifSelesai(null)}
            >
              Tutup Notifikasi
            </Button>
          </div>
        </div>
      )}

      {aktif.status !== "selesai" && (
        <div className="reveal mb-6 rounded-xl border border-border bg-card px-6 py-5 space-y-4">
          {aktif.status === "gagal" ? (
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <WarningCircle className="mt-0.5 size-5 shrink-0 text-rose-600" weight="duotone" />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-rose-900">Proses analisis gagal</p>
                  {aktif.catatan && <p className="mt-1 text-sm text-rose-800/80 leading-relaxed">{aktif.catatan}</p>}
                </div>
                <Badge variant="destructive" className="shrink-0 text-[10px]">Gagal</Badge>
              </div>
              <div className="flex flex-wrap gap-2 pt-1">
                <Button size="sm" variant="outline" onClick={prosesUlangDenganAI} disabled={prosesUlangJalan} className="gap-2">
                  {prosesUlangJalan ? (
                    <SpinnerGap className="size-3.5 animate-spin" weight="duotone" />
                  ) : (
                    <ArrowsClockwise className="size-3.5" weight="duotone" />
                  )}
                  Coba analisis ulang
                </Button>
              </div>
              {pesanProsesUlang && (
                <p className="text-xs font-medium text-rose-700 pl-0.5">{pesanProsesUlang}</p>
              )}
            </div>
          ) : aktif.status === "berhenti" ? (
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <StopCircle className="mt-0.5 size-5 shrink-0 text-amber-600" weight="duotone" />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-amber-900">Analisis dihentikan</p>
                  {aktif.catatan && <p className="mt-1 text-sm text-amber-800/80 leading-relaxed">{aktif.catatan}</p>}
                </div>
                <Badge variant="warning" className="shrink-0">Dihentikan</Badge>
              </div>
              <Button size="sm" variant="outline" onClick={prosesUlangDenganAI} disabled={prosesUlangJalan} className="gap-2">
                {prosesUlangJalan ? (
                  <SpinnerGap className="size-3.5 animate-spin" weight="duotone" />
                ) : (
                  <ArrowsClockwise className="size-3.5" weight="duotone" />
                )}
                Proses ulang dengan AI
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Progress header */}
              <div className="flex items-center gap-2.5">
                <SpinnerGap className="size-4 animate-spin text-primary shrink-0" weight="duotone" />
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium">
                    {aktif.status === "berjalan"
                      ? `Menganalisis ${aktif.ulasanDiproses} dari ${aktif.totalUlasan} ulasan`
                      : "Menunggu proses analisis dimulai"}
                  </span>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  {aktif.status === "berjalan" && elapsedDetik > 0 && (
                    <span className="font-mono text-xs text-muted-foreground tabular-nums">
                      {String(Math.floor(elapsedDetik / 60)).padStart(2, "0")}:{String(elapsedDetik % 60).padStart(2, "0")}
                    </span>
                  )}
                  <Badge variant="default" className="text-[10px]">Berjalan</Badge>
                </div>
              </div>

              {/* Progress bar + percentage */}
              <div className="space-y-1.5">
                <Progress value={aktif.totalUlasan > 0 ? (aktif.ulasanDiproses / aktif.totalUlasan) * 100 : 0} />
                {aktif.totalUlasan > 0 && (
                  <div className="flex items-center justify-between text-[11px] text-muted-foreground tabular-nums">
                    <span>{aktif.ulasanDiproses} selesai</span>
                    <span>{Math.round((aktif.ulasanDiproses / aktif.totalUlasan) * 100)}% — sisa {aktif.totalUlasan - aktif.ulasanDiproses} ulasan</span>
                  </div>
                )}
              </div>

              {/* Action buttons */}
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" render={<Link href={`/unggah?lanjut=${aktif.id}`} />}>
                  Lihat proses unggah
                </Button>
                {aktif.status === "berjalan" && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={hentikanAnalisis}
                    disabled={hentikanJalan}
                    className="border-amber-300/70 text-amber-700 hover:bg-amber-50 hover:text-amber-800"
                  >
                    {hentikanJalan ? (
                      <SpinnerGap className="size-3.5 animate-spin" weight="duotone" />
                    ) : (
                      <StopCircle className="size-3.5" weight="duotone" />
                    )}
                    {hentikanJalan ? "Menghentikan…" : "Hentikan analisis"}
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* Activity Log Panel */}
          {logAktivitas.length > 0 && (
            <div className="border-t border-border pt-4">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Log Aktivitas</p>
              <div className="space-y-1 max-h-36 overflow-y-auto pr-1">
                {logAktivitas.map((log, i) => (
                  <div key={i} className="flex items-start gap-2.5 text-[11px]">
                    <span className="font-mono text-muted-foreground/60 shrink-0 tabular-nums">{log.waktu}</span>
                    <span className={cn(
                      "leading-relaxed",
                      log.tipe === "sukses" && "text-emerald-700",
                      log.tipe === "error" && "text-rose-700",
                      log.tipe === "peringatan" && "text-amber-700",
                      log.tipe === "info" && "text-foreground/70"
                    )}>
                      {log.pesan}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {aktif.status === "selesai" && (
        <>
          {catatanPeringatan && (
            <div className="reveal mb-6 rounded-xl border border-amber-200 bg-amber-50 px-6 py-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-start gap-3">
                  <Info className="mt-0.5 size-4 shrink-0 text-amber-700" weight="duotone" />
                  <p className="text-sm leading-relaxed text-amber-900">{catatanPeringatan}</p>
                </div>
                <Button size="sm" variant="outline" onClick={prosesUlangDenganAI} disabled={prosesUlangJalan}>
                  {prosesUlangJalan ? (
                    <SpinnerGap className="size-4 animate-spin" weight="duotone" />
                  ) : (
                    <ArrowsClockwise className="size-4" />
                  )}
                  Proses ulang dengan AI
                </Button>
              </div>
              {pesanProsesUlang && (
                <p className="mt-2 pl-7 text-sm font-medium text-rose-700">{pesanProsesUlang}</p>
              )}
            </div>
          )}

          {durasiTercatat && !notifSelesai && (
            <div className="mb-4 flex items-center gap-2 text-xs text-muted-foreground">
              <Clock className="size-3.5 text-emerald-600" weight="bold" />
              <span>Waktu pengerjaan analisis: <strong className="font-mono text-emerald-950 font-semibold">{durasiTercatat}</strong></span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <Stat
              label="Total Ulasan"
              value={aktif.totalUlasan}
              sub={durasiTercatat ? `dianalisis dlm ${durasiTercatat}` : "seluruh data terunggah"}
              index={0}
            />
            <Stat
              label="Positif"
              value={aktif.totalPositif}
              sub={persen(aktif.totalPositif, totalTerlabel)}
              index={1}
              className="border-emerald-200/70"
            />
            <Stat
              label="Netral"
              value={aktif.totalNetral}
              sub={persen(aktif.totalNetral, totalTerlabel)}
              index={2}
              className="border-amber-200/70"
            />
            <Stat
              label="Negatif"
              value={aktif.totalNegatif}
              sub={persen(aktif.totalNegatif, totalTerlabel)}
              index={3}
              className="border-rose-200/70"
            />
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-5">
            <div className="reveal rounded-xl border border-border bg-card py-6 lg:col-span-2" style={{ animationDelay: "120ms" }}>
              <div className="px-6">
                <h3 className="text-sm font-semibold leading-none tracking-tight">Proporsi Sentimen</h3>
                <p className="mt-1.5 text-sm text-muted-foreground">Sebaran sentimen dari seluruh ulasan terlabel.</p>
              </div>
              <div className="mt-6 px-6">
                <SentimenDonut
                  positif={aktif.totalPositif}
                  negatif={aktif.totalNegatif}
                  netral={aktif.totalNetral}
                />
                <div className="mt-3 flex justify-center gap-5 text-xs text-muted-foreground">
                  <Legenda warna="bg-emerald-500" label="Positif" />
                  <Legenda warna="bg-amber-400" label="Netral" />
                  <Legenda warna="bg-rose-500" label="Negatif" />
                </div>
              </div>
            </div>

            <div className="reveal rounded-xl border border-border bg-card py-6 lg:col-span-3" style={{ animationDelay: "180ms" }}>
              <div className="px-6">
                <h3 className="text-sm font-semibold leading-none tracking-tight">Kondisi Umum Layanan</h3>
                <p className="mt-1.5 text-xs text-muted-foreground">Dashboard kondisi layanan berdasarkan hasil analisis.</p>
              </div>
              <div className="mt-6 px-6">
                <p className="text-[15px] leading-relaxed">
                  {aktif.kondisiUmum ?? "Dashboard kondisi umum belum tersedia."}
                </p>
                <div className="mt-6 space-y-2 text-sm">
                  <BarisRingkas label="Ulasan tanpa label sentimen" nilai={String(aktif.totalUlasan - totalTerlabel)} />
                  <BarisRingkas label="Sumber label" nilai="AI Gateway + fallback rating" />
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6 reveal rounded-xl border border-border bg-card py-6" style={{ animationDelay: "200ms" }}>
            <div className="px-6">
              <h3 className="text-sm font-semibold leading-none tracking-tight">Grafik Tren Sentimen</h3>
              <p className="mt-1.5 text-xs text-muted-foreground">
                Persentase sentimen harian berdasarkan tanggal asli setiap review.
              </p>
            </div>
            <div className="mt-6 px-6">
              {dataGrafik.length === 0 ? (
                <p className="py-8 text-center text-xs text-muted-foreground">
                  Belum ada analisis yang selesai untuk digambarkan.
                </p>
              ) : (
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={dataGrafik}>
                      <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.92 0.004 286.32)" />
                      <XAxis dataKey="label" fontSize={11} tickLine={false} axisLine={false} minTickGap={24} />
                      <YAxis fontSize={11} tickLine={false} axisLine={false} unit="%" domain={[0, 100]} />
                      <Tooltip formatter={(value) => `${value}%`} contentStyle={{ borderRadius: 12, fontSize: 11, border: "1px solid oklch(0.92 0.004 286.32)" }} />
                      <Legend />
                      <Line type="monotone" dataKey="Positif" stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} />
                      <Line type="monotone" dataKey="Negatif" stroke="#f43f5e" strokeWidth={2} dot={{ r: 3 }} />
                      <Line type="monotone" dataKey="Netral" stroke="#f59e0b" strokeWidth={2} strokeDasharray="5 4" dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </div>

          {selesaiUrutWaktu.length >= 2 && (
            <div className="mt-6 reveal rounded-xl border border-border bg-card py-6" style={{ animationDelay: "240ms" }}>
              <div className="px-6">
                <h3 className="text-sm font-semibold leading-none tracking-tight">Perbandingan Periode</h3>
                <p className="mt-1.5 text-xs text-muted-foreground">Pilih dua periode untuk melihat selisih jumlah sentimen.</p>
              </div>
              <div className="mt-6 space-y-4 px-6">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5 text-xs">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Periode awal</span>
                    <PeriodeSelect daftar={selesaiUrutWaktu} dipilih={periodeA} onChange={setPeriodeA} />
                  </div>
                  <div className="space-y-1.5 text-xs">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Periode pembanding</span>
                    <PeriodeSelect daftar={selesaiUrutWaktu} dipilih={periodeB} onChange={setPeriodeB} />
                  </div>
                </div>

                {itemA && itemB && (
                  <div className="grid gap-4 sm:grid-cols-3">
                    <KartuSelisih label="Positif" awal={itemA.totalPositif} akhir={itemB.totalPositif} baikJikaNaik index={0} />
                    <KartuSelisih label="Netral" awal={itemA.totalNetral} akhir={itemB.totalNetral} netral index={1} />
                    <KartuSelisih label="Negatif" awal={itemA.totalNegatif} akhir={itemB.totalNegatif} index={2} />
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {[
              { icon: Chats, label: "Daftar Ulasan", desc: "Telusuri dan saring ulasan", href: "/ulasan" },
              { icon: Tag, label: "Analisis Aspek", desc: "Aspek yang perlu diperbaiki", href: "/aspek" },
              { icon: Download, label: "Ekspor Laporan", desc: "Unduh laporan PDF / Excel", href: "/export" },
            ].map((item, i) => (
              <Link
                key={item.href}
                href={item.href}
                className="reveal group flex items-center gap-4 rounded-xl border border-border bg-card px-6 py-4 transition-colors hover:bg-accent/60"
                style={{ animationDelay: `${280 + i * 60}ms` }}
              >
                <item.icon className="size-5 text-primary" weight="duotone" />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold">{item.label}</div>
                  <div className="truncate text-xs text-muted-foreground">{item.desc}</div>
                </div>
                <ArrowRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function PeriodeSelect({
  daftar,
  dipilih,
  onChange,
}: {
  daftar: AnalisisItem[];
  dipilih: number | null;
  onChange: (id: number) => void;
}) {
  if (daftar.length === 0) {
    return (
      <Select disabled>
        <SelectTrigger className="w-full h-9 text-xs">
          <SelectValue placeholder="Belum ada periode selesai" />
        </SelectTrigger>
      </Select>
    );
  }

  return (
    <Select
      value={dipilih ? String(dipilih) : ""}
      onValueChange={(val) => onChange(Number(val))}
    >
      <SelectTrigger className="w-full bg-card shadow-xs h-9 text-xs">
        <SelectValue placeholder="Pilih Periode" />
      </SelectTrigger>
      <SelectContent align="start">
        {daftar.map((item) => (
          <SelectItem key={item.id} value={String(item.id)}>
            {formatTanggal(item.tanggalUnggah)} · {item.namaFile}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function KartuSelisih({
  label,
  awal,
  akhir,
  baikJikaNaik = false,
  netral = false,
  index = 0,
}: {
  label: string;
  awal: number;
  akhir: number;
  baikJikaNaik?: boolean;
  netral?: boolean;
  index?: number;
}) {
  const selisih = akhir - awal;
  const naik = selisih > 0;
  const turun = selisih < 0;

  const arahWarna = netral
    ? "text-muted-foreground"
    : naik
      ? baikJikaNaik
        ? "text-emerald-600"
        : "text-rose-600"
      : turun
        ? baikJikaNaik
          ? "text-rose-600"
          : "text-emerald-600"
        : "text-muted-foreground";

  return (
    <div className="reveal rounded-xl border border-border bg-background/60 px-5 py-4" style={{ animationDelay: `${index * 60}ms` }}>
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <div className="mt-2 font-mono text-xl font-bold tabular-nums">
        {awal} <span className="text-muted-foreground text-sm font-normal">→</span> {akhir}
      </div>
      <p className={cn("mt-1 flex items-center gap-1 text-xs font-semibold", arahWarna)}>
        {selisih === 0 ? (
          <>
            <Minus className="size-3.5" /> Tidak berubah
          </>
        ) : naik ? (
          <>
            <ArrowUpRight className="size-3.5" /> +{selisih}
          </>
        ) : (
          <>
            <ArrowDownRight className="size-3.5" /> {selisih}
          </>
        )}
      </p>
    </div>
  );
}

function persen(nilai: number, total: number): string {
  if (total === 0) return "0% dari ulasan terlabel";
  return `${Math.round((nilai / total) * 100)}% dari ulasan terlabel`;
}

function Legenda({ warna, label }: { warna: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={`size-2.5 rounded-full ${warna}`} />
      {label}
    </span>
  );
}

function BarisRingkas({ label, nilai }: { label: string; nilai: string }) {
  return (
    <div className="flex items-center justify-between border-b border-border pb-2 last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-mono font-medium tabular-nums">{nilai}</span>
    </div>
  );
}
