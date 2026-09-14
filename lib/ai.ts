import { isAIModelConfigured, resolveAIConfig, type CustomAIConfig } from "./ai-config";
import {
  ASPEK_UMUM,
  LokasiLayananReferensi,
  normalisasiAspekUmum,
} from "./service-taxonomy";

export type Sentimen = "positif" | "negatif" | "netral";

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

export interface AspekHasil {
  aspek: string;
  sentimen: Sentimen;
  kutipan: string | null;
}

export interface HasilAnalisisUlasan {
  sentimen: Sentimen;
  unitLayanan: UnitLayanan;
  kategoriMasalah: KategoriMasalah;
  faktorUrgensiMedis: boolean;
  saranDrafBalasan: string;
  kepercayaan: number;
  aspek: AspekHasil[];
  lokasiLayanan: string[];
}

export interface InputAnalisisUlasan {
  id: number;
  teksUlasan: string;
  rating: number | null;
}

export interface AIAnalisisCallbacks {
  onRetry?: (info: { percobaanBerikutnya: number; maksimumPercobaan: number; jedaMs: number; error: string }) => void | Promise<void>;
}

export const UNIT_LAYANAN_VALID: readonly UnitLayanan[] = [
  "IGD",
  "Farmasi",
  "Poliklinik/Dokter",
  "Rawat Inap",
  "Kasir/BPJS",
  "Fasilitas & Parkir",
  "Lainnya",
];

export const KATEGORI_MASALAH_VALID: readonly KategoriMasalah[] = [
  "Waktu Tunggu",
  "Keramahan Staf",
  "Kebersihan",
  "Akurasi Administrasi",
  "Kompetensi Medis",
  "Lainnya",
];

const SYSTEM_PROMPT = `Anda adalah analis mutu pelayanan rumah sakit yang memproses ulasan Google Maps berbahasa Indonesia.
Tugas Anda: mengekstrak informasi terstruktur secara spesifik untuk analitik rumah sakit dan analisis aspek.

ATURAN EKSTRAKSI:
1. unitLayanan: Klasifikasikan ke SATU dari:
   - "IGD": gawat darurat, emergency, triase, resusitasi, ambulans
   - "Farmasi": apotek, obat, resep, racikan, antrean obat, ketersediaan obat
   - "Poliklinik/Dokter": poli spesialis, dokter, konsultasi, pemeriksaan
   - "Rawat Inap": kamar inap, bangsal, perawat, bidan, kebersihan kamar, makanan pasien
   - "Kasir/BPJS": pembayaran, loket, antrean pendaftaran, klaim BPJS, asuransi
   - "Fasilitas & Parkir": parkir, toilet umum, lift, mushola, kantin, gedung, keamanan
   - "Lainnya": jika tidak termasuk kategori di atas

2. kategoriMasalah: Label SATU masalah utama:
   - "Waktu Tunggu": antrean lama, lambat, proses berbelit, delay
   - "Keramahan Staf": staf kasar, judes, acuh, tidak sopan, cuek
   - "Kebersihan": ruangan kotor, bau, sampah, tidak higienis
   - "Akurasi Administrasi": salah tagihan, dokumen keliru, sistem error, data tertukar
   - "Kompetensi Medis": kelalaian tindakan, salah obat/dosis, salah diagnosis
   - "Lainnya": jika tidak ada keluhan atau kategori lain

3. sentimen: SATU dari ["positif", "negatif", "netral"]

4. faktorUrgensiMedis (boolean): TRUE hanya jika ada indikasi krisis medis fatal/malapraktik/kelalaian gawat darurat berisiko nyawa. FALSE untuk keluhan biasa.

5. saranDrafBalasan (string): Draf resmi perwakilan humas RS (2-3 kalimat santun & empatik).

6. aspek: Pilih maksimal TIGA aspek yang benar-benar disebut dari daftar baku berikut:
   - "Waktu Tunggu & Kecepatan"
   - "Sikap & Keramahan Petugas"
   - "Komunikasi & Kejelasan Informasi"
   - "Kompetensi & Keamanan Medis"
   - "Kebersihan & Higiene"
   - "Fasilitas & Kenyamanan"
   - "Administrasi, BPJS & Biaya"
   - "Obat & Pelayanan Farmasi"
   - "Akses, Keamanan & Parkir"
   - "Lainnya"
   - Jangan membuat nama aspek baru.
   - "sentimen": "positif" | "negatif" | "netral"
   - "kutipan": kutipan kalimat asli pendukung ulasan (maksimal 120 karakter)

7. lokasiLayanan: Pilih maksimal TIGA nama poli/ruangan/unit dari DAFTAR LOKASI RS yang diberikan.
   Gunakan array kosong jika ulasan tidak menyebut lokasi secara jelas. Jangan mengarang nama lokasi.

Balas HANYA dengan JSON valid:
{
  "unitLayanan": "IGD"|"Farmasi"|"Poliklinik/Dokter"|"Rawat Inap"|"Kasir/BPJS"|"Fasilitas & Parkir"|"Lainnya",
  "kategoriMasalah": "Waktu Tunggu"|"Keramahan Staf"|"Kebersihan"|"Akurasi Administrasi"|"Kompetensi Medis"|"Lainnya",
  "sentimen": "positif"|"negatif"|"netral",
  "faktorUrgensiMedis": boolean,
  "saranDrafBalasan": string,
  "kepercayaan": number,
  "lokasiLayanan": string[],
  "aspek": [
    { "aspek": string, "sentimen": "positif"|"negatif"|"netral", "kutipan": string }
  ]
}`;

