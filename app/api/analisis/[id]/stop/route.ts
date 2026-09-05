import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { analisis } from "@/lib/db/schema";
import { hentikanProsesAnalisis, prosesSedangBerjalan } from "@/lib/analyzer";

export const runtime = "nodejs";

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
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

  if (!prosesSedangBerjalan(analisisId)) {
    return NextResponse.json({ error: "Tidak ada proses analisis yang sedang berjalan." }, { status: 409 });
  }

  hentikanProsesAnalisis(analisisId);
  return NextResponse.json({
    status: "berhenti",
    pesan: "Permintaan berhenti dikirim. Analisis akan berhenti setelah ulasan yang sedang diproses selesai.",
  });
}