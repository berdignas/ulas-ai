import { NextResponse } from "next/server";
import { supabase, toCamel } from "@/lib/db";
import { analisis, rumahSakit, ulasan, AnalisisRow, RumahSakitRow, UlasanRow } from "@/lib/db/schema";

export const runtime = "nodejs";

function tanggalDiZonaWaktu(value: string, timeZone: string): string | null {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value;
  const year = get("year");
  const month = get("month");
  const day = get("day");
  return year && month && day ? `${year}-${month}-${day}` : null;
}

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const analisisId = Number(id);
  if (!Number.isFinite(analisisId)) {
    return NextResponse.json({ error: "ID tidak valid." }, { status: 400 });
  }

  const { data: analisisRaw } = await supabase.from(analisis).select("*").eq("id", analisisId).limit(1);
  const itemAnalisis = toCamel<AnalisisRow>(analisisRaw?.[0]);
  if (!itemAnalisis) return NextResponse.json({ error: "Analisis tidak ditemukan." }, { status: 404 });

  const { data: rsRaw } = await supabase.from(rumahSakit).select("zona_waktu").eq("id", itemAnalisis.rumahSakitId).limit(1);
  const rs = toCamel<Pick<RumahSakitRow, "zonaWaktu">>(rsRaw?.[0]);
  const zonaWaktu = rs?.zonaWaktu || "Asia/Jakarta";
  const url = new URL(req.url);
  const dari = url.searchParams.get("dari");
  const sampai = url.searchParams.get("sampai");

  let query = supabase
    .from(ulasan)
    .select("tanggal_ulasan,sentimen")
    .eq("analisis_id", analisisId)
    .not("tanggal_ulasan", "is", null);
  if (dari) query = query.gte("tanggal_ulasan", new Date(`${dari}T00:00:00+07:00`).toISOString());
  if (sampai) query = query.lte("tanggal_ulasan", new Date(`${sampai}T23:59:59.999+07:00`).toISOString());

  const { data, error } = await query.order("tanggal_ulasan", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const rows = toCamel<Pick<UlasanRow, "tanggalUlasan" | "sentimen">[]>(data ?? []);

  const perHari = new Map<string, { positif: number; negatif: number; netral: number }>();
  for (const row of rows) {
    if (!row.tanggalUlasan || !row.sentimen) continue;
    const tanggal = tanggalDiZonaWaktu(row.tanggalUlasan, zonaWaktu);
    if (!tanggal) continue;
    const nilai = perHari.get(tanggal) ?? { positif: 0, negatif: 0, netral: 0 };
    nilai[row.sentimen]++;
    perHari.set(tanggal, nilai);
  }

  const keys = Array.from(perHari.keys()).sort();
  const points: Array<{
    tanggal: string;
    label: string;
    total: number;
    positif: number;
    negatif: number;
    netral: number;
    persenPositif: number;
    persenNegatif: number;
    persenNetral: number;
  }> = [];

  if (keys.length > 0) {
    const cursor = new Date(`${keys[0]}T00:00:00Z`);
    const akhir = new Date(`${keys[keys.length - 1]}T00:00:00Z`);
    while (cursor <= akhir && points.length < 400) {
      const tanggal = cursor.toISOString().slice(0, 10);
      const nilai = perHari.get(tanggal) ?? { positif: 0, negatif: 0, netral: 0 };
      const total = nilai.positif + nilai.negatif + nilai.netral;
      points.push({
        tanggal,
        label: cursor.toLocaleDateString("id-ID", { day: "numeric", month: "short", timeZone: "UTC" }),
        total,
        ...nilai,
        persenPositif: total ? Math.round((nilai.positif / total) * 100) : 0,
        persenNegatif: total ? Math.round((nilai.negatif / total) * 100) : 0,
        persenNetral: total ? Math.round((nilai.netral / total) * 100) : 0,
      });
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
  }

  return NextResponse.json({ points, zonaWaktu, totalUlasan: rows.length });
}
