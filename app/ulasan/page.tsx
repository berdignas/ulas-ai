"use client";

import { useEffect, useState } from "react";
import { type DateRange } from "react-day-picker";
import { format } from "date-fns";
import { CaretLeft, CaretRight, MagnifyingGlass, Trash } from "@phosphor-icons/react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
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
import { analisisMemilikiHasil, formatTanggal, type AnalisisItem, type Sentimen, type UlasanItem } from "@/lib/types";

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
  const [admin, setAdmin] = useState(false);
  const [targetHapus, setTargetHapus] = useState<UlasanItem | null>(null);
  const [menghapus, setMenghapus] = useState(false);
  const [errorHapus, setErrorHapus] = useState("");
  const [pesan, setPesan] = useState("");
  const [muatUlang, setMuatUlang] = useState(0);

  useEffect(() => {
    fetch("/api/auth/me").then((res) => res.json())
      .then((data) => setAdmin(data.isAdmin === true)).catch(() => setAdmin(false));
  }, []);

  async function hapusUlasan() {
    if (!targetHapus || menghapus) return;
    setMenghapus(true);
    setErrorHapus("");
    try {
      const res = await fetch(`/api/analisis/${targetHapus.analisisId}/ulasan/${targetHapus.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal menghapus ulasan.");
      setTargetHapus(null);
      setDibuka(null);
      setPesan("Ulasan berhasil dihapus. Jumlah ulasan dan sentimen telah diperbarui.");
      setHasil((lama) => ({ ulasan: lama.ulasan.filter((item) => item.id !== targetHapus.id), total: Math.max(0, lama.total - 1) }));
      if (hasil.ulasan.length === 1 && halaman > 1) setHalaman((value) => value - 1);
      setMuatUlang((value) => value + 1);
    } catch (error) {
      setErrorHapus(error instanceof Error ? error.message : "Koneksi terputus. Silakan coba lagi.");
    } finally {
      setMenghapus(false);
    }
  }

  useEffect(() => {
    fetch("/api/analisis")
      .then((res) => res.json())
      .then((data: { analisis?: AnalisisItem[] }) => {
        const list = Array.isArray(data?.analisis) ? data.analisis : [];
        setDaftarAnalisis(list);
        const tersedia = list.find(analisisMemilikiHasil);
        if (tersedia) setAnalisisId(tersedia.id);
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
      .then(async (res) => {
        if (!res.ok) throw new Error("Gagal memuat daftar ulasan.");
        return res.json();
      })
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
  }, [analisisId, sentimen, kataKunciKirim, dateRange, halaman, muatUlang]);

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

      {pesan && <p role="status" className="mb-4 text-sm text-muted-foreground">{pesan}</p>}
      {memuat ? (
        <LoadingSection rows={3} />
      ) : ulasan.length === 0 ? (
        <div className="reveal rounded-xl border border-dashed border-border bg-card px-6 py-16 text-center text-xs text-muted-foreground">
          Tidak ada ulasan yang cocok.
          {daftarAnalisis.length === 0 && " Unggah data ulasan terlebih dahulu."}
        </div>
      ) : (
        <div className="reveal overflow-hidden rounded-xl border border-border bg-card">
          <div className="max-h-[min(68dvh,720px)] overflow-auto">
          <Table className="text-sm">
            <TableHeader>
              <TableRow>
                <TableHead className="sticky top-0 z-10 w-40 bg-card">Pengulas</TableHead>
                <TableHead className="sticky top-0 z-10 w-16 bg-card">Rating</TableHead>
                <TableHead className="sticky top-0 z-10 bg-card">Ulasan</TableHead>
                <TableHead className="sticky top-0 z-10 w-28 bg-card">Sentimen</TableHead>
                <TableHead className="sticky top-0 z-10 w-28 bg-card">Tanggal</TableHead>
                {admin && <TableHead className="sticky top-0 z-10 w-24 bg-card">Aksi</TableHead>}
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
                    <TableCell className="min-w-[min(420px,48vw)] max-w-[min(760px,58vw)] align-top">
                      <div
                        onClick={(event) => event.stopPropagation()}
                        className={cn(
                          "text-sm leading-6 whitespace-pre-wrap break-words",
                          terbuka
                            ? "max-h-52 overflow-y-auto pr-3 [scrollbar-gutter:stable]"
                            : "line-clamp-3"
                        )}
                        title={terbuka ? undefined : "Klik baris untuk membaca ulasan lengkap"}
                      >
                        {item.teksUlasan}
                      </div>
                    </TableCell>
                    <TableCell>
                      <SentimentBadge value={item.sentimen} />
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs font-mono">{formatTanggal(item.tanggalUlasan)}</TableCell>
                    {admin && <TableCell>
                      <Button variant="ghost" size="sm" className="text-destructive" disabled={menghapus}
                        aria-label={`Hapus ulasan ${item.namaPengulas ?? "tanpa nama"}`}
                        onClick={(event) => {
                          event.stopPropagation();
                          setErrorHapus("");
                          setPesan("");
                          setTargetHapus(item);
                        }}>
                        <Trash className="size-4" /> Hapus
                      </Button>
                    </TableCell>}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          </div>
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
      <Dialog open={targetHapus !== null} onOpenChange={(open) => { if (!open && !menghapus) setTargetHapus(null); }}>
        <DialogContent className="max-w-[min(32rem,calc(100vw-2rem))] rounded-xl">
          <DialogHeader>
            <DialogTitle>Hapus ulasan ini?</DialogTitle>
            <DialogDescription>
              Ulasan dan hasil analisis terkait akan dihapus permanen. Jumlah sentimen akan diperbarui dan ringkasan naratif lama dikosongkan. Tindakan ini tidak dapat dibatalkan.
            </DialogDescription>
          </DialogHeader>
          <div className="min-w-0">
            <p className="mb-2 break-words text-sm font-semibold">{targetHapus?.namaPengulas ?? "Tanpa nama"}</p>
            <p className="max-h-40 overflow-y-auto whitespace-pre-wrap break-words text-sm text-muted-foreground">{targetHapus?.teksUlasan}</p>
          </div>
          {errorHapus && <p role="alert" className="text-sm text-destructive">{errorHapus}</p>}
          <DialogFooter className="gap-2">
            <Button variant="outline" autoFocus disabled={menghapus} onClick={() => setTargetHapus(null)}>Batal</Button>
            <Button variant="destructive" disabled={menghapus} onClick={hapusUlasan}>{menghapus ? "Menghapus..." : "Hapus ulasan"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
