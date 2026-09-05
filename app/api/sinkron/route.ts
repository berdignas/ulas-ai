import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { rumahSakit } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { jalankanSinkronHarian, ambilRiwayatSinkron } from "@/lib/apify";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const body = await req.json();
  const { rumahSakitId, tipePemicu } = body;
  if (!rumahSakitId) return NextResponse.json({ error: "rumahSakitId wajib" }, { status: 400 });

  const rs = await db.select().from(rumahSakit).where(eq(rumahSakit.id, rumahSakitId)).limit(1);
  if (!rs.length) return NextResponse.json({ error: "Rumah sakit tidak ditemukan" }, { status: 404 });

  const hasil = await jalankanSinkronHarian(rumahSakitId, tipePemicu ?? "manual");
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