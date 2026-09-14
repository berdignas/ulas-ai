import { after, NextResponse } from "next/server";
import { supabase, toCamel } from "@/lib/db";
import { analisis, AnalisisRow } from "@/lib/db/schema";
import { mulaiProsesAnalisis, prosesSedangBerjalan } from "@/lib/analyzer";

export const runtime = "nodejs";
export const maxDuration = 300;

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

  // Jika instance worker berakhir sebelum semua batch selesai, polling berikutnya
  // memulai kembali dari checkpoint di database. Ulasan dengan sumber_label terisi
  // tidak diproses ulang, sehingga aman dijalankan di localhost maupun serverless.
  const berjalanDiWorker = prosesSedangBerjalan(analisisId);
  if (item.status === "berjalan" && !berjalanDiWorker) {
    // Auto-resume: worker mati tapi status masih "berjalan" — ini selalu resume, bukan restart.
    const proses = mulaiProsesAnalisis(analisisId, true);
    if (proses) {
      after(() => proses);
      console.info(`[ai] melanjutkan analisis ${analisisId} dari checkpoint database`);
    }
  }

  return NextResponse.json({
    status: item.status,
    totalUlasan: item.totalUlasan,
    // Hanya status selesai yang boleh ditampilkan 100%. Status gagal tetap memakai
    // checkpoint agar UI tidak mengklaim seluruh ulasan sudah diproses.
    ulasanDiproses: item.status === "selesai" ? item.totalUlasan : item.ulasanDiproses,
    catatan: item.catatan,
  });
}
