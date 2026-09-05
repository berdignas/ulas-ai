import Papa from "papaparse";
import * as XLSX from "xlsx";

export interface ParsedUlasan {
  namaPengulas: string | null;
  rating: number | null;
  teksUlasan: string;
  tanggalUlasan: string | null;
}

interface ParseResult {
  ulasan: ParsedUlasan[];
  kolomTerdeteksi: { nama: string | null; rating: string | null; teks: string | null; tanggal: string | null };
}

const HEADER_ALIASES: Record<keyof ParseResult["kolomTerdeteksi"], string[]> = {
  nama: ["namapengulas", "nama", "name", "reviewername", "author", "reviewer", "pengulas", "oleh", "dari", "username", "pelanggan"],
  rating: ["rating", "bintang", "stars", "star", "nilai", "score", "skor", "ratingbintang"],
  teks: ["teksulasan", "ulasan", "review", "reviewtext", "komentar", "comment", "isiulasan", "isi", "teks", "text", "body", "content", "deskripsi"],
  tanggal: ["tanggalulasan", "tanggal", "date", "reviewdate", "waktu", "time", "dibuat", "created", "createdat", "tanggalreview", "tanggalrating"],
};

function normalizeHeader(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function parseRating(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value >= 0 && value <= 5 ? Math.round(value) : null;
  }
  if (typeof value === "string") {
    const match = value.match(/(\d+(?:[.,]\d+)?)/);
    if (!match) return null;
    const num = parseFloat(match[1].replace(",", "."));
    return num >= 0 && num <= 5 ? Math.round(num) : null;
  }
  return null;
}

function toCellString(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString();
  return String(value).trim();
}

function mapRows(rows: string[][]): ParseResult {
  const kolomTerdeteksi: ParseResult["kolomTerdeteksi"] = { nama: null, rating: null, teks: null, tanggal: null };
  if (rows.length === 0) return { ulasan: [], kolomTerdeteksi };

  const header = rows[0].map((cell) => normalizeHeader(toCellString(cell)));
  const columnIndex: Partial<Record<keyof typeof HEADER_ALIASES, number>> = {};

  const findField = (field: keyof typeof HEADER_ALIASES, fuzzy: boolean) => {
    if (columnIndex[field] !== undefined) return;
    for (let i = 0; i < header.length; i++) {
      const cell = header[i];
      if (!cell || Object.values(columnIndex).includes(i)) continue;
      const matched = HEADER_ALIASES[field].some((a) => (fuzzy ? cell.includes(a) : cell === a));
      if (matched) {
        columnIndex[field] = i;
        kolomTerdeteksi[field] = toCellString(rows[0][i]) || header[i];
        return;
      }
    }
  };

  const fields = Object.keys(HEADER_ALIASES) as (keyof typeof HEADER_ALIASES)[];
  fields.forEach((field) => findField(field, false));
  fields.forEach((field) => findField(field, true));

  const hasHeader = Object.keys(columnIndex).length > 0;
  const dataRows = hasHeader ? rows.slice(1) : rows;

  if (!hasHeader) {
    columnIndex.nama = 0;
    columnIndex.rating = 1;
    columnIndex.teks = 2;
    columnIndex.tanggal = 3;
  }

  const ulasan: ParsedUlasan[] = [];
  for (const row of dataRows) {
    const teks = toCellString(row[columnIndex.teks ?? -1]);
    if (!teks) continue;
    ulasan.push({
      namaPengulas: toCellString(row[columnIndex.nama ?? -1]) || null,
      rating: parseRating(row[columnIndex.rating ?? -1]),
      teksUlasan: teks,
      tanggalUlasan: toCellString(row[columnIndex.tanggal ?? -1]) || null,
    });
  }

  return { ulasan: dedupe(ulasan), kolomTerdeteksi };
}

function dedupe(items: ParsedUlasan[]): ParsedUlasan[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = item.teksUlasan.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function parseUlasanFile(buffer: Buffer, filename: string): ParseResult {
  const ext = filename.toLowerCase().split(".").pop() ?? "";

  if (ext === "csv" || ext === "txt") {
    const text = buffer.toString("utf-8").replace(/^\uFEFF/, "");
    const parsed = Papa.parse<string[]>(text, { skipEmptyLines: "greedy" });
    return mapRows(parsed.data);
  }

  if (ext === "xlsx" || ext === "xls") {
    const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) return { ulasan: [], kolomTerdeteksi: { nama: null, rating: null, teks: null, tanggal: null } };
    const rows = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[sheetName], {
      header: 1,
      defval: "",
      raw: false,
    });
    return mapRows(rows.map((row) => row.map((cell) => toCellString(cell))));
  }

  throw new Error("Format file tidak didukung. Gunakan file CSV atau Excel (.xlsx/.xls).");
}
