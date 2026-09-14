import { after, NextResponse } from "next/server";
import { supabase, toCamel, toSnake } from "@/lib/db";
import { analisis, rumahSakit, AnalisisRow } from "@/lib/db/schema";
import { mulaiProsesAnalisis, prosesSedangBerjalan } from "@/lib/analyzer";
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

  const { data: konfigurasiRS } = await supabase
    .from(rumahSakit)
    .select("ai_model, ai_api_key")
    .eq("id", item.rumahSakitId)
    .limit(1);
  const modelAI = konfigurasiRS?.[0]?.ai_model ?? null;
  const customConfig = parseCustomAIConfig(konfigurasiRS?.[0]?.ai_api_key);
  const pakaiAI = aiConfigured(modelAI, customConfig);

  if (prosesSedangBerjalan(analisisId)) {
    return NextResponse.json({ status: "berjalan", pesan: "Analisis sedang diproses." });
  }

  const ulangi = item.status === "selesai" || item.status === "berhenti";
  const isResume = item.status === "berhenti";
  // Catat status sebelum response dikirim. Tanpa ini, polling dapat membaca
  // status lama ketika worker after() belum sempat mulai di deployment serverless.
  // Saat resume (berhenti → berjalan), pertahankan catatan progres sebelumnya.
  // Saat mulai ulang penuh (selesai → berjalan), reset catatan dan kondisiUmum.
  const updatePayload = isResume
    ? toSnake({ status: "berjalan" })
    : toSnake({ status: "berjalan", catatan: null, kondisiUmum: null });
  const { error: startError } = await supabase
    .from(analisis)
    .update(updatePayload)
    .eq("id", analisisId);
  if (startError) {
    return NextResponse.json({ error: `Gagal menandai analisis sebagai berjalan: ${startError.message}` }, { status: 500 });
  }

  const proses = mulaiProsesAnalisis(analisisId, isResume);
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
    pesan: !pakaiAI
      ? "API key untuk model terpilih belum dikonfigurasi di environment lokal; sentimen ditentukan dari rating bintang."
      : isResume
        ? "Analisis dilanjutkan dari titik terakhir. Ulasan yang sudah selesai tidak diproses ulang."
        : ulangi
          ? "Analisis diproses ulang. Setiap ulasan sedang dikirim ke AI Gateway."
          : "Analisis dimulai. Setiap ulasan sedang dikirim ke AI Gateway.",
  });
}
