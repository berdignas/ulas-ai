"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import type { summarizeHospital } from "@/lib/hospital-summary";

type HospitalSummary = ReturnType<typeof summarizeHospital> & { namaRumahSakit: string };

export function KondisiLayanan({ rumahSakitId, revision }: { rumahSakitId: number | null; revision: string }) {
  const [summary, setSummary] = useState<HospitalSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    if (!rumahSakitId) return;
    const controller = new AbortController();
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/kondisi-layanan?rumahSakitId=${rumahSakitId}`, {
          cache: "no-store", signal: controller.signal,
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Ringkasan layanan gagal dimuat.");
        if (!controller.signal.aborted) setSummary(data);
      } catch (err) {
        if (!controller.signal.aborted) {
          setSummary(null);
          setError(err instanceof Error ? err.message : "Ringkasan layanan gagal dimuat.");
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void load();
    return () => controller.abort();
  }, [rumahSakitId, revision, refresh]);

  return (
    <section aria-labelledby="kondisi-layanan-title" className="rounded-xl border border-border bg-card p-4 sm:p-6 lg:col-span-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3 id="kondisi-layanan-title" className="text-sm font-semibold">Kondisi Umum Layanan</h3>
          <p className="mt-1.5 text-xs text-muted-foreground">Ringkasan penilaian rumah sakit dari ulasan yang tersimpan, termasuk unggahan dan sinkronisasi.</p>
        </div>
        <Button type="button" variant="outline" size="sm" disabled={loading || !rumahSakitId}
          onClick={() => setRefresh((value) => value + 1)} className="min-h-11">
          Perbarui ringkasan
        </Button>
      </div>
      <div className="mt-5" aria-live="polite" aria-busy={loading && Boolean(rumahSakitId)}>
        {!rumahSakitId && <p className="text-sm text-muted-foreground">Pilih atau tambahkan rumah sakit untuk melihat ringkasan penilaian.</p>}
        {loading && rumahSakitId && <p className="text-sm text-muted-foreground">Memuat penilaian, pujian, dan keluhan dari data ulasan...</p>}
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        {!loading && summary && (
          <>
            <div className="space-y-3 text-sm leading-relaxed">
              {summary.paragraphs.map((paragraph, index) => <p key={index}>{paragraph}</p>)}
            </div>
            {summary.examples.length > 0 && (
              <details className="mt-5 border-t border-border pt-4 text-sm">
                <summary className="min-h-11 cursor-pointer rounded-md py-2 font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  Lihat contoh ulasan yang mendasari penilaian
                </summary>
                <div className="mt-3 space-y-4">
                  {summary.examples.map((example) => (
                    <blockquote key={example.id} className="space-y-1">
                      <p className="text-xs font-medium capitalize text-muted-foreground">Contoh ulasan {example.sentimen}</p>
                      <p className="break-words text-sm leading-relaxed">“{example.teks}”</p>
                    </blockquote>
                  ))}
                </div>
              </details>
            )}
            <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
              Ringkasan mencerminkan pengalaman pengulas pada data yang tersedia. Jumlah per aspek dapat tumpang tindih karena satu ulasan bisa membahas beberapa aspek. Rata-rata rating dihitung dari data tersimpan.
            </p>
          </>
        )}
      </div>
    </section>
  );
}
