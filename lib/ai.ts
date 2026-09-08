import { isAIModelConfigured, resolveAIConfig } from "./ai-config";

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
}

export interface InputAnalisisUlasan {
  id: number;
  teksUlasan: string;
  rating: number | null;
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

6. aspek: Array aspek layanan spesifik yang disebutkan dalam ulasan:
   - "aspek": frasa singkat huruf kecil (contoh: "keramahan perawat", "kebersihan kamar mandi", "waktu tunggu obat", "kejelasan dokter", "kecepatan pelayanan", "kenyamanan ruang tunggu")
   - "sentimen": "positif" | "negatif" | "netral"
   - "kutipan": kutipan kalimat asli pendukung ulasan (maksimal 120 karakter)

Balas HANYA dengan JSON valid:
{
  "unitLayanan": "IGD"|"Farmasi"|"Poliklinik/Dokter"|"Rawat Inap"|"Kasir/BPJS"|"Fasilitas & Parkir"|"Lainnya",
  "kategoriMasalah": "Waktu Tunggu"|"Keramahan Staf"|"Kebersihan"|"Akurasi Administrasi"|"Kompetensi Medis"|"Lainnya",
  "sentimen": "positif"|"negatif"|"netral",
  "faktorUrgensiMedis": boolean,
  "saranDrafBalasan": string,
  "kepercayaan": number,
  "aspek": [
    { "aspek": string, "sentimen": "positif"|"negatif"|"netral", "kutipan": string }
  ]
}`;

const BATCH_SYSTEM_PROMPT = `${SYSTEM_PROMPT}

MODE BATCH (aturan ini menggantikan format jawaban tunggal di atas):
- Input berisi array "ulasan". Analisis SETIAP item secara independen.
- Salin "id" input ke hasil yang sesuai. Jangan menghilangkan, menggabungkan, atau menambah item.
- Balas hanya dengan JSON valid berbentuk:
{"hasil":[{"id":number,"unitLayanan":string,"kategoriMasalah":string,"sentimen":string,"faktorUrgensiMedis":boolean,"saranDrafBalasan":string,"kepercayaan":number,"aspek":[{"aspek":string,"sentimen":string,"kutipan":string}]}]}`;

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

export function aiConfigured(preferredModel?: string | null): boolean {
  return isAIModelConfigured(preferredModel);
}

const MAX_ATTEMPTS = 3;
const BACKOFF_MS = [1000, 2000, 4000];
const MAX_ATTEMPTS_429 = 6;
const BACKOFF_429_MS = [30_000, 60_000, 120_000, 240_000, 300_000];

export async function analisisUlasanDenganAI(
  teksUlasan: string,
  rating: number | null,
  preferredModel?: string | null
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
    };
  }

  const config = resolveAIConfig(preferredModel);
  if (!config.apiKey) {
    throw new Error(`API key ${config.providerLabel} belum dikonfigurasi di Vercel`);
  }

  if (config.provider === "gemini") {
    let lastError: unknown = null;
    for (let jumlahPercobaan = 0; jumlahPercobaan < 2; jumlahPercobaan++) {
      try {
        return await callOnceGemini(teksUlasan, rating, 45_000, config.model);
      } catch (error) {
        lastError = error;
        const retryable =
          error instanceof RetryableError ||
          error instanceof TypeError ||
          (error instanceof Error && error.name === "AbortError");
        if (!retryable || jumlahPercobaan === 1) break;
        await new Promise((r) => setTimeout(r, 1500));
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
        return await callOnce(teksUlasan, rating, 90_000, config.model);
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

    throw lastError instanceof Error ? lastError : new Error("Pemanggilan OpenCode Zen gagal");
  }

  throw new Error("Tidak ada kunci AI yang terkonfigurasi (Gemini, NVIDIA, atau OpenCode Zen)");
}

/**
 * Memproses beberapa ulasan dalam satu panggilan model. Jalur Gemini memakai
 * satu request sungguhan; provider lain tetap dijalankan paralel dengan
 * rate-limiter yang sudah ada agar perilakunya tetap kompatibel.
 */
export async function analisisBatchUlasanDenganAI(
  items: InputAnalisisUlasan[],
  preferredModel?: string | null
): Promise<Map<number, HasilAnalisisUlasan>> {
  const hasil = new Map<number, HasilAnalisisUlasan>();
  if (items.length === 0) return hasil;

  const config = resolveAIConfig(preferredModel);
  if (items.length === 1 || config.provider !== "gemini") {
    const entries = await Promise.all(
      items.map(async (item) => [
        item.id,
        await analisisUlasanDenganAI(item.teksUlasan, item.rating, preferredModel),
      ] as const)
    );
    return new Map(entries);
  }

  let lastError: unknown = null;
  for (let jumlahPercobaan = 0; jumlahPercobaan < 2; jumlahPercobaan++) {
    try {
      return await callOnceGeminiBatch(items, 60_000, config.model);
    } catch (error) {
      lastError = error;
      if (!(error instanceof RetryableError) && !(error instanceof TypeError)) break;
      if (jumlahPercobaan === 1) break;
      await new Promise((resolve) => setTimeout(resolve, 1500));
    }
  }

  console.warn("[ai] Gemini batch gagal, mencoba per ulasan:", lastError);
  const entries = await Promise.all(
    items.map(async (item) => [
      item.id,
      await analisisUlasanDenganAI(item.teksUlasan, item.rating, preferredModel),
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
  const cleaned = text.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
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
        throw new Error("Respons AI bukan JSON valid");
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

function normalizeHasil(raw: unknown): HasilAnalisisUlasan {
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
    const nama = String(a.aspek ?? a.aspect ?? a.nama ?? "").trim().toLowerCase();
    const sentimenAspek = cocokanSentimen(String(a.sentimen ?? a.sentiment ?? ""));
    if (!nama || !sentimenAspek) continue;
    aspek.push({
      aspek: nama.slice(0, 80),
      sentimen: sentimenAspek,
      kutipan: typeof a.kutipan === "string" && a.kutipan.trim() ? a.kutipan.trim().slice(0, 160) : null,
    });
  }

  return {
    sentimen,
    unitLayanan,
    kategoriMasalah,
    faktorUrgensiMedis,
    saranDrafBalasan,
    kepercayaan,
    aspek: aspek.slice(0, 10),
  };
}

async function callOnce(
  teksUlasan: string,
  rating: number | null,
  timeoutMs: number,
  overrideModel?: string
): Promise<HasilAnalisisUlasan> {
  const { apiKey, baseUrl, model: defaultModel } = getEnv();
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
      throw new RetryableError(`AI Gateway error ${res.status}`, res.status, retryAfterMs);
    }
    if (!res.ok) {
      throw new Error(`AI Gateway error ${res.status}: ${(await res.text()).slice(0, 200)}`);
    }

    const data = (await res.json()) as {
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
}, preferredModel?: string | null): Promise<string | null> {
  if (!aiConfigured(preferredModel)) return null;
  const config = resolveAIConfig(preferredModel);

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

  try {
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
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
    const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
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

    const data = (await res.json()) as {
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

const MIN_REQUEST_GAP_MS_GEMINI = 2000;
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
  overrideModel?: string
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
          parts: [{ text: SYSTEM_PROMPT }],
        },
        generationConfig: {
          responseMimeType: "application/json",
          temperature: 0,
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
    return normalizeHasil(extractJson(content));
  } finally {
    clearTimeout(timer);
  }
}

async function callOnceGeminiBatch(
  items: InputAnalisisUlasan[],
  timeoutMs: number,
  model: string
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
        systemInstruction: { parts: [{ text: BATCH_SYSTEM_PROMPT }] },
        generationConfig: {
          responseMimeType: "application/json",
          temperature: 0,
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
      output.set(id, normalizeHasil(row));
    }

    if (output.size !== items.length) {
      throw new Error(`Respons batch AI tidak lengkap (${output.size}/${items.length})`);
    }
    return output;
  } finally {
    clearTimeout(timer);
  }
}
