import { NextResponse } from "next/server";
import { supabase, toCamel, toSnake } from "@/lib/db";
import { rumahSakit, ulasan, sinkronLog, RumahSakitRow } from "@/lib/db/schema";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const onlyActive = searchParams.get("active") === "true";

  let query = supabase
    .from(rumahSakit)
    .select("*")
    .order("id", { ascending: false });

  if (onlyActive) {
    query = query.eq("aktif", true);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ rumahSakit: toCamel<RumahSakitRow[]>(data ?? []) });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    console.log('[POST /api/rumah-sakit] body:', body);
    const { nama, kode, googleMapsPlaceId, apifyActorId, apifyToken, zonaWaktu, jamSinkron, aiModel, aiApiKey } = body;
    if (!nama || !kode) {
      return NextResponse.json({ error: "Nama dan kode rumah sakit wajib diisi" }, { status: 400 });
    }

    const { data: existing } = await supabase.from(rumahSakit).select("id").eq("kode", kode).limit(1);
    if (existing && existing.length) {
      return NextResponse.json({ error: "Kode rumah sakit sudah digunakan" }, { status: 409 });
    }

    const { data: created, error } = await supabase
      .from(rumahSakit)
      .insert(toSnake({
        nama,
        kode,
        googleMapsPlaceId: googleMapsPlaceId ?? null,
        apifyActorId: apifyActorId ?? "compass/google-maps-reviews-scraper",
        apifyToken: apifyToken ?? null,
        zonaWaktu: zonaWaktu ?? "Asia/Jakarta",
        jamSinkron: jamSinkron ?? 6,
        aktif: true,
        aiModel: aiModel ?? "Google Gemini (Antigravity)",
        aiApiKey: aiApiKey ?? null,
        dibuatPada: new Date().toISOString(),
        diperbaruiPada: new Date().toISOString(),
      }))
      .select("id");

    if (error || !created?.[0]) {
      return NextResponse.json({ error: "Gagal membuat: " + (error?.message || "Unknown error") }, { status: 500 });
    }

    console.log('[POST /api/rumah-sakit] created:', created);
    return NextResponse.json({ id: created[0].id });
  } catch (e) {
    console.error('[POST /api/rumah-sakit] error:', e);
    return NextResponse.json({ error: "Gagal membuat: " + (e instanceof Error ? e.message : String(e)) }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  const body = await req.json();
  const { id, nama, kode, googleMapsPlaceId, apifyActorId, apifyToken, zonaWaktu, jamSinkron, aktif, aiModel, aiApiKey, kopSurat } = body;
  if (!id || !nama || !kode) {
    return NextResponse.json({ error: "ID, nama dan kode wajib diisi" }, { status: 400 });
  }

  const { data: existing } = await supabase.from(rumahSakit).select("id").eq("kode", kode).limit(1);
  if (existing && existing.length && existing[0].id !== id) {
    return NextResponse.json({ error: "Kode rumah sakit sudah digunakan" }, { status: 409 });
  }

  const updatePayload: Record<string, unknown> = {
    nama,
    kode,
    googleMapsPlaceId: googleMapsPlaceId ?? null,
    apifyActorId: apifyActorId ?? "compass/google-maps-reviews-scraper",
    apifyToken: apifyToken ?? null,
    zonaWaktu: zonaWaktu ?? "Asia/Jakarta",
    jamSinkron: jamSinkron ?? 6,
    aktif: aktif ?? true,
    diperbaruiPada: new Date().toISOString(),
  };

  // Only update fields if provided
  if (aiModel !== undefined) updatePayload.aiModel = aiModel;
  if (aiApiKey !== undefined) updatePayload.aiApiKey = aiApiKey;
  if (kopSurat !== undefined) updatePayload.kopSurat = kopSurat;

  const { data: updated, error } = await supabase
    .from(rumahSakit)
    .update(toSnake(updatePayload))
    .eq("id", id)
    .select("id");

  if (error || !updated?.length) {
    return NextResponse.json({ error: "Rumah sakit tidak ditemukan atau gagal diperbarui" }, { status: 404 });
  }
  return NextResponse.json({ id: updated[0].id });
}

export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    const { id, kopSurat } = body;
    if (!id) {
      return NextResponse.json({ error: "ID rumah sakit wajib diisi" }, { status: 400 });
    }

    const { data: updated, error } = await supabase
      .from(rumahSakit)
      .update(toSnake({
        kopSurat: kopSurat ?? null,
        diperbaruiPada: new Date().toISOString(),
      }))
      .eq("id", id)
      .select("id, kop_surat");

    if (error || !updated?.length) {
      return NextResponse.json({ error: "Gagal menyimpan kop surat: " + (error?.message || "Not found") }, { status: 500 });
    }

    return NextResponse.json({ success: true, id: updated[0].id, kopSurat: updated[0].kop_surat });
  } catch (e) {
    return NextResponse.json({ error: "Gagal menyimpan: " + (e instanceof Error ? e.message : String(e)) }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "ID wajib" }, { status: 400 });

  try {
    const rsId = Number(id);
    await supabase.from(ulasan).delete().eq("rumah_sakit_id", rsId);
    await supabase.from(sinkronLog).delete().eq("rumah_sakit_id", rsId);
    const { data: deleted, error } = await supabase.from(rumahSakit).delete().eq("id", rsId).select("id");

    if (error || !deleted?.length) {
      return NextResponse.json({ error: "Rumah sakit tidak ditemukan" }, { status: 404 });
    }
    return NextResponse.json({ success: true, id: deleted[0].id });
  } catch (e) {
    return NextResponse.json({ error: "Gagal menghapus: " + (e instanceof Error ? e.message : String(e)) }, { status: 500 });
  }
}