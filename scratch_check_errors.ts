import { supabase } from "./lib/db/index.ts";

async function main() {
  const { data } = await supabase
    .from("ulasan")
    .select("id, rating, sentimen, sumber_label, ai_status, ai_error_code, ai_error_message")
    .eq("analisis_id", 16)
    .eq("sumber_label", "rating")
    .limit(5);

  console.log("Sample rating fallback errors:", data);
}

main().catch(console.error);
