import { after, NextResponse } from "next/server";
import { supabase, toCamel, toSnake } from "@/lib/db";
import { analisis, rumahSakit, ulasan, AnalisisRow } from "@/lib/db/schema";
import { finalisasiAnalisisDihentikan, mulaiProsesAnalisis, prosesSedangBerjalan } from "@/lib/analyzer";
import { aiConfigured } from "@/lib/ai";
import { parseCustomAIConfig } from "@/lib/ai-config";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const analisisId = Number(id);
  if (!Number.isFinite(analisisId)) {
    return NextResponse.json({ error: "ID tidak valid." }, { status: 400 });
  }

  const { data: itemRowsRaw } = await supabase.from(analisis).select("*").eq("id", analisisId).limit(1);
  const item = toCamel<AnalisisRow>(itemRowsRaw?.[0]);
  if (!item) {
    return NextResponse.json({ error: "Analisis tidak ditemukan." }, { status: 404 });
  }

  const { count: totalUlasanAktual, error: totalUlasanError } = await supabase
    .from(ulasan)
    .select("id", { count: "exact", head: true })
    .eq("analisis_id", analisisId);
  const totalUlasan = totalUlasanError || totalUlasanAktual === null
    ? Math.max(item.totalUlasan, item.ulasanDiproses ?? 0)
    : totalUlasanAktual;

  const { data: konfigurasiRS } = await supabase
    .from(rumahSakit)
    .select("ai_model, ai_api_key")
    .eq("id", item.rumahSakitId)
    .limit(1);
  const modelAI = konfigurasiRS?.[0]?.ai_model ?? null;
  const customConfig = parseCustomAIConfig(konfigurasiRS?.[0]?.ai_api_key);
  const pakaiAI = aiConfigured(modelAI, customConfig);
  const hanyaSisa = item.status === "berhenti";

  // Jangan membangun ulang ringkasan atau memulai worker baru sebelum worker
  // sebelumnya benar-benar keluar. Ini menutup celah klik ulang tepat setelah stop.
  if (prosesSedangBerjalan(analisisId)) {
    const sedangDihentikan = item.status === "berhenti";
    const checkpointSaatIni = item.ulasanDiproses ?? 0;
    return NextResponse.json(
      {
        ...(sedangDihentikan
          ? { error: "Analisis sebelumnya masih sedang diakhiri. Coba lagi beberapa saat." }
          : {}),
        status: sedangDihentikan ? "berhenti" : "berjalan",
        totalUlasan,
        ulasanDiproses: checkpointSaatIni,
        sisaUlasan: Math.max(0, totalUlasan - checkpointSaatIni),
        pesan: sedangDihentikan
          ? "Analisis sebelumnya masih sedang diakhiri. Coba lagi beberapa saat."
          : "Analisis sedang diproses.",
      },
      { status: sedangDihentikan ? 409 : 200 }
    );
  }

  const { count: jumlahSudahDianalisis } = hanyaSisa
    ? await supabase
        .from(ulasan)
        .select("*", { count: "exact", head: true })
        .eq("analisis_id", analisisId)
        .not("sumber_label", "is", null)
    : { count: 0 };
  let checkpoint = jumlahSudahDianalisis ?? item.ulasanDiproses ?? 0;
  let sisaUlasan = Math.max(0, totalUlasan - checkpoint);

  // Data yang dihentikan oleh versi lama belum selalu mempunyai agregat hasil.
  // Bangun ringkasan parsial terlebih dahulu agar hasil lama langsung terlihat
  // saat pengguna memilih menganalisis sisa ulasan.
  if (hanyaSisa) {
    try {
      const ringkasanParsial = await finalisasiAnalisisDihentikan(
        analisisId,
        totalUlasan,
        "Hasil analisis sebelumnya dipertahankan"
      );
      checkpoint = ringkasanParsial.ulasanDiproses;
      sisaUlasan = ringkasanParsial.sisaUlasan;
    } catch (errorRingkasan) {
      console.warn("[ai] gagal memperbarui ringkasan sebelum analisis sisa:", errorRingkasan);
    }
  }

  if (hanyaSisa && sisaUlasan === 0) {
    return NextResponse.json({
      status: "selesai",
      pakaiAI,
      model: modelAI,
      totalUlasan,
      ulasanDiproses: checkpoint,
      sisaUlasan: 0,
      pesan: "Seluruh ulasan sudah dianalisis. Tidak ada ulasan tersisa.",
    });
  }

  const ulangi = item.status === "selesai" || item.status === "berhenti";
  // Catat status sebelum response dikirim. Tanpa ini, polling dapat membaca
  // status lama ketika worker after() belum sempat mulai di deployment serverless.
  // Saat menganalisis sisa (berhenti → berjalan), pertahankan hasil sebelumnya.
  // Saat mulai ulang penuh (selesai → berjalan), reset catatan dan kondisiUmum.
  const updatePayload = hanyaSisa
    ? toSnake({ status: "berjalan" })
    : toSnake({ status: "berjalan", catatan: null, kondisiUmum: null });
  const { error: startError } = await supabase
    .from(analisis)
    .update(updatePayload)
    .eq("id", analisisId);
  if (startError) {
    return NextResponse.json({ error: `Gagal menandai analisis sebagai berjalan: ${startError.message}` }, { status: 500 });
  }

  const proses = mulaiProsesAnalisis(analisisId, hanyaSisa);
  if (!proses) {
    return NextResponse.json({ status: "berjalan", pesan: "Analisis sedang diproses." });
  }
  if (process.env.VERCEL === "1") {
    after(() => proses);
  } else {
    void proses;
  }
  return NextResponse.json({
    status: "berjalan",
    pakaiAI,
    model: modelAI,
    totalUlasan,
    ulasanDiproses: checkpoint,
    sisaUlasan,
    pesan: !pakaiAI
      ? "API key untuk model terpilih belum dikonfigurasi di environment lokal; sentimen ditentukan dari rating bintang."
      : hanyaSisa
        ? `Menganalisis ${sisaUlasan} ulasan tersisa. ${checkpoint} hasil sebelumnya tetap tersimpan.`
        : ulangi
          ? "Analisis diproses ulang. Setiap ulasan sedang dikirim ke AI Gateway."
          : "Analisis dimulai. Setiap ulasan sedang dikirim ke AI Gateway.",
  });
}
