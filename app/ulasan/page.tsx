"use client";

import { useEffect, useState } from "react";
import { type DateRange } from "react-day-picker";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { CaretLeft, CaretRight, MagnifyingGlass } from "@phosphor-icons/react";
import { PageHeader } from "@/components/page-header";
import { LoadingSection } from "@/components/states";
import { SentimentBadge } from "@/components/sentiment-badge";
import { PilihPeriodeRentang } from "@/components/pilih-periode";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { formatTanggal, type AnalisisItem, type Sentimen, type UlasanItem } from "@/lib/types";

const FILTER_SENTIMEN: { nilai: Sentimen | "semua"; label: string }[] = [
  { nilai: "semua", label: "Semua" },
  { nilai: "positif", label: "Positif" },
  { nilai: "netral", label: "Netral" },
  { nilai: "negatif", label: "Negatif" },
];

const PER_HALAMAN = 15;

export default function UlasanPage() {
  const [daftarAnalisis, setDaftarAnalisis] = useState<AnalisisItem[]>([]);
  const [analisisId, setAnalisisId] = useState<number | null>(null);
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [sentimen, setSentimen] = useState<Sentimen | "semua">("semua");
  const [kataKunci, setKataKunci] = useState("");
  const [kataKunciKirim, setKataKunciKirim] = useState("");
  const [halaman, setHalaman] = useState(1);
  const [hasil, setHasil] = useState<{ ulasan: UlasanItem[]; total: number }>({ ulasan: [], total: 0 });
  const [pernahDimuat, setPernahDimuat] = useState(false);
  const [dibuka, setDibuka] = useState<number | null>(null);

  useEffect(() => {
    fetch("/api/analisis")
      .then((res) => res.json())
      .then((data: { analisis?: AnalisisItem[] }) => {
        const list = Array.isArray(data?.analisis) ? data.analisis : [];
        setDaftarAnalisis(list);
        const selesai = list.find((a) => a.status === "selesai");
        if (selesai) setAnalisisId(selesai.id);
      })
      .catch(() => setDaftarAnalisis([]));
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      setKataKunciKirim(kataKunci.trim());
      setHalaman(1);
    }, 400);
    return () => clearTimeout(timer);
  }, [kataKunci]);

  useEffect(() => {
    if (analisisId === null) return;
    let aktif = true;
    const params = new URLSearchParams({ page: String(halaman), limit: String(PER_HALAMAN) });
    if (sentimen !== "semua") params.set("sentimen", sentimen);
    if (kataKunciKirim) params.set("q", kataKunciKirim);
    if (dateRange?.from) params.set("dari", format(dateRange.from, "yyyy-MM-dd"));
    if (dateRange?.to) params.set("sampai", format(dateRange.to, "yyyy-MM-dd"));

    fetch(`/api/analisis/${analisisId}/ulasan?${params.toString()}`)
      .then((res) => res.json())
      .then((data: { ulasan: UlasanItem[]; total: number }) => {
        if (!aktif) return;
        setHasil({ ulasan: data.ulasan, total: data.total });
        setPernahDimuat(true);
      })
      .catch(() => {
        if (aktif) setPernahDimuat(true);
      });
    return () => {
      aktif = false;
    };
  }, [analisisId, sentimen, kataKunciKirim, dateRange, halaman]);

  const memuat = analisisId !== null && !pernahDimuat;
  const { ulasan, total } = hasil;
  const totalHalaman = Math.max(1, Math.ceil(total / PER_HALAMAN));

  return (
    <div>
      <PageHeader
        title="Daftar Ulasan"
        description="Telusuri seluruh ulasan, saring berdasarkan rentang tanggal, sentimen, atau kata kunci."
      >
        <PilihPeriodeRentang
          dateRange={dateRange}
          onChange={(range) => {
            setDateRange(range);
            setHalaman(1);
          }}
        />
      </PageHeader>

      <div className="reveal mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap gap-1.5">
          {FILTER_SENTIMEN.map(({ nilai, label }) => (
            <Button
              key={nilai}
              type="button"
              variant={sentimen === nilai ? "default" : "outline"}
              size="sm"
              onClick={() => {
                setSentimen(nilai);
                setHalaman(1);
              }}
              className="rounded-full text-xs font-medium"
            >
              {label}
            </Button>
          ))}
        </div>
        <div className="relative w-full md:max-w-xs">
          <MagnifyingGlass className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={kataKunci}
            onChange={(e) => setKataKunci(e.target.value)}
            placeholder="Cari ulasan, misal: lambat, ramah…"
            className="pl-9 text-xs h-9"
          />
        </div>
      </div>

      {memuat ? (
        <LoadingSection rows={3} />
      ) : ulasan.length === 0 ? (
        <div className="reveal rounded-xl border border-dashed border-border bg-card px-6 py-16 text-center text-xs text-muted-foreground">
          Tidak ada ulasan yang cocok.
          {daftarAnalisis.length === 0 && " Unggah data ulasan terlebih dahulu."}
        </div>
      ) : (
        <div className="reveal overflow-hidden rounded-xl border border-border bg-card">
          <Table className="text-xs">
            <TableHeader>
              <TableRow>
                <TableHead className="w-40">Pengulas</TableHead>
                <TableHead className="w-16">Rating</TableHead>
                <TableHead>Ulasan</TableHead>
                <TableHead className="w-28">Sentimen</TableHead>
                <TableHead className="w-28">Tanggal</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ulasan.map((item) => {
                const terbuka = dibuka === item.id;
                return (
                  <TableRow
                    key={item.id}
                    className="cursor-pointer"
                    onClick={() => setDibuka(terbuka ? null : item.id)}
                  >
                    <TableCell className="text-muted-foreground font-semibold text-xs">{item.namaPengulas ?? "-"}</TableCell>
                    <TableCell className="font-mono tabular-nums text-xs">
                      {item.rating !== null ? <Bintang nilai={item.rating} /> : "-"}
                    </TableCell>
                    <TableCell className={cn("max-w-xl text-xs", !terbuka && "truncate")}>
                      {item.teksUlasan}
                    </TableCell>
                    <TableCell>
                      <SentimentBadge value={item.sentimen} />
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs font-mono">{formatTanggal(item.tanggalUlasan)}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          <div className="flex items-center justify-between border-t border-border px-6 py-3 text-xs">
            <span className="text-xs text-muted-foreground">
              <span className="font-mono tabular-nums">{total}</span> ulasan ditemukan · halaman{" "}
              <span className="font-mono tabular-nums">{halaman}</span> dari{" "}
              <span className="font-mono tabular-nums">{totalHalaman}</span>
            </span>
            <div className="flex gap-1.5">
              <Button
                variant="outline"
                size="sm"
                disabled={halaman <= 1}
                onClick={() => setHalaman((h) => h - 1)}
              >
                <CaretLeft className="size-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={halaman >= totalHalaman}
                onClick={() => setHalaman((h) => h + 1)}
              >
                <CaretRight className="size-4" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Bintang({ nilai }: { nilai: number }) {
  return (
    <span className="text-amber-500 font-semibold" title={`${nilai} dari 5`}>
      {nilai}★
    </span>
  );
}
