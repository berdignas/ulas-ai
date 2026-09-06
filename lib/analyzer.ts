import { supabase, toCamel, toSnake } from "./db";
import { analisis, aspek, hasilAspekUlasan, ulasan, UlasanRow, AnalisisRow, AspekRow } from "./db/schema";
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
  const { data: usedRaw } = await supabase.from(hasilAspekUlasan).select("aspek_id");
  const usedIds = Array.from(new Set((usedRaw ?? []).map((r) => r.aspek_id)));
  if (usedIds.length === 0) {
    await supabase.from(aspek).delete().neq("id", 0);
  } else {
    await supabase.from(aspek).delete().not("id", "in", `(${usedIds.join(",")})`);
  }
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

const CONCURRENCY = 1;

async function prosesAnalisis(analisisId: number): Promise<void> {
  try {
    await supabase.from(analisis)
      .update(toSnake({ status: "berjalan", catatan: null, kondisiUmum: null }))
      .eq("id", analisisId);

    const { data: daftarUlasanRaw } = await supabase.from(ulasan).select("*").eq("analisis_id", analisisId);
    const daftarUlasan = toCamel<UlasanRow[]>(daftarUlasanRaw ?? []);

    const belumDiproses = daftarUlasan.filter((u) => u.sumberLabel !== "ai");
    const sudahDiproses = daftarUlasan.filter((u) => u.sumberLabel === "ai");

    const idBelum = belumDiproses.map((u) => u.id);
    if (idBelum.length > 0) {
      await supabase.from(hasilAspekUlasan).delete().in("ulasan_id", idBelum);
      await supabase.from(ulasan)
        .update(toSnake({ sentimen: null, sumberLabel: null }))
        .in("id", idBelum);
    }

    let ulasanDiprosesCounter = sudahDiproses.length;
    await supabase.from(analisis)
      .update(toSnake({ totalUlasan: daftarUlasan.length, ulasanDiproses: ulasanDiprosesCounter }))
      .eq("id", analisisId);

    let gagalDilabel = 0;
    let gagalAI = 0;
    let pakaiAI = sudahDiproses.length > 0;
    const cacheAspek = new Map<string, number>();

    const prosesSatuUlasan = async (item: UlasanRow) => {
      let sentimen: string | null = null;
      let sumberLabel: string | null = null;
      let unitLayanan: string = "Lainnya";
      let kategoriMasalah: string = "Lainnya";
      let faktorUrgensiMedis: boolean = false;
      let saranDrafBalasan: string | null = null;

      if (aiConfigured()) {
        try {
          const hasil = await analisisUlasanDenganAI(item.teksUlasan, item.rating ?? null);
          sentimen = hasil.sentimen;
          sumberLabel = "ai";
          unitLayanan = hasil.unitLayanan;
          kategoriMasalah = hasil.kategoriMasalah;
          faktorUrgensiMedis = hasil.faktorUrgensiMedis;
          saranDrafBalasan = hasil.saranDrafBalasan;
          pakaiAI = true;

          for (const itemAspek of hasil.aspek) {
            const aspekId = await dapatkanAspekId(itemAspek.aspek, cacheAspek);
            await supabase.from(hasilAspekUlasan)
              .insert(toSnake({
                ulasanId: item.id,
                aspekId,
                sentimenAspek: itemAspek.sentimen,
                kutipan: itemAspek.kutipan,
              }));
          }
        } catch (errorAI) {
          gagalAI++;
          console.warn(`[ai] ulasan ${item.id} gagal: ${errorAI instanceof Error ? errorAI.message : String(errorAI)}`);
          sentimen = sentimenFallbackDariRating(item.rating ?? null);
          sumberLabel = sentimen ? "rating" : null;
          if (!sentimen) gagalDilabel++;
        }
      } else {
        sentimen = sentimenFallbackDariRating(item.rating ?? null);
        sumberLabel = sentimen ? "rating" : null;
        if (!sentimen) gagalDilabel++;
      }

      await supabase.from(ulasan)
        .update(toSnake({
          sentimen,
          sumberLabel,
          unitLayanan,
          kategoriMasalah,
          faktorUrgensiMedis,
          saranDrafBalasan,
          diperbaruiPada: new Date().toISOString(),
        }))
        .eq("id", item.id);

      ulasanDiprosesCounter++;
      await supabase.from(analisis)
        .update(toSnake({ ulasanDiproses: ulasanDiprosesCounter }))
        .eq("id", analisisId);
    };

    const antrean = [...belumDiproses];
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
      const { data: terkiniRaw } = await supabase.from(analisis).select("*").eq("id", analisisId).limit(1);
      const terkini = toCamel<AnalisisRow>(terkiniRaw?.[0]);
      await supabase.from(analisis)
        .update(toSnake({
          status: "berhenti",
          catatan: `Analisis dihentikan setelah ${terkini?.ulasanDiproses ?? 0} dari ${daftarUlasan.length} ulasan diproses. Proses ulang untuk melanjutkan.`,
        }))
        .eq("id", analisisId);
      return;
    }

    const totalUlasan = daftarUlasan.length;

    const { count: jumlahPositif } = await supabase.from(ulasan)
      .select("*", { count: "exact", head: true })
      .eq("analisis_id", analisisId)
      .eq("sentimen", "positif");

    const { count: jumlahNegatif } = await supabase.from(ulasan)
      .select("*", { count: "exact", head: true })
      .eq("analisis_id", analisisId)
      .eq("sentimen", "negatif");

    const { count: jumlahNetral } = await supabase.from(ulasan)
      .select("*", { count: "exact", head: true })
      .eq("analisis_id", analisisId)
      .eq("sentimen", "netral");

    const posCount = jumlahPositif ?? 0;
    const negCount = jumlahNegatif ?? 0;
    const netCount = jumlahNetral ?? 0;

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
      totalPositif: posCount,
      totalNegatif: negCount,
      totalNetral: netCount,
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

    await supabase.from(analisis)
      .update(toSnake({
        status: "selesai",
        totalUlasan,
        totalPositif: posCount,
        totalNegatif: negCount,
        totalNetral: netCount,
        kondisiUmum,
        catatan: catatan.length > 0 ? catatan.join(" ") : null,
      }))
      .eq("id", analisisId);
  } catch (error) {
    const pesan = error instanceof Error ? error.message : "Kesalahan tidak diketahui";
    await supabase.from(analisis)
      .update(toSnake({ status: "gagal", catatan: `Proses analisis gagal: ${pesan}` }))
      .eq("id", analisisId);
  }
}

