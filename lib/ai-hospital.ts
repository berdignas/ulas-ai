import { getEnv, getEnvGemini, aiConfigured, aiConfiguredGemini, aiConfiguredNVIDIA, parseResponseJson } from "./ai";

export type UnitLayanan = "IGD" | "Farmasi" | "Poliklinik/Dokter" | "Rawat Inap" | "Kasir/BPJS" | "Fasilitas & Parkir" | "Lainnya";
export type KategoriMasalah = "Waktu Tunggu" | "Keramahan Staf" | "Kebersihan" | "Akurasi Administrasi" | "Kompetensi Medis" | "Lainnya";
export type Sentimen = "positif" | "negatif" | "netral";

export interface HasilAnalisisRumahSakit {
  unitLayanan: UnitLayanan;
  kategoriMasalah: KategoriMasalah;
  sentimen: Sentimen;
  faktorUrgensiMedis: boolean;
  saranDrafBalasan: string;
  kepercayaan: number;
}

const UNIT_LAYANAN: UnitLayanan[] = ["IGD", "Farmasi", "Poliklinik/Dokter", "Rawat Inap", "Kasir/BPJS", "Fasilitas & Parkir", "Lainnya"];
const KATEGORI_MASALAH: KategoriMasalah[] = ["Waktu Tunggu", "Keramahan Staf", "Kebersihan", "Akurasi Administrasi", "Kompetensi Medis", "Lainnya"];
const SENTIMEN_VALID: Sentimen[] = ["positif", "negatif", "netral"];

const SYSTEM_PROMPT_RS = `Anda adalah analis mutu pelayanan rumah sakit yang memproses ulasan Google Maps.
Tugas Anda: menganalisis ulasan pasien/keluarga dan mengekstrak informasi terstruktur untuk sistem manajemen mutu rumah sakit.

ATURAN EKSTRAKSI:
1. unit_layanan: Klasifikasikan ke SATU dari: IGD, Farmasi, Poliklinik/Dokter, Rawat Inap, Kasir/BPJS, Fasilitas & Parkir, Lainnya.
   - IGD: gawat darurat, darurat, ambulance, triase, resusitasi
   - Farmasi: apotek, obat, resep, racikan, dosis, ketersediaan obat
   - Poliklinik/Dokter: poli, dokter, spesialis, konsultasi, pemeriksaan, anamnesa
   - Rawat Inap: kamar, rawat inap, perawat, bidan, kebersihan kamar, makanan
   - Kasir/BPJS: pembayaran, bpjs, klaim, kartu indonesia sehat, administrasi biaya
   - Fasilitas & Parkir: parkir, toilet, lift, wifi, makanan kantin, kebersihan umum, bangunan
   - Lainnya: jika tidak cocok kategori di atas

2. kategori_masalah: Label SATU masalah utama:
   - Waktu Tunggu: antrian lama, lambat, menunggu lama, queue, delay
   - Keramahan Staf: tidak ramah, kasar, acuh, tidak sopan, egois, sombong
   - Kebersihan: kotor, bau, tidak bersih, kumuh, sampah, jengki
   - Akurasi Administrasi: salah tagihan, salah data, lama proses, bpjs error, dokumen salah
   - Kompetensi Medis: salah diagnosis, salah obat, salah tindakan, malapraktik, kelalaian
   - Lainnya: jika tidak cocok kategori di atas

3. sentimen: "positif" (puji/puas), "negatif" (keluh/kecewa), "netral" (campuran/datar)

4. faktor_urgensi_medis (boolean): TRUE hanya jika terdeteksi INDIKASI KRISIS MEDIS/HUKUM:
   - Dugaan malapraktik, kelalaian yang berakibat fatal/cedera permanen
   - Salah obat/dosis yang berpotensi bahaya nyawa
   - Kelalaian penanganan darurat (IGD menolak pasien, delay resusitasi)
   - Diskriminasi pasien (ditolak karena BPJS, suku, agama, gender)
   - Kecelakaan pasien di fasilitas (jatuh, terbakar, kecelakaan medis)
   FALSE untuk keluhan biasa: lama antri, staf kurang ramah, kamar kotor, parkir penuh, dll.

5. saran_draf_balasan: Satu paragraf (maks 3 kalimat) draf respons resmi perwakilan RS:
   - Empatik, sopan, tidak mengakui kesalahan medis secara sepihak
   - Menyatakan akan ditindaklanjuti/internal review
   - Mencantumkan narahubung Humas/Kepuasan Pasien (telepon/email)
   - Bahasa Indonesia formal, tidak defensif

6. kepercayaan: 0.0 - 1.0 skor keyakinan analisis.

BALAS HANYA JSON VALID tanpa teks lain.`;

