import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ulasan, rumahSakit } from "@/lib/db/schema";
import { eq, and, gte, lt, desc, sql, count } from "drizzle-orm";
import { ambilUlasanHarian, ambilUlasanKrisisBelumDitinjau, ambilStatistikHarian, perbaruiStatusTindakLanjut, perbaruiDrafBalasan } from "@/lib/apify";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const rumahSakitId = url.searchParams.get("rumahSakitId");
  const tanggal = url.searchParams.get("tanggal");
  const status = url.searchParams.get("status");
  const limit = parseInt(url.searchParams.get("limit") ?? "50");
  const offset = parseInt(url.searchParams.get("offset") ?? "0");

  if (!rumahSakitId) return NextResponse.json({ error: "rumahSakitId wajib" }, { status: 400 });

  const rsRows = await db.select().from(rumahSakit).where(eq(rumahSakit.id, parseInt(rumahSakitId))).limit(1);
  if (!rsRows.length) return NextResponse.json({ error: "Rumah sakit tidak ditemukan" }, { status: 404 });

  const whereConditions = [eq(ulasan.rumahSakitId, parseInt(rumahSakitId))];

  if (tanggal) {
    const tgl = new Date(tanggal);
    tgl.setHours(0, 0, 0, 0);
    const tglBerikut = new Date(tgl);
    tglBerikut.setDate(tglBerikut.getDate() + 1);
    whereConditions.push(gte(ulasan.tanggalUlasan, tgl.toISOString()));
    whereConditions.push(lt(ulasan.tanggalUlasan, tglBerikut.toISOString()));
  }

  if (status) {
    whereConditions.push(eq(ulasan.statusTindakLanjut, status as "baru" | "dalam_koordinasi" | "selesai"));
  }

  const rows = await db.select().from(ulasan)
    .where(and(...whereConditions))
    .orderBy(desc(ulasan.tanggalUlasan))
    .limit(limit)
    .offset(offset);

  const totalRows = await db.select({ jumlah: count() }).from(ulasan).where(and(...whereConditions));
  const total = totalRows[0]?.jumlah ?? 0;

  return NextResponse.json({ ulasan: rows, total, limit, offset });
}

export async function POST(req: Request) {
  const body = await req.json();
  const { action, ...params } = body;

  switch (action) {
    case "statistik_harian": {
      const { rumahSakitId, tanggal } = params;
      if (!rumahSakitId || !tanggal) return NextResponse.json({ error: "Parameter tidak lengkap" }, { status: 400 });
      const stat = await ambilStatistikHarian(rumahSakitId, new Date(tanggal));
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