async function dapatkanAspekId(namaAspek: string, cache: Map<string, number>): Promise<number> {
  const kunci = namaAspek.trim().toLowerCase();
  const cached = cache.get(kunci);
  if (cached !== undefined) return cached;

  const { data: existingRows } = await supabase.from(aspek).select("*").eq("nama_aspek", kunci).limit(1);
  const existing = toCamel<AspekRow>(existingRows?.[0]);
  if (existing) {
    cache.set(kunci, existing.id);
    return existing.id;
  }
  const { data: insertedRows } = await supabase.from(aspek).insert({ nama_aspek: kunci }).select("id");
  const inserted = insertedRows?.[0];
  if (inserted?.id) {
    cache.set(kunci, inserted.id);
    return inserted.id;
  }

  // Fallback in case of race condition
  const { data: retryRows } = await supabase.from(aspek).select("*").eq("nama_aspek", kunci).limit(1);
  const retryExisting = toCamel<AspekRow>(retryRows?.[0]);
  if (retryExisting?.id) {
    cache.set(kunci, retryExisting.id);
    return retryExisting.id;
  }

  throw new Error("Gagal menyimpan aspek: " + kunci);
}

export interface StatistikAspek {
  id: number;
  namaAspek: string;
  positif: number;
  negatif: number;
  netral: number;
}

export async function dapatkanStatistikAspek(
  analisisId: number,
  dari?: string | null,
  sampai?: string | null
): Promise<StatistikAspek[]> {
  let query = supabase.from(hasilAspekUlasan)
    .select("sentimen_aspek, aspek(id, nama_aspek), ulasan!inner(analisis_id, tanggal_ulasan)")
    .eq("ulasan.analisis_id", analisisId);

  if (dari) {
    const tglDari = new Date(dari);
    tglDari.setHours(0, 0, 0, 0);
    query = query.gte("ulasan.tanggal_ulasan", tglDari.toISOString());
  }

  if (sampai) {
    const tglSampai = new Date(sampai);
    tglSampai.setHours(23, 59, 59, 999);
    query = query.lte("ulasan.tanggal_ulasan", tglSampai.toISOString());
  }

  const { data: hasilRaw } = await query;

  const mapStats = new Map<number, StatistikAspek>();

  if (hasilRaw) {
    for (const item of hasilRaw as any[]) {
      const asp = item.aspek;
      if (!asp) continue;
      const id = asp.id;
      const namaAspek = asp.nama_aspek;
      const sentimen = item.sentimen_aspek;

      if (!mapStats.has(id)) {
        mapStats.set(id, { id, namaAspek, positif: 0, negatif: 0, netral: 0 });
      }

      const st = mapStats.get(id)!;
      if (sentimen === "positif") st.positif++;
      else if (sentimen === "negatif") st.negatif++;
      else if (sentimen === "netral") st.netral++;
    }
  }

  return Array.from(mapStats.values());
}