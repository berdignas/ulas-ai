import { supabase } from "./lib/db/index.ts";

async function main() {
  const { data: ulasanBelum } = await supabase
    .from("ulasan")
    .select("id, rating, teks_ulasan, sumber_label")
    .eq("analisis_id", 16)
    .is("sumber_label", null)
    .limit(10);

  console.log("Sisa ulasan belum diproses (sample):", ulasanBelum);
}

main().catch(console.error);
