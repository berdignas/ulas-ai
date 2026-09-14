"use client";

import Link from "next/link";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  ArrowRight,
  ArrowsClockwise,
  CaretRight,
  CheckCircle,
  FileCsv,
  SpinnerGap,
  StopCircle,
  UploadSimple,
} from "@phosphor-icons/react";
import { PageHeader } from "@/components/page-header";
import { ErrorState } from "@/components/states";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { formatTanggal, type ParsedPreview } from "@/lib/types";

type Tahap = "pilih" | "pratinjau" | "berjalan" | "selesai" | "gagal" | "berhenti" | "duplikat";

interface HasilUpload {
  id: number;
  namaFile: string;
  totalUlasan: number;
  kolomTerdeteksi: { nama: string | null; rating: string | null; teks: string | null; tanggal: string | null };
  pratinjau: ParsedPreview[];
  sudahAda?: boolean;
  namaFileLama?: string;
  status?: string;
}

export default function UnggahPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-64 items-center justify-center text-muted-foreground">
          <SpinnerGap className="size-5 animate-spin" weight="duotone" />
        </div>
      }
    >
      <UnggahInner />
    </Suspense>
  );
}

function UnggahInner() {
  const searchParams = useSearchParams();
  const lanjutId = searchParams.get("lanjut");

  const [tahap, setTahap] = useState<Tahap>(() =>
    lanjutId && Number.isFinite(Number(lanjutId)) ? "berjalan" : "pilih"
  );
  const [hasil, setHasil] = useState<HasilUpload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [unggahBerjalan, setUnggahBerjalan] = useState(false);
  const [progres, setProgres] = useState({ diproses: 0, total: 0 });
  const [berhentiJalan, setBerhentiJalan] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const idAktif = hasil?.id ?? (lanjutId && Number.isFinite(Number(lanjutId)) ? Number(lanjutId) : null);

  const berhentiPolling = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const pantauStatus = useCallback(
    (id: number) => {
      berhentiPolling();
      timerRef.current = setInterval(async () => {
        try {
          const res = await fetch(`/api/analisis/${id}/status`);
          if (!res.ok) return;
          const data = await res.json();
          setProgres({ diproses: data.ulasanDiproses, total: data.totalUlasan });
          if (data.status === "selesai") {
            berhentiPolling();
            try { localStorage.removeItem(`analisis-timer-${id}`); } catch {}
            setTahap("selesai");
          } else if (data.status === "gagal") {
            berhentiPolling();
            try { localStorage.removeItem(`analisis-timer-${id}`); } catch {}
            setError(data.catatan ?? "Proses analisis gagal.");
            setTahap("gagal");
          } else if (data.status === "berhenti") {
            berhentiPolling();
            try { localStorage.removeItem(`analisis-timer-${id}`); } catch {}
            setBerhentiJalan(false);
            setTahap("berhenti");
          }
        } catch {
          // jaringan belum siap; coba lagi pada interval berikutnya
        }
      }, 1500);
    },
    [berhentiPolling]
  );

  useEffect(() => {
    if (lanjutId) {
      const id = Number(lanjutId);
      if (Number.isFinite(id)) {
        pantauStatus(id);
      }
    }
    return berhentiPolling;
  }, [lanjutId, pantauStatus, berhentiPolling]);

  const pilihFile = async (file: File) => {
    setError(null);
    setUnggahBerjalan(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      let data: any = null;
      try {
        data = await res.json();
      } catch {
        // Non-JSON response
      }
      if (!res.ok) {
        setError(data?.error ?? data?.message ?? `Gagal mengunggah file (Status ${res.status}).`);
        setTahap("pilih");
        return;
      }
      setHasil(data);
      if (data.sudahAda) {
        setTahap("duplikat");
      } else {
        setTahap("pratinjau");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal terhubung ke server.");
      setTahap("pilih");
    } finally {
      setUnggahBerjalan(false);
    }
  };

  const hentikanAnalisis = async () => {
    if (idAktif === null || berhentiJalan) return;
    setBerhentiJalan(true);
    try {
      await fetch(`/api/analisis/${idAktif}/stop`, { method: "POST" });
    } catch (err) {
      setBerhentiJalan(false);
      setError(err instanceof Error ? err.message : "Gagal terhubung ke server.");
    }
  };

  const mulaiAnalisis = async () => {
    if (!hasil) return;
    setError(null);
    setBerhentiJalan(false);
    try {
      const res = await fetch(`/api/analisis/${hasil.id}/process`, { method: "POST" });
      let data: any = null;
      try {
        data = await res.json();
      } catch {
        // Non-JSON response
      }
      if (!res.ok) {
        setError(data?.error ?? data?.message ?? "Gagal memulai analisis.");
        return;
      }
      setProgres({ diproses: 0, total: hasil.totalUlasan });
      setTahap("berjalan");
      try {
        localStorage.setItem(`analisis-timer-${hasil.id}`, String(Date.now()));
      } catch {}
      pantauStatus(hasil.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal terhubung ke server.");
    }
  };

  const ulangi = () => {
    berhentiPolling();
    setHasil(null);
    setError(null);
    setProgres({ diproses: 0, total: 0 });
    setTahap("pilih");
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <div>
      <PageHeader
        title="Unggah Data"
        description="Unggah file CSV atau Excel berisi ulasan Google Maps, periksa pratinjau, lalu mulai analisis."
      />

      {error && tahap !== "gagal" && (
        <div className="reveal mb-6">
          <ErrorState message={error} />
        </div>
      )}

      {tahap === "pilih" && (
        <label
          className={cn(
            "reveal flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-border bg-card px-6 py-20 text-center transition-colors duration-200",
            unggahBerjalan ? "opacity-80" : "hover:border-primary/40 hover:bg-accent/40"
          )}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const file = e.dataTransfer.files[0];
            if (file) pilihFile(file);
          }}
        >
          <input
            ref={inputRef}
            type="file"
            accept=".csv,.txt,.xlsx,.xls"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) pilihFile(file);
            }}
          />
          <div className="mb-4 flex size-12 items-center justify-center rounded-full bg-secondary">
            {unggahBerjalan ? (
              <SpinnerGap className="size-6 animate-spin text-primary" weight="duotone" />
            ) : (
              <FileCsv className="size-6 text-muted-foreground" weight="duotone" />
            )}
          </div>
          <h3 className="text-lg font-semibold tracking-tight">
            {unggahBerjalan ? "Membaca file…" : "Pilih atau tarik file ke sini"}
          </h3>
          <p className="mt-1.5 max-w-md text-sm leading-relaxed text-muted-foreground">
            Format yang didukung: CSV, XLSX, XLS. Kolom nama pengulas, rating, teks ulasan, dan tanggal
            dikenali otomatis.
          </p>
          <span className="mt-6 inline-flex h-9 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground shadow-xs">
            <UploadSimple className="size-4" /> Pilih Berkas
          </span>
        </label>
      )}

      {tahap === "pratinjau" && hasil && (
        <div className="reveal space-y-6">
          <div className="rounded-xl border border-border bg-card py-6">
            <div className="flex flex-col gap-1.5 px-6 md:flex-row md:items-center md:justify-between">
              <div>
                <h3 className="text-sm font-semibold leading-none tracking-tight">Pratinjau Data</h3>
                <p className="mt-1.5 text-sm text-muted-foreground">
                  {hasil.totalUlasan} ulasan terbaca dari {hasil.namaFile}
                </p>
              </div>
              <Badge variant="secondary" className="font-mono">
                {hasil.totalUlasan} baris
              </Badge>
            </div>
            <div className="mt-6 grid gap-2 px-6 text-sm sm:grid-cols-2">
              <InfoKolom label="Kolom nama pengulas" nilai={hasil.kolomTerdeteksi.nama} />
              <InfoKolom label="Kolom rating" nilai={hasil.kolomTerdeteksi.rating} />
              <InfoKolom label="Kolom teks ulasan" nilai={hasil.kolomTerdeteksi.teks} />
              <InfoKolom label="Kolom tanggal" nilai={hasil.kolomTerdeteksi.tanggal} />
            </div>
            <div className="mt-6 px-6">
              <div className="overflow-hidden rounded-lg border border-border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-36">Pengulas</TableHead>
                      <TableHead className="w-16">Rating</TableHead>
                      <TableHead>Ulasan</TableHead>
                      <TableHead className="w-28">Tanggal</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {hasil.pratinjau.map((item, i) => (
                      <TableRow key={i}>
                        <TableCell className="text-muted-foreground">{item.namaPengulas ?? "-"}</TableCell>
                        <TableCell className="font-mono tabular-nums">{item.rating ?? "-"}</TableCell>
                        <TableCell className="max-w-md truncate whitespace-normal">{item.teksUlasan}</TableCell>
                        <TableCell className="text-muted-foreground">{formatTanggal(item.tanggalUlasan)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
            <div className="mt-6 flex flex-wrap gap-2 px-6">
              <Button onClick={mulaiAnalisis}>
                <CaretRight className="size-4" /> Mulai Analisis
              </Button>
              <Button onClick={ulangi} variant="outline">
                Pilih File Lain
              </Button>
            </div>
          </div>
        </div>
      )}

      {tahap === "berjalan" && (
        <div className="reveal flex flex-col items-center rounded-xl border border-border bg-card px-6 py-20 text-center">
          <SpinnerGap className="size-9 animate-spin text-primary" weight="duotone" />
          <h3 className="mt-4 text-lg font-semibold tracking-tight">Analisis sedang berjalan</h3>
          <p className="mt-1.5 max-w-md text-sm leading-relaxed text-muted-foreground">
            Setiap ulasan dikirim ke AI Gateway untuk ditentukan sentimen dan aspeknya. Anda boleh
            meninggalkan halaman ini; hasil akan tersedia di dashboard.
          </p>
          <div className="mt-8 w-full max-w-md space-y-2">
            <Progress value={progres.total > 0 ? (progres.diproses / progres.total) * 100 : 0} />
            <p className="font-mono text-xs tabular-nums text-muted-foreground">
              {progres.diproses} / {progres.total} ulasan diproses
            </p>
          </div>
          <Button
            variant="outline"
            onClick={hentikanAnalisis}
            disabled={berhentiJalan}
            className="mt-6 border-amber-300/70 text-amber-700 hover:bg-amber-50 hover:text-amber-800"
          >
            {berhentiJalan ? (
              <SpinnerGap className="size-4 animate-spin" weight="duotone" />
            ) : (
              <StopCircle className="size-4" weight="duotone" />
            )}
            {berhentiJalan ? "Menghentikan…" : "Hentikan analisis"}
          </Button>
        </div>
      )}

      {tahap === "berhenti" && (
        <div className="reveal flex flex-col items-center rounded-xl border border-amber-200 bg-amber-50/60 px-6 py-20 text-center">
          <StopCircle className="size-9 text-amber-600" weight="duotone" />
          <h3 className="mt-4 text-lg font-semibold tracking-tight text-amber-950">Analisis dihentikan</h3>
          <p className="mt-1.5 max-w-md text-sm leading-relaxed text-amber-900/80">
            Proses dihentikan setelah {progres.diproses} dari {progres.total} ulasan diproses. Hasil yang sudah
            diproses tetap tersimpan dan dapat dilanjutkan kapan saja.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
            {hasil && (
              <Button onClick={mulaiAnalisis}>
                <ArrowsClockwise className="size-4" />
                Proses Lagi
              </Button>
            )}
            <Button variant={hasil ? "outline" : "default"} render={<Link href="/" />}>
              Buka Dashboard
              <ArrowRight className="size-4" />
            </Button>
            <Button onClick={ulangi} variant="outline">
              Unggah File Lain
            </Button>
          </div>
        </div>
      )}

      {tahap === "selesai" && (
        <div className="reveal flex flex-col items-center rounded-xl border border-emerald-200 bg-emerald-50/60 px-6 py-20 text-center">
          <CheckCircle className="size-9 text-emerald-600" weight="duotone" />
          <h3 className="mt-4 text-lg font-semibold tracking-tight text-emerald-950">Analisis selesai</h3>
          <p className="mt-1.5 max-w-md text-sm leading-relaxed text-emerald-900/80">
            Hasil analisis sudah siap. Buka dashboard untuk melihat ringkasan sentimen.
          </p>
          <div className="mt-6 flex gap-2">
            <Button render={<Link href="/" />}>
              Buka Dashboard
              <ArrowRight className="size-4" />
            </Button>
            <Button onClick={ulangi} variant="outline">
              Unggah File Lain
            </Button>
          </div>
        </div>
      )}

      {tahap === "gagal" && (
        <div className="reveal">
          <ErrorState
            title="Analisis gagal"
            message={error ?? "Terjadi kesalahan saat memproses data."}
            onRetry={ulangi}
          />
        </div>
      )}

      {tahap === "duplikat" && hasil && (
        <div className="reveal rounded-xl border border-emerald-200 bg-emerald-50 px-6 py-10 text-center">
          <CheckCircle className="mx-auto size-10 text-emerald-600" weight="duotone" />
          <h3 className="mt-4 text-lg font-semibold text-emerald-950">Dataset ini sudah pernah dianalisis</h3>
          <p className="mx-auto mt-2 max-w-xl text-sm leading-relaxed text-emerald-900/80">
            Isi file sama dengan dataset <span className="font-medium">{hasil.namaFileLama}</span> (
            {hasil.totalUlasan.toLocaleString("id-ID")} ulasan)
            {hasil.status === "berjalan"
              ? " yang sedang diproses. Tidak perlu analisis ulang."
              : hasil.status === "berhenti"
                ? " yang prosesnya dihentikan sebelum selesai. Lanjutkan dari dashboard atau halaman unggah."
                : " yang sudah selesai dianalisis. Hasil dipakai kembali tanpa analisis ulang."}
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <Button size="lg" render={<Link href="/" />}>
              Lihat Hasil Analisis
              <ArrowRight className="size-4" />
            </Button>
            <Button variant="outline" onClick={ulangi}>
              Unggah File Lain
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function InfoKolom({ label, nilai }: { label: string; nilai: string | null }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-border bg-background/60 px-3 py-2">
      <span className="text-muted-foreground">{label}</span>
      <span className={cn("font-mono text-xs", nilai ? "font-medium" : "text-muted-foreground")}>
        {nilai ?? "tidak ditemukan"}
      </span>
    </div>
  );
}
