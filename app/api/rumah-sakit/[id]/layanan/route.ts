import { NextResponse } from "next/server";
import { supabase, toCamel } from "@/lib/db";
import {
  hasilLokasiUlasan,
  lokasiLayananRs,
  LokasiLayananRsRow,
  rumahSakit,
  ulasan,
} from "@/lib/db/schema";
import {
  deteksiLokasiDariKeyword,
  JenisLokasiLayanan,
  LOKASI_DEFAULT,
} from "@/lib/service-taxonomy";

export const runtime = "nodejs";

const JENIS_VALID = new Set<JenisLokasiLayanan>(["poli", "ruangan", "unit", "fasilitas"]);

type InputLokasi = {
  id?: number;
  nama?: string;
  jenis?: JenisLokasiLayanan;
  kataKunci?: string[];
  aktif?: boolean;
  urutan?: number;
};

function validasiItems(input: unknown): Array<Required<Omit<InputLokasi, "id">> & { id?: number }> {
  if (!Array.isArray(input)) throw new Error("Daftar poli dan ruangan tidak valid.");
  if (input.length > 200) throw new Error("Maksimal 200 poli, ruangan, unit, atau fasilitas per RS.");

  const namaUnik = new Set<string>();
  return input.map((raw, index) => {
    const item = raw as InputLokasi;
    const nama = String(item.nama ?? "").trim().slice(0, 100);
    const jenis = item.jenis;
    if (!nama) throw new Error(`Nama pada baris ${index + 1} wajib diisi.`);
    if (!jenis || !JENIS_VALID.has(jenis)) throw new Error(`Jenis pada baris ${index + 1} tidak valid.`);
    const kunciNama = nama.toLowerCase();
    if (namaUnik.has(kunciNama)) throw new Error(`Nama layanan "${nama}" digunakan lebih dari sekali.`);
    namaUnik.add(kunciNama);

    const kataKunci = Array.from(new Set(
      (Array.isArray(item.kataKunci) ? item.kataKunci : [])
        .map((value) => String(value).trim().toLowerCase().slice(0, 80))
        .filter(Boolean)
    ));
    if (kataKunci.length > 20) throw new Error(`Maksimal 20 kata kunci untuk "${nama}".`);

    return {
      id: Number.isFinite(Number(item.id)) ? Number(item.id) : undefined,
      nama,
      jenis,
      kataKunci,
      aktif: item.aktif !== false,
      urutan: Number.isFinite(Number(item.urutan)) ? Number(item.urutan) : index + 1,
    };
  });
}

async function klasifikasikanUlangKeyword(rumahSakitId: number): Promise<number> {
  const { data: lokasiRaw, error: lokasiError } = await supabase
    .from(lokasiLayananRs)
    .select("*")
    .eq("rumah_sakit_id", rumahSakitId)
    .eq("aktif", true);
  if (lokasiError) throw lokasiError;
  const daftarLokasi = toCamel<LokasiLayananRsRow[]>(lokasiRaw ?? []);

  const semuaReview: Array<{ id: number; teks_ulasan: string }> = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await supabase
      .from(ulasan)
      .select("id,teks_ulasan")
      .eq("rumah_sakit_id", rumahSakitId)
      .range(offset, offset + 999);
    if (error) throw error;
    semuaReview.push(...((data ?? []) as Array<{ id: number; teks_ulasan: string }>));
    if ((data ?? []).length < 1000) break;
  }

  for (let offset = 0; offset < semuaReview.length; offset += 500) {
    const ids = semuaReview.slice(offset, offset + 500).map((item) => item.id);
    if (ids.length > 0) {
      const { error } = await supabase
        .from(hasilLokasiUlasan)
        .delete()
        .in("ulasan_id", ids)
        .eq("metode", "keyword");
      if (error) throw error;
    }
  }

  const relasi = semuaReview.flatMap((review) =>
    deteksiLokasiDariKeyword(review.teks_ulasan, daftarLokasi).map((lokasi) => ({
      ulasan_id: review.id,
      lokasi_layanan_id: lokasi.id,
      metode: "keyword",
      kutipan: review.teks_ulasan.slice(0, 240) || null,
    }))
  );
  for (let offset = 0; offset < relasi.length; offset += 500) {
    const { error } = await supabase
      .from(hasilLokasiUlasan)
      .upsert(relasi.slice(offset, offset + 500), { onConflict: "ulasan_id,lokasi_layanan_id" });
    if (error) throw error;
  }
  return relasi.length;
}

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const rumahSakitId = Number(id);
  if (!Number.isFinite(rumahSakitId)) {
    return NextResponse.json({ error: "ID rumah sakit tidak valid." }, { status: 400 });
  }

  const { data, error } = await supabase
    .from(lokasiLayananRs)
    .select("*")
    .eq("rumah_sakit_id", rumahSakitId)
    .order("urutan", { ascending: true })
    .order("nama", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ layanan: toCamel<LokasiLayananRsRow[]>(data ?? []) });
}

