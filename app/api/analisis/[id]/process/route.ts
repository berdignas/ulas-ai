import { NextResponse } from "next/server";
import { supabase, toCamel } from "@/lib/db";
import { analisis, AnalisisRow } from "@/lib/db/schema";
import { mulaiProsesAnalisis, prosesSedangBerjalan } from "@/lib/analyzer";
import { aiConfigured } from "@/lib/ai";

export const runtime = "nodejs";

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

  if (prosesSedangBerjalan(analisisId)) {
    return NextResponse.json({ status: "berjalan", pesan: "Analisis sedang diproses." });
  }

  const ulangi = item.status === "selesai" || item.status === "berhenti";
  mulaiProsesAnalisis(analisisId);
  return NextResponse.json({
    status: "berjalan",
    pakaiAI: aiConfigured(),
    pesan: !aiConfigured()
      ? "Analisis dimulai tanpa AI Gateway; sentimen ditentukan dari rating bintang."
      : ulangi
        ? "Analisis diproses ulang. Setiap ulasan sedang dikirim ke AI Gateway."
        : "Analisis dimulai. Setiap ulasan sedang dikirim ke AI Gateway.",
  });
}