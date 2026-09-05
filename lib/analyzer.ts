import { eq, inArray, sql } from "drizzle-orm";
import { db } from "./db";
import { analisis, aspek, hasilAspekUlasan, ulasan } from "./db/schema";
import {
  aiConfigured,
  analisisUlasanDenganAI,
  buatKondisiUmum,
  kondisiUmumFallback,
  sentimenFallbackDariRating,
} from "./ai";

const runningProcesses = new Set<number>();
const stopRequests = new Set<number>();

export function prosesSedangBerjalan(analisisId: number): boolean {
  return runningProcesses.has(analisisId);
}

export function adaProsesBerjalan(): boolean {
  return runningProcesses.size > 0;
}

export function hentikanProsesAnalisis(analisisId: number): boolean {
  if (!runningProcesses.has(analisisId)) return false;
  stopRequests.add(analisisId);
  return true;
}

export async function hapusAspekYatim(): Promise<void> {
  await db.delete(aspek)
    .where(
      sql`not exists (select 1 from ${hasilAspekUlasan} where ${hasilAspekUlasan.aspekId} = ${aspek.id})`
    );
}

export function mulaiProsesAnalisis(analisisId: number): boolean {
  if (runningProcesses.has(analisisId)) return false;
  runningProcesses.add(analisisId);
  stopRequests.delete(analisisId);
  prosesAnalisis(analisisId).finally(() => {
    runningProcesses.delete(analisisId);
    stopRequests.delete(analisisId);
  });
  return true;
}

const CONCURRENCY = 3;

async function prosesAnalisis(analisisId: number): Promise<void> {
  try {
    await db.update(analisis)
      .set({ status: "berjalan", catatan: null, kondisiUmum: null })
      .where(eq(analisis.id, analisisId));

    const daftarUlasan = await db.select().from(ulasan).where(eq(ulasan.analisisId, analisisId));

    const idUlasan = daftarUlasan.map((u) => u.id);
    if (idUlasan.length > 0) {
      await db.delete(hasilAspekUlasan).where(inArray(hasilAspekUlasan.ulasanId, idUlasan));
      await db.update(ulasan)
        .set({ sentimen: null, sumberLabel: null })
        .where(inArray(ulasan.id, idUlasan));
    }

    await db.update(analisis)
      .set({ totalUlasan: daftarUlasan.length, ulasanDiproses: 0 })
      .where(eq(analisis.id, analisisId));

    let gagalDilabel = 0;
    let gagalAI = 0;
    let pakaiAI = false;
    const cacheAspek = new Map<string, number>();

    const prosesSatuUlasan = async (item: (typeof daftarUlasan)[number]) => {
      let sentimen: string | null = null;
      let sumberLabel: string | null = null;

      if (aiConfigured()) {
        try {
          const hasil = await analisisUlasanDenganAI(item.teksUlasan, item.rating);
          sentimen = hasil.sentimen;
          sumberLabel = "ai";
          pakaiAI = true;

          for (const itemAspek of hasil.aspek) {
            const aspekId = await dapatkanAspekId(itemAspek.aspek, cacheAspek);
            await db.insert(hasilAspekUlasan)
              .values({
                ulasanId: item.id,
                aspekId,
                sentimenAspek: itemAspek.sentimen,
                kutipan: itemAspek.kutipan,
              });
          }
        } catch (errorAI) {
          gagalAI++;
          console.warn(`[ai] ulasan ${item.id} gagal: ${errorAI instanceof Error ? errorAI.message : String(errorAI)}`);
          sentimen = sentimenFallbackDariRating(item.rating);
          sumberLabel = sentimen ? "rating" : null;
          if (!sentimen) gagalDilabel++;
        }
      } else {
        sentimen = sentimenFallbackDariRating(item.rating);
        sumberLabel = sentimen ? "rating" : null;
        if (!sentimen) gagalDilabel++;
      }

      await db.update(ulasan)
        .set({ sentimen: sentimen as "positif" | "negatif" | "netral" | null, sumberLabel })
        .where(eq(ulasan.id, item.id));

      await db.update(analisis)
        .set({ ulasanDiproses: sql`${analisis.ulasanDiproses} + 1` })
        .where(eq(analisis.id, analisisId));
    };

    const antrean = [...daftarUlasan];
    const pekerja = Array.from({ length: Math.min(CONCURRENCY, antrean.length) }, async () => {
      while (antrean.length > 0) {
        if (stopRequests.has(analisisId)) return;
        const item = antrean.shift();
        if (!item) break;
        await prosesSatuUlasan(item);
      }
    });
    await Promise.all(pekerja);

    if (stopRequests.has(analisisId)) {
      const terkiniRows = await db.select().from(analisis).where(eq(analisis.id, analisisId)).limit(1);
      const terkini = terkiniRows[0];
      await db.update(analisis)
        .set({
          status: "berhenti",
          catatan: `Analisis dihentikan setelah ${terkini?.ulasanDiproses ?? 0} dari ${daftarUlasan.length} ulasan diproses. Proses ulang untuk melanjutkan.`,
        })
        .where(eq(analisis.id, analisisId));
      return;
    }

    const totalUlasan = daftarUlasan.length;

    const totalPositifRows = await db
      .select({ jumlah: sql<number>`count(*)` })
      .from(ulasan)
      .where(sql`${ulasan.analisisId} = ${analisisId} AND ${ulasan.sentimen} = 'positif'`);
    const totalNegatifRows = await db
      .select({ jumlah: sql<number>`count(*)` })
      .from(ulasan)
      .where(sql`${ulasan.analisisId} = ${analisisId} AND ${ulasan.sentimen} = 'negatif'`);
    const totalNetralRows = await db
      .select({ jumlah: sql<number>`count(*)` })
      .from(ulasan)
      .where(sql`${ulasan.analisisId} = ${analisisId} AND ${ulasan.sentimen} = 'netral'`);

    const jumlahPositif = totalPositifRows[0]?.jumlah ?? 0;
    const jumlahNegatif = totalNegatifRows[0]?.jumlah ?? 0;
    const jumlahNetral = totalNetralRows[0]?.jumlah ?? 0;

    const aspekStatistik = await dapatkanStatistikAspek(analisisId);
    const aspekKeluhanTeratas = aspekStatistik
      .filter((a) => a.negatif > 0)
      .sort((a, b) => b.negatif - a.negatif)
      .slice(0, 3)
      .map((a) => a.namaAspek);
    const aspekPujianTeratas = aspekStatistik
      .filter((a) => a.positif > 0)
      .sort((a, b) => b.positif - a.positif)
      .slice(0, 3)
      .map((a) => a.namaAspek);

    const stats = {
      totalUlasan,
      totalPositif: jumlahPositif,
      totalNegatif: jumlahNegatif,
      totalNetral: jumlahNetral,
      aspekKeluhanTeratas,
      aspekPujianTeratas,
    };

    let kondisiUmum = pakaiAI ? await buatKondisiUmum(stats) : null;
    if (!kondisiUmum) kondisiUmum = kondisiUmumFallback(stats);

    const catatan: string[] = [];
    if (!aiConfigured()) {
      catatan.push("Kunci API AI belum diatur; sentimen ditentukan dari rating bintang sebagai fallback.");
    }
    if (gagalAI > 0) {
      catatan.push(`${gagalAI} ulasan gagal diproses AI dan diberi label dari rating bintang sebagai fallback.`);
    }
    if (gagalDilabel > 0) {
      catatan.push(`${gagalDilabel} ulasan tidak dapat diberi label sentimen (tidak ada rating dan AI gagal).`);
    }

    await db.update(analisis)
      .set({
        status: "selesai",
        totalUlasan,
        totalPositif: jumlahPositif,
        totalNegatif: jumlahNegatif,
        totalNetral: jumlahNetral,
        kondisiUmum,
        catatan: catatan.length > 0 ? catatan.join(" ") : null,
      })
      .where(eq(analisis.id, analisisId));
  } catch (error) {
    const pesan = error instanceof Error ? error.message : "Kesalahan tidak diketahui";
    await db.update(analisis)
      .set({ status: "gagal", catatan: `Proses analisis gagal: ${pesan}` })
      .where(eq(analisis.id, analisisId));
  }
}

