import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { rumahSakit, ulasan, sinkronLog } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";

export const runtime = "nodejs";

export async function GET() {
  const data = await db.select().from(rumahSakit).where(eq(rumahSakit.aktif, true)).orderBy(desc(rumahSakit.id));
  return NextResponse.json({ rumahSakit: data });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    console.log('[POST /api/rumah-sakit] body:', body);
    const { nama, kode, googleMapsPlaceId, apifyActorId, apifyToken, zonaWaktu, jamSinkron } = body;
    if (!nama || !kode) {
      return NextResponse.json({ error: "Nama dan kode rumah sakit wajib diisi" }, { status: 400 });
    }
    const existing = await db.select().from(rumahSakit).where(eq(rumahSakit.kode, kode)).limit(1);
    if (existing.length) return NextResponse.json({ error: "Kode rumah sakit sudah digunakan" }, { status: 409 });
    const created = await db.insert(rumahSakit).values({
      nama,
      kode,
      googleMapsPlaceId: googleMapsPlaceId ?? null,
      apifyActorId: apifyActorId ?? "compass/google-maps-reviews-scraper",
      apifyToken: apifyToken ?? null,
      zonaWaktu: zonaWaktu ?? "Asia/Jakarta",
      jamSinkron: jamSinkron ?? 6,
      aktif: true,
      dibuatPada: new Date(),
      diperbaruiPada: new Date(),
    }).returning({ id: rumahSakit.id });
    console.log('[POST /api/rumah-sakit] created:', created);
    return NextResponse.json({ id: created[0]?.id });
  } catch (e) {
    console.error('[POST /api/rumah-sakit] error:', e);
    return NextResponse.json({ error: "Gagal membuat: " + (e instanceof Error ? e.message : String(e)) }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  const body = await req.json();
  const { id, nama, kode, googleMapsPlaceId, apifyActorId, apifyToken, zonaWaktu, jamSinkron, aktif } = body;
  if (!id || !nama || !kode) {
    return NextResponse.json({ error: "ID, nama dan kode wajib diisi" }, { status: 400 });
  }

  const existing = await db.select().from(rumahSakit).where(eq(rumahSakit.kode, kode)).limit(1);
  if (existing.length && existing[0].id !== id) {
    return NextResponse.json({ error: "Kode rumah sakit sudah digunakan" }, { status: 409 });
  }

  const updated = await db.update(rumahSakit)
    .set({
      nama,
      kode,
      googleMapsPlaceId: googleMapsPlaceId ?? null,
      apifyActorId: apifyActorId ?? "compass/google-maps-reviews-scraper",
      apifyToken: apifyToken ?? null,
      zonaWaktu: zonaWaktu ?? "Asia/Jakarta",
      jamSinkron: jamSinkron ?? 6,
      aktif: aktif ?? true,
      diperbaruiPada: new Date(),
    })
    .where(eq(rumahSakit.id, id))
    .returning({ id: rumahSakit.id });

  if (!updated.length) return NextResponse.json({ error: "Rumah sakit tidak ditemukan" }, { status: 404 });
  return NextResponse.json({ id: updated[0].id });
}

export async function DELETE(req: Request) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "ID wajib" }, { status: 400 });

  try {
    await db.delete(ulasan).where(eq(ulasan.rumahSakitId, Number(id)));
    await db.delete(sinkronLog).where(eq(sinkronLog.rumahSakitId, Number(id)));
    const deleted = await db.delete(rumahSakit).where(eq(rumahSakit.id, Number(id))).returning({ id: rumahSakit.id });

    if (!deleted.length) return NextResponse.json({ error: "Rumah sakit tidak ditemukan" }, { status: 404 });
    return NextResponse.json({ success: true, id: deleted[0].id });
  } catch (e) {
    return NextResponse.json({ error: "Gagal menghapus: " + (e instanceof Error ? e.message : String(e)) }, { status: 500 });
  }
}