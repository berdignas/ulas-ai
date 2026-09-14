import { supabase, toCamel, toSnake } from "./db";
import {
  analisis,
  aspek,
  hasilAspekUlasan,
  hasilLokasiUlasan,
  lokasiLayananRs,
  rumahSakit,
  ulasan,
  UlasanRow,
  AnalisisRow,
  AspekRow,
  LokasiLayananRsRow,
} from "./db/schema";
import {
  aiConfigured,
  analisisBatchUlasanDenganAI,
  HasilAnalisisUlasan,
  buatKondisiUmum,
  kondisiUmumFallback,
  getAIErrorInfo,
  sentimenFallbackDariRating,
} from "./ai";
import {
  ASPEK_UMUM,
  deteksiLokasiDariKeyword,
  LokasiLayananReferensi,
  normalisasiAspekUmum,
} from "./service-taxonomy";
import { parseCustomAIConfig } from "./ai-config";

const runningProcesses = new Set<number>();
const stopRequests = new Set<number>();

export function prosesSedangBerjalan(analisisId: number): boolean {
  return runningProcesses.has(analisisId);
}

export function adaProsesBerjalan(): boolean {
  return runningProcesses.size > 0;
}

export function hentikanProsesAnalisis(analisisId: number): boolean {
  stopRequests.add(analisisId);
  return runningProcesses.has(analisisId);
}

/**
 * Permintaan berhenti harus disimpan di database, bukan hanya di memori.
 * Pada deployment serverless, endpoint /stop dan worker dapat berjalan pada
 * instance yang berbeda sehingga Set di atas tidak selalu dibagikan.
 */