const BATCH_SYSTEM_PROMPT = `${SYSTEM_PROMPT}

MODE BATCH (aturan ini menggantikan format jawaban tunggal di atas):
- Input berisi array "ulasan". Analisis SETIAP item secara independen.
- Salin "id" input ke hasil yang sesuai. Jangan menghilangkan, menggabungkan, atau menambah item.
- Balas hanya dengan JSON valid berbentuk:
{"hasil":[{"id":number,"unitLayanan":string,"kategoriMasalah":string,"sentimen":string,"faktorUrgensiMedis":boolean,"saranDrafBalasan":string,"kepercayaan":number,"lokasiLayanan":string[],"aspek":[{"aspek":string,"sentimen":string,"kutipan":string}]}]}`;

const ASPEK_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    aspek: { type: "string", enum: ASPEK_UMUM },
    sentimen: { type: "string", enum: ["positif", "negatif", "netral"] },
    kutipan: { type: "string", maxLength: 120 },
  },
  required: ["aspek", "sentimen", "kutipan"],
} as const;

const HASIL_JSON_PROPERTIES = {
  unitLayanan: { type: "string", enum: UNIT_LAYANAN_VALID },
  kategoriMasalah: { type: "string", enum: KATEGORI_MASALAH_VALID },
  sentimen: { type: "string", enum: ["positif", "negatif", "netral"] },
  faktorUrgensiMedis: { type: "boolean" },
  saranDrafBalasan: { type: "string", maxLength: 500 },
  kepercayaan: { type: "number", minimum: 0, maximum: 1 },
  aspek: {
    type: "array",
    maxItems: 3,
    items: ASPEK_JSON_SCHEMA,
  },
} as const;

const HASIL_JSON_REQUIRED = [
  "unitLayanan",
  "kategoriMasalah",
  "sentimen",
  "faktorUrgensiMedis",
  "saranDrafBalasan",
  "kepercayaan",
  "aspek",
] as const;

function lokasiJsonSchema(lokasi: LokasiLayananReferensi[]) {
  const namaLokasi = lokasi.filter((item) => item.aktif !== false).map((item) => item.nama);
  return {
    type: "array",
    maxItems: Math.min(3, namaLokasi.length),
    items: namaLokasi.length > 0
      ? { type: "string", enum: namaLokasi }
      : { type: "string" },
  };
}

function propertiHasil(lokasi: LokasiLayananReferensi[]) {
  return {
    ...HASIL_JSON_PROPERTIES,
    lokasiLayanan: lokasiJsonSchema(lokasi),
  };
}

function singleResponseSchema(lokasi: LokasiLayananReferensi[]) {
  return {
    type: "object",
    additionalProperties: false,
    properties: propertiHasil(lokasi),
    required: [...HASIL_JSON_REQUIRED, "lokasiLayanan"],
  };
}

function batchResponseSchema(items: InputAnalisisUlasan[], lokasi: LokasiLayananReferensi[]) {
  return {
    type: "object",
    additionalProperties: false,
    properties: {
      hasil: {
        type: "array",
        minItems: items.length,
        maxItems: items.length,
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            id: { type: "integer", enum: items.map((item) => item.id) },
            ...propertiHasil(lokasi),
          },
          required: ["id", ...HASIL_JSON_REQUIRED, "lokasiLayanan"],
        },
      },
    },
    required: ["hasil"],
  };
}

function promptDenganLokasi(lokasi: LokasiLayananReferensi[]): string {
  if (lokasi.length === 0) return `${SYSTEM_PROMPT}\n\nDAFTAR LOKASI RS: belum dikonfigurasi.`;
  const daftar = lokasi
    .filter((item) => item.aktif !== false)
    .slice(0, 200)
    .map((item) => `- ${item.nama} [${item.jenis}]${item.kataKunci.length ? `; alias: ${item.kataKunci.slice(0, 5).join(", ")}` : ""}`)
    .join("\n");
  return `${SYSTEM_PROMPT}\n\nDAFTAR LOKASI RS (gunakan nama persis):\n${daftar}`;
}

function geminiThinkingConfig(model: string) {
  return {
    thinkingLevel: model.includes("flash-lite") ? "minimal" : "low",
  };
}

export function getEnv() {
  return {
    apiKey: process.env.OPENCODE_ZEN_API_KEY ?? "",
    baseUrl: (process.env.OPENCODE_ZEN_BASE_URL ?? "https://opencode.ai/zen/v1").replace(/\/$/, ""),
    model: process.env.OPENCODE_ZEN_MODEL ?? "big-pickle",
  };
}

export function getEnvGemini() {
  return {
    apiKey: process.env.GEMINI_API_KEY ?? "",
    model: process.env.GEMINI_MODEL ?? "gemini-3.6-flash",
  };
}

export function aiConfiguredGemini(): boolean {
  return Boolean(process.env.GEMINI_API_KEY);
}

export function aiConfigured(preferredModel?: string | null, customConfig?: CustomAIConfig | null): boolean {
  return isAIModelConfigured(preferredModel, customConfig);
}

