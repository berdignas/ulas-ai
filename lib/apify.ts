import { db } from "./db";
import { rumahSakit, ulasan, sinkronLog, analisis } from "./db/schema";
import { eq, and, gte, lt, desc } from "drizzle-orm";

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

const APIFY_BASE_URL = "https://api.apify.com/v2";

async function panggilApifyActor(actorId: string, token: string, input: Record<string, unknown>): Promise<{ runId: string; defaultDatasetId: string }> {
  const res = await fetch(`${APIFY_BASE_URL}/acts/${actorId}/runs?token=${token}`, {
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
  return JSON.parse(responseText);
}

async function tungguRunSelesai(actorId: string, runId: string, token: string, timeoutMs = 120_000): Promise<{ status: string; defaultDatasetId: string }> {
  const mulai = Date.now();
  while (Date.now() - mulai < timeoutMs) {
    const res = await fetch(`${APIFY_BASE_URL}/actor-runs/${runId}?token=${token}`);
    const responseText = await res.text();
    console.log('[Apify] Poll status:', res.status, responseText.slice(0, 500));
    if (!res.ok) throw new Error(`Cek status run gagal: ${res.status} ${responseText || '(empty)'}`);
    if (!responseText) throw new Error('Apify poll response body kosong');
    const data = JSON.parse(responseText);
    if (data.data.status === "SUCCEEDED") return { status: data.data.status, defaultDatasetId: data.data.defaultDatasetId };
    if (data.data.status === "FAILED" || data.data.status === "ABORTED" || data.data.status === "TIMED-OUT") {
      throw new Error(`Apify run gagal: ${data.data.status}`);
    }
    await new Promise((r) => setTimeout(r, 3000));
  }
  throw new Error("Apify run timeout");
}

async function ambilDatasetItems(datasetId: string, token: string): Promise<ApifyReview[]> {
  const res = await fetch(`${APIFY_BASE_URL}/datasets/${datasetId}/items?token=${token}&clean=true`);
  const responseText = await res.text();
  console.log('[Apify] Fetch dataset:', res.status, responseText.slice(0, 500));
  if (!res.ok) throw new Error(`Ambil dataset gagal: ${res.status} ${responseText || '(empty)'}`);
  if (!responseText) throw new Error('Apify dataset response body kosong');
  return JSON.parse(responseText) as ApifyReview[];
}

function normalisasiTanggalApify(tanggal: string): Date {
  const d = new Date(tanggal);
  if (isNaN(d.getTime())) return new Date();
  return d;
}

export async function jalankanSinkronHarian(rumahSakitId: number, tipePemicu: "otomatis" | "manual" = "otomatis"): Promise<SinkronResult> {
  const rsRows = await db.select().from(rumahSakit).where(eq(rumahSakit.id, rumahSakitId)).limit(1);
  const rs = rsRows[0];
  if (!rs) return { sukses: false, ulasanBaru: 0, ulasanKrisis: 0, pesanError: "Rumah sakit tidak ditemukan" };
  if (!rs.apifyToken || !rs.googleMapsPlaceId) {
    return { sukses: false, ulasanBaru: 0, ulasanKrisis: 0, pesanError: "Konfigurasi Apify/Place ID belum lengkap" };
  }

  const logIdRows = await db.insert(sinkronLog)
    .values({
      rumahSakitId,
      dimulaiPada: new Date(),
      status: "berjalan",
      tipePemicu,
    })
    .returning({ id: sinkronLog.id });
  const logId = logIdRows[0]?.id;

  if (!logId) return { sukses: false, ulasanBaru: 0, ulasanKrisis: 0, pesanError: "Gagal membuat log sinkron" };

  try {
    const sekarang = new Date();
    const batasWaktu = new Date(sekarang.getTime() - 24 * 60 * 60 * 1000);

    const existingAnalisisRows = await db.select().from(analisis)
      .where(eq(analisis.rumahSakitId, rumahSakitId))
      .orderBy(desc(analisis.tanggalUnggah))
      .limit(1);
    const existingAnalisis = existingAnalisisRows[0];

    let analisisAktif = existingAnalisis;
    if (!analisisAktif) {
      const baruRows = await db.insert(analisis)
        .values({
          rumahSakitId,
          namaFile: `Sinkron Otomatis ${sekarang.toISOString().split("T")[0]}`,
          tanggalUnggah: sekarang,
          status: "berjalan",
        })
        .returning({ id: analisis.id });
      const baru = baruRows[0];
      if (!baru) throw new Error("Gagal membuat analisis");
      const analisisAktifRows = await db.select().from(analisis).where(eq(analisis.id, baru.id)).limit(1);
      analisisAktif = analisisAktifRows[0];
    }

    if (!analisisAktif) throw new Error("Gagal memastikan analisis aktif");

    const input = {
      placeIds: [rs.googleMapsPlaceId],
      maxReviews: 10,
      sort: "newest",
      language: "id",
    };

    const { runId, defaultDatasetId: datasetIdAwal } = await panggilApifyActor(rs.apifyActorId!, rs.apifyToken!, input);
    await tungguRunSelesai(rs.apifyActorId!, runId, rs.apifyToken!);
    const reviews = await ambilDatasetItems(datasetIdAwal, rs.apifyToken!);

    let ulasanBaru = 0;
    const ulasanKrisis = 0;

    for (const review of reviews) {
      const tglReview = normalisasiTanggalApify(review.publishedAt);
      if (tglReview < batasWaktu) continue;

      const existingRows = await db.select().from(ulasan).where(eq(ulasan.reviewId, review.reviewId)).limit(1);
      if (existingRows.length) continue;

      const analisisId = analisisAktif.id;
      const rsId = rumahSakitId;

      const faktorUrgensi = false;
      const unitLayanan = "Lainnya";
      const kategoriMasalah = "Lainnya";
      const statusTindakLanjut = "baru" as const;

      await db.insert(ulasan).values({
        analisisId,
        rumahSakitId: rsId,
        reviewId: review.reviewId,
        namaPengulas: review.authorName,
        rating: review.rating,
        teksUlasan: review.text,
        tanggalUlasan: review.publishedAt,
        bahasa: review.language,
        sentimen: null,
        sumberLabel: null,
        unitLayanan,
        kategoriMasalah,
        faktorUrgensiMedis: faktorUrgensi,
        saranDrafBalasan: null,
        statusTindakLanjut,
        dataMentah: JSON.stringify(review),
        dibuatPada: new Date(),
        diperbaruiPada: new Date(),
      });

      ulasanBaru++;
    }

    if (analisisAktif) {
      await db.update(analisis)
        .set({ totalUlasan: analisisAktif.totalUlasan + ulasanBaru, status: "selesai" })
        .where(eq(analisis.id, analisisAktif.id));
    }

    await db.update(sinkronLog)
      .set({
        selesaiPada: new Date(),
        status: "selesai",
        ulasanBaru,
        ulasanDiproses: 0,
        ulasanKrisis,
      })
      .where(eq(sinkronLog.id, logId));

    return { sukses: true, ulasanBaru, ulasanKrisis };
  } catch (error) {
    const pesan = error instanceof Error ? error.message : "Kesalahan tidak diketahui";
    await db.update(sinkronLog)
      .set({ selesaiPada: new Date(), status: "gagal", pesanError: pesan })
      .where(eq(sinkronLog.id, logId));
    return { sukses: false, ulasanBaru: 0, ulasanKrisis: 0, pesanError: pesan };
  }
}

export async function ambilRiwayatSinkron(rumahSakitId: number, limit = 20) {
  return await db.select().from(sinkronLog)
    .where(eq(sinkronLog.rumahSakitId, rumahSakitId))
    .orderBy(desc(sinkronLog.dimulaiPada))
    .limit(limit);
}

export async function ambilUlasanHarian(rumahSakitId: number, tanggal: Date) {
  const awalHari = new Date(tanggal);
  awalHari.setHours(0, 0, 0, 0);
  const akhirHari = new Date(tanggal);
  akhirHari.setHours(23, 59, 59, 999);

  return await db.select().from(ulasan)
    .where(and(
      eq(ulasan.rumahSakitId, rumahSakitId),
      gte(ulasan.tanggalUlasan, awalHari.toISOString()),
      lt(ulasan.tanggalUlasan, akhirHari.toISOString())
    ))
    .orderBy(desc(ulasan.tanggalUlasan));
}

export async function ambilUlasanKrisisBelumDitinjau(rumahSakitId: number) {
  return await db.select().from(ulasan)
    .where(and(
      eq(ulasan.rumahSakitId, rumahSakitId),
      eq(ulasan.faktorUrgensiMedis, true),
      eq(ulasan.statusTindakLanjut, "baru")
    ))
    .orderBy(desc(ulasan.tanggalUlasan));
}

export async function perbaruiStatusTindakLanjut(ulasanId: number, status: "baru" | "dalam_koordinasi" | "selesai", catatan?: string, user?: string) {
  await db.update(ulasan)
    .set({
      statusTindakLanjut: status,
      ditinjauPada: status !== "baru" ? new Date() : null,
      ditinjauOleh: user ?? null,
      catatanInternal: catatan ?? null,
      diperbaruiPada: new Date(),
    })
    .where(eq(ulasan.id, ulasanId));
}

export async function perbaruiDrafBalasan(ulasanId: number, draf: string) {
  await db.update(ulasan)
    .set({ saranDrafBalasan: draf, diperbaruiPada: new Date() })
    .where(eq(ulasan.id, ulasanId));
}

export async function ambilStatistikHarian(rumahSakitId: number, tanggal: Date) {
  const awalHari = new Date(tanggal);
  awalHari.setHours(0, 0, 0, 0);
  const akhirHari = new Date(tanggal);
  akhirHari.setHours(23, 59, 59, 999);

  const rows = await db.select().from(ulasan)
    .where(and(
      eq(ulasan.rumahSakitId, rumahSakitId),
      gte(ulasan.tanggalUlasan, awalHari.toISOString()),
      lt(ulasan.tanggalUlasan, akhirHari.toISOString())
    ))
    .orderBy(desc(ulasan.tanggalUlasan));

  const total = rows.length;
  const positif = rows.filter((r) => r.sentimen === "positif").length;
  const negatif = rows.filter((r) => r.sentimen === "negatif").length;
  const netral = rows.filter((r) => r.sentimen === "netral").length;
  const krisis = rows.filter((r) => r.faktorUrgensiMedis === true).length;
  const belumDitinjau = rows.filter((r) => r.statusTindakLanjut === "baru").length;

  return { total, positif, negatif, netral, krisis, belumDitinjau };
}