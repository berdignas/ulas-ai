import { supabase } from "../lib/db";
import { hasilAspekUlasan } from "../lib/db/schema";

async function testJoin() {
  const { data, error } = await supabase.from(hasilAspekUlasan)
    .select("sentimen_aspek, aspek(id, nama_aspek), ulasan!inner(analisis_id, tanggal_ulasan)")
    .limit(5);

  console.log("Error:", error);
  console.log("Data:", data);
}

testJoin().catch(console.error);