const MAX_ATTEMPTS = 3;
const BACKOFF_MS = [1000, 2000, 4000];
const MAX_ATTEMPTS_429 = 6;
const BACKOFF_429_MS = [30_000, 60_000, 120_000, 240_000, 300_000];

export async function analisisUlasanDenganAI(
  teksUlasan: string,
  rating: number | null,
  preferredModel?: string | null,
  lokasi: LokasiLayananReferensi[] = [],
  customConfig?: CustomAIConfig | null
): Promise<HasilAnalisisUlasan> {
  if (!teksUlasan || teksUlasan.trim() === "") {
    const sentimen = sentimenFallbackDariRating(rating) ?? "netral";
    return {
      sentimen,
      unitLayanan: "Lainnya",
      kategoriMasalah: "Lainnya",
      faktorUrgensiMedis: false,
      saranDrafBalasan: "Terima kasih atas penilaian yang Anda berikan kepada rumah sakit kami.",
      kepercayaan: 1,
      aspek: [],
      lokasiLayanan: [],
    };
  }

  const config = resolveAIConfig(preferredModel, customConfig);
  if (!config.apiKey && !config.baseUrl.includes("localhost") && !config.baseUrl.includes("127.0.0.1")) {
    throw new Error(`API key ${config.providerLabel} belum dikonfigurasi`);
  }

  if (config.provider === "gemini") {
    let lastError: unknown = null;
    const maksimumPercobaan = 4;
    for (let jumlahPercobaan = 0; jumlahPercobaan < maksimumPercobaan; jumlahPercobaan++) {
      try {
        return await callOnceGemini(teksUlasan, rating, 45_000, config.model, lokasi);
      } catch (error) {
        lastError = error;
        const retryable =
          error instanceof RetryableError ||
          error instanceof TypeError ||
          (error instanceof Error && error.name === "AbortError");
        if (!retryable || jumlahPercobaan === maksimumPercobaan - 1) break;
        const backoff = [5_000, 15_000, 45_000][jumlahPercobaan] ?? 45_000;
        const retryAfter = error instanceof RetryableError ? error.retryAfterMs : undefined;
        const jeda = Math.min(120_000, Math.max(backoff, retryAfter ?? 0) + Math.floor(Math.random() * 1_000));
        await new Promise((r) => setTimeout(r, jeda));
      }
    }
    throw lastError instanceof Error ? lastError : new Error("Pemanggilan Gemini AI gagal");
  }

  if (config.provider === "nvidia") {
    let lastError: unknown = null;
    let jumlahPercobaan = 0;

    while (jumlahPercobaan < MAX_ATTEMPTS_429) {
      jumlahPercobaan++;
      try {
        return await callOnceNVIDIA(teksUlasan, rating, 90_000, config.model);
      } catch (error) {
        lastError = error;
        const retryable =
          error instanceof RetryableError ||
          error instanceof TypeError ||
          (error instanceof Error && error.name === "AbortError");
        if (!retryable) break;

        let jedaMs: number;
        if (error instanceof RetryableError && error.status === 429) {
          if (jumlahPercobaan >= MAX_ATTEMPTS_429) break;
          jedaMs =
            error.retryAfterMs ?? BACKOFF_429_MS[Math.min(jumlahPercobaan - 1, BACKOFF_429_MS.length - 1)];
        } else {
          if (jumlahPercobaan >= MAX_ATTEMPTS) break;
          jedaMs = BACKOFF_MS[Math.min(jumlahPercobaan - 1, BACKOFF_MS.length - 1)];
        }
        await new Promise((r) => setTimeout(r, jedaMs));
      }
    }

    throw lastError instanceof Error ? lastError : new Error("Pemanggilan NVIDIA AI gagal");
  } else if (config.provider === "opencode") {
    let lastError: unknown = null;
    let jumlahPercobaan = 0;

    while (jumlahPercobaan < MAX_ATTEMPTS_429) {
      jumlahPercobaan++;
      try {
        return await callOnce(teksUlasan, rating, 90_000, config.model, customConfig);
      } catch (error) {
        lastError = error;
        const retryable =
          error instanceof RetryableError ||
          error instanceof TypeError ||
          (error instanceof Error && error.name === "AbortError");
        if (!retryable) break;

        let jedaMs: number;
        if (error instanceof RetryableError && error.status === 429) {
          if (jumlahPercobaan >= MAX_ATTEMPTS_429) break;
          jedaMs =
            error.retryAfterMs ?? BACKOFF_429_MS[Math.min(jumlahPercobaan - 1, BACKOFF_429_MS.length - 1)];
        } else {
          if (jumlahPercobaan >= MAX_ATTEMPTS) break;
          jedaMs = BACKOFF_MS[Math.min(jumlahPercobaan - 1, BACKOFF_MS.length - 1)];
        }
        await new Promise((r) => setTimeout(r, jedaMs));
      }
    }

    throw lastError instanceof Error ? lastError : new Error(`Pemanggilan ${config.providerLabel} gagal`);
  }

  throw new Error("Tidak ada kunci AI yang terkonfigurasi (Gemini, NVIDIA, atau Custom Provider)");
}

/**
 * Memproses beberapa ulasan dalam satu panggilan model. Jalur Gemini memakai
 * satu request sungguhan; provider lain tetap dijalankan paralel dengan
 * rate-limiter yang sudah ada agar perilakunya tetap kompatibel.
 */