async function adaPermintaanBerhenti(analisisId: number): Promise<boolean> {
  if (stopRequests.has(analisisId)) return true;

  const { data } = await supabase
    .from(analisis)
    .select("status")
    .eq("id", analisisId)
    .limit(1);
  return data?.[0]?.status === "berhenti";
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

export function mulaiProsesAnalisis(analisisId: number, isResume = false): Promise<void> | null {
  if (runningProcesses.has(analisisId)) return null;
  runningProcesses.add(analisisId);
  stopRequests.delete(analisisId);
  return prosesAnalisis(analisisId, isResume).finally(() => {
    runningProcesses.delete(analisisId);
    stopRequests.delete(analisisId);
  });
}

const BATCH_SIZE = Math.max(1, Math.min(15, Number(process.env.ANALYSIS_BATCH_SIZE) || 8));
const BATCH_MAX_CHARS = Math.max(2_000, Math.min(30_000, Number(process.env.ANALYSIS_BATCH_MAX_CHARS) || 12_000));

function buatBatchAdaptif(items: UlasanRow[]): UlasanRow[][] {
  const batches: UlasanRow[][] = [];
  let batch: UlasanRow[] = [];
  let jumlahKarakter = 0;

  for (const item of items) {
    const panjang = item.teksUlasan?.length ?? 0;
    if (batch.length > 0 && (batch.length >= BATCH_SIZE || jumlahKarakter + panjang > BATCH_MAX_CHARS)) {
      batches.push(batch);
      batch = [];
      jumlahKarakter = 0;
    }
    batch.push(item);
    jumlahKarakter += panjang;
  }
  if (batch.length > 0) batches.push(batch);
  return batches;
}

async function prosesAnalisis(analisisId: number, isResume = false): Promise<void> {
  const mulaiWaktuMs = Date.now();
  try {
    // Hanya update status ke "berjalan" tanpa menghapus catatan/kondisiUmum.
    // Penghapusan catatan/kondisiUmum sudah dilakukan di /process route berdasarkan
    // apakah ini resume atau restart penuh. Di sini cukup pastikan status = berjalan.
    await supabase.from(analisis)
      .update(toSnake({ status: "berjalan" }))
      .eq("id", analisisId);

    const { data: daftarUlasanRaw } = await supabase.from(ulasan).select("*").eq("analisis_id", analisisId);
    const daftarUlasan = toCamel<UlasanRow[]>(daftarUlasanRaw ?? []);
    const rumahSakitId = daftarUlasan[0]?.rumahSakitId;
    const { data: konfigurasiRSRaw } = rumahSakitId
      ? await supabase.from(rumahSakit).select("ai_model, ai_api_key").eq("id", rumahSakitId).limit(1)
      : { data: null };
    const modelAI = konfigurasiRSRaw?.[0]?.ai_model ?? null;
    const customConfig = parseCustomAIConfig(konfigurasiRSRaw?.[0]?.ai_api_key);
    const aiTersedia = aiConfigured(modelAI, customConfig);
    const lokasiResponse = rumahSakitId
      ? await supabase
          .from(lokasiLayananRs)
          .select("*")
          .eq("rumah_sakit_id", rumahSakitId)
          .eq("aktif", true)
          .order("urutan", { ascending: true })
      : { data: null, error: null };
    const schemaV3Tersedia = !lokasiResponse.error;
    const daftarLokasi = toCamel<LokasiLayananRsRow[]>(lokasiResponse.data ?? []);

    // Saat RESUME: hanya proses ulasan yang benar-benar belum punya label sama sekali
    // (sumberLabel = null). Ulasan yang sudah berlabel "ai" maupun "rating" dianggap
    // selesai dan tidak akan di-reset — ini mencegah progress bar mundur.
    //
    // Saat RESTART PENUH: proses semua ulasan dari nol (termasuk yang sudah berlabel).
    const belumDiproses = isResume
      ? daftarUlasan.filter((u) => !u.sumberLabel)                // hanya yang belum berlabel
      : daftarUlasan.filter((u) => u.sumberLabel !== "ai");        // non-ai (restart perilaku lama)
    const sudahDiproses = isResume
      ? daftarUlasan.filter((u) => !!u.sumberLabel)                // semua yang sudah berlabel (ai + rating)
      : daftarUlasan.filter((u) => u.sumberLabel === "ai");        // hanya ai

    const idBelum = belumDiproses.map((u) => u.id);
    if (idBelum.length > 0) {
      await supabase.from(hasilAspekUlasan).delete().in("ulasan_id", idBelum);
      if (schemaV3Tersedia) {
        await supabase.from(hasilLokasiUlasan).delete().in("ulasan_id", idBelum);
      }
      const resetAI = schemaV3Tersedia ? {
        aiStatus: aiTersedia ? "menunggu" : "tidak_aktif",
        aiErrorCode: null,
        aiErrorMessage: null,
      } : {};
      await supabase.from(ulasan)
        .update(toSnake({
          sentimen: null,
          sumberLabel: null,
          ...resetAI,
        }))
        .in("id", idBelum);
    }

    // Simpan checkpoint awal — jumlah ulasan yang sudah selesai dianalisis sebelum
    // sesi ini dimulai. Ini memastikan progress bar tidak mundur saat resume.
    let ulasanDiprosesCounter = sudahDiproses.length;
    await supabase.from(analisis)
      .update(toSnake({ totalUlasan: daftarUlasan.length, ulasanDiproses: ulasanDiprosesCounter }))
      .eq("id", analisisId);


    let gagalDilabel = 0;
    let gagalAI = 0;
    let pakaiAI = sudahDiproses.some((item) => item.sumberLabel === "ai");
    let tertundaKarenaAI: ReturnType<typeof getAIErrorInfo> | null = null;
    let errorAITerakhir: ReturnType<typeof getAIErrorInfo> | null = null;
    const cacheAspek = new Map<string, number>();
    const { data: daftarAspekRaw } = await supabase.from(aspek).select("*");
    for (const itemAspek of toCamel<AspekRow[]>(daftarAspekRaw ?? [])) {
      const namaNormal = normalisasiAspekUmum(itemAspek.namaAspek);
      if (namaNormal.toLowerCase() === itemAspek.namaAspek.trim().toLowerCase()) {
        cacheAspek.set(namaNormal.toLowerCase(), itemAspek.id);
      }
    }

    const simpanSatuUlasan = async (
      item: UlasanRow,
      hasil: HasilAnalisisUlasan | null,
      errorAI: ReturnType<typeof getAIErrorInfo> | null
    ) => {
      let sentimen: string | null = null;
      let sumberLabel: string | null = null;
      let unitLayanan: string = "Lainnya";
      let kategoriMasalah: string = "Lainnya";
      let faktorUrgensiMedis: boolean = false;
      let saranDrafBalasan: string | null = null;

      if (hasil) {
          sentimen = hasil.sentimen;
          sumberLabel = "ai";
          unitLayanan = hasil.unitLayanan;
          kategoriMasalah = hasil.kategoriMasalah;
          faktorUrgensiMedis = hasil.faktorUrgensiMedis;
          saranDrafBalasan = hasil.saranDrafBalasan;
          pakaiAI = true;
      } else {
        sentimen = sentimenFallbackDariRating(item.rating ?? null);
        sumberLabel = sentimen ? "rating" : null;
        if (!sentimen) gagalDilabel++;
      }

      const observabilitasAI = schemaV3Tersedia ? {
        aiStatus: hasil ? "selesai" : aiTersedia ? "gagal" : "tidak_aktif",
        aiAttempts: (item.aiAttempts ?? 0) + (aiTersedia ? 1 : 0),
        aiErrorCode: hasil ? null : errorAI?.code ?? null,
        aiErrorMessage: hasil ? null : errorAI?.message ?? null,
        aiDiprosesPada: hasil ? new Date().toISOString() : null,
      } : {};
      return supabase.from(ulasan)
        .update(toSnake({
          sentimen,
          sumberLabel,
          unitLayanan,
          kategoriMasalah,
          faktorUrgensiMedis,
          saranDrafBalasan,
          ...observabilitasAI,
          diperbaruiPada: new Date().toISOString(),
        }))
        .eq("id", item.id);
    };

    const batches = buatBatchAdaptif(belumDiproses);
    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      if (await adaPermintaanBerhenti(analisisId)) break;
      const batch = batches[batchIndex];
      let hasilBatch = new Map<number, HasilAnalisisUlasan>();
      let errorPermanenBatch: ReturnType<typeof getAIErrorInfo> | null = null;
      const mulaiBatch = Date.now();

      if (aiTersedia) {
        try {
          hasilBatch = await analisisBatchUlasanDenganAI(
            batch.map((item) => ({ id: item.id, teksUlasan: item.teksUlasan, rating: item.rating ?? null })),
            modelAI,
            daftarLokasi,
            {
              onRetry: async ({ percobaanBerikutnya, maksimumPercobaan, jedaMs }) => {
                await supabase.from(analisis)
                  .update(toSnake({
                    catatan: `AI sedang membatasi permintaan. Mencoba lagi dalam ${Math.ceil(jedaMs / 1000)} detik (${percobaanBerikutnya}/${maksimumPercobaan}). Hasil yang sudah selesai tetap aman.`,
                  }))
                  .eq("id", analisisId);
              },
            },
            customConfig
          );
        } catch (errorAI) {
          const info = getAIErrorInfo(errorAI);
          errorAITerakhir = info;
          console.warn(`[ai] batch ${batchIndex + 1}/${batches.length} gagal (${info.code}): ${info.message}`);
          if (info.retryable) {
            tertundaKarenaAI = info;
            if (schemaV3Tersedia) {
              await Promise.all(batch.map((item) => supabase.from(ulasan)
                .update(toSnake({
                  aiStatus: "retry",
                  aiAttempts: (item.aiAttempts ?? 0) + 1,
                  aiErrorCode: info.code,
                  aiErrorMessage: info.message,
                }))
                .eq("id", item.id)));
            }
            break;
          }
          gagalAI += batch.length;
          errorPermanenBatch = info;
        }
      }

      const relasiAspek: Array<{
        ulasanId: number;
        aspekId: number;
        sentimenAspek: string;
        kutipan: string | null;
      }> = [];
      const relasiLokasi: Array<{
        ulasanId: number;
        lokasiLayananId: number;
        metode: "keyword" | "ai";
        kutipan: string | null;
      }> = [];
      const lokasiByNama = new Map(daftarLokasi.map((item) => [item.nama.toLowerCase(), item]));

      await pastikanAspekTersedia(
        Array.from(hasilBatch.values()).flatMap((hasil) => hasil.aspek.map((item) => item.aspek)),
        cacheAspek
      );

      for (const item of batch) {
        const hasil = hasilBatch.get(item.id) ?? null;
        if (hasil) {
          for (const itemAspek of hasil.aspek) {
            const aspekId = cacheAspek.get(itemAspek.aspek.trim().toLowerCase());
            if (aspekId === undefined) continue;
            relasiAspek.push({
              ulasanId: item.id,
              aspekId,
              sentimenAspek: itemAspek.sentimen,
              kutipan: itemAspek.kutipan,
            });
          }
        }

        const dariKeyword = deteksiLokasiDariKeyword(item.teksUlasan, daftarLokasi);
        const lokasiGabungan = new Map<number, { lokasi: LokasiLayananReferensi; metode: "keyword" | "ai" }>();
        for (const lokasi of dariKeyword) lokasiGabungan.set(lokasi.id, { lokasi, metode: "keyword" });
        for (const nama of hasil?.lokasiLayanan ?? []) {
          const lokasi = lokasiByNama.get(nama.toLowerCase());
          if (lokasi && !lokasiGabungan.has(lokasi.id)) lokasiGabungan.set(lokasi.id, { lokasi, metode: "ai" });
        }
        for (const { lokasi, metode } of Array.from(lokasiGabungan.values()).slice(0, 3)) {
          relasiLokasi.push({
            ulasanId: item.id,
            lokasiLayananId: lokasi.id,
            metode,
            kutipan: item.teksUlasan.slice(0, 240) || null,
          });
        }
      }

      await Promise.all(batch.map((item) => simpanSatuUlasan(
        item,
        hasilBatch.get(item.id) ?? null,
        errorPermanenBatch
      )));
      if (relasiAspek.length > 0) {
        await supabase.from(hasilAspekUlasan).insert(toSnake(relasiAspek));
      }
      if (schemaV3Tersedia && relasiLokasi.length > 0) {
        await supabase.from(hasilLokasiUlasan).upsert(toSnake(relasiLokasi), {
          onConflict: "ulasan_id,lokasi_layanan_id",
        });
      }

      ulasanDiprosesCounter += batch.length;
      await supabase.from(analisis)
        .update(toSnake({ ulasanDiproses: ulasanDiprosesCounter, catatan: null }))
        .eq("id", analisisId);
      console.info(
        `[ai] analisis ${analisisId}, batch ${batchIndex + 1}/${batches.length}: ${batch.length} ulasan dalam ${Date.now() - mulaiBatch}ms`
      );
    }

    if (tertundaKarenaAI) {
      const namaProvider = customConfig?.providerName || (modelAI?.startsWith("gemini") ? "Gemini" : modelAI || "AI Provider");
      await supabase.from(analisis)
        .update(toSnake({
          status: "berhenti",
          catatan: `Analisis AI dijeda sementara agar sisa ulasan tidak terisi rating (${tertundaKarenaAI.code}: ${tertundaKarenaAI.message}). Ulasan yang sudah selesai (${ulasanDiprosesCounter} ulasan) tersimpan aman. Tunggu sekitar 1 menit agar kuota ${namaProvider} pulih, lalu klik tombol 'Proses ulang' untuk melanjutkan.`,
        }))
        .eq("id", analisisId);
      return;
    }

    if (await adaPermintaanBerhenti(analisisId)) {
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

    let kondisiUmum = pakaiAI ? await buatKondisiUmum(stats, modelAI, customConfig) : null;
    if (!kondisiUmum) kondisiUmum = kondisiUmumFallback(stats);

    const catatan: string[] = [];
    if (!aiTersedia) {
      catatan.push(`API key untuk model ${modelAI || "AI terpilih"} belum diatur di environment lokal; sentimen ditentukan dari rating bintang sebagai fallback.`);
    }
    if (gagalAI > 0) {
      catatan.push(`${gagalAI} ulasan gagal diproses AI dan diberi label dari rating bintang sebagai fallback.${errorAITerakhir ? ` Penyebab terakhir: ${errorAITerakhir.code} — ${errorAITerakhir.message}.` : ""}`);
    }
    if (gagalDilabel > 0) {
      catatan.push(`${gagalDilabel} ulasan tidak dapat diberi label sentimen (tidak ada rating dan AI gagal).`);
    }
    const totalDetik = Math.max(1, Math.round((Date.now() - mulaiWaktuMs) / 1000));
    const menit = Math.floor(totalDetik / 60);
    const sisaDetik = totalDetik % 60;
    const infoWaktu = menit > 0 ? `${menit} menit ${sisaDetik} detik` : `${sisaDetik} detik`;
    catatan.unshift(`Selesai dianalisis dalam waktu ${infoWaktu}.`);

    await supabase.from(analisis)
      .update(toSnake({
        status: "selesai",
        totalUlasan,
        totalPositif: posCount,
        totalNegatif: negCount,
        totalNetral: netCount,
        kondisiUmum,
        catatan: catatan.join(" "),
      }))
      .eq("id", analisisId);
  } catch (error) {
    const pesan = error instanceof Error ? error.message : "Kesalahan tidak diketahui";
    await supabase.from(analisis)
      .update(toSnake({ status: "gagal", catatan: `Proses analisis gagal: ${pesan}` }))
      .eq("id", analisisId);
  }
}

async function pastikanAspekTersedia(namaAspek: string[], cache: Map<string, number>): Promise<void> {
  const belumAda = Array.from(new Set(
    namaAspek.map((nama) => nama.trim().toLowerCase()).filter((nama) => nama && !cache.has(nama))
  ));
  if (belumAda.length === 0) return;

  const { data: rows, error } = await supabase
    .from(aspek)
    .upsert(belumAda.map((nama_aspek) => ({ nama_aspek })), { onConflict: "nama_aspek" })
    .select("id,nama_aspek");

  if (!error) {
    for (const row of rows ?? []) {
      cache.set(String(row.nama_aspek).trim().toLowerCase(), Number(row.id));
    }
  }

  // Menjaga kompatibilitas bila konfigurasi PostgREST tidak mengizinkan bulk upsert.
  for (const nama of belumAda) {
    if (!cache.has(nama)) await dapatkanAspekId(nama, cache);
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

export interface LokasiTerkaitItem {
  nama: string;
  jenis?: string;
  total: number;
}

export interface StatistikAspek {
  id: number;
  namaAspek: string;
  positif: number;
  negatif: number;
  netral: number;
  lokasiNegatif?: LokasiTerkaitItem[];
  lokasiPositif?: LokasiTerkaitItem[];
}

export async function dapatkanStatistikAspek(
  analisisId: number,
  dari?: string | null,
  sampai?: string | null
): Promise<StatistikAspek[]> {
  let query = supabase.from(hasilAspekUlasan)
    .select("ulasan_id, sentimen_aspek, aspek(id, nama_aspek), ulasan!inner(id, analisis_id, tanggal_ulasan, unit_layanan)")
    .eq("ulasan.analisis_id", analisisId);

  let queryLokasi = supabase.from(hasilLokasiUlasan)
    .select("ulasan_id, lokasi_layanan_rs(id, nama, jenis), ulasan!inner(analisis_id, tanggal_ulasan)")
    .eq("ulasan.analisis_id", analisisId);

  if (dari) {
    const tglDari = new Date(dari);
    tglDari.setHours(0, 0, 0, 0);
    query = query.gte("ulasan.tanggal_ulasan", tglDari.toISOString());
    queryLokasi = queryLokasi.gte("ulasan.tanggal_ulasan", tglDari.toISOString());
  }

  if (sampai) {
    const tglSampai = new Date(sampai);
    tglSampai.setHours(23, 59, 59, 999);
    query = query.lte("ulasan.tanggal_ulasan", tglSampai.toISOString());
    queryLokasi = queryLokasi.lte("ulasan.tanggal_ulasan", tglSampai.toISOString());
  }

  const [{ data: hasilRaw }, { data: lokasiRaw }] = await Promise.all([
    query,
    queryLokasi,
  ]);

  // Map ulasanId -> Map<namaLokasi, { nama: string; jenis?: string }>
  const ulasanKeLokasi = new Map<number, Map<string, { nama: string; jenis?: string }>>();

  if (lokasiRaw) {
    const lokasiTerstruktur = lokasiRaw as unknown as Array<{
      ulasan_id: number;
      lokasi_layanan_rs: { id: number; nama: string; jenis: string } | null;
    }>;
    for (const row of lokasiTerstruktur) {
      const lok = row.lokasi_layanan_rs;
      if (!lok?.nama) continue;
      if (!ulasanKeLokasi.has(row.ulasan_id)) {
        ulasanKeLokasi.set(row.ulasan_id, new Map());
      }
      ulasanKeLokasi.get(row.ulasan_id)!.set(lok.nama, {
        nama: lok.nama,
        jenis: lok.jenis,
      });
    }
  }

  interface AspekAccumulator {
    id: number;
    namaAspek: string;
    positif: number;
    negatif: number;
    netral: number;
    lokasiNegatifMap: Map<string, { nama: string; jenis?: string; total: number }>;
    lokasiPositifMap: Map<string, { nama: string; jenis?: string; total: number }>;
  }

  const mapAccumulator = new Map<string, AspekAccumulator>();

  if (hasilRaw) {
    const hasilTerstruktur = hasilRaw as unknown as Array<{
      ulasan_id: number;
      sentimen_aspek: string;
      aspek: { id: number; nama_aspek: string } | null;
      ulasan: { id: number; analisis_id: number; tanggal_ulasan: string; unit_layanan?: string | null } | null;
    }>;

    for (const item of hasilTerstruktur) {
      const asp = item.aspek;
      if (!asp) continue;
      const namaAspek = normalisasiAspekUmum(asp.nama_aspek);
      const id = ASPEK_UMUM.indexOf(namaAspek) + 1;
      const sentimen = item.sentimen_aspek;

      if (!mapAccumulator.has(namaAspek)) {
        mapAccumulator.set(namaAspek, {
          id,
          namaAspek,
          positif: 0,
          negatif: 0,
          netral: 0,
          lokasiNegatifMap: new Map(),
          lokasiPositifMap: new Map(),
        });
      }

      const acc = mapAccumulator.get(namaAspek)!;
      if (sentimen === "positif") acc.positif++;
      else if (sentimen === "negatif") acc.negatif++;
      else if (sentimen === "netral") acc.netral++;

      // Cari lokasi terkait ulasan ini
      let lokasiReview = ulasanKeLokasi.get(item.ulasan_id);
      // Fallback ke ulasan.unit_layanan jika tidak ada lokasi layanan spesifik
      if ((!lokasiReview || lokasiReview.size === 0) && item.ulasan?.unit_layanan && item.ulasan.unit_layanan !== "Lainnya") {
        lokasiReview = new Map([
          [item.ulasan.unit_layanan, { nama: item.ulasan.unit_layanan, jenis: "unit" }]
        ]);
        ulasanKeLokasi.set(item.ulasan_id, lokasiReview);
      }

      if (lokasiReview && lokasiReview.size > 0) {
        if (sentimen === "negatif") {
          for (const [nama, info] of lokasiReview.entries()) {
            const cur = acc.lokasiNegatifMap.get(nama);
            if (cur) {
              cur.total++;
            } else {
              acc.lokasiNegatifMap.set(nama, { nama, jenis: info.jenis, total: 1 });
            }
          }
        } else if (sentimen === "positif") {
          for (const [nama, info] of lokasiReview.entries()) {
            const cur = acc.lokasiPositifMap.get(nama);
            if (cur) {
              cur.total++;
            } else {
              acc.lokasiPositifMap.set(nama, { nama, jenis: info.jenis, total: 1 });
            }
          }
        }
      }
    }
  }

  return Array.from(mapAccumulator.values())
    .map((acc) => {
      const lokasiNegatif = Array.from(acc.lokasiNegatifMap.values())
        .sort((a, b) => b.total - a.total || a.nama.localeCompare(b.nama))
        .slice(0, 3);
      const lokasiPositif = Array.from(acc.lokasiPositifMap.values())
        .sort((a, b) => b.total - a.total || a.nama.localeCompare(b.nama))
        .slice(0, 3);

      return {
        id: acc.id,
        namaAspek: acc.namaAspek,
        positif: acc.positif,
        negatif: acc.negatif,
        netral: acc.netral,
        lokasiNegatif: lokasiNegatif.length > 0 ? lokasiNegatif : undefined,
        lokasiPositif: lokasiPositif.length > 0 ? lokasiPositif : undefined,
      };
    })
    .sort((a, b) => a.id - b.id);
}

export interface StatistikLokasi {
  id: number;
  nama: string;
  jenis: string;
  total: number;
  positif: number;
  negatif: number;
  netral: number;
  contoh: string[];
}

export async function dapatkanStatistikLokasi(
  analisisId: number,
  dari?: string | null,
  sampai?: string | null
): Promise<StatistikLokasi[]> {
  let query = supabase.from(hasilLokasiUlasan)
    .select("kutipan, lokasi_layanan_rs(id,nama,jenis), ulasan!inner(analisis_id,tanggal_ulasan,sentimen)")
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

  const { data } = await query;
  const statistik = new Map<number, StatistikLokasi>();
  const rows = (data ?? []) as unknown as Array<{
    kutipan: string | null;
    lokasi_layanan_rs: { id: number; nama: string; jenis: string } | null;
    ulasan: { sentimen: string | null } | null;
  }>;

  for (const row of rows) {
    const lokasi = row.lokasi_layanan_rs;
    if (!lokasi) continue;
    if (!statistik.has(lokasi.id)) {
      statistik.set(lokasi.id, {
        id: lokasi.id,
        nama: lokasi.nama,
        jenis: lokasi.jenis,
        total: 0,
        positif: 0,
        negatif: 0,
        netral: 0,
        contoh: [],
      });
    }
    const item = statistik.get(lokasi.id)!;
    item.total++;
    if (row.ulasan?.sentimen === "positif") item.positif++;
    else if (row.ulasan?.sentimen === "negatif") item.negatif++;
    else item.netral++;
    if (row.kutipan && item.contoh.length < 3 && !item.contoh.includes(row.kutipan)) {
      item.contoh.push(row.kutipan);
    }
  }

  return Array.from(statistik.values()).sort((a, b) => b.total - a.total || a.nama.localeCompare(b.nama));
}
