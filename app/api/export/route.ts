import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ulasan, rumahSakit } from "@/lib/db/schema";
import { eq, and, gte, lt, desc } from "drizzle-orm";
import * as XLSX from "xlsx";

export const runtime = "nodejs";

function escapeCsv(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

function generateCsv(rows: Record<string, unknown>[], headers: string[]): string {
  const headerLine = headers.join(",");
  const dataLines = rows.map((row) => headers.map((h) => escapeCsv(String(row[h] ?? ""))).join(","));
  return [headerLine, ...dataLines].join("\n");
}

function generateXlsx(rows: Record<string, unknown>[], sheetName: string = "Laporan"): Blob {
  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = { Sheets: { [sheetName]: worksheet }, SheetNames: [sheetName] };
  const buf = XLSX.write(workbook, { bookType: "xlsx", bookSST: false });
  const data = new Uint8Array(buf);
  return new Blob([data], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=UTF-8" });
}

function generateHtmlReport(rs: { nama: string; kode: string }, rows: Record<string, unknown>[], periode: { dari: string; sampai: string }): string {
  const tglDari = new Date(periode.dari).toLocaleDateString("id-ID");
  const tglSampai = new Date(periode.sampai).toLocaleDateString("id-ID");

  const rowsHtml = rows.map((r) => `
    <tr>
      <td>${escapeHtml(String(r.tanggalUlasan ?? ""))}</td>
      <td>${escapeHtml(String(r.namaPengulas ?? ""))}</td>
      <td style="text-align:center">${escapeHtml(String(r.rating ?? ""))}</td>
      <td>${escapeHtml(String(r.teksUlasan ?? "")).slice(0, 200)}</td>
      <td>${escapeHtml(String(r.unitLayanan ?? ""))}</td>
      <td>${escapeHtml(String(r.kategoriMasalah ?? ""))}</td>
      <td>${escapeHtml(String(r.sentimen ?? ""))}</td>
      <td>${escapeHtml(String(r.statusTindakLanjut ?? ""))}</td>
    </tr>
  `).join("");

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Laporan Mutu - ${escapeHtml(rs.nama)}</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 20px; font-size: 11px; }
    h1 { text-align: center; margin-bottom: 5px; }
    .meta { text-align: center; color: #666; margin-bottom: 20px; font-size: 10px; }
    table { width: 100%; border-collapse: collapse; }
    th, td { border: 1px solid #ddd; padding: 4px; text-align: left; }
    th { background: #f5f5f5; font-weight: bold; }
    tr:nth-child(even) { background: #fafafa; }
    @page { margin: 15mm; }
  </style>
</head>
<body>
  <h1>Laporan Mutu Ulasan Google Maps</h1>
  <div class="meta">${escapeHtml(rs.nama)} | Periode: ${tglDari} - ${tglSampai} | Dicetak: ${new Date().toLocaleString("id-ID")}</div>
  <table>
    <thead>
      <tr>
        <th>Tanggal</th><th>Reviewer</th><th>Rating</th><th>Ulasan</th>
        <th>Unit</th><th>Kategori</th><th>Sentimen</th><th>Status</th>
      </tr>
    </thead>
    <tbody>${rowsHtml}</tbody>
  </table>
</body>
</html>`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&#38;")
    .replace(/</g, "&#60;")
    .replace(/>/g, "&#62;")
    .replace(/"/g, "&#34;")
    .replace(/'/g, "'");
}

export async function POST(req: Request) {
  const body = await req.json();
  const { rumahSakitId, format, dari, sampai, status } = body;

  if (!rumahSakitId || !dari || !sampai) {
    return NextResponse.json({ error: "Parameter rumahSakitId, dari, sampai wajib" }, { status: 400 });
  }

  const rsRows = await db.select().from(rumahSakit).where(eq(rumahSakit.id, rumahSakitId)).limit(1);
  const rs = rsRows[0];
  if (!rs) return NextResponse.json({ error: "Rumah sakit tidak ditemukan" }, { status: 404 });

  const tglDari = new Date(dari);
  tglDari.setHours(0, 0, 0, 0);
  const tglSampai = new Date(sampai);
  tglSampai.setHours(23, 59, 59, 999);

  const whereConditions = [
    eq(ulasan.rumahSakitId, rumahSakitId),
    gte(ulasan.tanggalUlasan, tglDari.toISOString()),
    lt(ulasan.tanggalUlasan, tglSampai.toISOString()),
  ];

  if (status && status !== "all") {
    whereConditions.push(eq(ulasan.statusTindakLanjut, status));
  }

  const rows = await db.select({
    tanggalUlasan: ulasan.tanggalUlasan,
    namaPengulas: ulasan.namaPengulas,
    rating: ulasan.rating,
    teksUlasan: ulasan.teksUlasan,
    unitLayanan: ulasan.unitLayanan,
    kategoriMasalah: ulasan.kategoriMasalah,
    sentimen: ulasan.sentimen,
    statusTindakLanjut: ulasan.statusTindakLanjut,
  }).from(ulasan)
    .where(and(...whereConditions))
    .orderBy(desc(ulasan.tanggalUlasan));

  // Map to records with Indonesian headers
  const records = rows.map((r) => ({
    "Tanggal Ulasan": String(r.tanggalUlasan ?? ""),
    "Nama Pengulas": String(r.namaPengulas ?? ""),
    Rating: String(r.rating ?? ""),
    "Teks Ulasan": String(r.teksUlasan ?? "").slice(0, 200),
    "Unit Layanan": String(r.unitLayanan ?? ""),
    "Kategori Masalah": String(r.kategoriMasalah ?? ""),
    Sentimen: String(r.sentimen ?? ""),
    "Status Tindak Lanjut": String(r.statusTindakLanjut ?? ""),
  }));

  if (format === "csv") {
    const headers = ["Tanggal Ulasan", "Nama Pengulas", "Rating", "Teks Ulasan", "Unit Layanan", "Kategori Masalah", "Sentimen", "Status Tindak Lanjut"];
    const csv = generateCsv(records, headers);
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="laporan-mutu-${rs.kode}-${dari}-${sampai}.csv"`,
      },
    });
  }

  if (format === "xlsx") {
    return new NextResponse(generateXlsx(records), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=UTF-8",
        "Content-Disposition": `attachment; filename="laporan-mutu-${rs.kode}-${dari}-${sampai}.xlsx"`,
      },
    });
  }

  if (format === "html") {
    const html = generateHtmlReport(rs, records.map(r => ({
      tanggalUlasan: r["Tanggal Ulasan"],
      namaPengulas: r["Nama Pengulas"],
      rating: r.Rating,
      teksUlasan: r["Teks Ulasan"],
      unitLayanan: r["Unit Layanan"],
      kategoriMasalah: r["Kategori Masalah"],
      sentimen: r.Sentimen,
      statusTindakLanjut: r["Status Tindak Lanjut"],
    })), { dari, sampai });
    return new NextResponse(html, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Content-Disposition": `inline; filename="laporan-mutu-${rs.kode}-${dari}-${sampai}.html"`,
      },
    });
  }

  return NextResponse.json({ error: "Format tidak didukung. Gunakan: csv, xlsx, html" }, { status: 400 });
}