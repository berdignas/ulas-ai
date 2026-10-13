"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Period = {
  dari: string;
  sampai: string;
  total: number;
  positif: number;
  netral: number;
  negatif: number;
  belumDianalisis: number;
};
type Comparison = { awal: Period; pembanding: Period; zonaWaktu: string };

function dateLabel(value: string) {
  return new Date(`${value}T00:00:00Z`).toLocaleDateString("id-ID", {
    day: "numeric", month: "short", year: "numeric", timeZone: "UTC",
  });
}

export function PerbandinganPeriode({ rumahSakitId }: { rumahSakitId: number | null }) {
  const [dates, setDates] = useState({ awalDari: "", awalSampai: "", pembandingDari: "", pembandingSampai: "" });
  const [result, setResult] = useState<Comparison | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const request = useRef<AbortController | null>(null);

  useEffect(() => () => request.current?.abort(), []);

  function changeDate(key: keyof typeof dates, value: string) {
    request.current?.abort();
    setDates((current) => ({ ...current, [key]: value }));
    setResult(null);
    setError(null);
    setLoading(false);
  }

  async function compare(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!rumahSakitId) return;
    if (dates.awalDari > dates.awalSampai || dates.pembandingDari > dates.pembandingSampai) {
      setError("Tanggal mulai tidak boleh melewati tanggal akhir.");
      return;
    }
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setLoading(true);
    setResult(null);
    setError(null);
    try {
      const params = new URLSearchParams({ rumahSakitId: String(rumahSakitId), ...dates });
      const response = await fetch(`/api/perbandingan-periode?${params}`, { cache: "no-store", signal: controller.signal });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Perbandingan gagal dimuat.");
      if (!controller.signal.aborted) setResult(data);
    } catch (err) {
      if (!controller.signal.aborted) setError(err instanceof Error ? err.message : "Perbandingan gagal dimuat. Silakan coba lagi.");
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }

  return (
    <section aria-labelledby="perbandingan-title" className="mt-6 rounded-xl border border-border bg-card p-4 sm:p-6">
      <h3 id="perbandingan-title" className="text-sm font-semibold">Perbandingan Periode</h3>
      <p className="mt-1.5 text-xs text-muted-foreground">
        Bandingkan sentimen ulasan Google Maps berdasarkan tanggal ulasan. Data unggahan manual tidak disertakan.
      </p>
      <form onSubmit={compare} className="mt-5 space-y-4">
        <div className="grid gap-5 lg:grid-cols-2">
          {([
            { label: "Periode awal", dari: "awalDari", sampai: "awalSampai" },
            { label: "Periode pembanding", dari: "pembandingDari", sampai: "pembandingSampai" },
          ] as const).map((period) => (
            <fieldset key={period.dari} className="min-w-0">
              <legend className="mb-2 text-xs font-semibold">{period.label}</legend>
              <div className="grid gap-3 sm:grid-cols-2">
                {([period.dari, period.sampai] as const).map((key, index) => (
                  <div key={key} className="min-w-0 space-y-1.5">
                    <label htmlFor={`perbandingan-${key}`} className="text-xs text-muted-foreground">
                      {index === 0 ? "Dari tanggal" : "Sampai tanggal"}
                    </label>
                    <Input id={`perbandingan-${key}`} type="date" required value={dates[key]}
                      onChange={(event) => changeDate(key, event.target.value)}
                      max={index === 0 ? dates[period.sampai] || undefined : undefined}
                      min={index === 1 ? dates[period.dari] || undefined : undefined}
                      className="min-h-11 w-full min-w-0 text-sm" />
                  </div>
                ))}
              </div>
            </fieldset>
          ))}
        </div>
        <Button type="submit" disabled={loading || !rumahSakitId} className="min-h-11">
          {loading ? "Memuat perbandingan..." : "Bandingkan periode"}
        </Button>
      </form>
      {error && <p role="alert" className="mt-4 text-sm text-destructive">{error}</p>}
      <div aria-live="polite" aria-busy={loading}>
        {loading && <p className="mt-4 text-xs text-muted-foreground">Menghitung ulasan pada kedua rentang tanggal...</p>}
        {!loading && !result && !error && <p className="mt-4 text-xs text-muted-foreground">Pilih kedua rentang tanggal, lalu klik Bandingkan periode.</p>}
        {result && (
          <div className="mt-5 space-y-4">
            <div className="grid gap-3 text-xs text-muted-foreground sm:grid-cols-2">
              {([result.awal, result.pembanding] as const).map((period, index) => (
                <p key={index}>
                  <span className="font-medium text-foreground">{index === 0 ? "Awal" : "Pembanding"}: </span>
                  {dateLabel(period.dari)} sampai {dateLabel(period.sampai)}
                  <br />{period.total} ulasan · {period.belumDianalisis} belum dianalisis
                </p>
              ))}
            </div>
            {(result.awal.total === 0 || result.pembanding.total === 0) && (
              <p className="text-xs text-muted-foreground">Tidak ada ulasan Google Maps pada {result.awal.total === 0 && result.pembanding.total === 0 ? "kedua periode" : result.awal.total === 0 ? "periode awal" : "periode pembanding"}. Pilih tanggal lain atau tarik data untuk periode tersebut.</p>
            )}
            <div className="grid gap-4 sm:grid-cols-3">
              {([ ["positif", "Positif"], ["netral", "Netral"], ["negatif", "Negatif"] ] as const).map(([key, label]) => {
                const delta = result.pembanding[key] - result.awal[key];
                return (
                  <div key={key} className="rounded-xl border border-border bg-background/60 px-5 py-4">
                    <p className="text-xs font-medium text-muted-foreground">{label}</p>
                    <p className="mt-2 text-xl font-bold tabular-nums">{result.awal[key]} <span className="text-sm font-normal text-muted-foreground">ke</span> {result.pembanding[key]}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{delta === 0 ? "Tidak berubah" : `${delta > 0 ? "+" : ""}${delta} ulasan`}</p>
                  </div>
                );
              })}
            </div>
            <p className="text-xs text-muted-foreground">Tanggal akhir termasuk dalam perhitungan. Zona waktu: {result.zonaWaktu}. Selisih menunjukkan jumlah ulasan, bukan persentase.</p>
          </div>
        )}
      </div>
    </section>
  );
}
