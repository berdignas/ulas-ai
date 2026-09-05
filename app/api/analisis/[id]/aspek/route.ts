import { NextResponse } from "next/server";
import { dapatkanStatistikAspek } from "@/lib/analyzer";

export const runtime = "nodejs";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const analisisId = Number(id);
  if (!Number.isFinite(analisisId)) {
    return NextResponse.json({ error: "ID tidak valid." }, { status: 400 });
  }

  const statistik = await dapatkanStatistikAspek(analisisId);
  const urutKeluhan = [...statistik].sort((a, b) => b.negatif - a.negatif || b.positif + b.negatif - (a.positif + a.negatif));
  const urutPujian = [...statistik].sort((a, b) => b.positif - a.positif || b.positif + b.negatif - (a.positif + a.negatif));

  return NextResponse.json({
    aspek: statistik,
    perluDiperbaiki: urutKeluhan.filter((a) => a.negatif > 0),
    perluDipertahankan: urutPujian.filter((a) => a.positif > 0),
  });
}