export async function analisisBatchUlasanDenganAI(
  items: InputAnalisisUlasan[],
  preferredModel?: string | null,
  lokasi: LokasiLayananReferensi[] = [],
  callbacks: AIAnalisisCallbacks = {},
  customConfig?: CustomAIConfig | null
): Promise<Map<number, HasilAnalisisUlasan>> {
  const hasil = new Map<number, HasilAnalisisUlasan>();
  if (items.length === 0) return hasil;

  const config = resolveAIConfig(preferredModel, customConfig);
  if (config.provider !== "gemini") {
    let lastError: unknown = null;
    const maksimumPercobaan = 4;
    for (let jumlahPercobaan = 0; jumlahPercobaan < maksimumPercobaan; jumlahPercobaan++) {
      try {
        return await callOnceOpenAIBatch(items, 60_000, config.model, lokasi, customConfig);
      } catch (error) {
        lastError = error;
        const retryable =
          error instanceof RetryableError ||
          error instanceof TypeError ||
          (error instanceof Error && error.name === "AbortError");
        if (!retryable || jumlahPercobaan === maksimumPercobaan - 1) break;
        const backoff = [5_000, 15_000, 30_000, 60_000][jumlahPercobaan] ?? 60_000;
        const retryAfter = error instanceof RetryableError ? error.retryAfterMs : undefined;
        const jitter = Math.floor(Math.random() * 1_000);
        const jeda = Math.min(120_000, Math.max(backoff, retryAfter ?? 0) + jitter);
        console.warn(`[ai] ${config.providerLabel} batch ditunda ${jeda}ms sebelum percobaan ${jumlahPercobaan + 2}/${maksimumPercobaan}`);
        await callbacks.onRetry?.({
          percobaanBerikutnya: jumlahPercobaan + 2,
          maksimumPercobaan,
          jedaMs: jeda,
          error: error instanceof Error ? error.message.slice(0, 300) : String(error).slice(0, 300),
        });
        await new Promise((resolve) => setTimeout(resolve, jeda));
      }
    }

    if (lastError instanceof RetryableError || lastError instanceof TypeError ||
        (lastError instanceof Error && lastError.name === "AbortError")) {
      throw lastError;
    }

    console.warn(`[ai] ${config.providerLabel} batch gagal, mencoba per ulasan secara sekuensial:`, lastError);
    for (const item of items) {
      const res = await analisisUlasanDenganAI(item.teksUlasan, item.rating, preferredModel, lokasi, customConfig);
      hasil.set(item.id, res);
      await new Promise((r) => setTimeout(r, 800));
    }
    return hasil;
  }

  let lastError: unknown = null;
  const maksimumPercobaan = 5;
  for (let jumlahPercobaan = 0; jumlahPercobaan < maksimumPercobaan; jumlahPercobaan++) {
    try {
      return await callOnceGeminiBatch(items, 60_000, config.model, lokasi);
    } catch (error) {
      lastError = error;
      const retryable = error instanceof RetryableError || error instanceof TypeError ||
        (error instanceof Error && error.name === "AbortError");
      if (!retryable || jumlahPercobaan === maksimumPercobaan - 1) break;
      const backoff = [5_000, 15_000, 30_000, 60_000][jumlahPercobaan] ?? 60_000;
      const retryAfter = error instanceof RetryableError ? error.retryAfterMs : undefined;
      const jitter = Math.floor(Math.random() * 1_000);
      const jeda = Math.min(120_000, Math.max(backoff, retryAfter ?? 0) + jitter);
      console.warn(`[ai] Gemini batch ditunda ${jeda}ms sebelum percobaan ${jumlahPercobaan + 2}/${maksimumPercobaan}`);
      await callbacks.onRetry?.({
        percobaanBerikutnya: jumlahPercobaan + 2,
        maksimumPercobaan,
        jedaMs: jeda,
        error: error instanceof Error ? error.message.slice(0, 300) : String(error).slice(0, 300),
      });
      await new Promise((resolve) => setTimeout(resolve, jeda));
    }
  }

  if (lastError instanceof RetryableError || lastError instanceof TypeError ||
      (lastError instanceof Error && lastError.name === "AbortError")) {
    throw lastError;
  }

  console.warn("[ai] Gemini batch gagal, mencoba per ulasan:", lastError);
  const entries = await Promise.all(
    items.map(async (item) => [
      item.id,
      await analisisUlasanDenganAI(item.teksUlasan, item.rating, preferredModel, lokasi),
    ] as const)
  );
  return new Map(entries);
}

export function sentimenFallbackDariRating(rating: number | null): Sentimen | null {
  if (rating === null) return null;
  if (rating >= 4) return "positif";
  if (rating <= 2) return "negatif";
  return "netral";
}

const VALID_SENTIMEN: Sentimen[] = ["positif", "negatif", "netral"];

function cocokanSentimen(raw: string): Sentimen | null {
  const s = raw.toLowerCase();
  const langsung = VALID_SENTIMEN.find((v) => s.includes(v));
  if (langsung) return langsung;
  if (/positive|puas|pujian|baik|suka/.test(s)) return "positif";
  if (/negative|keluh|kecewa|buruk|marah/.test(s)) return "negatif";
  if (/neutral|mixed|campuran|biasa/.test(s)) return "netral";
  return null;
}

