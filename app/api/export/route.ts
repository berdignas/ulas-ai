import { NextResponse } from "next/server";
import { supabase, toCamel } from "@/lib/db";
import { ulasan, rumahSakit, UlasanRow, RumahSakitRow } from "@/lib/db/schema";
import * as XLSX from "xlsx";
import {
  Document,
  Packer,
  Paragraph,
  Table,
  TableRow,
  TableCell,
  TextRun,
  ImageRun,
  HeadingLevel,
  AlignmentType,
  WidthType,
  BorderStyle,
  PageOrientation,
} from "docx";

export const runtime = "nodejs";

function escapeCsv(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

function generateXlsx(rows: Record<string, unknown>[], sheetName: string = "Laporan"): Blob {
  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = { Sheets: { [sheetName]: worksheet }, SheetNames: [sheetName] };
  const buf = XLSX.write(workbook, { bookType: "xlsx", bookSST: false });
  const data = new Uint8Array(buf);
  return new Blob([data], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=UTF-8",
  });
}

function generateHtmlReport(
  rs: { nama: string; kode: string },
  rows: Record<string, unknown>[],
  periode: { dari: string; sampai: string },
  kopSuratBase64: string | null
): string {
  const tglDari = new Date(periode.dari).toLocaleDateString("id-ID");
  const tglSampai = new Date(periode.sampai).toLocaleDateString("id-ID");

  const kopHtml = kopSuratBase64
    ? `<div style="width:100%;text-align:center;margin-bottom:14px;">
        <img src="data:image/png;base64,${kopSuratBase64}" style="width:100%;max-height:150px;object-fit:contain;display:block;margin:0 auto;" alt="Kop Surat"/>
      </div>
      <hr style="border:none;border-top:2px solid #222;margin:10px 0 18px 0;">`
    : "";

  const rowsHtml = rows
    .map(
      (r) => `
    <tr>
      <td>${String(r.tanggalUlasan ?? "")}</td>
      <td>${String(r.namaPengulas ?? "")}</td>
      <td style="text-align:center">${String(r.rating ?? "")}</td>
      <td>${String(r.teksUlasan ?? "").slice(0, 200)}</td>
      <td>${String(r.unitLayanan ?? "")}</td>
      <td>${String(r.kategoriMasalah ?? "")}</td>
      <td>${String(r.sentimen ?? "")}</td>
      <td>${String(r.statusTindakLanjut ?? "")}</td>
    </tr>
  `
    )
    .join("");

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Laporan Mutu - ${rs.nama}</title>
  <style>
    @page { size: A4 portrait; margin: 12mm 12mm 15mm 12mm; }
    body { font-family: 'Segoe UI', Arial, sans-serif; margin: 20px; font-size: 11px; color: #111; }
    h1 { text-align: center; margin-bottom: 4px; font-size: 15px; font-weight: 700; }
    .meta { text-align: center; color: #555; margin-bottom: 20px; font-size: 11px; }
    table { width: 100%; border-collapse: collapse; margin-top: 8px; }
    th, td { border: 1px solid #ccc; padding: 5px 6px; text-align: left; vertical-align: top; }
    th { background: #f0f0f0; font-weight: 600; font-size: 10.5px; }
    tr:nth-child(even) { background: #fafafa; }
    @media print {
      body { margin: 0; }
      @page { size: portrait; }
    }
  </style>
</head>
<body>
  ${kopHtml}
  <h1>Laporan Mutu Ulasan Layanan</h1>
  <div class="meta">${rs.nama} | Periode: ${tglDari} — ${tglSampai} | Dicetak: ${new Date().toLocaleString("id-ID")}</div>
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

async function generateDocx(
  rs: { nama: string; kode: string },
  rows: Record<string, unknown>[],
  periode: { dari: string; sampai: string },
  kopSuratBase64: string | null
): Promise<Buffer> {
  const tglDari = new Date(periode.dari).toLocaleDateString("id-ID");
  const tglSampai = new Date(periode.sampai).toLocaleDateString("id-ID");

  const TABLE_HEADERS = ["Tanggal", "Reviewer", "Rating", "Ulasan", "Unit", "Kategori", "Sentimen", "Status"];
  const ROW_KEYS = [
    "tanggalUlasan",
    "namaPengulas",
    "rating",
    "teksUlasan",
    "unitLayanan",
    "kategoriMasalah",
    "sentimen",
    "statusTindakLanjut",
  ] as const;

  const headerRow = new TableRow({
    children: TABLE_HEADERS.map(
      (h) =>
        new TableCell({
          shading: { fill: "F5F5F5" },
          width: { size: 100 / TABLE_HEADERS.length, type: WidthType.PERCENTAGE },
          children: [
            new Paragraph({
              children: [new TextRun({ text: h, bold: true, size: 18 })],
            }),
          ],
        })
    ),
  });

  const dataRows = rows.map(
    (r) =>
      new TableRow({
        children: ROW_KEYS.map(
          (k) =>
            new TableCell({
              width: { size: 100 / TABLE_HEADERS.length, type: WidthType.PERCENTAGE },
              children: [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: String(r[k] ?? "").slice(0, 200),
                      size: 16,
                    }),
                  ],
                }),
              ],
            })
        ),
      })
  );

  const kopParagraph: Paragraph[] = [];
  if (kopSuratBase64) {
    const imgBuffer = Buffer.from(kopSuratBase64, "base64");
    kopParagraph.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          new ImageRun({
            data: imgBuffer,
            transformation: { width: 620, height: 110 },
            type: "png",
          }),
        ],
      }),
      new Paragraph({ text: "" })
    );
  }

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            size: {
              orientation: PageOrientation.PORTRAIT,
            },
            margin: {
              top: 1000,
              right: 1000,
              bottom: 1000,
              left: 1000,
            },
          },
        },
        children: [
          ...kopParagraph,
          new Paragraph({
            text: "Laporan Mutu Ulasan Layanan",
            heading: HeadingLevel.HEADING_1,
            alignment: AlignmentType.CENTER,
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({
                text: `${rs.nama} | Periode: ${tglDari} — ${tglSampai}`,
                size: 20,
                color: "666666",
              }),
            ],
          }),
          new Paragraph({ text: "" }),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [headerRow, ...dataRows],
          }),
          new Paragraph({ text: "" }),
          new Paragraph({
            alignment: AlignmentType.RIGHT,
            children: [
              new TextRun({
                text: `Dicetak: ${new Date().toLocaleString("id-ID")}`,
                size: 16,
                color: "999999",
              }),
            ],
          }),
        ],
      },
    ],
  });

  return Packer.toBuffer(doc);
}

