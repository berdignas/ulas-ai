export type Sentimen = "positif" | "negatif" | "netral";
export type StatusAnalisis =
  | "menunggu"
  | "berjalan"
  | "selesai"
  | "gagal"
  | "berhenti";
export type StatusTindakLanjut = "baru" | "dalam_koordinasi" | "selesai";
export type UnitLayanan =
  | "IGD"
  | "Farmasi"
  | "Poliklinik/Dokter"
  | "Rawat Inap"
  | "Kasir/BPJS"
  | "Fasilitas & Parkir"
  | "Lainnya";
export type KategoriMasalah =
  | "Waktu Tunggu"
  | "Keramahan Staf"
  | "Kebersihan"
  | "Akurasi Administrasi"
  | "Kompetensi Medis"
  | "Lainnya";

export interface RumahSakitRow {
  id: number;
  nama: string;
  kode: string;
  googleMapsPlaceId?: string | null;
  apifyActorId?: string | null;
  apifyToken?: string | null;
  aktif: boolean | null;
  zonaWaktu: string | null;
  jamSinkron: number | null;
  aiModel?: string | null;
  aiApiKey?: string | null;
  kopSurat?: string | null;
  dibuatPada: Date | string;
  diperbaruiPada: Date | string;
}

export interface SinkronLogRow {
  id: number;
  rumahSakitId: number;
  dimulaiPada: Date | string;
  selesaiPada?: Date | string | null;
  status: string;
  ulasanBaru?: number | null;
  ulasanDiproses?: number | null;
  ulasanKrisis?: number | null;
  pesanError?: string | null;
  tipePemicu?: string | null;
}

export interface AnalisisRow {
  id: number;
  rumahSakitId: number;
  namaFile: string;
  tanggalUnggah: Date | string;
  status: StatusAnalisis;
  totalUlasan: number;
  ulasanDiproses: number;
  totalPositif: number;
  totalNegatif: number;
  totalNetral: number;
  kondisiUmum?: string | null;
  catatan?: string | null;
  sidikJari?: string | null;
}

export interface UlasanRow {
  id: number;
  analisisId: number;
  rumahSakitId: number;
  reviewId: string;
  namaPengulas?: string | null;
  rating?: number | null;
  teksUlasan: string;
  tanggalUlasan?: string | null;
  bahasa?: string | null;
  sentimen?: Sentimen | null;
  sumberLabel?: string | null;
  aiStatus?: string | null;
  aiAttempts?: number | null;
  aiErrorCode?: string | null;
  aiErrorMessage?: string | null;
  aiDiprosesPada?: Date | string | null;
  unitLayanan?: string | null;
  kategoriMasalah?: string | null;
  faktorUrgensiMedis?: boolean | null;
  saranDrafBalasan?: string | null;
  statusTindakLanjut?: StatusTindakLanjut | null;
  ditinjauPada?: Date | string | null;
  ditinjauOleh?: string | null;
  catatanInternal?: string | null;
  dataMentah?: string | null;
  dibuatPada?: Date | string;
  diperbaruiPada?: Date | string;
}

export interface AspekRow {
  id: number;
  namaAspek: string;
}

export interface HasilAspekUlasanRow {
  id: number;
  ulasanId: number;
  aspekId: number;
  sentimenAspek: Sentimen;
  kutipan?: string | null;
}

export interface KategoriMasalahRow {
  id: number;
  nama: string;
  deskripsi?: string | null;
  urutan?: number | null;
  aktif?: boolean | null;
}

export interface UnitLayananRow {
  id: number;
  nama: string;
  deskripsi?: string | null;
  urutan?: number | null;
  aktif?: boolean | null;
}

export interface LokasiLayananRsRow {
  id: number;
  rumahSakitId: number;
  nama: string;
  jenis: "poli" | "ruangan" | "unit" | "fasilitas";
  kataKunci: string[];
  aktif: boolean;
  urutan: number;
  dibuatPada?: Date | string;
  diperbaruiPada?: Date | string;
}

export interface HasilLokasiUlasanRow {
  id: number;
  ulasanId: number;
  lokasiLayananId: number;
  metode: "keyword" | "ai";
  kutipan?: string | null;
}

// Constant table names for Supabase REST API queries
export const rumahSakit = "rumah_sakit";
export const sinkronLog = "sinkron_log";
export const analisis = "analisis";
export const ulasan = "ulasan";
export const aspek = "aspek";
export const hasilAspekUlasan = "hasil_aspek_ulasans";
export const kategoriMasalah = "kategori_masalah";
export const unitLayanan = "unit_layanan";
export const lokasiLayananRs = "lokasi_layanan_rs";
export const hasilLokasiUlasan = "hasil_lokasi_ulasans";
