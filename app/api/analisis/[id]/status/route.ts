import { after, NextResponse } from "next/server";
import { supabase, toCamel } from "@/lib/db";
import { analisis, ulasan, AnalisisRow } from "@/lib/db/schema";
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

  const { count: totalUlasanAktual, error: totalUlasanError } = await supabase
    .from(ulasan)
    .select("id", { count: "exact", head: true })
    .eq("analisis_id", analisisId);
  const totalUlasan = totalUlasanError || totalUlasanAktual === null
    ? Math.max(item.totalUlasan, item.ulasanDiproses ?? 0)
    : totalUlasanAktual;

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
    totalUlasan,
    // Batasi checkpoint terhadap total aktual agar UI tidak pernah menampilkan
    // lebih dari jumlah ulasan yang benar-benar tersimpan.
    ulasanDiproses: Math.min(totalUlasan, item.ulasanDiproses),
    sisaUlasan: Math.max(0, totalUlasan - item.ulasanDiproses),
    catatan: item.catatan,
  });
}