export async function PUT(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const rumahSakitId = Number(id);
    if (!Number.isFinite(rumahSakitId)) {
      return NextResponse.json({ error: "ID rumah sakit tidak valid." }, { status: 400 });
    }

    const { data: rs } = await supabase.from(rumahSakit).select("id").eq("id", rumahSakitId).limit(1);
    if (!rs?.length) return NextResponse.json({ error: "Rumah sakit tidak ditemukan." }, { status: 404 });

    const body = await req.json() as { layanan?: unknown };
    const items = validasiItems(body.layanan);
    const { data: existing, error: existingError } = await supabase
      .from(lokasiLayananRs)
      .select("id")
      .eq("rumah_sakit_id", rumahSakitId);
    if (existingError) throw existingError;

    const existingIds = new Set((existing ?? []).map((item) => Number(item.id)));
    const incomingIds = new Set(items.map((item) => item.id).filter((item): item is number => Boolean(item)));
    const idsDinonaktifkan = Array.from(existingIds).filter((itemId) => !incomingIds.has(itemId));
    if (idsDinonaktifkan.length > 0) {
      const { error } = await supabase
        .from(lokasiLayananRs)
        .update({ aktif: false, diperbarui_pada: new Date().toISOString() })
        .in("id", idsDinonaktifkan)
        .eq("rumah_sakit_id", rumahSakitId);
      if (error) throw error;
    }

    for (const item of items) {
      const payload = {
        rumah_sakit_id: rumahSakitId,
        nama: item.nama,
        jenis: item.jenis,
        kata_kunci: item.kataKunci,
        aktif: item.aktif,
        urutan: item.urutan,
        diperbarui_pada: new Date().toISOString(),
      };
      if (item.id && existingIds.has(item.id)) {
        const { error } = await supabase
          .from(lokasiLayananRs)
          .update(payload)
          .eq("id", item.id)
          .eq("rumah_sakit_id", rumahSakitId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from(lokasiLayananRs).insert(payload);
        if (error) throw error;
      }
    }

    const diklasifikasi = await klasifikasikanUlangKeyword(rumahSakitId);
    const { data: updatedRows, error: updatedError } = await supabase
      .from(lokasiLayananRs)
      .select("*")
      .eq("rumah_sakit_id", rumahSakitId)
      .order("urutan", { ascending: true })
      .order("nama", { ascending: true });
    if (updatedError) throw updatedError;
    return NextResponse.json({
      layanan: toCamel<LokasiLayananRsRow[]>(updatedRows ?? []),
      diklasifikasi,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Gagal menyimpan poli dan ruangan." },
      { status: 400 }
    );
  }
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const rumahSakitId = Number(id);
  if (!Number.isFinite(rumahSakitId)) {
    return NextResponse.json({ error: "ID rumah sakit tidak valid." }, { status: 400 });
  }
  const { data: existing } = await supabase.from(lokasiLayananRs).select("id").eq("rumah_sakit_id", rumahSakitId).limit(1);
  if (existing?.length) {
    return NextResponse.json({ error: "Template hanya dapat dipasang ketika daftar masih kosong." }, { status: 409 });
  }
  const { error } = await supabase.from(lokasiLayananRs).insert(
    LOKASI_DEFAULT.map((item) => ({
      rumah_sakit_id: rumahSakitId,
      nama: item.nama,
      jenis: item.jenis,
      kata_kunci: item.kataKunci,
      aktif: true,
      urutan: item.urutan,
    }))
  );
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
