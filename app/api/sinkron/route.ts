import { NextResponse } from "next/server";
import { supabase, toCamel } from "@/lib/db";
import { rumahSakit, RumahSakitRow } from "@/lib/db/schema";
import { jalankanSinkronHarian, ambilRiwayatSinkron } from "@/lib/apify";
import { isPeriodeScraping } from "@/lib/scraping-periods";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const body = await req.json();
  const { rumahSakitId, tipePemicu, periode } = body;
  if (periode != null && !isPeriodeScraping(periode)) {
    return NextResponse.json({ error: "Periode penarikan tidak valid." }, { status: 400 });
  }
  if (!rumahSakitId) return NextResponse.json({ error: "rumahSakitId wajib" }, { status: 400 });

  const { data: rsRaw } = await supabase.from(rumahSakit).select("*").eq("id", rumahSakitId).limit(1);
  const rs = toCamel<RumahSakitRow[]>(rsRaw ?? []);
  if (!rs.length) return NextResponse.json({ error: "Rumah sakit tidak ditemukan" }, { status: 404 });

  const hasil = await jalankanSinkronHarian(rumahSakitId, tipePemicu ?? "manual", periode ?? "1d");
  return NextResponse.json(hasil);
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const rumahSakitId = url.searchParams.get("rumahSakitId");
  const limit = parseInt(url.searchParams.get("limit") ?? "20");
  if (!rumahSakitId) return NextResponse.json({ error: "rumahSakitId wajib" }, { status: 400 });

  const riwayat = await ambilRiwayatSinkron(parseInt(rumahSakitId), limit);
  return NextResponse.json({ riwayat });
}
