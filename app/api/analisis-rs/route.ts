import { NextResponse } from "next/server";
import { supabase, toCamel, toSnake } from "@/lib/db";
import { rumahSakit, ulasan, UlasanRow } from "@/lib/db/schema";
import { analisisBatchUlasanDenganAI, personalisasiDrafBalasan } from "@/lib/ai";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const body = await req.json();
  const { ulasanIds, rumahSakitId, analisisId } = body;

  let targetIds: number[] = [];

  if (ulasanIds && Array.isArray(ulasanIds)) {
    targetIds = ulasanIds;
  } else if (rumahSakitId) {
    const { data: rows } = await supabase.from(ulasan)
      .select("id")
      .eq("rumah_sakit_id", rumahSakitId)
      .is("sentimen", null)
      .limit(50);
    targetIds = (rows ?? []).map((r) => r.id);
  } else if (analisisId) {
    const { data: rows } = await supabase.from(ulasan)
      .select("id")
      .eq("analisis_id", analisisId)
      .is("sentimen", null)
      .limit(50);
    targetIds = (rows ?? []).map((r) => r.id);
  }

  if (targetIds.length === 0) {
    return NextResponse.json({ diproses: 0, pesan: "Tidak ada ulasan yang perlu diproses" });
  }

  const { data: ulasanDataRaw } = await supabase.from(ulasan)
    .select("id, teks_ulasan, rating, rumah_sakit_id, nama_pengulas")
    .in("id", targetIds);

  const ulasanData = toCamel<UlasanRow[]>(ulasanDataRaw ?? []);

  const targetRumahSakitId = Number(rumahSakitId) || ulasanData[0]?.rumahSakitId;
  const { data: konfigurasiRS } = targetRumahSakitId
    ? await supabase.from(rumahSakit).select("ai_model").eq("id", targetRumahSakitId).limit(1)
    : { data: null };
  const modelAI = konfigurasiRS?.[0]?.ai_model ?? null;

  const hasil = await analisisBatchUlasanDenganAI(
    ulasanData.map((u) => ({ id: u.id, teksUlasan: u.teksUlasan, rating: u.rating ?? null, namaPengulas: u.namaPengulas ?? null })),
    modelAI
  );

  let diproses = 0;
  let krisis = 0;
  for (const [id, res] of hasil.entries()) {
    await supabase.from(ulasan)
      .update(toSnake({
        unitLayanan: res.unitLayanan,
        kategoriMasalah: res.kategoriMasalah,
        sentimen: res.sentimen,
        faktorUrgensiMedis: res.faktorUrgensiMedis,
        saranDrafBalasan: personalisasiDrafBalasan(
          res.saranDrafBalasan,
          ulasanData.find((item) => item.id === id)?.namaPengulas,
          res.faktorUrgensiMedis
        ),
        diperbaruiPada: new Date().toISOString(),
      }))
      .eq("id", id);
    diproses++;
    if (res.faktorUrgensiMedis) krisis++;
  }

  return NextResponse.json({ diproses, krisis, total: targetIds.length });
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id wajib" }, { status: 400 });

  const { data: itemRowsRaw } = await supabase.from(ulasan).select("*").eq("id", parseInt(id)).limit(1);
  const item = toCamel<UlasanRow>(itemRowsRaw?.[0]);
  if (!item) return NextResponse.json({ error: "Ulasan tidak ditemukan" }, { status: 404 });

  return NextResponse.json(item);
}
