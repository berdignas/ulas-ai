import { after, NextResponse } from "next/server";
import { supabase, toCamel } from "@/lib/db";
import { analisis, rumahSakit, AnalisisRow } from "@/lib/db/schema";
import { mulaiProsesAnalisis, prosesSedangBerjalan } from "@/lib/analyzer";
import { aiConfigured } from "@/lib/ai";

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
    .select("ai_model")
    .eq("id", item.rumahSakitId)
    .limit(1);
  const modelAI = konfigurasiRS?.[0]?.ai_model ?? null;
  const pakaiAI = aiConfigured(modelAI);

  if (prosesSedangBerjalan(analisisId)) {
    return NextResponse.json({ status: "berjalan", pesan: "Analisis sedang diproses." });
  }

  const ulangi = item.status === "selesai" || item.status === "berhenti";
  const proses = mulaiProsesAnalisis(analisisId);
  if (!proses) {
    return NextResponse.json({ status: "berjalan", pesan: "Analisis sedang diproses." });
  }
  after(() => proses);
  return NextResponse.json({
    status: "berjalan",
    pakaiAI,
    model: modelAI,
    pesan: !pakaiAI
      ? "API key untuk model terpilih belum dikonfigurasi di Vercel; sentimen ditentukan dari rating bintang."
      : ulangi
        ? "Analisis diproses ulang. Setiap ulasan sedang dikirim ke AI Gateway."
        : "Analisis dimulai. Setiap ulasan sedang dikirim ke AI Gateway.",
  });
}
