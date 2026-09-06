import { NextResponse } from "next/server";
import { supabase, toCamel, getSqlClient } from "@/lib/db";
import { analisis, aspek, AnalisisRow } from "@/lib/db/schema";
import { adaProsesBerjalan } from "@/lib/analyzer";

export const runtime = "nodejs";

export async function GET() {
  const { data, error } = await supabase
    .from(analisis)
    .select("*")
    .order("tanggal_unggah", { ascending: false });

  if (data) {
    return NextResponse.json({ analisis: toCamel<AnalisisRow[]>(data) });
  }

  // Fallback to direct PostgreSQL query if Supabase REST API key is invalid/placeholder
  const sql = getSqlClient();
  if (sql) {
    try {
      const rows = await sql`SELECT * FROM analisis ORDER BY tanggal_unggah DESC`;
      return NextResponse.json({ analisis: toCamel<AnalisisRow[]>(rows) });
    } catch (dbErr) {
      return NextResponse.json({ error: (dbErr as Error).message }, { status: 500 });
    }
  }

  return NextResponse.json({ error: error?.message || "Gagal mengambil data analisis" }, { status: 500 });
}

export async function DELETE(req: Request) {
  const paksa = new URL(req.url).searchParams.get("paksa") === "1";
  const { data: runningRows } = await supabase
    .from(analisis)
    .select("id")
    .eq("status", "berjalan");
  const adaBerjalanDiDb = Boolean(runningRows && runningRows.length > 0);

  if ((adaProsesBerjalan() || adaBerjalanDiDb) && !paksa) {
    return NextResponse.json(
      { error: "Masih ada analisis yang sedang diproses. Tunggu hingga selesai sebelum membersihkan data." },
      { status: 409 }
    );
  }

  const { data: allAnalisis } = await supabase.from(analisis).select("id");
  const total = allAnalisis?.length ?? 0;

  const { error: delErr } = await supabase.from(analisis).delete().neq("id", 0);
  await supabase.from(aspek).delete().neq("id", 0);

  if (delErr) {
    const sql = getSqlClient();
    if (sql) {
      await sql`TRUNCATE TABLE ulasan, hasil_aspek_ulasans, sinkron_log, analisis, aspek RESTART IDENTITY CASCADE`;
    }
  }

  return NextResponse.json({ terhapus: total });
}