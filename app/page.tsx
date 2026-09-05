"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  ArrowsClockwise,
  Broom,
  Chats,
  ChartDonut,
  ChartLineUp,
  Info,
  SpinnerGap,
  StopCircle,
  Tag,
  Trash,
  UploadSimple,
  WarningCircle,
} from "@phosphor-icons/react";
import { PageHeader } from "@/components/page-header";
import { Stat } from "@/components/metric";
import { EmptyState, LoadingSection } from "@/components/states";
import { PilihPeriode } from "@/components/pilih-periode";
import { SentimenDonut } from "@/components/sentimen-donut";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { formatTanggalWaktu, type AnalisisItem } from "@/lib/types";

export default function DashboardPage() {
  const [daftar, setDaftar] = useState<AnalisisItem[]>([]);
  const [memuat, setMemuat] = useState(true);
  const [dipilih, setDipilih] = useState<number | null>(null);
  const [prosesUlangJalan, setProsesUlangJalan] = useState(false);
  const [pesanProsesUlang, setPesanProsesUlang] = useState<string | null>(null);
  const [hentikanJalan, setHentikanJalan] = useState(false);

  const muatDaftar = useCallback(() => {
    return fetch("/api/analisis")
      .then((res) => res.json())
      .then((data: { analisis: AnalisisItem[] }) => {
        setDaftar(data.analisis);
        return data.analisis;
      });
  }, []);

  useEffect(() => {
    fetch("/api/analisis")
      .then((res) => res.json())
      .then((data: { analisis: AnalisisItem[] }) => {
        setDaftar(data.analisis);
        const selesai = data.analisis.find((a) => a.status === "selesai");
        setDipilih(selesai?.id ?? data.analisis[0]?.id ?? null);
      })
      .finally(() => setMemuat(false));
  }, []);

  const statusAktif = daftar.find((a) => a.id === dipilih)?.status;
  useEffect(() => {
    if (statusAktif !== "berjalan") return;
    const timer = setInterval(() => {
      muatDaftar().catch(() => undefined);
    }, 2500);
    return () => clearInterval(timer);
  }, [statusAktif, muatDaftar]);

  const prosesUlangDenganAI = useCallback(async () => {
    if (dipilih === null || prosesUlangJalan) return;
    setProsesUlangJalan(true);
    setPesanProsesUlang(null);
    try {
      const res = await fetch(`/api/analisis/${dipilih}/process`, { method: "POST" });
      const data = (await res.json()) as { pakaiAI?: boolean; pesan?: string };
      if (res.ok && data.pakaiAI === false) {
        setPesanProsesUlang(data.pesan ?? "Kunci API AI belum diatur.");
      } else {
        await muatDaftar();
      }
    } catch {
      setPesanProsesUlang("Tidak dapat memulai proses ulang. Coba lagi.");
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

  const pilihSetelahHapus = useCallback((sisa: AnalisisItem[]) => {
    const selesai = sisa.find((a) => a.status === "selesai");
    setDipilih(selesai?.id ?? sisa[0]?.id ?? null);
  }, []);

  const hapusAktif = useCallback(async () => {
    if (dipilih === null || aksiJalan) return;
    if (konfirmasi !== "hapus") {
      setKonfirmasi("hapus");
      return;
    }
    setAksiJalan(true);
    setPesanAksi(null);
    try {
      const res = await fetch(`/api/analisis/${dipilih}`, { method: "DELETE" });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setPesanAksi(data.error ?? "Gagal menghapus dataset.");
        return;
      }
      const sisa = await muatDaftar();
      pilihSetelahHapus(sisa);
    } catch {
      setPesanAksi("Gagal menghapus dataset. Coba lagi.");
    } finally {
      setAksiJalan(false);
      setKonfirmasi(null);
    }
  }, [dipilih, aksiJalan, konfirmasi, muatDaftar, pilihSetelahHapus]);

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

  const aktif = useMemo(() => daftar.find((a) => a.id === dipilih) ?? null, [daftar, dipilih]);
  const totalTerlabel = aktif ? aktif.totalPositif + aktif.totalNegatif + aktif.totalNetral : 0;

  if (memuat) {
    return <LoadingSection rows={2} />;
  }

  if (daftar.length === 0) {
    return (
      <div>
        <PageHeader
          title="Analisis Sentimen Ulasan"
          description="Unggah ulasan Google Maps, lalu lihat proporsi sentimen dan aspek layanan yang perlu diperbaiki atau dipertahankan."
        />
        <EmptyState
          icon={UploadSimple}
          title="Belum ada data ulasan"
          description="Mulai dengan mengunggah file CSV atau Excel berisi ulasan Google Maps. Kolom relevan akan dideteksi otomatis."
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
        description={`Diunggah ${formatTanggalWaktu(aktif.tanggalUnggah)} · ${aktif.namaFile}`}
      >
        <PilihPeriode daftar={daftar} dipilih={dipilih} onChange={setDipilih} hanyaSelesai={false} />
        <Button
          variant="outline"
          size="sm"
          disabled={aksiJalan || aktif.status === "berjalan"}
          onClick={hapusAktif}
          className={konfirmasi === "hapus" ? "border-destructive/50 text-destructive" : ""}
        >
          {aksiJalan ? (
            <SpinnerGap className="size-4 animate-spin" weight="duotone" />
          ) : (
            <Trash className="size-4" weight="duotone" />
          )}
          {konfirmasi === "hapus" ? "Yakin? Klik lagi" : "Hapus dataset"}
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={aksiJalan || daftar.some((a) => a.status === "berjalan")}
          onClick={bersihkanSemua}
          className={konfirmasi === "bersihkan" ? "border-destructive/50 text-destructive" : ""}
        >
          <Broom className="size-4" weight="duotone" />
          {konfirmasi === "bersihkan" ? "Yakin? Klik lagi" : "Bersihkan semua"}
        </Button>
      </PageHeader>

      {pesanAksi && (
        <div className="reveal mb-6 flex items-center gap-2.5 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-900">
          <WarningCircle className="size-4 shrink-0" weight="duotone" />
          {pesanAksi}
        </div>
      )}

      {aktif.status !== "selesai" && (
        <div className="reveal mb-6 rounded-xl border border-border bg-card px-6 py-5">
          {aktif.status === "gagal" ? (
            <div className="flex items-start gap-3">
              <WarningCircle className="mt-0.5 size-5 shrink-0 text-rose-600" weight="duotone" />
              <div>
                <p className="text-sm font-semibold text-rose-900">Proses analisis gagal</p>
                {aktif.catatan && <p className="mt-1 text-sm text-rose-800/90">{aktif.catatan}</p>}
              </div>
            </div>
          ) : aktif.status === "berhenti" ? (
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <StopCircle className="mt-0.5 size-5 shrink-0 text-amber-600" weight="duotone" />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-amber-900">Analisis dihentikan</p>
                  {aktif.catatan && <p className="mt-1 text-sm text-amber-800/90">{aktif.catatan}</p>}
                </div>
                <Badge variant="warning" className="shrink-0">
                  Dihentikan
                </Badge>
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
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-2.5 text-sm">
                <SpinnerGap className="size-4 animate-spin text-primary" weight="duotone" />
                <span className="font-medium">
                  {aktif.status === "berjalan"
                    ? `Menganalisis ${aktif.ulasanDiproses} dari ${aktif.totalUlasan} ulasan…`
                    : "Menunggu proses analisis dimulai."}
                </span>
                <Badge variant="default" className="ml-auto">
                  Berjalan
                </Badge>
              </div>
              <Progress value={aktif.totalUlasan > 0 ? (aktif.ulasanDiproses / aktif.totalUlasan) * 100 : 0} />
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
                      <SpinnerGap className="size-4 animate-spin" weight="duotone" />
                    ) : (
                      <StopCircle className="size-4" weight="duotone" />
                    )}
                    {hentikanJalan ? "Menghentikan…" : "Hentikan analisis"}
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {aktif.status === "selesai" && (
        <>
          {aktif.catatan && (
            <div className="reveal mb-6 rounded-xl border border-amber-200 bg-amber-50 px-6 py-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-start gap-3">
                  <Info className="mt-0.5 size-4 shrink-0 text-amber-700" weight="duotone" />
                  <p className="text-sm leading-relaxed text-amber-900">{aktif.catatan}</p>
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

          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <Stat label="Total Ulasan" value={aktif.totalUlasan} sub="seluruh data terunggah" index={0} />
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
                <h3 className="font-semibold leading-none tracking-tight">Proporsi Sentimen</h3>
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
                <h3 className="font-semibold leading-none tracking-tight">Kondisi Umum Layanan</h3>
                <p className="mt-1.5 text-sm text-muted-foreground">Dashboard kondisi layanan berdasarkan hasil analisis.</p>
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

          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {[
              { icon: Chats, label: "Daftar Ulasan", desc: "Telusuri dan saring ulasan", href: "/ulasan" },
              { icon: Tag, label: "Analisis Aspek", desc: "Aspek yang perlu diperbaiki", href: "/aspek" },
              { icon: ChartLineUp, label: "Pemantauan Tren", desc: "Bandingkan antar periode", href: "/tren" },
            ].map((item, i) => (
              <Link
                key={item.href}
                href={item.href}
                className="reveal group flex items-center gap-4 rounded-xl border border-border bg-card px-6 py-4 transition-colors hover:bg-accent/60"
                style={{ animationDelay: `${240 + i * 60}ms` }}
              >
                <item.icon className="size-5 text-primary" weight="duotone" />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold">{item.label}</div>
                  <div className="truncate text-sm text-muted-foreground">{item.desc}</div>
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
