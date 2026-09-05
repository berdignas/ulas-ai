import { NextResponse } from "next/server";
import { and, eq, like, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { ulasan } from "@/lib/db/schema";

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

  const kondisi = [eq(ulasan.analisisId, analisisId)];
  if (sentimen && SENTIMEN_VALID.includes(sentimen as typeof SENTIMEN_VALID[number])) {
    kondisi.push(eq(ulasan.sentimen, sentimen as typeof SENTIMEN_VALID[number]));
  }
  if (kataKunci) {
    kondisi.push(like(ulasan.teksUlasan, `%${kataKunci}%`));
  }
  const whereKondisi = and(...kondisi);

  const totalRows = await db
    .select({ jumlah: sql<number>`count(*)` })
    .from(ulasan)
    .where(whereKondisi);
  const total = totalRows[0]?.jumlah ?? 0;

  const daftar = await db
    .select()
    .from(ulasan)
    .where(whereKondisi)
    .orderBy(sql`${ulasan.id}`)
    .limit(perHalaman)
    .offset((halaman - 1) * perHalaman);

  return NextResponse.json({
    ulasan: daftar,
    total,
    halaman,
    perHalaman,
  });
}