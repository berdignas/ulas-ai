import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { analisis, ulasan } from "@/lib/db/schema";
import { parseUlasanFile } from "@/lib/parser";

export const runtime = "nodejs";

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

  const sidikJari = createHash("sha256")
    .update(
      hasilParse.ulasan
        .map((u) => [u.namaPengulas ?? "", u.rating ?? "", u.teksUlasan, u.tanggalUlasan ?? ""].join("|"))
        .join("\n")
    )
    .digest("hex");

  const existingRows = await db.select().from(analisis).where(eq(analisis.sidikJari, sidikJari));
  const sudahAda = existingRows.find((a) => a.status === "selesai" || a.status === "berjalan" || a.status === "berhenti");

  if (sudahAda) {
    return NextResponse.json({
      sudahAda: true,
      id: sudahAda.id,
      namaFile: file.name,
      namaFileLama: sudahAda.namaFile,
      status: sudahAda.status,
      totalUlasan: sudahAda.totalUlasan,
    });
  }

  const dibuatRows = await db.insert(analisis).values({
    namaFile: file.name,
    tanggalUnggah: new Date(),
    status: "menunggu",
    totalUlasan: hasilParse.ulasan.length,
    sidikJari,
    rumahSakitId: 1, // Default to first rumah sakit, should be configurable
  }).returning({ id: analisis.id });

  const dibuat = dibuatRows[0];
  if (!dibuat) {
    return NextResponse.json({ error: "Gagal membuat analisis" }, { status: 500 });
  }

  const nilaiUlasan = hasilParse.ulasan.map((u) => ({
    analisisId: dibuat.id,
    rumahSakitId: 1, // Default to first rumah sakit
    reviewId: `review_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    namaPengulas: u.namaPengulas,
    rating: u.rating,
    teksUlasan: u.teksUlasan,
    tanggalUlasan: u.tanggalUlasan,
    bahasa: "id",
    sentimen: null,
    sumberLabel: null,
    unitLayanan: "Lainnya",
    kategoriMasalah: "Lainnya",
    faktorUrgensiMedis: false,
    statusTindakLanjut: "baru" as const,
    dataMentah: null,
    dibuatPada: new Date(),
    diperbaruiPada: new Date(),
  }));

  for (let i = 0; i < nilaiUlasan.length; i += 500) {
    await db.insert(ulasan).values(nilaiUlasan.slice(i, i + 500));
  }

  return NextResponse.json({
    id: dibuat.id,
    namaFile: file.name,
    totalUlasan: hasilParse.ulasan.length,
    kolomTerdeteksi: hasilParse.kolomTerdeteksi,
    pratinjau: hasilParse.ulasan.slice(0, 8),
  });
}