function extractJson(text: string): unknown {
  let cleaned = text.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
  cleaned = cleaned.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  if (!cleaned) throw new Error("Respons AI kosong");
  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(cleaned.slice(start, end + 1));
      } catch {
        // Lanjutkan mencoba parse array
      }
    }
    const startArr = cleaned.indexOf("[");
    const endArr = cleaned.lastIndexOf("]");
    if (startArr >= 0 && endArr > startArr) {
      try {
        return JSON.parse(cleaned.slice(startArr, endArr + 1));
      } catch {
        // Gagal
      }
    }
    throw new Error("Respons AI bukan JSON valid");
  }
}

function cocokanEnum<T extends string>(raw: string, valid: readonly T[], fallback: T): T {
  const lower = raw.toLowerCase().trim();
  const found = valid.find((v) => lower.includes(v.toLowerCase()));
  return found ?? fallback;
}

function cocokanBoolean(raw: unknown): boolean {
  if (typeof raw === "boolean") return raw;
  if (typeof raw === "string") return /true|yes|1|ya/gi.test(raw);
  if (typeof raw === "number") return raw !== 0;
  return false;
}

function normalizeHasil(raw: unknown, lokasi: LokasiLayananReferensi[] = []): HasilAnalisisUlasan {
  if (typeof raw !== "object" || raw === null) throw new Error("Format respons AI tidak valid");
  const obj = raw as Record<string, unknown>;

  const sentimenRaw = String(obj.sentimen ?? obj.sentiment ?? "");
  const sentimen = cocokanSentimen(sentimenRaw) ?? "netral";

  const unitLayanan = cocokanEnum(String(obj.unit_layanan ?? obj.unitLayanan ?? ""), UNIT_LAYANAN_VALID, "Lainnya");
  const kategoriMasalah = cocokanEnum(String(obj.kategori_masalah ?? obj.kategoriMasalah ?? ""), KATEGORI_MASALAH_VALID, "Lainnya");
  const faktorUrgensiMedis = cocokanBoolean(obj.faktor_urgensi_medis ?? obj.faktorUrgensiMedis ?? obj.urgent ?? false);
  const saranDrafBalasan = String(obj.saran_draf_balasan ?? obj.saranDrafBalasan ?? obj.drafBalasan ?? "").trim().slice(0, 500);
  const kepercayaan = Math.max(0, Math.min(1, Number(obj.kepercayaan ?? obj.confidence ?? 0.85)));

  const aspekRaw = Array.isArray(obj.aspek) ? obj.aspek : Array.isArray(obj.aspects) ? obj.aspects : [];
  const aspek: AspekHasil[] = [];
  for (const item of aspekRaw) {
    if (typeof item !== "object" || item === null) continue;
    const a = item as Record<string, unknown>;
    const namaMentah = String(a.aspek ?? a.aspect ?? a.nama ?? "").trim();
    const sentimenAspek = cocokanSentimen(String(a.sentimen ?? a.sentiment ?? ""));
    if (!namaMentah || !sentimenAspek) continue;
    const nama = normalisasiAspekUmum(namaMentah);
    if (aspek.some((itemAspek) => itemAspek.aspek === nama)) continue;
    aspek.push({
      aspek: nama,
      sentimen: sentimenAspek,
      kutipan: typeof a.kutipan === "string" && a.kutipan.trim() ? a.kutipan.trim().slice(0, 160) : null,
    });
  }

  const namaLokasi = new Map(lokasi.map((item) => [item.nama.toLowerCase(), item.nama]));
  const lokasiRaw = Array.isArray(obj.lokasiLayanan)
    ? obj.lokasiLayanan
    : Array.isArray(obj.lokasi_layanan)
      ? obj.lokasi_layanan
      : [];
  const lokasiLayanan = Array.from(new Set(
    lokasiRaw
      .map((item) => namaLokasi.get(String(item).trim().toLowerCase()))
      .filter((item): item is string => Boolean(item))
  )).slice(0, 3);

  return {
    sentimen,
    unitLayanan,
    kategoriMasalah,
    faktorUrgensiMedis,
    saranDrafBalasan,
    kepercayaan,
    aspek: aspek.slice(0, 3),
    lokasiLayanan,
  };
}

export async function parseResponseJson<T = unknown>(res: Response): Promise<T> {
  const text = await res.text();
  try {
    return JSON.parse(text) as T;
  } catch (err) {
    const cleaned = text.trim();
    const firstBrace = cleaned.indexOf("{");
    const lastBrace = cleaned.lastIndexOf("}");
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      try {
        return JSON.parse(cleaned.slice(firstBrace, lastBrace + 1)) as T;
      } catch {}
    }
    throw err;
  }
}

