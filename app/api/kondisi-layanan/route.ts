import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { summarizeHospital, type SummaryReview } from "@/lib/hospital-summary";

export const runtime = "nodejs";

export async function GET(request: Request) {
  if (!await getCurrentUser()) return NextResponse.json({ error: "Silakan masuk kembali." }, { status: 401 });
  const rsId = Number(new URL(request.url).searchParams.get("rumahSakitId"));
  if (!Number.isSafeInteger(rsId) || rsId <= 0) return NextResponse.json({ error: "Rumah sakit tidak valid." }, { status: 400 });
  try {
    const { data: hospital, error } = await supabase.from("rumah_sakit").select("nama").eq("id", rsId).maybeSingle();
    if (error) throw error;
    if (!hospital) return NextResponse.json({ error: "Rumah sakit tidak ditemukan." }, { status: 404 });
    const reviews: SummaryReview[] = [];
    for (let offset = 0; ; offset += 500) {
      const { data, error: reviewError } = await supabase.from("ulasan")
        .select("id,rating,teks_ulasan,tanggal_ulasan,sentimen,sumber_label,unit_layanan,faktor_urgensi_medis,hasil_aspek_ulasans(sentimen_aspek,aspek(nama_aspek))")
        .eq("rumah_sakit_id", rsId)
        .order("id", { ascending: true }).range(offset, offset + 499);
      if (reviewError) throw reviewError;
      reviews.push(...((data ?? []) as unknown as SummaryReview[]));
      if (!data || data.length < 500) break;
    }
    return NextResponse.json({ ...summarizeHospital(hospital.nama, reviews), namaRumahSakit: hospital.nama });
  } catch (error) {
    console.error("[kondisi-layanan]", error);
    return NextResponse.json({ error: "Ringkasan layanan gagal dimuat. Silakan coba lagi." }, { status: 500 });
  }
}
