"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowDownRight, ArrowUpRight, Minus } from "@phosphor-icons/react";
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
import { LoadingSection } from "@/components/states";
import { StatusBadge } from "@/components/sentiment-badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { formatTanggal, formatTanggalWaktu, type AnalisisItem } from "@/lib/types";

export default function TrenPage() {
  const [daftar, setDaftar] = useState<AnalisisItem[]>([]);
  const [memuat, setMemuat] = useState(true);
  const [periodeA, setPeriodeA] = useState<number | null>(null);
  const [periodeB, setPeriodeB] = useState<number | null>(null);

  useEffect(() => {
    fetch("/api/analisis")
      .then((res) => res.json())
      .then((data: { analisis: AnalisisItem[] }) => {
        const selesai = data.analisis.filter((a) => a.status === "selesai");
        setDaftar(data.analisis);
        if (selesai.length >= 2) {
          setPeriodeA(selesai[1].id);
          setPeriodeB(selesai[0].id);
        } else if (selesai.length === 1) {
          setPeriodeA(selesai[0].id);
          setPeriodeB(selesai[0].id);
        }
      })
      .finally(() => setMemuat(false));
  }, []);

  const selesaiUrutWaktu = useMemo(
    () =>
      [...daftar]
        .filter((a) => a.status === "selesai")
        .sort((a, b) => new Date(a.tanggalUnggah).getTime() - new Date(b.tanggalUnggah).getTime()),
    [daftar]
  );

  const dataGrafik = useMemo(
    () =>
      selesaiUrutWaktu.map((a) => {
        const terlabel = a.totalPositif + a.totalNegatif + a.totalNetral;
        return {
          tanggal: formatTanggal(a.tanggalUnggah),
          Positif: terlabel ? Math.round((a.totalPositif / terlabel) * 100) : 0,
          Negatif: terlabel ? Math.round((a.totalNegatif / terlabel) * 100) : 0,
        };
      }),
    [selesaiUrutWaktu]
  );

  const itemA = daftar.find((a) => a.id === periodeA);
  const itemB = daftar.find((a) => a.id === periodeB);

  if (memuat) {
    return <LoadingSection rows={3} />;
  }

  if (daftar.length === 0) {
    return (
      <div>
        <PageHeader
          title="Pemantauan Tren"
          description="Bandingkan hasil antar periode untuk melihat apakah layanan semakin baik atau memburuk."
        />
        <div className="reveal rounded-xl border border-dashed border-border bg-card px-6 py-16 text-center text-sm text-muted-foreground">
          Belum ada riwayat analisis. Unggah data ulasan untuk mulai memantau tren.
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Pemantauan Tren"
        description="Bandingkan hasil antar periode untuk melihat apakah layanan semakin baik atau memburuk."
      />

      <div className="reveal rounded-xl border border-border bg-card py-6">
        <div className="px-6">
          <h3 className="font-semibold leading-none tracking-tight">Grafik Tren Sentimen</h3>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Persentase sentimen positif dan negatif dari setiap periode analisis.
          </p>
        </div>
        <div className="mt-6 px-6">
          {dataGrafik.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Belum ada analisis yang selesai untuk digambarkan.
            </p>
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={dataGrafik}>
                  <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.92 0.004 286.32)" />
                  <XAxis dataKey="tanggal" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis fontSize={12} tickLine={false} axisLine={false} unit="%" domain={[0, 100]} />
                  <Tooltip formatter={(value) => `${value}%`} contentStyle={{ borderRadius: 12, fontSize: 12, border: "1px solid oklch(0.92 0.004 286.32)" }} />
                  <Legend />
                  <Line type="monotone" dataKey="Positif" stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} />
                  <Line type="monotone" dataKey="Negatif" stroke="#f43f5e" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      <div className="reveal mt-6 rounded-xl border border-border bg-card py-6" style={{ animationDelay: "80ms" }}>
        <div className="px-6">
          <h3 className="font-semibold leading-none tracking-tight">Perbandingan Periode</h3>
          <p className="mt-1.5 text-sm text-muted-foreground">Pilih dua periode untuk melihat selisih jumlah sentimen.</p>
        </div>
        <div className="mt-6 space-y-4 px-6">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1.5 text-sm">
              <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Periode awal</span>
              <PeriodeSelect daftar={selesaiUrutWaktu} dipilih={periodeA} onChange={setPeriodeA} />
            </label>
            <label className="space-y-1.5 text-sm">
              <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Periode pembanding</span>
              <PeriodeSelect daftar={selesaiUrutWaktu} dipilih={periodeB} onChange={setPeriodeB} />
            </label>
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

      <div className="reveal mt-6 overflow-hidden rounded-xl border border-border bg-card" style={{ animationDelay: "140ms" }}>
        <div className="border-b border-border px-6 py-4">
          <h3 className="font-semibold leading-none tracking-tight">Riwayat Analisis</h3>
          <p className="mt-1 text-xs text-muted-foreground">Seluruh hasil analisis dari periode sebelumnya.</p>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tanggal Unggah</TableHead>
              <TableHead>Berkas</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead className="text-right">Positif</TableHead>
              <TableHead className="text-right">Netral</TableHead>
              <TableHead className="text-right">Negatif</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {daftar.map((item) => (
              <TableRow key={item.id}>
                <TableCell className="whitespace-nowrap text-muted-foreground">
                  {formatTanggalWaktu(item.tanggalUnggah)}
                </TableCell>
                <TableCell className="max-w-52 truncate">{item.namaFile}</TableCell>
                <TableCell>
                  <StatusBadge status={item.status} />
                </TableCell>
                <TableCell className="text-right font-mono tabular-nums">{item.totalUlasan}</TableCell>
                <TableCell className="text-right font-mono tabular-nums text-emerald-600">
                  {item.status === "selesai" ? item.totalPositif : "-"}
                </TableCell>
                <TableCell className="text-right font-mono tabular-nums text-amber-600">
                  {item.status === "selesai" ? item.totalNetral : "-"}
                </TableCell>
                <TableCell className="text-right font-mono tabular-nums text-rose-600">
                  {item.status === "selesai" ? item.totalNegatif : "-"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
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
  return (
    <select
      value={dipilih ?? ""}
      onChange={(e) => onChange(Number(e.target.value))}
      className="h-9 w-full rounded-lg border border-input bg-card px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
    >
      {daftar.length === 0 && <option value="">Belum ada periode selesai</option>}
      {daftar.map((item) => (
        <option key={item.id} value={item.id}>
          {formatTanggal(item.tanggalUnggah)} · {item.namaFile}
        </option>
      ))}
    </select>
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
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <div className="mt-2 font-mono text-xl font-semibold tabular-nums">
        {awal} <span className="text-muted-foreground">→</span> {akhir}
      </div>
      <p className={cn("mt-1 flex items-center gap-1 text-sm font-medium", arahWarna)}>
        {selisih === 0 ? (
          <>
            <Minus className="size-4" /> Tidak berubah
          </>
        ) : naik ? (
          <>
            <ArrowUpRight className="size-4" /> +{selisih}
          </>
        ) : (
          <>
            <ArrowDownRight className="size-4" /> {selisih}
          </>
        )}
      </p>
    </div>
  );
}
