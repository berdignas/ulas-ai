import { NextResponse } from "next/server";
import { supabase, toCamel } from "@/lib/db";
import { analisis, ulasan, AnalisisRow } from "@/lib/db/schema";
import { hapusAspekYatim, prosesSedangBerjalan } from "@/lib/analyzer";

export const runtime = "nodejs";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
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

  const { count: totalTerlabel } = await supabase
    .from(ulasan)
    .select("*", { count: "exact", head: true })
    .eq("analisis_id", analisisId)
    .not("sentimen", "is", null);

  return NextResponse.json({
    analisis: item,
    totalTerlabel: totalTerlabel ?? 0,
  });
}

export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
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

  const paksa = new URL(req.url).searchParams.get("paksa") === "1";
  if ((prosesSedangBerjalan(analisisId) || item.status === "berjalan") && !paksa) {
    return NextResponse.json(
      { error: "Analisis sedang diproses. Tunggu hingga selesai sebelum menghapus." },
      { status: 409 }
    );
  }

  await supabase.from(analisis).delete().eq("id", analisisId);
  await hapusAspekYatim();
  return NextResponse.json({ terhapus: true });
}