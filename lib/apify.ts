import { supabase, toCamel, toSnake } from "./db";
import { rumahSakit, ulasan, sinkronLog, analisis, RumahSakitRow, AnalisisRow, SinkronLogRow, UlasanRow } from "./db/schema";
import { mulaiProsesAnalisis } from "./analyzer";

export interface ApifyReview {
  reviewId: string;
  authorName: string;
  rating: number;
  text: string;
  publishedAt: string;
  language: string;
  responseFromOwner?: string;
  responseFromOwnerDate?: string;
}

export interface ApifyRunResult {
  items: ApifyReview[];
  totalCount: number;
}

export interface SinkronResult {
  sukses: boolean;
  ulasanBaru: number;
  ulasanKrisis: number;
  pesanError?: string;
}

export type PeriodeScraping = "1d" | "1w" | "1m" | "1y";

const APIFY_BASE_URL = "https://api.apify.com/v2";

function formatActorId(actorId: string): string {
  const trimmed = actorId.trim();
  if (trimmed.includes("/")) {
    return trimmed.replace("/", "~");
  }
  return trimmed;
}

async function panggilApifyActor(actorId: string, token: string, input: Record<string, unknown>): Promise<{ runId: string; defaultDatasetId: string }> {
  const safeActorId = formatActorId(actorId);
  const res = await fetch(`${APIFY_BASE_URL}/acts/${safeActorId}/runs?token=${token}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const responseText = await res.text();
  console.log('[Apify] Start actor response:', res.status, responseText.slice(0, 500));
  if (!res.ok) {
    throw new Error(`Apify actor start gagal: ${res.status} ${responseText || '(empty body)'}`);
  }
  if (!responseText) throw new Error('Apify response body kosong');
  const json = JSON.parse(responseText);
  const runId = json.data?.id || json.id || json.runId;
  const defaultDatasetId = json.data?.defaultDatasetId || json.defaultDatasetId;
  if (!runId) throw new Error('Apify response tidak memiliki run ID valid');
  return { runId, defaultDatasetId };
}

async function tungguRunSelesai(actorId: string, runId: string, token: string, timeoutMs = 180_000): Promise<{ status: string; defaultDatasetId: string }> {
  const mulai = Date.now();
  while (Date.now() - mulai < timeoutMs) {
    const res = await fetch(`${APIFY_BASE_URL}/actor-runs/${runId}?token=${token}`);
    const responseText = await res.text();
    console.log('[Apify] Poll status:', res.status, responseText.slice(0, 500));
    if (!res.ok) throw new Error(`Cek status run gagal: ${res.status} ${responseText || '(empty)'}`);
    if (!responseText) throw new Error('Apify poll response body kosong');
    const data = JSON.parse(responseText);
    const status = data.data?.status || data.status;
    const defaultDatasetId = data.data?.defaultDatasetId || data.defaultDatasetId;
    if (status === "SUCCEEDED") return { status, defaultDatasetId };
    if (status === "FAILED" || status === "ABORTED" || status === "TIMED-OUT") {
      throw new Error(`Apify run gagal: ${status}`);
    }
    await new Promise((r) => setTimeout(r, 3000));
  }
  throw new Error("Apify run timeout");
}

async function ambilDatasetItems(datasetId: string, token: string): Promise<Record<string, unknown>[]> {
  const res = await fetch(`${APIFY_BASE_URL}/datasets/${datasetId}/items?token=${token}&clean=true`);
  const responseText = await res.text();
  console.log('[Apify] Fetch dataset:', res.status, responseText.slice(0, 500));
  if (!res.ok) throw new Error(`Ambil dataset gagal: ${res.status} ${responseText || '(empty)'}`);
  if (!responseText) throw new Error('Apify dataset response body kosong');
  return JSON.parse(responseText) as Record<string, unknown>[];
}

function parseRating(val: unknown): number | null {
  if (val === null || val === undefined) return null;
  const num = typeof val === "number" ? val : parseFloat(String(val));
  return Number.isFinite(num) && num >= 1 && num <= 5 ? Math.round(num) : null;
}

function extractTanggalApify(r: Record<string, unknown>): { iso: string; dateObj: Date } {
  const rawDate = (r.publishedAtDate as string) || (r.publishedAt as string) || (r.publishAt as string) || (r.date as string) || (r.reviewDate as string) || (r.scrapedAt as string);
  if (!rawDate) {
    const now = new Date();
    return { iso: now.toISOString(), dateObj: now };
  }

  const d = new Date(rawDate);
  if (!isNaN(d.getTime())) {
    return { iso: d.toISOString(), dateObj: d };
  }

  const str = String(rawDate).toLowerCase().trim();
  const now = new Date();
  let msAgo = 0;

  const matchNum = str.match(/(\d+)/);
  const num = matchNum ? parseInt(matchNum[1], 10) : 1;

  if (str.includes("menit") || str.includes("minute")) {
    msAgo = num * 60 * 1000;
  } else if (str.includes("jam") || str.includes("hour")) {
    msAgo = num * 60 * 60 * 1000;
  } else if (str.includes("hari") || str.includes("day")) {
    msAgo = num * 24 * 60 * 60 * 1000;
  } else if (str.includes("minggu") || str.includes("week")) {
    msAgo = num * 7 * 24 * 60 * 60 * 1000;
  } else if (str.includes("bulan") || str.includes("month")) {
    msAgo = num * 30 * 24 * 60 * 60 * 1000;
  } else if (str.includes("tahun") || str.includes("year")) {
    msAgo = num * 365 * 24 * 60 * 60 * 1000;
  }

  const calculatedDate = new Date(now.getTime() - msAgo);
  return { iso: calculatedDate.toISOString(), dateObj: calculatedDate };
}

function extractReviewData(r: Record<string, unknown>) {
  const userObj = typeof r.user === "object" && r.user !== null ? (r.user as Record<string, unknown>) : null;
  const namaPengulas =
    (typeof r.name === "string" && r.name.trim()) ||
    (typeof r.authorName === "string" && r.authorName.trim()) ||
    (typeof r.authorTitle === "string" && r.authorTitle.trim()) ||
    (typeof r.reviewerName === "string" && r.reviewerName.trim()) ||
    (userObj && typeof userObj.name === "string" && userObj.name.trim()) ||
    (typeof r.author === "string" && r.author.trim()) ||
    "Pengulas Google";

  const rating = parseRating(r.stars ?? r.rating ?? r.star ?? r.score ?? r.starsCount);

  const teksUlasan =
    (typeof r.text === "string" && r.text) ||
    (typeof r.textTranslated === "string" && r.textTranslated) ||
    (typeof r.reviewText === "string" && r.reviewText) ||
    (typeof r.comment === "string" && r.comment) ||
    (typeof r.snippet === "string" && r.snippet) ||
    "";

  const { iso: tanggalUlasan, dateObj: tglReview } = extractTanggalApify(r);

  const reviewId =
    (typeof r.reviewId === "string" && r.reviewId.trim()) ||
    (typeof r.id === "string" && r.id.trim()) ||
    (typeof r.reviewerId === "string" && r.reviewerId.trim()) ||
    (typeof r.review_id === "string" && r.review_id.trim()) ||
    `apify_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

  return { namaPengulas, rating, teksUlasan, tanggalUlasan, tglReview, reviewId };
}

export async function jalankanSinkronHarian(
  rumahSakitId: number,
  tipePemicu: "otomatis" | "manual" = "otomatis",
  periode: PeriodeScraping = "1d"
): Promise<SinkronResult> {
  const { data: rsRaw } = await supabase.from(rumahSakit).select("*").eq("id", rumahSakitId).limit(1);
  const rs = toCamel<RumahSakitRow>(rsRaw?.[0]);
  if (!rs) return { sukses: false, ulasanBaru: 0, ulasanKrisis: 0, pesanError: "Rumah sakit tidak ditemukan" };
  if (!rs.apifyToken || !rs.googleMapsPlaceId) {
    return { sukses: false, ulasanBaru: 0, ulasanKrisis: 0, pesanError: "Konfigurasi Apify/Place ID belum lengkap" };
  }

  const { data: logRaw, error: logErr } = await supabase.from(sinkronLog)
    .insert(toSnake({
      rumahSakitId,
      dimulaiPada: new Date().toISOString(),
      status: "berjalan",
      tipePemicu,
    }))
    .select("id");
  if (logErr || !logRaw?.[0]?.id) return { sukses: false, ulasanBaru: 0, ulasanKrisis: 0, pesanError: "Gagal membuat log sinkron: " + (logErr?.message || "") };
  const logId = logRaw[0].id;

  try {
    const sekarang = new Date();
    
    // Konfigurasi batas waktu & maxReviews berdasarkan periode scraping
    let msPeriode = 24 * 60 * 60 * 1000; // default 1 hari
    let maxReviews = 20;

    if (periode === "1w") {
      msPeriode = 7 * 24 * 60 * 60 * 1000; // 1 minggu
      maxReviews = 100;
    } else if (periode === "1m") {
      msPeriode = 30 * 24 * 60 * 60 * 1000; // 1 bulan
      maxReviews = 300;
    } else if (periode === "1y") {
      msPeriode = 365 * 24 * 60 * 60 * 1000; // 1 tahun
      maxReviews = 1000;
    }

    const batasWaktu = new Date(sekarang.getTime() - msPeriode);

    const labelPeriodeMap: Record<PeriodeScraping, string> = {
      "1d": "1 Hari",
      "1w": "1 Minggu",
      "1m": "1 Bulan",
      "1y": "1 Tahun",
    };

    const { data: existingAnalisisRaw } = await supabase.from(analisis)
      .select("*")
      .eq("rumah_sakit_id", rumahSakitId)
      .order("tanggal_unggah", { ascending: false })
      .limit(1);
    const existingAnalisis = toCamel<AnalisisRow>(existingAnalisisRaw?.[0]);

    let analisisAktif = existingAnalisis;
    if (!analisisAktif) {
      const { data: baruRaw, error: baruErr } = await supabase.from(analisis)
        .insert(toSnake({
          rumahSakitId,
          namaFile: `Sinkron Apify (${labelPeriodeMap[periode]}) ${sekarang.toISOString().split("T")[0]}`,
          tanggalUnggah: sekarang.toISOString(),
          status: "berjalan",
        }))
        .select("id");
      if (baruErr || !baruRaw?.[0]?.id) throw new Error("Gagal membuat analisis: " + (baruErr?.message || ""));
      
      const { data: analisisAktifRaw } = await supabase.from(analisis).select("*").eq("id", baruRaw[0].id).limit(1);
      analisisAktif = toCamel<AnalisisRow>(analisisAktifRaw?.[0]);
    }

    if (!analisisAktif) throw new Error("Gagal memastikan analisis aktif");

    const targetPlace = (rs.googleMapsPlaceId || "").trim();
    const targetUrl = targetPlace.startsWith("http")
      ? targetPlace
      : `https://www.google.com/maps/place/?q=place_id:${encodeURIComponent(targetPlace)}`;

    const input: Record<string, unknown> = {
      startUrls: [{ url: targetUrl }],
      maxReviews,
      oneReviewPerRow: true,
      sort: "newest",
      language: "id",
    };

    if (!targetPlace.startsWith("http")) {
      input.placeIds = [targetPlace];
    }

    const { runId, defaultDatasetId: datasetIdAwal } = await panggilApifyActor(rs.apifyActorId!, rs.apifyToken!, input);
    await tungguRunSelesai(rs.apifyActorId!, runId, rs.apifyToken!);
    const rawItems = await ambilDatasetItems(datasetIdAwal, rs.apifyToken!);

    const reviews: Record<string, unknown>[] = [];
    for (const item of rawItems) {
      if (item && Array.isArray(item.reviews) && item.reviews.length > 0) {
        reviews.push(...(item.reviews as Record<string, unknown>[]));
      } else if (item) {
        reviews.push(item);
      }
    }

    let ulasanBaru = 0;
    const ulasanKrisis = 0;

    for (const r of reviews) {
      const { namaPengulas, rating, teksUlasan, tanggalUlasan, tglReview, reviewId } = extractReviewData(r);
      if (tglReview < batasWaktu) continue;

      const { data: existingRows } = await supabase.from(ulasan).select("id").eq("review_id", reviewId).limit(1);
      if (existingRows && existingRows.length) continue;

      const analisisId = analisisAktif.id;
      const rsId = rumahSakitId;

      await supabase.from(ulasan).insert(toSnake({
        analisisId,
        rumahSakitId: rsId,
        reviewId,
        namaPengulas,
        rating,
        teksUlasan,
        tanggalUlasan,
        bahasa: (r.language as string) ?? "id",
        sentimen: null,
        sumberLabel: null,
        unitLayanan: "Lainnya",
        kategoriMasalah: "Lainnya",
        faktorUrgensiMedis: false,
        saranDrafBalasan: null,
        statusTindakLanjut: "baru",
        dataMentah: JSON.stringify(r),
        dibuatPada: new Date().toISOString(),
        diperbaruiPada: new Date().toISOString(),
      }));

      ulasanBaru++;
    }

    if (analisisAktif) {
      await supabase.from(analisis)
        .update(toSnake({ totalUlasan: (analisisAktif.totalUlasan || 0) + ulasanBaru, status: "berjalan" }))
        .eq("id", analisisAktif.id);

      // OTOMATIS JALANKAN ANALISIS ASPEK & SENTIMEN NVIDIA AI
      if (ulasanBaru > 0) {
        mulaiProsesAnalisis(analisisAktif.id);
      } else {
        await supabase.from(analisis)
          .update(toSnake({ status: "selesai" }))
          .eq("id", analisisAktif.id);
      }
    }

    await supabase.from(sinkronLog)
      .update(toSnake({
        selesaiPada: new Date().toISOString(),
        status: "selesai",
        ulasanBaru,
        ulasanDiproses: 0,
        ulasanKrisis,
      }))
      .eq("id", logId);

    return { sukses: true, ulasanBaru, ulasanKrisis };
  } catch (error) {
    const pesan = error instanceof Error ? error.message : "Kesalahan tidak diketahui";
    await supabase.from(sinkronLog)
      .update(toSnake({ selesaiPada: new Date().toISOString(), status: "gagal", pesanError: pesan }))
      .eq("id", logId);
    return { sukses: false, ulasanBaru: 0, ulasanKrisis: 0, pesanError: pesan };
  }
}

export async function ambilRiwayatSinkron(rumahSakitId: number, limit = 20): Promise<SinkronLogRow[]> {
  const { data } = await supabase.from(sinkronLog)
    .select("*")
    .eq("rumah_sakit_id", rumahSakitId)
    .order("dimulai_pada", { ascending: false })
    .limit(limit);
  return toCamel<SinkronLogRow[]>(data ?? []);
}

export async function ambilUlasanHarian(rumahSakitId: number, tanggal: Date): Promise<UlasanRow[]> {
  const awalHari = new Date(tanggal);
  awalHari.setHours(0, 0, 0, 0);
  const akhirHari = new Date(tanggal);
  akhirHari.setHours(23, 59, 59, 999);

  const { data } = await supabase.from(ulasan)
    .select("*")
    .eq("rumah_sakit_id", rumahSakitId)
    .gte("tanggal_ulasan", awalHari.toISOString())
    .lt("tanggal_ulasan", akhirHari.toISOString())
    .order("tanggal_ulasan", { ascending: false });
  return toCamel<UlasanRow[]>(data ?? []);
}

export async function ambilUlasanKrisisBelumDitinjau(rumahSakitId: number): Promise<UlasanRow[]> {
  const { data } = await supabase.from(ulasan)
    .select("*")
    .eq("rumah_sakit_id", rumahSakitId)
    .eq("faktor_urgensi_medis", true)
    .eq("status_tindak_lanjut", "baru")
    .order("tanggal_ulasan", { ascending: false });
  return toCamel<UlasanRow[]>(data ?? []);
}

export async function perbaruiStatusTindakLanjut(ulasanId: number, status: "baru" | "dalam_koordinasi" | "selesai", catatan?: string, user?: string) {
  await supabase.from(ulasan)
    .update(toSnake({
      statusTindakLanjut: status,
      ditinjauPada: status !== "baru" ? new Date().toISOString() : null,
      ditinjauOleh: user ?? null,
      catatanInternal: catatan ?? null,
      diperbaruiPada: new Date().toISOString(),
    }))
    .eq("id", ulasanId);
}

export async function perbaruiDrafBalasan(ulasanId: number, draf: string) {
  await supabase.from(ulasan)
    .update(toSnake({ saranDrafBalasan: draf, diperbaruiPada: new Date().toISOString() }))
    .eq("id", ulasanId);
}

export async function ambilStatistikHarian(rumahSakitId: number, tanggal?: Date | null) {
  let query = supabase.from(ulasan).select("*").eq("rumah_sakit_id", rumahSakitId);

  if (tanggal) {
    const awalHari = new Date(tanggal);
    awalHari.setHours(0, 0, 0, 0);
    const akhirHari = new Date(tanggal);
    akhirHari.setHours(23, 59, 59, 999);
    query = query.gte("tanggal_ulasan", awalHari.toISOString()).lt("tanggal_ulasan", akhirHari.toISOString());
  }

  const { data: rowsRaw } = await query.order("tanggal_ulasan", { ascending: false });
  const rows = toCamel<UlasanRow[]>(rowsRaw ?? []);

  const total = rows.length;
  const positif = rows.filter((r) => r.sentimen === "positif").length;
  const negatif = rows.filter((r) => r.sentimen === "negatif").length;
  const netral = rows.filter((r) => r.sentimen === "netral").length;
  const krisis = rows.filter((r) => r.faktorUrgensiMedis === true).length;
  const belumDitinjau = rows.filter((r) => r.statusTindakLanjut === "baru").length;

  return { total, positif, negatif, netral, krisis, belumDitinjau };
}
