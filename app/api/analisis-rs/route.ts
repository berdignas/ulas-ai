import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ulasan } from "@/lib/db/schema";
import { eq, and, isNull, inArray } from "drizzle-orm";
import { analisisUlasanRumahSakit, prosesBatchAnalisis } from "@/lib/ai-hospital";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const body = await req.json();
  const { ulasanIds, rumahSakitId, analisisId } = body;

  let targetIds: number[] = [];

  if (ulasanIds && Array.isArray(ulasanIds)) {
    targetIds = ulasanIds;
  } else if (rumahSakitId) {
    const rows = await db.select({ id: ulasan.id }).from(ulasan)
      .where(and(eq(ulasan.rumahSakitId, rumahSakitId), isNull(ulasan.sentimen)))
      .limit(50);
    targetIds = rows.map((r) => r.id);
  } else if (analisisId) {
    const rows = await db.select({ id: ulasan.id }).from(ulasan)
      .where(and(eq(ulasan.analisisId, analisisId), isNull(ulasan.sentimen)))
      .limit(50);
    targetIds = rows.map((r) => r.id);
  }

  if (targetIds.length === 0) {
    return NextResponse.json({ diproses: 0, pesan: "Tidak ada ulasan yang perlu diproses" });
  }

  const ulasanData = await db.select({ id: ulasan.id, teksUlasan: ulasan.teksUlasan, rating: ulasan.rating })
    .from(ulasan)
    .where(inArray(ulasan.id, targetIds));

  const hasil = await prosesBatchAnalisis(ulasanData.map((u) => ({ id: u.id, teksUlasan: u.teksUlasan, rating: u.rating })));

  let diproses = 0;
  let krisis = 0;
  for (const [id, res] of hasil.entries()) {
    await db.update(ulasan)
      .set({
        unitLayanan: res.unitLayanan,
        kategoriMasalah: res.kategoriMasalah,
        sentimen: res.sentimen,
        faktorUrgensiMedis: res.faktorUrgensiMedis,
        saranDrafBalasan: res.saranDrafBalasan,
        diperbaruiPada: new Date(),
      })
      .where(eq(ulasan.id, id));
    diproses++;
    if (res.faktorUrgensiMedis) krisis++;
  }

  return NextResponse.json({ diproses, krisis, total: targetIds.length });
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id wajib" }, { status: 400 });

  const itemRows = await db.select().from(ulasan).where(eq(ulasan.id, parseInt(id))).limit(1);
  const item = itemRows[0];
  if (!item) return NextResponse.json({ error: "Ulasan tidak ditemukan" }, { status: 404 });

  return NextResponse.json(item);
}