import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { analisis, aspek } from "@/lib/db/schema";
import { adaProsesBerjalan } from "@/lib/analyzer";
import { desc, eq } from "drizzle-orm";

export const runtime = "nodejs";

export async function GET() {
  const daftar = await db.select().from(analisis).orderBy(desc(analisis.tanggalUnggah));
  return NextResponse.json({ analisis: daftar });
}

export async function DELETE(req: Request) {
  const paksa = new URL(req.url).searchParams.get("paksa") === "1";
  const runningRows = await db.select({ id: analisis.id }).from(analisis).where(eq(analisis.status, "berjalan"));
  const adaBerjalanDiDb = runningRows.length > 0;

  if ((adaProsesBerjalan() || adaBerjalanDiDb) && !paksa) {
    return NextResponse.json(
      { error: "Masih ada analisis yang sedang diproses. Tunggu hingga selesai sebelum membersihkan data." },
      { status: 409 }
    );
  }

  const allAnalisis = await db.select({ id: analisis.id }).from(analisis);
  await db.delete(analisis);
  await db.delete(aspek);
  return NextResponse.json({ terhapus: allAnalisis.length });
}