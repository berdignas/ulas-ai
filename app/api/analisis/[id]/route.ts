import { NextResponse } from "next/server";
import { eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { analisis, ulasan } from "@/lib/db/schema";
import { hapusAspekYatim, prosesSedangBerjalan } from "@/lib/analyzer";

export const runtime = "nodejs";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const analisisId = Number(id);
  if (!Number.isFinite(analisisId)) {
    return NextResponse.json({ error: "ID tidak valid." }, { status: 400 });
  }

  const itemRows = await db.select().from(analisis).where(eq(analisis.id, analisisId)).limit(1);
  const item = itemRows[0];
  if (!item) {
    return NextResponse.json({ error: "Analisis tidak ditemukan." }, { status: 404 });
  }

  const totalTerlabelRows = await db
    .select({ jumlah: sql<number>`count(*)` })
    .from(ulasan)
    .where(sql`${ulasan.analisisId} = ${analisisId} AND ${ulasan.sentimen} IS NOT NULL`);
  const totalTerlabel = totalTerlabelRows[0]?.jumlah ?? 0;

  return NextResponse.json({
    analisis: item,
    totalTerlabel,
  });
}

export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const analisisId = Number(id);
  if (!Number.isFinite(analisisId)) {
    return NextResponse.json({ error: "ID tidak valid." }, { status: 400 });
  }

  const itemRows = await db.select().from(analisis).where(eq(analisis.id, analisisId)).limit(1);
  const item = itemRows[0];
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

  await db.delete(analisis).where(eq(analisis.id, analisisId));
  hapusAspekYatim();
  return NextResponse.json({ terhapus: true });
}