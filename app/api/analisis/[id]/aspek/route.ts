import { NextResponse } from "next/server";
import { dapatkanStatistikAspek, dapatkanStatistikLokasi } from "@/lib/analyzer";

export const runtime = "nodejs";

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const analisisId = Number(id);
  if (!Number.isFinite(analisisId)) {
    return NextResponse.json({ error: "ID tidak valid." }, { status: 400 });
  }

  const url = new URL(req.url);
  const dari = url.searchParams.get("dari");
  const sampai = url.searchParams.get("sampai");

  const [statistik, lokasi] = await Promise.all([
    dapatkanStatistikAspek(analisisId, dari, sampai),
    dapatkanStatistikLokasi(analisisId, dari, sampai),
  ]);
  const urutKeluhan = [...statistik].sort((a, b) => b.negatif - a.negatif || b.positif + b.negatif - (a.positif + a.negatif));
  const urutPujian = [...statistik].sort((a, b) => b.positif - a.positif || b.positif + b.negatif - (a.positif + a.negatif));

  return NextResponse.json({
    aspek: statistik,
    perluDiperbaiki: urutKeluhan.filter((a) => a.negatif > 0),
    perluDipertahankan: urutPujian.filter((a) => a.positif > 0),
    lokasi,
  });
}
