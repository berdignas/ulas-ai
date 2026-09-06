"use client";

import { useEffect, useState } from "react";
import { type DateRange } from "react-day-picker";
import { format } from "date-fns";
import { Info, ThumbsDown, ThumbsUp } from "@phosphor-icons/react";
import { PageHeader } from "@/components/page-header";
import { LoadingSection } from "@/components/states";
import { PilihPeriodeRentang } from "@/components/pilih-periode";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import type { AnalisisItem, StatistikAspek } from "@/lib/types";

interface DataAspek {
  aspek: StatistikAspek[];
  perluDiperbaiki: StatistikAspek[];
  perluDipertahankan: StatistikAspek[];
}

export default function AspekPage() {
  const [daftarAnalisis, setDaftarAnalisis] = useState<AnalisisItem[]>([]);
  const [analisisId, setAnalisisId] = useState<number | null>(null);
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [data, setData] = useState<DataAspek | null>(null);
  const [pernahDimuat, setPernahDimuat] = useState(false);

  useEffect(() => {
    fetch("/api/analisis")
      .then((res) => res.json())
      .then((dataRes: { analisis?: AnalisisItem[] }) => {
        const list = Array.isArray(dataRes?.analisis) ? dataRes.analisis : [];
        setDaftarAnalisis(list);
        const selesai = list.find((a) => a.status === "selesai");
        if (selesai) setAnalisisId(selesai.id);
      })
      .catch(() => setDaftarAnalisis([]));
  }, []);

  useEffect(() => {
    if (analisisId === null) return;
    let aktif = true;
    const params = new URLSearchParams();
    if (dateRange?.from) params.set("dari", format(dateRange.from, "yyyy-MM-dd"));
    if (dateRange?.to) params.set("sampai", format(dateRange.to, "yyyy-MM-dd"));

    const queryStr = params.toString() ? `?${params.toString()}` : "";
    fetch(`/api/analisis/${analisisId}/aspek${queryStr}`)
      .then((res) => res.json())
      .then((hasil: DataAspek) => {
        if (!aktif) return;
        setData(hasil);
        setPernahDimuat(true);
      })
      .catch(() => {
        if (aktif) setPernahDimuat(true);
      });
    return () => {
      aktif = false;
    };
  }, [analisisId, dateRange]);

  const memuat = analisisId !== null && !pernahDimuat;
  const analisisAktif = daftarAnalisis.find((a) => a.id === analisisId);
  const tanpaAspek = !memuat && data && data.aspek.length === 0;

  return (
    <div>
      <PageHeader
        title="Analisis Aspek"
        description="Aspek yang paling banyak dikeluhkan perlu diperbaiki; yang paling banyak dipuji perlu dipertahankan."
      >
        <PilihPeriodeRentang
          dateRange={dateRange}
          onChange={setDateRange}
        />
      </PageHeader>

      {memuat ? (
        <LoadingSection rows={3} />
      ) : analisisId === null ? (
        <div className="reveal rounded-xl border border-dashed border-border bg-card px-6 py-16 text-center text-xs text-muted-foreground">
          Belum ada hasil analisis yang selesai. Unggah data ulasan terlebih dahulu.
        </div>
      ) : tanpaAspek ? (
        <div className="reveal rounded-xl border border-amber-200 bg-amber-50/80 p-6 text-center space-y-2.5">
          <Info className="mx-auto size-7 text-amber-600" weight="duotone" />
          <div className="space-y-1">
            <h3 className="text-sm font-semibold text-amber-950">Data Aspek Layanan Belum Tersedia</h3>
            <p className="mx-auto max-w-xl text-xs leading-relaxed text-amber-900/90">
              Analisis aspek spesifik memerlukan pemrosesan kecerdasan buatan (AI). Ulasan saat ini telah dikelompokkan secara otomatis berdasarkan rating. Silakan konfigurasi Model AI dan API Key di halaman Pengaturan RS untuk mengaktifkan analisis aspek secara penuh.
            </p>
          </div>
        </div>
      ) : (
        data && (
          <div className="space-y-6">
            <div className="grid gap-6 lg:grid-cols-2">
              <div className="reveal overflow-hidden rounded-xl border border-border bg-card">
                <div className="flex items-center gap-2.5 border-b border-border px-6 py-4">
                  <span className="flex size-8 items-center justify-center rounded-lg bg-rose-100">
                    <ThumbsDown className="size-4 text-rose-600" weight="duotone" />
                  </span>
                  <div>
                    <h3 className="font-semibold leading-none tracking-tight text-sm">Perlu Diperbaiki</h3>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Aspek dengan keluhan terbanyak, diurutkan dari yang paling mendesak.
                    </p>
                  </div>
                </div>
                <div className="divide-y divide-border">
                  {data.perluDiperbaiki.length === 0 && (
                    <p className="px-6 py-8 text-center text-xs text-muted-foreground">
                      Tidak ada keluhan yang terdeteksi.
                    </p>
                  )}
                  {data.perluDiperbaiki.map((item, i) => (
                    <BarisAspek key={item.id} item={item} peringkat={i + 1} fokus="negatif" index={i} />
                  ))}
                </div>
              </div>

              <div className="reveal overflow-hidden rounded-xl border border-border bg-card" style={{ animationDelay: "80ms" }}>
                <div className="flex items-center gap-2.5 border-b border-border px-6 py-4">
                  <span className="flex size-8 items-center justify-center rounded-lg bg-emerald-100">
                    <ThumbsUp className="size-4 text-emerald-600" weight="duotone" />
                  </span>
                  <div>
                    <h3 className="font-semibold leading-none tracking-tight text-sm">Perlu Dipertahankan</h3>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Aspek dengan pujian terbanyak yang menjadi kekuatan layanan.
                    </p>
                  </div>
                </div>
                <div className="divide-y divide-border">
                  {data.perluDipertahankan.length === 0 && (
                    <p className="px-6 py-8 text-center text-xs text-muted-foreground">
                      Tidak ada pujian yang terdeteksi.
                    </p>
                  )}
                  {data.perluDipertahankan.map((item, i) => (
                    <BarisAspek key={item.id} item={item} peringkat={i + 1} fokus="positif" index={i} />
                  ))}
                </div>
              </div>
            </div>

            <div className="reveal overflow-hidden rounded-xl border border-border bg-card" style={{ animationDelay: "140ms" }}>
              <div className="border-b border-border px-6 py-4">
                <h3 className="font-semibold leading-none tracking-tight text-sm">Nilai Setiap Aspek</h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  Perbandingan jumlah ulasan positif dan negatif yang menyebut tiap aspek.
                </p>
              </div>
              <Table className="text-xs">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-48">Aspek</TableHead>
                    <TableHead className="w-24">Positif</TableHead>
                    <TableHead className="w-24">Netral</TableHead>
                    <TableHead className="w-24">Negatif</TableHead>
                    <TableHead>Perbandingan</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[...data.aspek]
                    .sort((a, b) => b.positif + b.negatif + b.netral - (a.positif + a.negatif + a.netral))
                    .map((item) => {
                      const totalAspek = item.positif + item.negatif + item.netral;
                      return (
                        <TableRow key={item.id}>
                          <TableCell className="font-medium capitalize text-xs">{item.namaAspek}</TableCell>
                          <TableCell className="font-mono tabular-nums text-emerald-600 text-xs">{item.positif}</TableCell>
                          <TableCell className="font-mono tabular-nums text-amber-600 text-xs">{item.netral}</TableCell>
                          <TableCell className="font-mono tabular-nums text-rose-600 text-xs">{item.negatif}</TableCell>
                          <TableCell>
                            <div className="flex h-2 w-44 overflow-hidden rounded-full bg-muted">
                              {totalAspek > 0 && (
                                <>
                                  <div className="bg-emerald-500" style={{ width: `${(item.positif / totalAspek) * 100}%` }} />
                                  <div className="bg-amber-400" style={{ width: `${(item.netral / totalAspek) * 100}%` }} />
                                  <div className="bg-rose-500" style={{ width: `${(item.negatif / totalAspek) * 100}%` }} />
                                </>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                </TableBody>
              </Table>
            </div>
          </div>
        )
      )}
    </div>
  );
}

function BarisAspek({
  item,
  peringkat,
  fokus,
  index,
}: {
  item: StatistikAspek;
  peringkat: number;
  fokus: "positif" | "negatif";
  index: number;
}) {
  const nilaiUtama = fokus === "negatif" ? item.negatif : item.positif;
  const total = item.positif + item.negatif + item.netral;

  return (
    <div className="reveal px-6 py-4" style={{ animationDelay: `${index * 60}ms` }}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <span
            className={cn(
              "flex size-5 shrink-0 items-center justify-center rounded-full font-mono text-[10px] font-semibold",
              fokus === "negatif" ? "bg-rose-100 text-rose-700" : "bg-emerald-100 text-emerald-700"
            )}
          >
            {peringkat}
          </span>
          <span className="truncate text-xs font-semibold capitalize">{item.namaAspek}</span>
        </div>
        <span className="shrink-0 font-mono text-xs tabular-nums text-muted-foreground">
          {nilaiUtama} {fokus === "negatif" ? "keluhan" : "pujian"} · {total} penyebutan
        </span>
      </div>
      <div className="mt-2.5 flex h-1.5 w-full overflow-hidden rounded-full bg-muted">
        {total > 0 && (
          <>
            <div className="bg-emerald-500" style={{ width: `${(item.positif / total) * 100}%` }} />
            <div className="bg-amber-400" style={{ width: `${(item.netral / total) * 100}%` }} />
            <div className="bg-rose-500" style={{ width: `${(item.negatif / total) * 100}%` }} />
          </>
        )}
      </div>
    </div>
  );
}