async function dapatkanAspekId(namaAspek: string, cache: Map<string, number>): Promise<number> {
  const kunci = namaAspek.trim().toLowerCase();
  const cached = cache.get(kunci);
  if (cached !== undefined) return cached;

  const existingRows = await db.select().from(aspek).where(eq(aspek.namaAspek, kunci)).limit(1);
  const existing = existingRows[0];
  if (existing) {
    cache.set(kunci, existing.id);
    return existing.id;
  }
  const insertedRows = await db.insert(aspek).values({ namaAspek: kunci }).returning({ id: aspek.id });
  const inserted = insertedRows[0];
  cache.set(kunci, inserted.id);
  return inserted.id;
}

export interface StatistikAspek {
  id: number;
  namaAspek: string;
  positif: number;
  negatif: number;
  netral: number;
}

export async function dapatkanStatistikAspek(analisisId: number): Promise<StatistikAspek[]> {
  const rows = await db
    .select({
      id: aspek.id,
      namaAspek: aspek.namaAspek,
      positif: sql<number>`sum(case when ${hasilAspekUlasan.sentimenAspek} = 'positif' then 1 else 0 end)`,
      negatif: sql<number>`sum(case when ${hasilAspekUlasan.sentimenAspek} = 'negatif' then 1 else 0 end)`,
      netral: sql<number>`sum(case when ${hasilAspekUlasan.sentimenAspek} = 'netral' then 1 else 0 end)`,
    })
    .from(hasilAspekUlasan)
    .innerJoin(aspek, eq(hasilAspekUlasan.aspekId, aspek.id))
    .innerJoin(ulasan, eq(hasilAspekUlasan.ulasanId, ulasan.id))
    .where(eq(ulasan.analisisId, analisisId))
    .groupBy(aspek.id, aspek.namaAspek);

  return rows.map((row) => ({
    id: row.id,
    namaAspek: row.namaAspek,
    positif: row.positif ?? 0,
    negatif: row.negatif ?? 0,
    netral: row.netral ?? 0,
  }));
}