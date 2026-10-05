import { NextResponse } from "next/server";
import { supabase, toCamel, toSnake } from "@/lib/db";
import { ulasan, rumahSakit, UlasanRow, RumahSakitRow } from "@/lib/db/schema";
import { ambilUlasanKrisisBelumDitinjau, ambilStatistikHarian, perbaruiStatusTindakLanjut, perbaruiDrafBalasan } from "@/lib/apify";
import { aiConfigured, analisisUlasanDenganAI, personalisasiDrafBalasan } from "@/lib/ai";
import { parseCustomAIConfig } from "@/lib/ai-config";

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
    case "buat_draf": {
      const ulasanId = Number(params.ulasanId);
      if (!Number.isSafeInteger(ulasanId) || ulasanId < 1) {
        return NextResponse.json({ error: "ID ulasan tidak valid" }, { status: 400 });
      }
      const { data: item, error: readError } = await supabase.from(ulasan)
        .select("id, rumah_sakit_id, teks_ulasan, rating, nama_pengulas, faktor_urgensi_medis, saran_draf_balasan")
        .eq("id", ulasanId).single();
      if (readError || !item) return NextResponse.json({ error: "Ulasan tidak ditemukan" }, { status: 404 });
      if (item.saran_draf_balasan) return NextResponse.json({ draf: item.saran_draf_balasan });
      const { data: rs } = await supabase.from(rumahSakit)
        .select("ai_model, ai_api_key").eq("id", item.rumah_sakit_id).single();
      const customConfig = parseCustomAIConfig(rs?.ai_api_key);
      if (!aiConfigured(rs?.ai_model, customConfig)) {
        return NextResponse.json({ error: "Provider AI belum dikonfigurasi" }, { status: 503 });
      }
      try {
        const hasil = await analisisUlasanDenganAI(item.teks_ulasan, item.rating, rs?.ai_model, [], customConfig);
        const draf = personalisasiDrafBalasan(hasil.saranDrafBalasan, item.nama_pengulas, item.faktor_urgensi_medis);
        if (!draf) throw new Error("AI tidak menghasilkan draf balasan");
        const { error } = await supabase.from(ulasan)
          .update(toSnake({ saranDrafBalasan: draf, diperbaruiPada: new Date().toISOString() }))
          .eq("id", ulasanId);
        if (error) throw error;
        return NextResponse.json({ draf });
      } catch (error) {
        return NextResponse.json({ error: error instanceof Error ? error.message : "Gagal membuat draf" }, { status: 502 });
      }
    }
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
