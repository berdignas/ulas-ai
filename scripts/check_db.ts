import { supabase } from "../lib/db";

async function main() {
  const { data: d1, error: e1 } = await supabase.from("hasil_aspek_ulasans").select("*");
  console.log("hasil_aspek_ulasans (with s):", d1?.length, "error:", e1?.message);

  const { data: d2, error: e2 } = await supabase.from("hasil_aspek_ulasan").select("*");
  console.log("hasil_aspek_ulasan (no s):", d2?.length, "error:", e2?.message);

  const { data: d3, error: e3 } = await supabase.from("unit_layanan").select("*");
  console.log("unit_layanan rows:", d3?.length, "error:", e3?.message, d3);

  const { data: d4, error: e4 } = await supabase.from("kategori_masalah").select("*");
  console.log("kategori_masalah rows:", d4?.length, "error:", e4?.message, d4);
}

main().catch(console.error);
