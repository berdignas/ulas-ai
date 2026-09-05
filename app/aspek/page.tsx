"use client";

import { useEffect, useState } from "react";
import { Info, ThumbsDown, ThumbsUp } from "@phosphor-icons/react";
import { PageHeader } from "@/components/page-header";
import { LoadingSection } from "@/components/states";
import { PilihPeriode } from "@/components/pilih-periode";
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
  const [data, setData] = useState<DataAspek | null>(null);
  const [pernahDimuat, setPernahDimuat] = useState(false);

  useEffect(() => {
    fetch("/api/analisis")
      .then((res) => res.json())
      .then((dataRes: { analisis: AnalisisItem[] }) => {
        setDaftarAnalisis(dataRes.analisis);
        const selesai = dataRes.analisis.find((a) => a.status === "selesai");
        if (selesai) setAnalisisId(selesai.id);
      });
  }, []);

  useEffect(() => {
    if (analisisId === null) return;
    let aktif = true;
    fetch(`/api/analisis/${analisisId}/aspek`)
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
  }, [analisisId]);

  const memuat = analisisId !== null && !pernahDimuat;
  const analisisAktif = daftarAnalisis.find((a) => a.id === analisisId);
  const tanpaAspek = !memuat && data && data.aspek.length === 0;

  return (
    <div>
      <PageHeader
        title="Analisis Aspek"
        description="Aspek yang paling banyak dikeluhkan perlu diperbaiki; yang paling banyak dipuji perlu dipertahankan."
      >
        <PilihPeriode daftar={daftarAnalisis} dipilih={analisisId} onChange={setAnalisisId} />
      </PageHeader>

      {memuat ? (
        <LoadingSection rows={3} />
      ) : analisisId === null ? (
        <div className="reveal rounded-xl border border-dashed border-border bg-card px-6 py-16 text-center text-sm text-muted-foreground">
          Belum ada hasil analisis yang selesai. Unggah data ulasan terlebih dahulu.
        </div>
      ) : tanpaAspek ? (
        <div className="reveal rounded-xl border border-amber-200 bg-amber-50 px-6 py-10 text-center">
          <Info className="mx-auto size-8 text-amber-600" weight="duotone" />
          <h3 className="mt-3 text-base font-semibold text-amber-950">Data aspek belum tersedia</h3>
          <p className="mx-auto mt-1.5 max-w-lg text-sm leading-relaxed text-amber-900/80">
            Pengenalan aspek layanan dilakukan oleh AI Gateway. Analisis ini diproses tanpa AI Gateway
            (fallback rating), sehingga daftar aspek kosong. Atur OPENCODE_ZEN_API_KEY lalu gunakan tombol
            &quot;Proses ulang dengan AI&quot; di halaman Beranda untuk mendapatkan analisis aspek.
          </p>
          {analisisAktif?.catatan && (
            <p className="mx-auto mt-3 max-w-lg text-xs text-amber-900/60">{analisisAktif.catatan}</p>
          )}
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
                    <h3 className="font-semibold leading-none tracking-tight">Perlu Diperbaiki</h3>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Aspek dengan keluhan terbanyak, diurutkan dari yang paling mendesak.
                    </p>
                  </div>
                </div>
                <div className="divide-y divide-border">
                  {data.perluDiperbaiki.length === 0 && (
                    <p className="px-6 py-8 text-center text-sm text-muted-foreground">
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
                    <h3 className="font-semibold leading-none tracking-tight">Perlu Dipertahankan</h3>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Aspek dengan pujian terbanyak yang menjadi kekuatan layanan.
                    </p>
                  </div>
                </div>
                <div className="divide-y divide-border">
                  {data.perluDipertahankan.length === 0 && (
                    <p className="px-6 py-8 text-center text-sm text-muted-foreground">
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
                <h3 className="font-semibold leading-none tracking-tight">Nilai Setiap Aspek</h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  Perbandingan jumlah ulasan positif dan negatif yang menyebut tiap aspek.
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] text-sm">
                  <thead>
                    <tr className="border-b border-border text-left">
                      <th className="h-10 px-6 text-xs font-medium uppercase tracking-wide text-muted-foreground">Aspek</th>
                      <th className="h-10 px-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">Positif</th>
                      <th className="h-10 px-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">Netral</th>
                      <th className="h-10 px-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">Negatif</th>
                      <th className="h-10 px-6 text-xs font-medium uppercase tracking-wide text-muted-foreground">Perbandingan</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...data.aspek]
                      .sort((a, b) => b.positif + b.negatif + b.netral - (a.positif + a.negatif + a.netral))
                      .map((item) => {
                        const totalAspek = item.positif + item.negatif + item.netral;
                        return (
                          <tr key={item.id} className="border-b border-border last:border-0">
                            <td className="px-6 py-3 font-medium capitalize">{item.namaAspek}</td>
                            <td className="px-3 py-3 font-mono tabular-nums text-emerald-600">{item.positif}</td>
                            <td className="px-3 py-3 font-mono tabular-nums text-amber-600">{item.netral}</td>
                            <td className="px-3 py-3 font-mono tabular-nums text-rose-600">{item.negatif}</td>
                            <td className="px-6 py-3">
                              <div className="flex h-2 w-44 overflow-hidden rounded-full bg-muted">
                                {totalAspek > 0 && (
                                  <>
                                    <div className="bg-emerald-500" style={{ width: `${(item.positif / totalAspek) * 100}%` }} />
                                    <div className="bg-amber-400" style={{ width: `${(item.netral / totalAspek) * 100}%` }} />
                                    <div className="bg-rose-500" style={{ width: `${(item.negatif / totalAspek) * 100}%` }} />
                                  </>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
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
          <span className="truncate text-sm font-medium capitalize">{item.namaAspek}</span>
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
