export type Sentimen = "positif" | "negatif" | "netral";

export interface AspekHasil {
  aspek: string;
  sentimen: Sentimen;
  kutipan: string | null;
}

export interface HasilAnalisisUlasan {
  sentimen: Sentimen;
  aspek: AspekHasil[];
}

const SYSTEM_PROMPT = `Anda adalah analis sentimen ulasan pelanggan berbahasa Indonesia.
Tugas Anda: menentukan sentimen keseluruhan sebuah ulasan dan mengenali aspek layanan yang disebutkan.

Aspek layanan yang umum: pelayanan, kebersihan, harga, fasilitas, kualitas produk, lokasi, parkir, kecepatan, keramahan, suasana, keamanan, variasi menu, dan aspek lain yang relevan (gunakan frasa singkat huruf kecil).

Aturan:
- Sentimen: "positif" jika ulasan memuji/memuaskan, "negatif" jika mengeluh/kecewa, "netral" jika datar atau campuran seimbang.
- Setiap aspek hanya dicantumkan jika benar-benar disebutkan dalam ulasan.
- "kutipan" berisi potongan singkat teks asli yang mendukung penilaian aspek tersebut, maksimal 120 karakter.
- Balas HANYA dengan JSON valid tanpa teks lain.`;

export function getEnv() {
  return {
    apiKey: process.env.OPENCODE_ZEN_API_KEY ?? "",
    baseUrl: (process.env.OPENCODE_ZEN_BASE_URL ?? "https://opencode.ai/zen/v1").replace(/\/$/, ""),
    model: process.env.OPENCODE_ZEN_MODEL ?? "big-pickle",
  };
}

export function aiConfigured(): boolean {
  return Boolean(process.env.OPENCODE_ZEN_API_KEY);
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

function normalizeHasil(raw: unknown): HasilAnalisisUlasan {
  if (typeof raw !== "object" || raw === null) throw new Error("Format respons AI tidak valid");
  const obj = raw as Record<string, unknown>;

  const sentimenRaw = String(obj.sentimen ?? obj.sentiment ?? "");
  const sentimen = cocokanSentimen(sentimenRaw);
  if (!sentimen) throw new Error("Sentimen tidak dikenali");

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

  return { sentimen, aspek: aspek.slice(0, 10) };
}

const MIN_REQUEST_GAP_MS = 1500;
let waktuPermintaanTerakhir = 0;
let antreanPermintaan: Promise<void> = Promise.resolve();

async function tungguGiliran(): Promise<void> {
  const giliran = antreanPermintaan;
  let lepaskan: () => void = () => undefined;
  antreanPermintaan = new Promise<void>((resolve) => {
    lepaskan = resolve;
  });
  await giliran;
  const sejakTerakhir = Date.now() - waktuPermintaanTerakhir;
  if (sejakTerakhir < MIN_REQUEST_GAP_MS) {
    await new Promise((r) => setTimeout(r, MIN_REQUEST_GAP_MS - sejakTerakhir));
  }
  waktuPermintaanTerakhir = Date.now();
  lepaskan();
}

async function callOnce(teksUlasan: string, rating: number | null, timeoutMs: number): Promise<HasilAnalisisUlasan> {
  const { apiKey, baseUrl, model } = getEnvNVIDIA();
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

const MAX_ATTEMPTS = 3;
const BACKOFF_MS = [1000, 2000, 4000];
const MAX_ATTEMPTS_429 = 6;
const BACKOFF_429_MS = [30_000, 60_000, 120_000, 240_000, 300_000];

export async function analisisUlasanDenganAI(
  teksUlasan: string,
  rating: number | null
): Promise<HasilAnalisisUlasan> {
  if (aiConfigured()) {
    let lastError: unknown = null;
    let jumlahPercobaan = 0;

    while (jumlahPercobaan < MAX_ATTEMPTS_429) {
      jumlahPercobaan++;
      try {
        return await callOnce(teksUlasan, rating, 90_000);
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

    throw lastError instanceof Error ? lastError : new Error("Pemanggilan AI gagal");
  } else if (aiConfiguredNVIDIA()) {
    let lastError: unknown = null;
    let jumlahPercobaan = 0;

    while (jumlahPercobaan < MAX_ATTEMPTS_429) {
      jumlahPercobaan++;
      try {
        return await callOnceNVIDIA(teksUlasan, rating, 90_000);
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
  }

  throw new Error("Tidak ada kunci AI yang terkonfigurasi (OpenCode Zen atau NVIDIA)");
}

export function sentimenFallbackDariRating(rating: number | null): Sentimen | null {
  if (rating === null) return null;
  if (rating >= 4) return "positif";
  if (rating <= 2) return "negatif";
  return "netral";
}

function getEnvNVIDIA() {
  return {
    apiKey: process.env.NVIDIA_API_KEY ?? "",
    baseUrl: (process.env.NVIDIA_BASE_URL ?? "https://api.nvidia.com/v1").replace(/\/$/, ""),
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
}): Promise<string | null> {
  if (!aiConfigured()) return null;
  const { apiKey, baseUrl, model } = getEnv();

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

async function callOnceNVIDIA(teksUlasan: string, rating: number | null, timeoutMs: number): Promise<HasilAnalisisUlasan> {
  const { apiKey, baseUrl, model } = getEnvNVIDIA();
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
