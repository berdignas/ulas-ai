export const ASPEK_UMUM = [
  "Waktu Tunggu & Kecepatan",
  "Sikap & Keramahan Petugas",
  "Komunikasi & Kejelasan Informasi",
  "Kompetensi & Keamanan Medis",
  "Kebersihan & Higiene",
  "Fasilitas & Kenyamanan",
  "Administrasi, BPJS & Biaya",
  "Obat & Pelayanan Farmasi",
  "Akses, Keamanan & Parkir",
  "Lainnya",
] as const;

export type AspekUmum = (typeof ASPEK_UMUM)[number];
export type JenisLokasiLayanan = "poli" | "ruangan" | "unit" | "fasilitas";

export interface LokasiLayananReferensi {
  id: number;
  nama: string;
  jenis: JenisLokasiLayanan;
  kataKunci: string[];
  aktif?: boolean;
  urutan?: number;
}

export const LOKASI_DEFAULT: Array<Omit<LokasiLayananReferensi, "id">> = [
  { nama: "IGD", jenis: "unit", kataKunci: ["igd", "ugd", "gawat darurat", "emergency"], aktif: true, urutan: 1 },
  { nama: "Pendaftaran", jenis: "unit", kataKunci: ["pendaftaran", "loket pendaftaran", "registrasi"], aktif: true, urutan: 2 },
  { nama: "Kasir/BPJS", jenis: "unit", kataKunci: ["kasir", "bpjs", "asuransi", "klaim"], aktif: true, urutan: 3 },
  { nama: "Farmasi", jenis: "unit", kataKunci: ["farmasi", "apotek", "pengambilan obat", "antrean obat"], aktif: true, urutan: 4 },
  { nama: "Laboratorium", jenis: "unit", kataKunci: ["laboratorium", "lab", "cek darah"], aktif: true, urutan: 5 },
  { nama: "Radiologi", jenis: "unit", kataKunci: ["radiologi", "rontgen", "x-ray", "ct scan", "mri"], aktif: true, urutan: 6 },
  { nama: "Rawat Inap", jenis: "unit", kataKunci: ["rawat inap", "bangsal", "kamar pasien"], aktif: true, urutan: 7 },
  { nama: "Ruang Bedah/OK", jenis: "ruangan", kataKunci: ["ruang bedah", "ruang operasi", "kamar operasi"], aktif: true, urutan: 8 },
  { nama: "ICU/HCU", jenis: "ruangan", kataKunci: ["icu", "hcu", "intensive care"], aktif: true, urutan: 9 },
  { nama: "NICU/PICU", jenis: "ruangan", kataKunci: ["nicu", "picu"], aktif: true, urutan: 10 },
  { nama: "Ruang Bersalin/VK", jenis: "ruangan", kataKunci: ["ruang bersalin", "kamar bersalin", "ruang vk"], aktif: true, urutan: 11 },
  { nama: "Poli Anak", jenis: "poli", kataKunci: ["poli anak", "poliklinik anak", "dokter anak"], aktif: true, urutan: 12 },
  { nama: "Poli Kandungan", jenis: "poli", kataKunci: ["poli kandungan", "poli obgyn", "dokter kandungan"], aktif: true, urutan: 13 },
  { nama: "Poli Penyakit Dalam", jenis: "poli", kataKunci: ["poli penyakit dalam", "dokter penyakit dalam"], aktif: true, urutan: 14 },
  { nama: "Poli Bedah", jenis: "poli", kataKunci: ["poli bedah", "poliklinik bedah"], aktif: true, urutan: 15 },
  { nama: "Fasilitas Umum/Parkir", jenis: "fasilitas", kataKunci: ["parkir", "toilet", "mushola", "kantin", "lift"], aktif: true, urutan: 16 },
];

const PETA_ASPEK: Array<{ aspek: AspekUmum; pola: RegExp }> = [
  { aspek: "Waktu Tunggu & Kecepatan", pola: /tunggu|antre|antri|lama|lambat|kecepat|respons|respon/ },
  { aspek: "Sikap & Keramahan Petugas", pola: /ramah|sopan|judes|kasar|cuek|acuh|sikap|sabar|perhatian/ },
  { aspek: "Komunikasi & Kejelasan Informasi", pola: /jelas|informasi|komunikasi|penjelasan|edukasi|arah|petunjuk/ },
  { aspek: "Kebersihan & Higiene", pola: /bersih|kotor|bau|sampah|higien|sanitasi/ },
  { aspek: "Administrasi, BPJS & Biaya", pola: /admin|bpjs|kasir|biaya|bayar|tagihan|tarif|harga|asuransi|berkas|pendaftaran/ },
  { aspek: "Obat & Pelayanan Farmasi", pola: /obat|farmasi|apotek|resep|racikan/ },
  { aspek: "Akses, Keamanan & Parkir", pola: /parkir|akses|satpam|keamanan|lokasi|jalan/ },
  { aspek: "Fasilitas & Kenyamanan", pola: /fasilitas|nyaman|ruang|kamar|ac\b|kursi|makanan|sarana|prasarana|tenang|alat/ },
  { aspek: "Kompetensi & Keamanan Medis", pola: /pelayanan|perawatan|keperawatan|kompeten|diagnos|tindakan|medis|dokter|perawat|bidan|pemeriksaan|perban|prosedur|kesiagaan|obsgyn|obgyn|keselamatan/ },
];

export function normalisasiAspekUmum(value: string): AspekUmum {
  const teks = value.trim().toLowerCase();
  const exact = ASPEK_UMUM.find((item) => item.toLowerCase() === teks);
  if (exact) return exact;
  return PETA_ASPEK.find((item) => item.pola.test(teks))?.aspek ?? "Lainnya";
}

function normalisasiTeks(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function deteksiLokasiDariKeyword(
  teksUlasan: string,
  lokasi: LokasiLayananReferensi[]
): LokasiLayananReferensi[] {
  const teks = ` ${normalisasiTeks(teksUlasan)} `;
  const kandidat = lokasi
    .filter((item) => item.aktif !== false)
    .flatMap((item) => {
      const semuaKata = [item.nama, ...item.kataKunci]
        .map(normalisasiTeks)
        .filter((kata) => kata.length >= 2)
        .sort((a, b) => b.length - a.length);
      const cocok = semuaKata.find((kata) => teks.includes(` ${kata} `));
      return cocok ? [{ item, panjang: cocok.length }] : [];
    })
    .sort((a, b) => b.panjang - a.panjang || (a.item.urutan ?? 999) - (b.item.urutan ?? 999));

  const hasil: LokasiLayananReferensi[] = [];
  for (const kandidatItem of kandidat) {
    if (hasil.some((item) => item.id === kandidatItem.item.id)) continue;
    hasil.push(kandidatItem.item);
    if (hasil.length === 3) break;
  }
  return hasil;
}
