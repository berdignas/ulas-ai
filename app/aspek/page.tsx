"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { type DateRange } from "react-day-picker";
import { format } from "date-fns";
import { ChartBar, Eye, Info, MapPin, Star, ThumbsDown, ThumbsUp } from "@phosphor-icons/react";
import { PageHeader } from "@/components/page-header";
import { LoadingSection } from "@/components/states";
import { PilihPeriodeRentang } from "@/components/pilih-periode";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { analisisMemilikiHasil, formatTanggal, type AnalisisItem, type StatistikAspek, type StatistikLokasi, type UlasanLokasiItem } from "@/lib/types";

interface DataAspek {
  aspek: StatistikAspek[];
  perluDiperbaiki: StatistikAspek[];
  perluDipertahankan: StatistikAspek[];
  lokasi: StatistikLokasi[];
}

interface DetailLokasiState {
  lokasi: StatistikLokasi;
  review: UlasanLokasiItem[];
  page: number;
  total: number;
  hasMore: boolean;
  loading: boolean;
  error: string | null;
}

const JENIS_LABEL: Record<StatistikLokasi["jenis"], string> = {
  poli: "Poli",
  ruangan: "Ruangan",
  unit: "Unit",
  fasilitas: "Fasilitas",
};

function persen(nilai: number, total: number) {
  return total > 0 ? Math.round((nilai / total) * 100) : 0;
}

