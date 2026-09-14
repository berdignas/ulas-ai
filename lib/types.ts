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

export interface LokasiTerkaitItem {
  nama: string;
  jenis?: "poli" | "ruangan" | "unit" | "fasilitas" | string;
  total: number;
}

export interface StatistikAspek {
  id: number;
  namaAspek: string;
  positif: number;
  negatif: number;
  netral: number;
  lokasiNegatif?: LokasiTerkaitItem[];
  lokasiPositif?: LokasiTerkaitItem[];
}

export interface StatistikLokasi {
  id: number;
  nama: string;
  jenis: "poli" | "ruangan" | "unit" | "fasilitas";
  total: number;
  positif: number;
  negatif: number;
  netral: number;
  contoh: string[];
}

export interface UlasanLokasiItem {
  id: number;
  namaPengulas: string | null;
  rating: number | null;
  teksUlasan: string;
  tanggalUlasan: string | null;
  sentimen: Sentimen | null;
  sumberLabel: string | null;
  metode: "keyword" | "ai";
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

export function formatDurasi(totalDetik: number): string {
  if (!Number.isFinite(totalDetik) || totalDetik <= 0) return "0 detik";
  if (totalDetik < 60) {
    return `${totalDetik} detik`;
  }
  const menit = Math.floor(totalDetik / 60);
  const detik = totalDetik % 60;
  if (detik === 0) {
    return `${menit} menit`;
  }
  return `${menit} menit ${detik} detik`;
}

export function ekstraksiDurasiDariCatatan(catatan: string | null | undefined): string | null {
  if (!catatan) return null;
  const match = catatan.match(/Selesai dianalisis dalam waktu ([^.]+)\./);
  return match ? match[1].trim() : null;
}

export function bersihkanCatatanPeringatan(catatan: string | null | undefined): string | null {
  if (!catatan) return null;
  const sisa = catatan.replace(/Selesai dianalisis dalam waktu [^.]+\.\s*/gi, "").trim();
  return sisa.length > 0 ? sisa : null;
}
