import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { supabase } from "@/lib/supabase";

export const runtime = "nodejs";

function validDate(value: string | null): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function nextDay(value: string) {
  const date = new Date(`${value}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

function midnight(value: string, timeZone: string) {
  const target = new Date(`${value}T00:00:00Z`).getTime();
  let timestamp = target;
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone, timeZoneName: "longOffset",
  });
  for (let i = 0; i < 2; i++) {
    const offset = formatter.formatToParts(new Date(timestamp)).find((part) => part.type === "timeZoneName")?.value;
    const match = offset?.match(/GMT([+-])(\d{2}):(\d{2})/);
    const minutes = match ? (Number(match[2]) * 60 + Number(match[3])) * (match[1] === "+" ? 1 : -1) : 0;
    timestamp = target - minutes * 60_000;
  }
  return new Date(timestamp).toISOString();
}

export async function GET(req: Request) {
  if (!await getCurrentUser()) return NextResponse.json({ error: "Silakan masuk kembali." }, { status: 401 });
  const params = new URL(req.url).searchParams;
  const rsId = Number(params.get("rumahSakitId"));
  const dates = ["awalDari", "awalSampai", "pembandingDari", "pembandingSampai"].map((key) => params.get(key));
  if (!Number.isSafeInteger(rsId) || rsId <= 0 || !dates.every(validDate)) {
    return NextResponse.json({ error: "Pilih rumah sakit dan isi empat tanggal yang valid." }, { status: 400 });
  }
  const [awalDari, awalSampai, pembandingDari, pembandingSampai] = dates as string[];
  if (awalDari > awalSampai || pembandingDari > pembandingSampai) {
    return NextResponse.json({ error: "Tanggal mulai tidak boleh melewati tanggal akhir." }, { status: 400 });
  }

  try {
    const { data: rs, error } = await supabase.from("rumah_sakit").select("zona_waktu").eq("id", rsId).maybeSingle();
    if (error) throw error;
    if (!rs) return NextResponse.json({ error: "Rumah sakit tidak ditemukan." }, { status: 404 });
    const zonaWaktu = rs.zona_waktu || "Asia/Jakarta";

    async function countPeriod(dari: string, sampai: string) {
      const start = midnight(dari, zonaWaktu);
      const end = midnight(nextDay(sampai), zonaWaktu);
      const counts = await Promise.all([null, "positif", "netral", "negatif"].map(async (sentimen) => {
        // Uploads have a fingerprint; only Apify datasets are included in this comparison.
        let query = supabase.from("ulasan")
          .select("id,analisis!inner(id)", { count: "exact", head: true })
          .eq("rumah_sakit_id", rsId)
          .eq("analisis.rumah_sakit_id", rsId)
          .is("analisis.sidik_jari", null)
          .like("analisis.nama_file", "Sinkron Apify%")
          .gte("tanggal_ulasan", start).lt("tanggal_ulasan", end);
        if (sentimen) query = query.eq("sentimen", sentimen);
        const { count, error: countError } = await query;
        if (countError) throw countError;
        return count ?? 0;
      }));
      const [total, positif, netral, negatif] = counts;
      return { dari, sampai, total, positif, netral, negatif, belumDianalisis: total - positif - netral - negatif };
    }

    const [awal, pembanding] = await Promise.all([
      countPeriod(awalDari, awalSampai), countPeriod(pembandingDari, pembandingSampai),
    ]);
    return NextResponse.json({ awal, pembanding, zonaWaktu });
  } catch (error) {
    console.error("[perbandingan-periode]", error);
    return NextResponse.json({ error: "Perbandingan gagal dimuat. Silakan coba lagi." }, { status: 500 });
  }
}
