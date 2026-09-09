import { NextResponse } from "next/server";
import { supabase, toCamel } from "@/lib/db";
import { analisis, AnalisisRow } from "@/lib/db/schema";
import { hentikanProsesAnalisis } from "@/lib/analyzer";
import { toSnake } from "@/lib/db";

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

  if (item.status !== "berjalan") {
    return NextResponse.json({ error: "Tidak ada proses analisis yang sedang berjalan." }, { status: 409 });
  }

  // Simpan sinyal stop agar dapat dibaca worker di instance lain setelah deploy.
  const { error } = await supabase
    .from(analisis)
    .update(toSnake({ status: "berhenti", catatan: "Permintaan berhenti diterima. Menunggu batch aktif selesai." }))
    .eq("id", analisisId)
    .eq("status", "berjalan");
  if (error) {
    return NextResponse.json({ error: `Gagal menghentikan analisis: ${error.message}` }, { status: 500 });
  }

  hentikanProsesAnalisis(analisisId);
  return NextResponse.json({
    status: "berhenti",
    pesan: "Permintaan berhenti dikirim. Analisis akan berhenti setelah ulasan yang sedang diproses selesai.",
  });
}
