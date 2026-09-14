import { NextResponse } from "next/server";
import { supabase, toCamel, toSnake } from "@/lib/db";
import { ulasan, rumahSakit, UlasanRow } from "@/lib/db/schema";
import { aiConfigured, analisisBatchUlasanDenganAI, getAIErrorInfo, sentimenFallbackDariRating } from "@/lib/ai";
import { parseCustomAIConfig } from "@/lib/ai-config";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * POST /api/jurnal/analisis-manual
 * Menganalisis satu ulasan secara manual menggunakan AI.
 * Body: { ulasanId: number }
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { ulasanId } = body;

    if (!ulasanId || typeof ulasanId !== "number") {
      return NextResponse.json({ error: "ulasanId wajib diisi." }, { status: 400 });
    }

    const { data: rowsRaw, error: fetchError } = await supabase
      .from(ulasan)
      .select("*")
      .eq("id", ulasanId)
      .limit(1);

    if (fetchError || !rowsRaw?.length) {
      return NextResponse.json({ error: "Ulasan tidak ditemukan." }, { status: 404 });
    }

    const item = toCamel<UlasanRow>(rowsRaw[0]);

    // Ambil konfigurasi AI dari rumah sakit
    const { data: rsRaw } = item.rumahSakitId
      ? await supabase.from(rumahSakit).select("ai_model, ai_api_key").eq("id", item.rumahSakitId).limit(1)
      : { data: null };

    const modelAI = rsRaw?.[0]?.ai_model ?? null;
    const customConfig = parseCustomAIConfig(rsRaw?.[0]?.ai_api_key);
    const aiTersedia = aiConfigured(modelAI, customConfig);

    let sentimen: string | null = null;
    let sumberLabel: string | null = null;
    let unitLayanan: string = "Lainnya";
    let kategoriMasalah: string = "Lainnya";
    let faktorUrgensiMedis: boolean = false;
    let saranDrafBalasan: string | null = null;
    let pakaiAI = false;
    let pesanError: string | null = null;

    if (aiTersedia) {
      try {
        const hasilBatch = await analisisBatchUlasanDenganAI(
          [{ id: item.id, teksUlasan: item.teksUlasan, rating: item.rating ?? null }],
          modelAI,
          [], // Tidak perlu daftar lokasi untuk analisis manual individual
          {},
          customConfig
        );

        const hasil = hasilBatch.get(item.id);
        if (hasil) {
          sentimen = hasil.sentimen;
          sumberLabel = "ai";
          unitLayanan = hasil.unitLayanan;
          kategoriMasalah = hasil.kategoriMasalah;
          faktorUrgensiMedis = hasil.faktorUrgensiMedis;
          saranDrafBalasan = hasil.saranDrafBalasan;
          pakaiAI = true;
        } else {
          // AI gagal, fallback ke rating
          sentimen = sentimenFallbackDariRating(item.rating ?? null);
          sumberLabel = sentimen ? "rating" : null;
          pesanError = "Analisis AI tidak menghasilkan data. Sentimen ditentukan dari rating.";
        }
      } catch (err) {
        const info = getAIErrorInfo(err);
        sentimen = sentimenFallbackDariRating(item.rating ?? null);
        sumberLabel = sentimen ? "rating" : null;
        pesanError = `AI gagal (${info.code}): ${info.message}. Sentimen ditentukan dari rating.`;
      }
    } else {
      sentimen = sentimenFallbackDariRating(item.rating ?? null);
      sumberLabel = sentimen ? "rating" : null;
      pesanError = "API AI belum dikonfigurasi. Sentimen ditentukan dari rating bintang.";
    }

    // Simpan hasil ke database
    await supabase
      .from(ulasan)
      .update(
        toSnake({
          sentimen,
          sumberLabel,
          unitLayanan,
          kategoriMasalah,
          faktorUrgensiMedis,
          saranDrafBalasan,
          diperbaruiPada: new Date().toISOString(),
        })
      )
      .eq("id", ulasanId);

    return NextResponse.json({
      sukses: true,
      pakaiAI,
      sentimen,
      unitLayanan,
      kategoriMasalah,
      faktorUrgensiMedis,
      saranDrafBalasan,
      pesanError,
    });
  } catch (err) {
    console.error("[analisis-manual] error:", err);
    return NextResponse.json({ error: "Terjadi kesalahan internal." }, { status: 500 });
  }
}