function cocokanEnum<T extends string>(raw: string, valid: T[], fallback: T): T {
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

function normalizeHasil(raw: unknown): HasilAnalisisRumahSakit {
  if (typeof raw !== "object" || raw === null) throw new Error("Format respons AI tidak valid");
  const obj = raw as Record<string, unknown>;

  const unitLayanan = cocokanEnum(String(obj.unit_layanan ?? obj.unitLayanan ?? ""), UNIT_LAYANAN, "Lainnya");
  const kategoriMasalah = cocokanEnum(String(obj.kategori_masalah ?? obj.kategoriMasalah ?? ""), KATEGORI_MASALAH, "Lainnya");
  const sentimen = cocokanEnum(String(obj.sentimen ?? obj.sentiment ?? ""), SENTIMEN_VALID, "netral");
  const faktorUrgensiMedis = cocokanBoolean(obj.faktor_urgensi_medis ?? obj.faktorUrgensiMedis ?? obj.urgent ?? false);
  const saranDrafBalasan = String(obj.saran_draf_balasan ?? obj.saranDrafBalasan ?? obj.drafBalasan ?? "").trim().slice(0, 500);
  const kepercayaan = Math.max(0, Math.min(1, Number(obj.kepercayaan ?? obj.confidence ?? 0.8)));

  return { unitLayanan, kategoriMasalah, sentimen, faktorUrgensiMedis, saranDrafBalasan, kepercayaan };
}

const MIN_REQUEST_GAP_MS = 1500;
let waktuPermintaanTerakhir = 0;
let antreanPermintaan: Promise<void> = Promise.resolve();

async function tungguGiliran(): Promise<void> {
  const giliran = antreanPermintaan;
  let lepaskan: () => void = () => undefined;
  antreanPermintaan = new Promise<void>((resolve) => { lepaskan = resolve; });
  await giliran;
  const sejakTerakhir = Date.now() - waktuPermintaanTerakhir;
  if (sejakTerakhir < MIN_REQUEST_GAP_MS) {
    await new Promise((r) => setTimeout(r, MIN_REQUEST_GAP_MS - sejakTerakhir));
  }
  waktuPermintaanTerakhir = Date.now();
  lepaskan();
}

async function callOnce(teksUlasan: string, rating: number | null, timeoutMs: number): Promise<HasilAnalisisRumahSakit> {
  const { apiKey, baseUrl, model } = getEnv();
  await tungguGiliran();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(`${getEnv().baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${getEnv().apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: getEnv().model,
        temperature: 0,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM_PROMPT_RS },
          { role: "user", content: JSON.stringify({ rating, ulasan: teksUlasan }) },
        ],
      }),
      signal: controller.signal,
    });

    if (res.status === 429 || res.status >= 500) {
      const retryAfterDetik = Number(res.headers.get("retry-after"));
      const retryAfterMs = Number.isFinite(retryAfterDetik) && retryAfterDetik > 0 ? retryAfterDetik * 1000 : undefined;
      throw new RetryableError(`AI Gateway error ${res.status}`, res.status, retryAfterMs);
    }
    if (!res.ok) {
      throw new Error(`AI Gateway error ${res.status}: ${(await res.text()).slice(0, 200)}`);
    }

    const data = (await parseResponseJson(res)) as { choices?: { message?: { content?: string } }[] };
    const content = data.choices?.[0]?.message?.content ?? "";
    return normalizeHasil(extractJson(content));
  } finally {
    clearTimeout(timer);
  }
}

class RetryableError extends Error {
  constructor(message: string, public readonly status?: number, public readonly retryAfterMs?: number) { super(message); }
}

const MAX_ATTEMPTS = 3;
const BACKOFF_MS = [1000, 2000, 4000];
const MAX_ATTEMPTS_429 = 6;
const BACKOFF_429_MS = [30_000, 60_000, 120_000, 240_000, 300_000];

export async function analisisUlasanRumahSakit(teksUlasan: string, rating: number | null): Promise<HasilAnalisisRumahSakit> {
  const configured = aiConfigured();

  if (!configured) {
    return {
      unitLayanan: "Lainnya",
      kategoriMasalah: "Lainnya",
      sentimen: rating !== null ? (rating >= 4 ? "positif" : rating <= 2 ? "negatif" : "netral") : "netral",
      faktorUrgensiMedis: false,
      saranDrafBalasan: "Terima kasih atas ulasan Anda. Kami akan menindaklanjuti masukan ini. Hubungi Humas: (021) 1234567 / humas@rumahsakit.id",
      kepercayaan: 0.3,
    };
  }

  if (aiConfiguredGemini()) {
    let lastError: unknown = null;
    let jumlahPercobaan = 0;

    while (jumlahPercobaan < MAX_ATTEMPTS_429) {
      jumlahPercobaan++;
      try {
        return await callOnceGeminiHospital(teksUlasan, rating, 90_000);
      } catch (error) {
        lastError = error;
        const retryable = error instanceof RetryableError || error instanceof TypeError || (error instanceof Error && error.name === "AbortError");
        if (!retryable) break;

        let jedaMs: number;
        if (error instanceof RetryableError && error.status === 429) {
          if (jumlahPercobaan >= MAX_ATTEMPTS_429) break;
          jedaMs = error.retryAfterMs ?? BACKOFF_429_MS[Math.min(jumlahPercobaan - 1, BACKOFF_429_MS.length - 1)];
        } else {
          if (jumlahPercobaan >= MAX_ATTEMPTS) break;
          jedaMs = BACKOFF_MS[Math.min(jumlahPercobaan - 1, BACKOFF_MS.length - 1)];
        }
        await new Promise((r) => setTimeout(r, jedaMs));
      }
    }
    console.warn("[ai-hospital] Gemini gagal, mencoba fallback NVIDIA/OpenCode:", lastError);
  }

  if (aiConfiguredNVIDIA()) {
    let lastError: unknown = null;
    let jumlahPercobaan = 0;

    while (jumlahPercobaan < MAX_ATTEMPTS_429) {
      jumlahPercobaan++;
      try {
        return await callOnceNVIDIAhospital(teksUlasan, rating, 90_000);
      } catch (error) {
        lastError = error;
        const retryable = error instanceof RetryableError || error instanceof TypeError || (error instanceof Error && error.name === "AbortError");
        if (!retryable) break;

        let jedaMs: number;
        if (error instanceof RetryableError && error.status === 429) {
          if (jumlahPercobaan >= MAX_ATTEMPTS_429) break;
          jedaMs = error.retryAfterMs ?? BACKOFF_429_MS[Math.min(jumlahPercobaan - 1, BACKOFF_429_MS.length - 1)];
        } else {
          if (jumlahPercobaan >= MAX_ATTEMPTS) break;
          jedaMs = BACKOFF_MS[Math.min(jumlahPercobaan - 1, BACKOFF_MS.length - 1)];
        }
        await new Promise((r) => setTimeout(r, jedaMs));
      }
    }

    throw lastError instanceof Error ? lastError : new Error("Pemanggilan NVIDIA AI gagal");
  }

  if (Boolean(process.env.OPENCODE_ZEN_API_KEY)) {
    let lastError: unknown = null;
    let jumlahPercobaan = 0;

    while (jumlahPercobaan < MAX_ATTEMPTS_429) {
      jumlahPercobaan++;
      try {
        return await callOnce(teksUlasan, rating, 90_000);
      } catch (error) {
        lastError = error;
        const retryable = error instanceof RetryableError || error instanceof TypeError || (error instanceof Error && error.name === "AbortError");
        if (!retryable) break;

        let jedaMs: number;
        if (error instanceof RetryableError && error.status === 429) {
          if (jumlahPercobaan >= MAX_ATTEMPTS_429) break;
          jedaMs = error.retryAfterMs ?? BACKOFF_429_MS[Math.min(jumlahPercobaan - 1, BACKOFF_429_MS.length - 1)];
        } else {
          if (jumlahPercobaan >= MAX_ATTEMPTS) break;
          jedaMs = BACKOFF_MS[Math.min(jumlahPercobaan - 1, BACKOFF_MS.length - 1)];
        }
        await new Promise((r) => setTimeout(r, jedaMs));
      }
    }

    throw lastError instanceof Error ? lastError : new Error("Pemanggilan OpenCode Zen gagal");
  }

  throw new Error("Tidak ada kunci AI yang terkonfigurasi");
}

async function callOnceNVIDIAhospital(teksUlasan: string, rating: number | null, timeoutMs: number): Promise<HasilAnalisisRumahSakit> {
  const { apiKey, baseUrl, model } = getEnvNVIDIAfromHospital();
  await tungguGiliranNVIDIAhospital();
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
          { role: "system", content: SYSTEM_PROMPT_RS },
          { role: "user", content: JSON.stringify({ rating, ulasan: teksUlasan }) },
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

    const data = (await parseResponseJson(res)) as { choices?: { message?: { content?: string } }[] };
    const content = data.choices?.[0]?.message?.content ?? "";
    return normalizeHasil(extractJson(content));
  } finally {
    clearTimeout(timer);
  }
}

const MIN_REQUEST_GAP_MS_NVIDIA_HOSPITAL = 1500;
let waktuPermintaanTerakhirNVIDIAHospital = 0;
let antreanPermintaanNVIDIAHospital: Promise<void> = Promise.resolve();

async function tungguGiliranNVIDIAhospital(): Promise<void> {
  const giliran = antreanPermintaanNVIDIAHospital;
  let lepaskan: () => void = () => undefined;
  antreanPermintaanNVIDIAHospital = new Promise<void>((resolve) => { lepaskan = resolve; });
  await giliran;
  const sejakTerakhir = Date.now() - waktuPermintaanTerakhirNVIDIAHospital;
  if (sejakTerakhir < MIN_REQUEST_GAP_MS_NVIDIA_HOSPITAL) {
    await new Promise((r) => setTimeout(r, MIN_REQUEST_GAP_MS_NVIDIA_HOSPITAL - sejakTerakhir));
  }
  waktuPermintaanTerakhirNVIDIAHospital = Date.now();
  lepaskan();
}

function getEnvNVIDIAfromHospital() {
  return {
    apiKey: process.env.NVIDIA_API_KEY ?? "",
    baseUrl: (process.env.NVIDIA_BASE_URL ?? "https://api.nvidia.com/v1").replace(/\/$/, ""),
    model: process.env.NVIDIA_MODEL ?? "nemotron",
  };
}

const MIN_REQUEST_GAP_MS_GEMINI_HOSPITAL = 800;
let waktuPermintaanTerakhirGeminiHospital = 0;
let antreanPermintaanGeminiHospital: Promise<void> = Promise.resolve();

async function tungguGiliranGeminiHospital(): Promise<void> {
  const giliran = antreanPermintaanGeminiHospital;
  let lepaskan: () => void = () => undefined;
  antreanPermintaanGeminiHospital = new Promise<void>((resolve) => { lepaskan = resolve; });
  await giliran;
  const sejakTerakhir = Date.now() - waktuPermintaanTerakhirGeminiHospital;
  if (sejakTerakhir < MIN_REQUEST_GAP_MS_GEMINI_HOSPITAL) {
    await new Promise((r) => setTimeout(r, MIN_REQUEST_GAP_MS_GEMINI_HOSPITAL - sejakTerakhir));
  }
  waktuPermintaanTerakhirGeminiHospital = Date.now();
  lepaskan();
}

async function callOnceGeminiHospital(teksUlasan: string, rating: number | null, timeoutMs: number): Promise<HasilAnalisisRumahSakit> {
  const { apiKey, model } = getEnvGemini();
  await tungguGiliranGeminiHospital();
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
          parts: [{ text: SYSTEM_PROMPT_RS }],
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
      const retryAfterDetik = Number(res.headers.get("retry-after"));
      const retryAfterMs = Number.isFinite(retryAfterDetik) && retryAfterDetik > 0 ? retryAfterDetik * 1000 : undefined;
      throw new RetryableError(`Gemini AI error ${res.status}`, res.status, retryAfterMs);
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

export async function prosesBatchAnalisis(ulasans: Array<{ id: number; teksUlasan: string; rating: number | null }>, onProgress?: (done: number, total: number) => void): Promise<Map<number, HasilAnalisisRumahSakit>> {
  const hasil = new Map<number, HasilAnalisisRumahSakit>();
  const CONCURRENCY = 2;
  const queue = [...ulasans];
  const workers = Array.from({ length: Math.min(CONCURRENCY, queue.length) }, async () => {
    while (queue.length > 0) {
      const item = queue.shift();
      if (!item) break;
      try {
        const res = await analisisUlasanRumahSakit(item.teksUlasan, item.rating);
        hasil.set(item.id, res);
      } catch (e) {
        console.error(`AI gagal untuk ulasan ${item.id}:`, e);
        hasil.set(item.id, {
          unitLayanan: "Lainnya",
          kategoriMasalah: "Lainnya",
          sentimen: "netral",
          faktorUrgensiMedis: false,
          saranDrafBalasan: "Terima kasih atas ulasan Anda. Kami akan menindaklanjuti masukan ini. Hubungi Humas: (021) 1234567 / humas@rumahsakit.id",
          kepercayaan: 0.1,
        });
      }
      if (onProgress) onProgress(hasil.size, ulasans.length);
    }
  });
  await Promise.all(workers);
  return hasil;
}