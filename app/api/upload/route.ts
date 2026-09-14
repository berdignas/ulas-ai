import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { supabase, toCamel, toSnake, getSqlClient } from "@/lib/db";
import { analisis, ulasan, rumahSakit, AnalisisRow } from "@/lib/db/schema";
import { parseUlasanFile } from "@/lib/parser";

export const runtime = "nodejs";

async function dapatkanRumahSakitId(): Promise<number> {
  const { data: rsRaw } = await supabase.from(rumahSakit).select("id").limit(1);
  if (rsRaw && rsRaw.length > 0) {
    return rsRaw[0].id;
  }

  const sql = getSqlClient();
  if (sql) {
    const existing = await sql`SELECT id FROM rumah_sakit LIMIT 1`;
    if (existing.length > 0) return existing[0].id;
  }

  const defaultRS = {
    nama: "Rumah Sakit Umum Default",
    kode: "RSU-DEFAULT",
    googleMapsPlaceId: null,
    apifyActorId: "compass/google-maps-reviews-scraper",
    apifyToken: null,
    aktif: true,
    zonaWaktu: "Asia/Jakarta",
    jamSinkron: 6,
    dibuatPada: new Date().toISOString(),
    diperbaruiPada: new Date().toISOString(),
  };

  const { data: created } = await supabase.from(rumahSakit).insert(toSnake(defaultRS)).select("id");
  if (created?.[0]?.id) return created[0].id;

  if (sql) {
    const directCreated = await sql`
      INSERT INTO rumah_sakit (nama, kode, aktif, zona_waktu, jam_sinkron, dibuat_pada, diperbarui_pada)
      VALUES ('Rumah Sakit Umum Default', 'RSU-DEFAULT', true, 'Asia/Jakarta', 6, NOW(), NOW())
      ON CONFLICT (kode) DO UPDATE SET nama = EXCLUDED.nama
      RETURNING id
    `;
    if (directCreated[0]?.id) return directCreated[0].id;
  }

  return 1;
}

export async function POST(req: Request) {
  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Permintaan tidak valid. Kirim file sebagai form-data." }, { status: 400 });
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Tidak ada file yang diunggah." }, { status: 400 });
  }

  const ext = file.name.toLowerCase().split(".").pop() ?? "";
  if (!["csv", "txt", "xlsx", "xls"].includes(ext)) {
    return NextResponse.json({ error: "Format file tidak didukung. Gunakan CSV atau Excel." }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  let hasilParse;
  try {
    hasilParse = parseUlasanFile(buffer, file.name);
  } catch (error) {
    const pesan = error instanceof Error ? error.message : "Gagal membaca file.";
    return NextResponse.json({ error: pesan }, { status: 400 });
  }

  if (hasilParse.ulasan.length === 0) {
    return NextResponse.json(
      { error: "Tidak ada ulasan yang dapat dibaca dari file ini. Pastikan file berisi kolom ulasan." },
      { status: 400 }
    );
  }

  const rumahSakitId = await dapatkanRumahSakitId();

  const sidikJari = createHash("sha256")
    .update(
      hasilParse.ulasan
        .map((u) => [u.namaPengulas ?? "", u.rating ?? "", u.teksUlasan, u.tanggalUlasan ?? ""].join("|"))
        .join("\n")
    )
    .digest("hex");

  let existingRows: AnalisisRow[] = [];
  const { data: existingRowsRaw } = await supabase.from(analisis).select("*").eq("sidik_jari", sidikJari);
  if (existingRowsRaw) {
    existingRows = toCamel<AnalisisRow[]>(existingRowsRaw);
  } else {
    const sql = getSqlClient();
    if (sql) {
      const rows = await sql`SELECT * FROM analisis WHERE sidik_jari = ${sidikJari}`;
      existingRows = toCamel<AnalisisRow[]>(rows);
    }
  }

  const sudahAda = existingRows.find((a) => a.status === "selesai" || a.status === "berjalan" || a.status === "berhenti");

  if (sudahAda) {
    return NextResponse.json({
      sudahAda: true,
      id: sudahAda.id,
      namaFile: file.name,
      namaFileLama: sudahAda.namaFile,
      status: sudahAda.status,
      totalUlasan: sudahAda.totalUlasan,
      ulasanDiproses: sudahAda.ulasanDiproses,
    });
  }

  let dibuatId: number | null = null;
  const { data: dibuatRaw, error: dibuatErr } = await supabase.from(analisis).insert(toSnake({
    namaFile: file.name,
    tanggalUnggah: new Date().toISOString(),
    status: "menunggu",
    totalUlasan: hasilParse.ulasan.length,
    sidikJari,
    rumahSakitId,
  })).select("id");

  if (dibuatRaw?.[0]?.id) {
    dibuatId = dibuatRaw[0].id;
  } else {
    // Fallback to direct SQL connection if Supabase REST API key is invalid/placeholder
    const sql = getSqlClient();
    if (sql) {
      const directRows = await sql`
        INSERT INTO analisis (nama_file, tanggal_unggah, status, total_ulasan, sidik_jari, rumah_sakit_id)
        VALUES (${file.name}, NOW(), 'menunggu', ${hasilParse.ulasan.length}, ${sidikJari}, ${rumahSakitId})
        RETURNING id
      `;
      dibuatId = directRows[0]?.id ?? null;
    }
  }

  if (!dibuatId) {
    return NextResponse.json({
      error: "Gagal membuat analisis: " + (dibuatErr?.message || "Format kunci API tidak valid. Isi NEXT_PUBLIC_SUPABASE_ANON_KEY di .env")
    }, { status: 500 });
  }

  const nilaiUlasan = hasilParse.ulasan.map((u) => ({
    analisisId: dibuatId!,
    rumahSakitId,
    reviewId: `review_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    namaPengulas: u.namaPengulas ?? null,
    rating: u.rating ?? null,
    teksUlasan: u.teksUlasan,
    tanggalUlasan: u.tanggalUlasan ?? null,
    bahasa: "id",
    sentimen: null,
    sumberLabel: null,
    unitLayanan: "Lainnya",
    kategoriMasalah: "Lainnya",
    faktorUrgensiMedis: false,
    statusTindakLanjut: "baru",
    dataMentah: null,
    dibuatPada: new Date().toISOString(),
    diperbaruiPada: new Date().toISOString(),
  }));

  const { error: insertErr } = await supabase.from(ulasan).insert(toSnake(nilaiUlasan));
  if (insertErr) {
    const sql = getSqlClient();
    if (sql) {
      for (let i = 0; i < nilaiUlasan.length; i += 200) {
        const chunk = nilaiUlasan.slice(i, i + 200);
        await sql`INSERT INTO ulasan ${sql(chunk.map(c => toSnake(c)))}`;
      }
    }
  }

  return NextResponse.json({
    id: dibuatId,
    namaFile: file.name,
    totalUlasan: hasilParse.ulasan.length,
    kolomTerdeteksi: hasilParse.kolomTerdeteksi,
    pratinjau: hasilParse.ulasan.slice(0, 8),
  });
}