async function callOnce(
  teksUlasan: string,
  rating: number | null,
  timeoutMs: number,
  overrideModel?: string,
  customConfig?: CustomAIConfig | null
): Promise<HasilAnalisisUlasan> {
  const env = getEnv();
  const rawKey = customConfig?.apiKey || env.apiKey;
  const apiKey = rawKey.trim().replace(/^Bearer\s+/i, "").replace(/^["']|["']$/g, "");
  const baseUrl = (customConfig?.baseUrl || env.baseUrl).trim().replace(/\/chat\/completions\/?$/i, "").replace(/\/$/, "");
  const model = overrideModel || customConfig?.model || env.model;
  await tungguGiliranNVIDIA();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        temperature: 0,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: JSON.stringify({ rating, ulasan: teksUlasan }),
          },
        ],
      }),
      signal: controller.signal,
    });

    if (res.status === 429 || res.status >= 500) {
      const retryAfterDetik = Number(res.headers.get("retry-after"));
      const retryAfterMs =
        Number.isFinite(retryAfterDetik) && retryAfterDetik > 0 ? retryAfterDetik * 1000 : undefined;
      throw new RetryableError(`AI Gateway error ${res.status}`, res.status, retryAfterMs);
    }
    if (!res.ok) {
      throw new Error(`AI Gateway error ${res.status}: ${(await res.text()).slice(0, 200)}`);
    }

    const data = (await parseResponseJson(res)) as {
      choices?: { message?: { content?: string } }[];
    };
    const content = data.choices?.[0]?.message?.content ?? "";
    return normalizeHasil(extractJson(content));
  } finally {
    clearTimeout(timer);
  }
}

class RetryableError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
    public readonly retryAfterMs?: number
  ) {
    super(message);
  }
}

export function isAIErrorRetryable(error: unknown): boolean {
  return error instanceof RetryableError || error instanceof TypeError ||
    (error instanceof Error && error.name === "AbortError");
}

export function getAIErrorInfo(error: unknown): { code: string; message: string; retryable: boolean } {
  const message = error instanceof Error ? error.message : String(error);
  const status = error instanceof RetryableError ? error.status : undefined;
  return {
    code: status ? `HTTP_${status}` : error instanceof Error ? error.name || "AI_ERROR" : "AI_ERROR",
    message: message.replace(/key=[^&\s]+/gi, "key=[REDACTED]").slice(0, 500),
    retryable: isAIErrorRetryable(error),
  };
}



function getEnvNVIDIA() {
  return {
    apiKey: process.env.NVIDIA_API_KEY ?? "",
    baseUrl: (process.env.NVIDIA_BASE_URL ?? "https://integrate.api.nvidia.com/v1").replace(/\/$/, ""),
    model: process.env.NVIDIA_MODEL ?? "nemotron",
  };
}

export function aiConfiguredNVIDIA(): boolean {
  return Boolean(process.env.NVIDIA_API_KEY);
}

const PROMPT_KONDISI_UMUM = `Berdasarkan data statistik ulasan berikut, tulis SATU paragraf ringkas (maksimal 3 kalimat) dalam bahasa Indonesia yang menggambarkan kondisi umum layanan. Sebutkan kondisi sentimen secara keseluruhan dan aspek yang paling perlu diperhatikan. Balas hanya dengan paragraf tersebut tanpa tanda kutip.`;

