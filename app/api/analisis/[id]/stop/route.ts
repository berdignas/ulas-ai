import { NextResponse } from "next/server";
import { supabase, toCamel } from "@/lib/db";
import { analisis, ulasan, AnalisisRow } from "@/lib/db/schema";
import { finalisasiAnalisisDihentikan, hentikanProsesAnalisis } from "@/lib/analyzer";
import { toSnake } from "@/lib/db";

export const runtime = "nodejs";

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
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

  const { count: totalUlasanAktual, error: totalUlasanError } = await supabase
    .from(ulasan)
    .select("id", { count: "exact", head: true })
    .eq("analisis_id", analisisId);
  const totalUlasan = totalUlasanError || totalUlasanAktual === null
    ? Math.max(item.totalUlasan, item.ulasanDiproses ?? 0)
    : totalUlasanAktual;

  if (item.status !== "berjalan") {
    return NextResponse.json({ error: "Tidak ada proses analisis yang sedang berjalan." }, { status: 409 });
  }

  // Simpan sinyal stop agar dapat dibaca worker di instance lain setelah deploy.
  const { error } = await supabase
    .from(analisis)
    .update(toSnake({ status: "berhenti", catatan: "Mengakhiri analisis dan menyiapkan hasil parsial." }))
    .eq("id", analisisId)
    .eq("status", "berjalan");
  if (error) {
    return NextResponse.json({ error: `Gagal menghentikan analisis: ${error.message}` }, { status: 500 });
  }

  hentikanProsesAnalisis(analisisId);
  try {
    const hasil = await finalisasiAnalisisDihentikan(
      analisisId,
      totalUlasan,
      "Analisis dihentikan oleh pengguna"
    );
    return NextResponse.json({
      status: hasil.status,
      totalUlasan,
      ulasanDiproses: hasil.ulasanDiproses,
      sisaUlasan: hasil.sisaUlasan,
      pesan: hasil.sisaUlasan > 0
        ? `Analisis dihentikan. ${hasil.ulasanDiproses} hasil tersedia dan ${hasil.sisaUlasan} ulasan masih dapat dianalisis.`
        : "Analisis dihentikan setelah seluruh ulasan selesai diproses.",
    });
  } catch (finalisasiError) {
    console.error("[ai] gagal menyiapkan ringkasan parsial:", finalisasiError);
    return NextResponse.json({
      status: "berhenti",
      totalUlasan,
      ulasanDiproses: item.ulasanDiproses,
      sisaUlasan: Math.max(0, totalUlasan - item.ulasanDiproses),
      pesan: "Analisis dihentikan. Muat ulang dashboard untuk melihat hasil parsial terbaru.",
    });
  }
}