export async function POST(req: Request) {
  const body = await req.json();
  const { rumahSakitId, format, dari, sampai, status, kopSuratBase64 } = body;

  if (!rumahSakitId || !dari || !sampai) {
    return NextResponse.json(
      { error: "Parameter rumahSakitId, dari, dan sampai wajib diisi." },
      { status: 400 }
    );
  }

  const rsId = Number(rumahSakitId);
  const { data: rsRowsRaw } = await supabase
    .from(rumahSakit)
    .select("*")
    .eq("id", rsId)
    .limit(1);
  const rs = toCamel<RumahSakitRow>(rsRowsRaw?.[0]);
  if (!rs) {
    return NextResponse.json({ error: "Rumah sakit tidak ditemukan." }, { status: 404 });
  }

  const tglDari = new Date(dari);
  tglDari.setHours(0, 0, 0, 0);
  const tglSampai = new Date(sampai);
  tglSampai.setHours(23, 59, 59, 999);

  let query = supabase
    .from(ulasan)
    .select("*")
    .eq("rumah_sakit_id", rsId)
    .gte("tanggal_ulasan", tglDari.toISOString())
    .lt("tanggal_ulasan", tglSampai.toISOString());

  if (status && status !== "all") {
    query = query.eq("status_tindak_lanjut", status);
  }

  const { data: rowsRaw, error } = await query.order("tanggal_ulasan", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = toCamel<UlasanRow[]>(rowsRaw ?? []);

  const records = rows.map((r) => ({
    tanggalUlasan: String(r.tanggalUlasan ?? ""),
    namaPengulas: String(r.namaPengulas ?? ""),
    rating: String(r.rating ?? ""),
    teksUlasan: String(r.teksUlasan ?? "").slice(0, 200),
    unitLayanan: String(r.unitLayanan ?? ""),
    kategoriMasalah: String(r.kategoriMasalah ?? ""),
    sentimen: String(r.sentimen ?? ""),
    statusTindakLanjut: String(r.statusTindakLanjut ?? ""),
  }));

  const namaFile = `laporan-mutu-${rs.kode}-${dari}-${sampai}`;

  const effectiveKopSurat = kopSuratBase64 || rs.kopSurat || null;

  // ── PDF (HTML siap cetak) ─────────────────────────────────────
  if (format === "pdf") {
    const html = generateHtmlReport(
      rs,
      records,
      { dari, sampai },
      effectiveKopSurat
    );
    return new NextResponse(html, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Content-Disposition": `inline; filename="${namaFile}.html"`,
      },
    });
  }

  // ── Excel ─────────────────────────────────────────────────────
  if (format === "xlsx") {
    const xlsxRecords = records.map((r) => ({
      "Tanggal Ulasan": r.tanggalUlasan,
      "Nama Pengulas": r.namaPengulas,
      Rating: r.rating,
      "Teks Ulasan": r.teksUlasan,
      "Unit Layanan": r.unitLayanan,
      "Kategori Masalah": r.kategoriMasalah,
      Sentimen: r.sentimen,
      "Status Tindak Lanjut": r.statusTindakLanjut,
    }));
    const blob = generateXlsx(xlsxRecords, "Laporan Mutu");
    const arrayBuffer = await blob.arrayBuffer();
    return new NextResponse(new Uint8Array(arrayBuffer), {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${namaFile}.xlsx"`,
      },
    });
  }

  // ── Word (DOCX) ───────────────────────────────────────────────
  if (format === "docx") {
    const buffer = await generateDocx(
      rs,
      records,
      { dari, sampai },
      effectiveKopSurat
    );
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${namaFile}.docx"`,
      },
    });
  }

  return NextResponse.json(
    { error: "Format tidak didukung. Gunakan: pdf, xlsx, atau docx." },
    { status: 400 }
  );
}