export async function buatKondisiUmum(stats: {
  totalUlasan: number;
  totalPositif: number;
  totalNegatif: number;
  totalNetral: number;
  aspekKeluhanTeratas: string[];
  aspekPujianTeratas: string[];
}, preferredModel?: string | null, customConfig?: CustomAIConfig | null): Promise<string | null> {
  if (!aiConfigured(preferredModel, customConfig)) return null;
  const config = resolveAIConfig(preferredModel, customConfig);

  if (config.provider === "gemini") {
    try {
      const { apiKey, model } = config;
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: `${PROMPT_KONDISI_UMUM}\n\nData Statistik: ${JSON.stringify(stats)}`
            }]
          }],
          generationConfig: { temperature: 0.4 }
        }),
      });
      if (res.ok) {
        const data = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
        const content = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
        if (content) return content;
      }
    } catch {
      return null;
    }
  }

  const { apiKey, baseUrl, model } = config;
  const cleanKey = apiKey.trim().replace(/^Bearer\s+/i, "").replace(/^["']|["']$/g, "");
  const cleanBaseUrl = baseUrl.trim().replace(/\/chat\/completions\/?$/i, "").replace(/\/$/, "");

  try {
    const res = await fetch(`${cleanBaseUrl}/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${cleanKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        temperature: 0.4,
        messages: [
          { role: "system", content: PROMPT_KONDISI_UMUM },
          { role: "user", content: JSON.stringify(stats) },
        ],
      }),
    });
    if (!res.ok) return null;
    const data = (await parseResponseJson(res)) as { choices?: { message?: { content?: string } }[] };
    const content = data.choices?.[0]?.message?.content?.trim();
    return content || null;
  } catch {
    return null;
  }
}

export function kondisiUmumFallback(stats: {
  totalUlasan: number;
  totalPositif: number;
  totalNegatif: number;
  totalNetral: number;
  aspekKeluhanTeratas: string[];
  aspekPujianTeratas: string[];
}): string {
  const { totalUlasan, totalPositif, totalNegatif, aspekKeluhanTeratas, aspekPujianTeratas } = stats;
  const persenPositif = totalUlasan > 0 ? Math.round((totalPositif / totalUlasan) * 100) : 0;
  const persenNegatif = totalUlasan > 0 ? Math.round((totalNegatif / totalUlasan) * 100) : 0;

  let kalimat = `Dari ${totalUlasan} ulasan, ${persenPositif}% bernada positif dan ${persenNegatif}% negatif.`;
  if (aspekKeluhanTeratas.length > 0) {
    kalimat += ` Aspek yang paling banyak dikeluhkan adalah ${aspekKeluhanTeratas.join(", ")}.`;
  }
  if (aspekPujianTeratas.length > 0) {
    kalimat += ` Sementara itu, ${aspekPujianTeratas.join(", ")} menjadi kekuatan yang perlu dipertahankan.`;
  }
  return kalimat;
}

async function callOnceNVIDIA(
  teksUlasan: string,
  rating: number | null,
  timeoutMs: number,
  overrideModel?: string
): Promise<HasilAnalisisUlasan> {
  const { apiKey, baseUrl, model: defaultModel } = getEnvNVIDIA();
  const model = overrideModel || defaultModel;
  await tungguGiliranNVIDIA();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        temperature: 0,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: JSON.stringify({ rating, ulasan: teksUlasan }),
          },
        ],
      }),
      signal: controller.signal,
    });

    if (res.status === 429 || res.status >= 500) {
      const retryAfterDetik = Number(res.headers.get("retry-after"));
      const retryAfterMs =
        Number.isFinite(retryAfterDetik) && retryAfterDetik > 0 ? retryAfterDetik * 1000 : undefined;
      throw new RetryableError(`NVIDIA AI error ${res.status}`, res.status, retryAfterMs);
    }
    if (!res.ok) {
      throw new Error(`NVIDIA AI error ${res.status}: ${(await res.text()).slice(0, 200)}`);
    }

    const data = (await parseResponseJson(res)) as {
      choices?: { message?: { content?: string } }[];
    };
    const content = data.choices?.[0]?.message?.content ?? "";
    return normalizeHasil(extractJson(content));
  } finally {
    clearTimeout(timer);
  }
}

const MIN_REQUEST_GAP_MS_NVIDIA = 1500;
let waktuPermintaanTerakhirNVIDIA = 0;
let antreanPermintaanNVIDIA: Promise<void> = Promise.resolve();

async function tungguGiliranNVIDIA(): Promise<void> {
  const giliran = antreanPermintaanNVIDIA;
  let lepaskan: () => void = () => undefined;
  antreanPermintaanNVIDIA = new Promise<void>((resolve) => {
    lepaskan = resolve;
  });
  await giliran;
  const sejakTerakhir = Date.now() - waktuPermintaanTerakhirNVIDIA;
  if (sejakTerakhir < MIN_REQUEST_GAP_MS_NVIDIA) {
    await new Promise((r) => setTimeout(r, MIN_REQUEST_GAP_MS_NVIDIA - sejakTerakhir));
  }
  waktuPermintaanTerakhirNVIDIA = Date.now();
  lepaskan();
}

const MIN_REQUEST_GAP_MS_GEMINI = Math.max(
  0,
  Math.min(10_000, Number(process.env.GEMINI_REQUEST_GAP_MS) || 500)
);
let waktuPermintaanTerakhirGemini = 0;
let antreanPermintaanGemini: Promise<void> = Promise.resolve();

async function tungguGiliranGemini(): Promise<void> {
  const giliran = antreanPermintaanGemini;
  let lepaskan: () => void = () => undefined;
  antreanPermintaanGemini = new Promise<void>((resolve) => {
    lepaskan = resolve;
  });
  try {
    await giliran;
    const sejakTerakhir = Date.now() - waktuPermintaanTerakhirGemini;
    if (sejakTerakhir < MIN_REQUEST_GAP_MS_GEMINI) {
      await new Promise((r) => setTimeout(r, MIN_REQUEST_GAP_MS_GEMINI - sejakTerakhir));
    }
    waktuPermintaanTerakhirGemini = Date.now();
  } finally {
    lepaskan();
  }
}

async function callOnceGemini(
  teksUlasan: string,
  rating: number | null,
  timeoutMs: number,
  overrideModel?: string,
  lokasi: LokasiLayananReferensi[] = []
): Promise<HasilAnalisisUlasan> {
  const { apiKey, model: defaultModel } = getEnvGemini();
  const model = overrideModel || defaultModel;
  await tungguGiliranGemini();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: promptDenganLokasi(lokasi) }],
        },
        generationConfig: {
          responseMimeType: "application/json",
          responseJsonSchema: singleResponseSchema(lokasi),
          thinkingConfig: geminiThinkingConfig(model),
        },
        contents: [
          {
            parts: [
              {
                text: JSON.stringify({ rating, ulasan: teksUlasan }),
              },
            ],
          },
        ],
      }),
      signal: controller.signal,
    });

    if (res.status === 429 || res.status >= 500) {
      const errorText = await res.text();
      const match = errorText.match(/retry in\s+([\d\.]+)s/i);
      let retryAfterMs = match ? Math.ceil(parseFloat(match[1]) * 1000) + 1500 : undefined;
      if (!retryAfterMs) {
        const retryAfterDetik = Number(res.headers.get("retry-after"));
        retryAfterMs = Number.isFinite(retryAfterDetik) && retryAfterDetik > 0 ? retryAfterDetik * 1000 : 7000;
      }
      throw new RetryableError(`Gemini AI error ${res.status}: ${errorText.slice(0, 150)}`, res.status, retryAfterMs);
    }
    if (!res.ok) {
      throw new Error(`Gemini AI error ${res.status}: ${(await res.text()).slice(0, 200)}`);
    }

    const data = await res.json();
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    return normalizeHasil(extractJson(content), lokasi);
  } finally {
    clearTimeout(timer);
  }
}

async function callOnceGeminiBatch(
  items: InputAnalisisUlasan[],
  timeoutMs: number,
  model: string,
  lokasi: LokasiLayananReferensi[] = []
): Promise<Map<number, HasilAnalisisUlasan>> {
  const { apiKey } = getEnvGemini();
  await tungguGiliranGemini();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: `${promptDenganLokasi(lokasi)}\n\n${BATCH_SYSTEM_PROMPT.slice(SYSTEM_PROMPT.length)}` }] },
        generationConfig: {
          responseMimeType: "application/json",
          responseJsonSchema: batchResponseSchema(items, lokasi),
          thinkingConfig: geminiThinkingConfig(model),
        },
        contents: [{
          parts: [{
            text: JSON.stringify({
              ulasan: items.map((item) => ({
                id: item.id,
                rating: item.rating,
                ulasan: item.teksUlasan,
              })),
            }),
          }],
        }],
      }),
      signal: controller.signal,
    });

    if (res.status === 429 || res.status >= 500) {
      const errorText = await res.text();
      const retryAfterDetik = Number(res.headers.get("retry-after"));
      const retryAfterMs = Number.isFinite(retryAfterDetik) && retryAfterDetik > 0
        ? retryAfterDetik * 1000
        : undefined;
      throw new RetryableError(
        `Gemini batch error ${res.status}: ${errorText.slice(0, 150)}`,
        res.status,
        retryAfterMs
      );
    }
    if (!res.ok) {
      throw new Error(`Gemini batch error ${res.status}: ${(await res.text()).slice(0, 200)}`);
    }

    const data = await res.json();
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    const parsed = extractJson(content);
    if (typeof parsed !== "object" || parsed === null) {
      throw new Error("Format respons batch AI tidak valid");
    }

    const rows = (parsed as Record<string, unknown>).hasil;
    if (!Array.isArray(rows)) throw new Error("Respons batch AI tidak memiliki array hasil");

    const output = new Map<number, HasilAnalisisUlasan>();
    for (const row of rows) {
      if (typeof row !== "object" || row === null) continue;
      const id = Number((row as Record<string, unknown>).id);
      if (!items.some((item) => item.id === id) || output.has(id)) continue;
      output.set(id, normalizeHasil(row, lokasi));
    }

    if (output.size !== items.length) {
      throw new Error(`Respons batch AI tidak lengkap (${output.size}/${items.length})`);
    }
    return output;
  } finally {
    clearTimeout(timer);
  }
}

async function callOnceOpenAIBatch(
  items: InputAnalisisUlasan[],
  timeoutMs: number,
  model: string,
  lokasi: LokasiLayananReferensi[] = [],
  customConfig?: CustomAIConfig | null
): Promise<Map<number, HasilAnalisisUlasan>> {
  const env = getEnv();
  const rawKey = customConfig?.apiKey || env.apiKey;
  const apiKey = rawKey.trim().replace(/^Bearer\s+/i, "").replace(/^["']|["']$/g, "");
  const baseUrl = (customConfig?.baseUrl || env.baseUrl).trim().replace(/\/chat\/completions\/?$/i, "").replace(/\/$/, "");
  const activeModel = model || customConfig?.model || env.model;

  await tungguGiliranNVIDIA();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: activeModel,
        temperature: 0,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: `${promptDenganLokasi(lokasi)}\n\n${BATCH_SYSTEM_PROMPT.slice(SYSTEM_PROMPT.length)}`,
          },
          {
            role: "user",
            content: JSON.stringify({
              ulasan: items.map((item) => ({
                id: item.id,
                rating: item.rating,
                ulasan: item.teksUlasan,
              })),
            }),
          },
        ],
      }),
      signal: controller.signal,
    });

    if (res.status === 429 || res.status >= 500) {
      const errorText = await res.text().catch(() => "");
      const retryAfterDetik = Number(res.headers.get("retry-after"));
      const retryAfterMs =
        Number.isFinite(retryAfterDetik) && retryAfterDetik > 0 ? retryAfterDetik * 1000 : undefined;
      throw new RetryableError(
        `AI Gateway batch error ${res.status}: ${errorText.slice(0, 150)}`,
        res.status,
        retryAfterMs
      );
    }
    if (!res.ok) {
      throw new Error(`AI Gateway batch error ${res.status}: ${(await res.text()).slice(0, 200)}`);
    }

    const data = (await parseResponseJson(res)) as {
      choices?: { message?: { content?: string } }[];
    };
    const content = data.choices?.[0]?.message?.content ?? "";
    const parsed = extractJson(content);
    if (typeof parsed !== "object" || parsed === null) {
      throw new Error("Format respons batch AI tidak valid");
    }

    const rows = (parsed as Record<string, unknown>).hasil;
    if (!Array.isArray(rows)) throw new Error("Respons batch AI tidak memiliki array hasil");

    const output = new Map<number, HasilAnalisisUlasan>();
    for (const row of rows) {
      if (typeof row !== "object" || row === null) continue;
      const id = Number((row as Record<string, unknown>).id);
      if (!items.some((item) => item.id === id) || output.has(id)) continue;
      output.set(id, normalizeHasil(row, lokasi));
    }

    if (output.size !== items.length) {
      throw new Error(`Respons batch AI tidak lengkap (${output.size}/${items.length})`);
    }
    return output;
  } finally {
    clearTimeout(timer);
  }
}
