import { NextResponse } from "next/server";
import { supabase, toCamel } from "@/lib/db";
import { ulasan, UlasanRow } from "@/lib/db/schema";

export const runtime = "nodejs";

const SENTIMEN_VALID = ["positif", "negatif", "netral"] as const;

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const analisisId = Number(id);
  if (!Number.isFinite(analisisId)) {
    return NextResponse.json({ error: "ID tidak valid." }, { status: 400 });
  }

  const url = new URL(req.url);
  const sentimen = url.searchParams.get("sentimen");
  const kataKunci = url.searchParams.get("q")?.trim() || null;
  const halaman = Math.max(1, Number(url.searchParams.get("page") ?? "1") || 1);
  const perHalaman = Math.min(100, Math.max(10, Number(url.searchParams.get("limit") ?? "20") || 20));

  let query = supabase.from(ulasan).select("*", { count: "exact" }).eq("analisis_id", analisisId);

  const dari = url.searchParams.get("dari");
  const sampai = url.searchParams.get("sampai");

  if (dari) {
    const tglDari = new Date(dari);
    tglDari.setHours(0, 0, 0, 0);
    query = query.gte("tanggal_ulasan", tglDari.toISOString());
  }

  if (sampai) {
    const tglSampai = new Date(sampai);
    tglSampai.setHours(23, 59, 59, 999);
    query = query.lte("tanggal_ulasan", tglSampai.toISOString());
  }

  if (sentimen && SENTIMEN_VALID.includes(sentimen as typeof SENTIMEN_VALID[number])) {
    query = query.eq("sentimen", sentimen);
  }
  if (kataKunci) {
    query = query.ilike("teks_ulasan", `%${kataKunci}%`);
  }

  const fromIndex = (halaman - 1) * perHalaman;
  const toIndex = fromIndex + perHalaman - 1;

  const { data: listRaw, count, error } = await query
    .order("tanggal_ulasan", { ascending: false })
    .range(fromIndex, toIndex);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const daftar = toCamel<UlasanRow[]>(listRaw ?? []);
  const total = count ?? 0;

  return NextResponse.json({
    ulasan: daftar,
    total,
    halaman,
    perHalaman,
  });
}