export default function AspekPage() {
  const [analisisId, setAnalisisId] = useState<number | null>(null);
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [data, setData] = useState<DataAspek | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailLokasi, setDetailLokasi] = useState<DetailLokasiState | null>(null);

  useEffect(() => {
    fetch("/api/analisis")
      .then((res) => res.json())
      .then((result: { analisis?: AnalisisItem[] }) => {
        const list = Array.isArray(result.analisis) ? result.analisis : [];
        const tersedia = list.find(analisisMemilikiHasil);
        setAnalisisId(tersedia?.id ?? null);
        if (!tersedia) setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (analisisId === null) {
      return;
    }
    let aktif = true;
    const params = new URLSearchParams();
    if (dateRange?.from) params.set("dari", format(dateRange.from, "yyyy-MM-dd"));
    if (dateRange?.to) params.set("sampai", format(dateRange.to, "yyyy-MM-dd"));
    const query = params.size ? `?${params}` : "";
    fetch(`/api/analisis/${analisisId}/aspek${query}`)
      .then((res) => res.json())
      .then((result: DataAspek) => {
        if (aktif) setData(result);
      })
      .catch(() => {
        if (aktif) setData(null);
      })
      .finally(() => {
        if (aktif) setLoading(false);
      });
    return () => {
      aktif = false;
    };
  }, [analisisId, dateRange]);

  const ringkasan = useMemo(() => {
    if (!data) return null;
    const evaluasi = [...data.aspek].sort((a, b) => b.negatif - a.negatif)[0];
    const pertahankan = [...data.aspek].sort((a, b) => b.positif - a.positif)[0];
    const terbanyak = [...data.lokasi].sort((a, b) => b.total - a.total)[0];
    const berisiko = [...data.lokasi]
      .filter((item) => item.total >= 3)
      .sort((a, b) => persen(b.negatif, b.total) - persen(a.negatif, a.total))[0];
    return { evaluasi, pertahankan, terbanyak, berisiko };
  }, [data]);

  const muatReviewLokasi = async (lokasi: StatistikLokasi, page = 1, append = false) => {
    setDetailLokasi((current) => ({
      lokasi,
      review: append && current?.lokasi.id === lokasi.id ? current.review : [],
      page: append && current?.lokasi.id === lokasi.id ? current.page : 0,
      total: append && current?.lokasi.id === lokasi.id ? current.total : lokasi.total,
      hasMore: append && current?.lokasi.id === lokasi.id ? current.hasMore : false,
      loading: true,
      error: null,
    }));

    const params = new URLSearchParams({ page: String(page), limit: "50" });
    if (dateRange?.from) params.set("dari", format(dateRange.from, "yyyy-MM-dd"));
    if (dateRange?.to) params.set("sampai", format(dateRange.to, "yyyy-MM-dd"));

    try {
      const response = await fetch(`/api/analisis/${analisisId}/lokasi/${lokasi.id}/ulasan?${params}`);
      const result = await response.json() as {
        review?: UlasanLokasiItem[];
        pagination?: { page: number; total: number; hasMore: boolean };
        error?: string;
      };
      if (!response.ok) throw new Error(result.error || "Gagal memuat review lokasi.");
      setDetailLokasi((current) => current?.lokasi.id === lokasi.id ? {
        ...current,
        review: append ? [...current.review, ...(result.review ?? [])] : (result.review ?? []),
        page: result.pagination?.page ?? page,
        total: result.pagination?.total ?? result.review?.length ?? 0,
        hasMore: result.pagination?.hasMore ?? false,
        loading: false,
        error: null,
      } : current);
    } catch (error) {
      setDetailLokasi((current) => current?.lokasi.id === lokasi.id ? {
        ...current,
        loading: false,
        error: error instanceof Error ? error.message : "Gagal memuat review lokasi.",
      } : current);
    }
  };

  return (
    <div>
      <PageHeader
        title="Analisis Aspek"
        description="Lihat apa yang dinilai pasien dan di poli atau ruangan mana pengalaman itu terjadi."
      >
        <PilihPeriodeRentang
          dateRange={dateRange}
          onChange={(range) => {
            setLoading(true);
            setDetailLokasi(null);
            setDateRange(range);
          }}
        />
      </PageHeader>

      {loading ? (
        <LoadingSection rows={3} />
      ) : analisisId === null ? (
        <EmptyMessage text="Belum ada hasil analisis yang selesai." />
      ) : !data || (data.aspek.length === 0 && data.lokasi.length === 0) ? (
        <EmptyMessage text="Belum ada aspek atau lokasi layanan yang terdeteksi pada periode ini." />
      ) : (
        <div className="space-y-6">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <RingkasanCard label="Perlu dievaluasi" nilai={ringkasan?.evaluasi?.namaAspek ?? "Belum ada"} meta={ringkasan?.evaluasi ? `${ringkasan.evaluasi.negatif} keluhan` : ""} tone="danger" />
            <RingkasanCard label="Perlu dipertahankan" nilai={ringkasan?.pertahankan?.namaAspek ?? "Belum ada"} meta={ringkasan?.pertahankan ? `${ringkasan.pertahankan.positif} pujian` : ""} tone="success" />
            <RingkasanCard label="Lokasi paling disebut" nilai={ringkasan?.terbanyak?.nama ?? "Belum terdeteksi"} meta={ringkasan?.terbanyak ? `${ringkasan.terbanyak.total} review` : ""} />
            <RingkasanCard label="Negatif tertinggi" nilai={ringkasan?.berisiko?.nama ?? "Data belum cukup"} meta={ringkasan?.berisiko ? `${persen(ringkasan.berisiko.negatif, ringkasan.berisiko.total)}% negatif` : "Minimal 3 review"} tone="warning" />
          </div>

          <Tabs defaultValue="aspek" className="gap-4">
            <TabsList className="h-11 w-full justify-start rounded-xl border border-border bg-card p-1 sm:w-fit">
              <TabsTrigger value="aspek" className="h-9 px-4">
                <ChartBar className="size-4" /> Aspek layanan
              </TabsTrigger>
              <TabsTrigger value="lokasi" className="h-9 px-4">
                <MapPin className="size-4" /> Poli & ruangan
              </TabsTrigger>
            </TabsList>

            <TabsContent value="aspek" className="space-y-6">
              <div className="grid gap-6 lg:grid-cols-2">
                <RankingCard title="Perlu Dievaluasi" description="Aspek baku dengan keluhan terbanyak." icon="down" items={data.perluDiperbaiki.slice(0, 5)} fokus="negatif" />
                <RankingCard title="Perlu Dipertahankan" description="Kekuatan layanan yang paling sering dipuji." icon="up" items={data.perluDipertahankan.slice(0, 5)} fokus="positif" />
              </div>
              <div className="overflow-hidden rounded-xl border border-border bg-card">
                <div className="border-b border-border px-5 py-4">
                  <h3 className="text-sm font-semibold">Ringkasan Aspek Umum</h3>
                  <p className="mt-1 text-xs text-muted-foreground">Nama serupa telah digabungkan ke dalam kategori yang konsisten.</p>
                </div>
                <Table>
                  <TableHeader><TableRow><TableHead>Aspek</TableHead><TableHead>Positif</TableHead><TableHead>Netral</TableHead><TableHead>Negatif</TableHead><TableHead>Distribusi</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {[...data.aspek].sort((a, b) => b.positif + b.negatif + b.netral - (a.positif + a.negatif + a.netral)).map((item) => {
                      const total = item.positif + item.negatif + item.netral;
                      return <TableRow key={item.id}>
                        <TableCell className="max-w-64 whitespace-normal font-medium">{item.namaAspek}</TableCell>
                        <TableCell className="font-mono text-emerald-700">{item.positif}</TableCell>
                        <TableCell className="font-mono text-amber-700">{item.netral}</TableCell>
                        <TableCell className="font-mono text-rose-700">{item.negatif}</TableCell>
                        <TableCell><DistributionBar positif={item.positif} netral={item.netral} negatif={item.negatif} total={total} /></TableCell>
                      </TableRow>;
                    })}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>

            <TabsContent value="lokasi">
              <div className="overflow-hidden rounded-xl border border-border bg-card">
                <div className="border-b border-border px-5 py-4">
                  <h3 className="text-sm font-semibold">Kinerja Poli & Ruangan</h3>
                  <p className="mt-1 text-xs text-muted-foreground">Lokasi dengan kurang dari 3 review ditandai sebagai sampel terbatas.</p>
                </div>
                {data.lokasi.length === 0 ? (
                  <EmptyMessage text="Belum ada lokasi yang cocok. Tambahkan nama dan alias di Pengaturan RS, lalu proses ulang analisis." compact />
                ) : (
                  <Table>
                    <TableHeader><TableRow><TableHead>Poli/Ruangan</TableHead><TableHead>Review</TableHead><TableHead>Positif</TableHead><TableHead>Negatif</TableHead><TableHead>Penilaian</TableHead><TableHead className="text-right">Aksi</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {data.lokasi.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell className="min-w-64 whitespace-normal">
                            <div className="flex flex-wrap items-center gap-2"><LokasiLabel lokasi={item} /><Badge variant="outline">{JENIS_LABEL[item.jenis]}</Badge></div>
                            {item.contoh[0] && <p className="mt-1.5 line-clamp-2 max-w-xl text-xs leading-5 text-muted-foreground">“{item.contoh[0]}”</p>}
                          </TableCell>
                          <TableCell className="font-mono">{item.total}</TableCell>
                          <TableCell className="font-mono text-emerald-700">{persen(item.positif, item.total)}%</TableCell>
                          <TableCell className="font-mono text-rose-700">{persen(item.negatif, item.total)}%</TableCell>
                          <TableCell>{item.total < 3 ? <Badge variant="warning">Sampel terbatas</Badge> : persen(item.negatif, item.total) >= 40 ? <Badge variant="danger">Perlu perhatian</Badge> : <Badge variant="success">Terkendali</Badge>}</TableCell>
                          <TableCell className="text-right">
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => void muatReviewLokasi(item)}
                              className="h-11 gap-2"
                              aria-label={`Lihat seluruh review ${item.nama}`}
                            >
                              <Eye className="size-4" aria-hidden="true" />
                              Lihat review
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </div>
      )}

      <Dialog open={Boolean(detailLokasi)} onOpenChange={(open) => !open && setDetailLokasi(null)}>
        <DialogContent className="max-h-[88dvh] w-[calc(100%-1.5rem)] max-w-3xl gap-0 overflow-hidden p-0 sm:rounded-2xl">
          <DialogHeader className="border-b border-border px-5 py-5 pr-14 text-left sm:px-6">
            <DialogTitle className="flex flex-wrap items-center gap-2 text-base">
              Review untuk {detailLokasi && <LokasiLabel lokasi={detailLokasi.lokasi} />}
            </DialogTitle>
            <DialogDescription>
              {detailLokasi ? `${detailLokasi.total} review terhubung dengan ${JENIS_LABEL[detailLokasi.lokasi.jenis].toLowerCase()} ini.` : "Daftar review lokasi layanan."}
            </DialogDescription>
          </DialogHeader>

          <div className="min-h-0 overflow-y-auto px-4 py-4 sm:px-6" tabIndex={0}>
            {detailLokasi?.loading && detailLokasi.review.length === 0 ? (
              <LoadingSection rows={3} />
            ) : detailLokasi?.error && detailLokasi.review.length === 0 ? (
              <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-8 text-center text-sm text-rose-800" role="alert">
                <p>{detailLokasi.error}</p>
                <Button type="button" variant="outline" className="mt-4 h-11" onClick={() => void muatReviewLokasi(detailLokasi.lokasi)}>
                  Coba lagi
                </Button>
              </div>
            ) : detailLokasi?.review.length === 0 ? (
              <p className="py-12 text-center text-sm text-muted-foreground">Tidak ada review pada periode ini.</p>
            ) : (
              <div className="space-y-3">
                {detailLokasi?.review.map((item) => (
                  <article key={item.id} className="rounded-xl border border-border bg-card p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h3 className="text-sm font-semibold">{item.namaPengulas || "Pengulas anonim"}</h3>
                        <p className="mt-1 text-xs text-muted-foreground">{formatTanggal(item.tanggalUlasan)}</p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        {item.rating !== null && (
                          <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-200">
                            <Star className="size-3.5" weight="fill" aria-hidden="true" /> {item.rating}/5
                          </span>
                        )}
                        <Badge variant={item.sentimen === "positif" ? "success" : item.sentimen === "negatif" ? "danger" : "warning"}>
                          {item.sentimen ? item.sentimen[0].toUpperCase() + item.sentimen.slice(1) : "Belum dinilai"}
                        </Badge>
                      </div>
                    </div>
                    <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-foreground">{item.teksUlasan}</p>
                    <p className="mt-3 text-[11px] text-muted-foreground">
                      Lokasi dikenali oleh {item.metode === "ai" ? "AI" : "kata kunci"}
                      {item.sumberLabel ? ` · Sentimen: ${item.sumberLabel}` : ""}
                    </p>
                  </article>
                ))}

                {detailLokasi?.error && (
                  <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800 dark:border-rose-800 dark:bg-rose-950/50 dark:text-rose-200" role="alert">{detailLokasi.error}</p>
                )}
                {detailLokasi?.hasMore && (
                  <Button
                    type="button"
                    variant="outline"
                    disabled={detailLokasi.loading}
                    className="h-11 w-full"
                    onClick={() => void muatReviewLokasi(detailLokasi.lokasi, detailLokasi.page + 1, true)}
                  >
                    {detailLokasi.loading ? "Memuat review…" : `Muat lebih banyak (${detailLokasi.review.length} dari ${detailLokasi.total})`}
                  </Button>
                )}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function LokasiLabel({ lokasi }: { lokasi: Pick<StatistikLokasi, "id" | "nama"> }) {
  const hue = Math.round((lokasi.id * 137.508) % 360);
  return (
    <span
      style={{ "--lokasi-hue": hue } as CSSProperties}
      className="inline-flex items-center gap-1.5 rounded-full border border-[hsl(var(--lokasi-hue)_55%_72%)] bg-[hsl(var(--lokasi-hue)_78%_94%)] px-2.5 py-1 text-xs font-semibold text-[hsl(var(--lokasi-hue)_62%_25%)] dark:border-[hsl(var(--lokasi-hue)_44%_35%)] dark:bg-[hsl(var(--lokasi-hue)_35%_18%)] dark:text-[hsl(var(--lokasi-hue)_72%_80%)]"
    >
      <span className="size-1.5 rounded-full bg-[hsl(var(--lokasi-hue)_68%_43%)]" aria-hidden="true" />
      {lokasi.nama}
    </span>
  );
}

function EmptyMessage({ text, compact = false }: { text: string; compact?: boolean }) {
  return <div className={cn("rounded-xl border border-dashed border-border bg-card px-6 text-center text-sm text-muted-foreground", compact ? "py-10" : "py-16")}>
    <Info className="mx-auto mb-2 size-6" weight="duotone" />{text}
  </div>;
}

function RingkasanCard({ label, nilai, meta, tone = "default" }: { label: string; nilai: string; meta: string; tone?: "default" | "danger" | "success" | "warning" }) {
  const toneClass = { default: "text-primary", danger: "text-rose-700", success: "text-emerald-700", warning: "text-amber-700" }[tone];
  return <div className="rounded-xl border border-border bg-card p-4">
    <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
    <p className="mt-2 line-clamp-2 min-h-10 text-sm font-semibold leading-5">{nilai}</p>
    <p className={cn("mt-2 text-xs font-medium", toneClass)}>{meta}</p>
  </div>;
}

function RankingCard({ title, description, icon, items, fokus }: { title: string; description: string; icon: "up" | "down"; items: StatistikAspek[]; fokus: "positif" | "negatif" }) {
  return <div className="overflow-hidden rounded-xl border border-border bg-card">
    <div className="flex gap-3 border-b border-border px-5 py-4">
      <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-lg", icon === "down" ? "bg-rose-100 text-rose-700" : "bg-emerald-100 text-emerald-700")}>
        {icon === "down" ? <ThumbsDown className="size-4" weight="duotone" /> : <ThumbsUp className="size-4" weight="duotone" />}
      </span>
      <div><h3 className="text-sm font-semibold">{title}</h3><p className="mt-1 text-xs text-muted-foreground">{description}</p></div>
    </div>
    <div className="divide-y divide-border">
      {items.length === 0 ? <p className="px-5 py-8 text-center text-xs text-muted-foreground">Belum ada data.</p> : items.map((item, index) => {
        const total = item.positif + item.negatif + item.netral;
        const nilai = fokus === "negatif" ? item.negatif : item.positif;
        const lokasiTerkait = fokus === "negatif" ? item.lokasiNegatif : item.lokasiPositif;
        return <div key={item.id} className="space-y-2 px-5 py-3.5">
          <div className="flex items-center justify-between gap-4"><span className="text-sm font-medium"><span className="mr-2 font-mono text-xs text-muted-foreground">{index + 1}.</span>{item.namaAspek}</span><span className="shrink-0 text-xs text-muted-foreground">{nilai} dari {total}</span></div>
          <div className={cn("h-1.5 rounded-full bg-muted", fokus === "negatif" ? "[&>div]:bg-rose-500" : "[&>div]:bg-emerald-500")}><div className="h-full rounded-full transition-all" style={{ width: `${persen(nilai, total)}%` }} /></div>
          {lokasiTerkait && lokasiTerkait.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 pt-0.5 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground/80">
                <MapPin className="size-3 shrink-0 text-muted-foreground" weight="bold" />
                Sering disebut di:
              </span>
              {lokasiTerkait.map((lok) => (
                <span
                  key={lok.nama}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium",
                    fokus === "negatif"
                      ? "border border-rose-200/70 bg-rose-50 text-rose-700 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-300"
                      : "border border-emerald-200/70 bg-emerald-50 text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-300"
                  )}
                >
                  <span>{lok.nama}</span>
                  <span className="font-mono text-[10px] opacity-75">({lok.total}x)</span>
                </span>
              ))}
            </div>
          )}
        </div>;
      })}
    </div>
  </div>;
}

function DistributionBar({ positif, netral, negatif, total }: { positif: number; netral: number; negatif: number; total: number }) {
  return <div className="flex h-2 w-40 overflow-hidden rounded-full bg-muted" aria-label={`${positif} positif, ${netral} netral, ${negatif} negatif`}>
    {total > 0 && <><div className="bg-emerald-500" style={{ width: `${persen(positif, total)}%` }} /><div className="bg-amber-400" style={{ width: `${persen(netral, total)}%` }} /><div className="bg-rose-500" style={{ width: `${persen(negatif, total)}%` }} /></>}
  </div>;
}
