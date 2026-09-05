export type Sentimen = "positif" | "negatif" | "netral";
export type StatusAnalisis = "menunggu" | "berjalan" | "selesai" | "gagal" | "berhenti";

export interface AnalisisItem {
  id: number;
  namaFile: string;
  tanggalUnggah: string;
  status: StatusAnalisis;
  totalUlasan: number;
  ulasanDiproses: number;
  totalPositif: number;
  totalNegatif: number;
  totalNetral: number;
  kondisiUmum: string | null;
  catatan: string | null;
}

export interface UlasanItem {
  id: number;
  analisisId: number;
  namaPengulas: string | null;
  rating: number | null;
  teksUlasan: string;
  tanggalUlasan: string | null;
  sentimen: Sentimen | null;
  sumberLabel: string | null;
}

export interface StatistikAspek {
  id: number;
  namaAspek: string;
  positif: number;
  negatif: number;
  netral: number;
}

export interface ParsedPreview {
  namaPengulas: string | null;
  rating: number | null;
  teksUlasan: string;
  tanggalUlasan: string | null;
}

export function formatTanggal(iso: string | null): string {
  if (!iso) return "-";
  const tanggal = new Date(iso);
  if (Number.isNaN(tanggal.getTime())) return iso;
  return tanggal.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
}

export function formatTanggalWaktu(iso: string): string {
  const tanggal = new Date(iso);
  if (Number.isNaN(tanggal.getTime())) return iso;
  return tanggal.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
