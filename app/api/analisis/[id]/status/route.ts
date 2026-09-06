import { NextResponse } from "next/server";
import { supabase, toCamel } from "@/lib/db";
import { analisis, AnalisisRow } from "@/lib/db/schema";
import { prosesSedangBerjalan } from "@/lib/analyzer";

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

  return NextResponse.json({
    status: item.status,
    totalUlasan: item.totalUlasan,
    ulasanDiproses:
      prosesSedangBerjalan(analisisId) || item.status === "berjalan" || item.status === "berhenti"
        ? item.ulasanDiproses
        : item.totalUlasan,
    catatan: item.catatan,
  });
}