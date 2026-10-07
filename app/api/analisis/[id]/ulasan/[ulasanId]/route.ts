import { NextResponse } from "next/server";
import { getCurrentUser, isAdmin } from "@/lib/auth";
import { getSqlClient } from "@/lib/db";

export const runtime = "nodejs";

export async function DELETE(
  req: Request,
  ctx: { params: Promise<{ id: string; ulasanId: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Silakan masuk kembali." }, { status: 401 });
  if (!isAdmin(user)) return NextResponse.json({ error: "Hanya admin yang dapat menghapus ulasan." }, { status: 403 });

  const origin = req.headers.get("origin");
  if (origin && origin !== new URL(req.url).origin) {
    return NextResponse.json({ error: "Asal permintaan tidak valid." }, { status: 403 });
  }
  const params = await ctx.params;
  const id = Number(params.id);
  const ulasanId = Number(params.ulasanId);
  if (![id, ulasanId].every((value) => Number.isSafeInteger(value) && value > 0)) {
    return NextResponse.json({ error: "ID tidak valid." }, { status: 400 });
  }

  const sql = getSqlClient();
  if (!sql) return NextResponse.json({ error: "Koneksi database untuk penghapusan belum tersedia." }, { status: 503 });

  try {
    // Lock the parent so simultaneous deletes serialize and counts stay consistent.
    // All changes, including cascading aspect/location deletion, commit together.
    const result = await sql.begin(async (tx) => {
      const parents = await tx`SELECT status FROM analisis WHERE id = ${id} FOR UPDATE`;
      if (!parents.length) return { status: 404, error: "Analisis tidak ditemukan." };
      if (["menunggu", "berjalan"].includes(parents[0].status)) {
        return { status: 409, error: "Analisis masih dalam antrean atau sedang diproses. Tunggu hingga selesai sebelum menghapus ulasan." };
      }
      const deleted = await tx`DELETE FROM ulasan WHERE id = ${ulasanId} AND analisis_id = ${id} RETURNING id`;
      if (!deleted.length) return { status: 404, error: "Ulasan tidak ditemukan atau sudah dihapus." };
      await tx`
        UPDATE analisis SET
          total_ulasan = counts.total,
          ulasan_diproses = counts.diproses,
          total_positif = counts.positif,
          total_netral = counts.netral,
          total_negatif = counts.negatif,
          kondisi_umum = NULL,
          catatan = 'Data ulasan telah diubah. Ringkasan naratif perlu dibuat ulang.',
          sidik_jari = NULL
        FROM (
          SELECT count(*)::int AS total,
            count(sentimen)::int AS diproses,
            count(*) FILTER (WHERE sentimen = 'positif')::int AS positif,
            count(*) FILTER (WHERE sentimen = 'netral')::int AS netral,
            count(*) FILTER (WHERE sentimen = 'negatif')::int AS negatif
          FROM ulasan WHERE analisis_id = ${id}
        ) counts
        WHERE analisis.id = ${id}
      `;
      return { status: 200, terhapus: true, id: ulasanId };
    });
    return NextResponse.json(result, { status: result.status });
  } catch {
    return NextResponse.json({ error: "Ulasan belum dihapus karena terjadi gangguan database. Silakan coba lagi." }, { status: 500 });
  }
}
