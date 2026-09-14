import { NextResponse } from "next/server";
import { supabase, toCamel } from "@/lib/db";
import { ulasan, rumahSakit, UlasanRow, RumahSakitRow } from "@/lib/db/schema";
import { ambilUlasanKrisisBelumDitinjau, ambilStatistikHarian, perbaruiStatusTindakLanjut, perbaruiDrafBalasan } from "@/lib/apify";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const action = url.searchParams.get("action");
  const rumahSakitId = url.searchParams.get("rumahSakitId");
  const tanggal = url.searchParams.get("tanggal");
  const status = url.searchParams.get("status");
  const rating = url.searchParams.get("rating");
  const krisis = url.searchParams.get("krisis");
  const limit = parseInt(url.searchParams.get("limit") ?? "50");
  const offset = parseInt(url.searchParams.get("offset") ?? "0");

  if (!rumahSakitId) return NextResponse.json({ error: "rumahSakitId wajib" }, { status: 400 });

  const rsId = parseInt(rumahSakitId);

  if (action === "statistik_harian") {
    const stat = await ambilStatistikHarian(rsId, tanggal ? new Date(tanggal) : null);
    return NextResponse.json(stat);
  }

  if (action === "krisis_belum_ditinjau") {
    const krisis = await ambilUlasanKrisisBelumDitinjau(rsId);
    return NextResponse.json({ krisis });
  }

  const { data: rsRowsRaw } = await supabase.from(rumahSakit).select("*").eq("id", rsId).limit(1);
  const rsRows = toCamel<RumahSakitRow[]>(rsRowsRaw ?? []);
  if (!rsRows.length) return NextResponse.json({ error: "Rumah sakit tidak ditemukan" }, { status: 404 });

  let query = supabase.from(ulasan).select("*", { count: "exact" }).eq("rumah_sakit_id", rsId);

  if (krisis === "true" || krisis === "1") {
    query = query.eq("faktor_urgensi_medis", true);
  }

  if (tanggal) {
    const tgl = new Date(tanggal);
    tgl.setHours(0, 0, 0, 0);
    const tglBerikut = new Date(tgl);
    tglBerikut.setDate(tglBerikut.getDate() + 1);
    query = query.gte("tanggal_ulasan", tgl.toISOString()).lt("tanggal_ulasan", tglBerikut.toISOString());
  }

  if (status) {
    query = query.eq("status_tindak_lanjut", status);
  }

  if (rating) {
    query = query.eq("rating", parseInt(rating));
  }

  const { data: rowsRaw, count, error } = await query
    .order("tanggal_ulasan", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = toCamel<UlasanRow[]>(rowsRaw ?? []);
  const total = count ?? 0;

  return NextResponse.json({ ulasan: rows, total, limit, offset });
}

export async function POST(req: Request) {
  const body = await req.json();
  const { action, ...params } = body;

  switch (action) {
    case "statistik_harian": {
      const { rumahSakitId, tanggal } = params;
      if (!rumahSakitId) return NextResponse.json({ error: "Parameter tidak lengkap" }, { status: 400 });
      const stat = await ambilStatistikHarian(rumahSakitId, tanggal ? new Date(tanggal) : null);
      return NextResponse.json(stat);
    }
    case "krisis_belum_ditinjau": {
      const { rumahSakitId } = params;
      if (!rumahSakitId) return NextResponse.json({ error: "rumahSakitId wajib" }, { status: 400 });
      const krisis = await ambilUlasanKrisisBelumDitinjau(rumahSakitId);
      return NextResponse.json({ krisis });
    }
    case "perbarui_status": {
      const { ulasanId, status, catatan, user } = params;
      if (!ulasanId || !status) return NextResponse.json({ error: "Parameter tidak lengkap" }, { status: 400 });
      await perbaruiStatusTindakLanjut(ulasanId, status, catatan, user);
      return NextResponse.json({ sukses: true });
    }
    case "perbarui_draf": {
      const { ulasanId, draf } = params;
      if (!ulasanId || draf === undefined) return NextResponse.json({ error: "Parameter tidak lengkap" }, { status: 400 });
      await perbaruiDrafBalasan(ulasanId, draf);
      return NextResponse.json({ sukses: true });
    }
    default:
      return NextResponse.json({ error: "Action tidak dikenal" }, { status: 400 });
  }
}