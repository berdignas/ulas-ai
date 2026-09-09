import { NextResponse } from "next/server";
import { supabase, toCamel } from "@/lib/db";
import {
  analisis,
  hasilLokasiUlasan,
  lokasiLayananRs,
  ulasan,
} from "@/lib/db/schema";
import type { UlasanLokasiItem } from "@/lib/types";

export const runtime = "nodejs";

type UlasanLokasiRow = {
  id: number;
  nama_pengulas: string | null;
  rating: number | null;
  teks_ulasan: string;
  tanggal_ulasan: string | null;
  sentimen: UlasanLokasiItem["sentimen"];
  sumber_label: string | null;
  hasil_lokasi_ulasans: Array<{ metode: UlasanLokasiItem["metode"] }> | null;
};

export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string; lokasiId: string }> }
) {
  const { id, lokasiId } = await ctx.params;
  const analisisId = Number(id);
  const layananId = Number(lokasiId);
  if (!Number.isFinite(analisisId) || !Number.isFinite(layananId)) {
    return NextResponse.json({ error: "ID analisis atau lokasi tidak valid." }, { status: 400 });
  }

  const url = new URL(req.url);
  const page = Math.max(1, Number(url.searchParams.get("page")) || 1);
  const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit")) || 50));
  const dari = url.searchParams.get("dari");
  const sampai = url.searchParams.get("sampai");
  const offset = (page - 1) * limit;

  const { data: analisisRows, error: analisisError } = await supabase
    .from(analisis)
    .select("rumah_sakit_id")
    .eq("id", analisisId)
    .limit(1);
  if (analisisError) {
    return NextResponse.json({ error: analisisError.message }, { status: 500 });
  }
  const rumahSakitId = Number(analisisRows?.[0]?.rumah_sakit_id);
  if (!Number.isFinite(rumahSakitId)) {
    return NextResponse.json({ error: "Analisis tidak ditemukan." }, { status: 404 });
  }

  const { data: lokasiRows, error: lokasiError } = await supabase
    .from(lokasiLayananRs)
    .select("id,nama,jenis")
    .eq("id", layananId)
    .eq("rumah_sakit_id", rumahSakitId)
    .limit(1);
  if (lokasiError) {
    return NextResponse.json({ error: lokasiError.message }, { status: 500 });
  }
  if (!lokasiRows?.length) {
    return NextResponse.json({ error: "Poli atau ruangan tidak ditemukan." }, { status: 404 });
  }

  let query = supabase
    .from(ulasan)
    .select(
      `id,nama_pengulas,rating,teks_ulasan,tanggal_ulasan,sentimen,sumber_label,${hasilLokasiUlasan}!inner(metode,lokasi_layanan_id)`,
      { count: "exact" }
    )
    .eq("analisis_id", analisisId)
    .eq(`${hasilLokasiUlasan}.lokasi_layanan_id`, layananId)
    .order("tanggal_ulasan", { ascending: false, nullsFirst: false })
    .order("id", { ascending: false })
    .range(offset, offset + limit - 1);

  if (dari) {
    const tanggalDari = new Date(dari);
    tanggalDari.setHours(0, 0, 0, 0);
    query = query.gte("tanggal_ulasan", tanggalDari.toISOString());
  }
  if (sampai) {
    const tanggalSampai = new Date(sampai);
    tanggalSampai.setHours(23, 59, 59, 999);
    query = query.lte("tanggal_ulasan", tanggalSampai.toISOString());
  }

  const { data: rawRows, error, count } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = (rawRows ?? []) as unknown as UlasanLokasiRow[];
  const review: UlasanLokasiItem[] = rows.map((row) => {
    const hasilLokasi = Array.isArray(row.hasil_lokasi_ulasans)
      ? row.hasil_lokasi_ulasans[0]
      : null;
    const item = toCamel<Omit<UlasanLokasiItem, "metode">>(row);
    return {
      id: item.id,
      namaPengulas: item.namaPengulas,
      rating: item.rating,
      teksUlasan: item.teksUlasan,
      tanggalUlasan: item.tanggalUlasan,
      sentimen: item.sentimen,
      sumberLabel: item.sumberLabel,
      metode: hasilLokasi?.metode === "ai" ? "ai" : "keyword",
    };
  });
  const total = count ?? review.length;

  return NextResponse.json({
    lokasi: toCamel(lokasiRows[0]),
    review,
    pagination: {
      page,
      limit,
      total,
      hasMore: offset + review.length < total,
    },
  });
}
