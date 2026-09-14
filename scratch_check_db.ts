import { supabase, toCamel } from "./lib/db/index.ts";

async function main() {
  const { data: list, error } = await supabase
    .from("analisis")
    .select("id, nama_file, status, total_ulasan, ulasan_diproses, catatan")
    .order("id", { ascending: false })
    .limit(5);

  console.log("Analisis:", list, error);

  if (list && list.length > 0) {
    const latestId = list[0].id;
    const { data: ulasanList } = await supabase
      .from("ulasan")
      .select("id, sentimen, sumber_label")
      .eq("analisis_id", latestId);

    console.log("Total ulasan:", ulasanList?.length);
    const summary = {};
    for (const u of ulasanList || []) {
      const key = `${u.sumber_label || 'null'}_${u.sentimen || 'null'}`;
      summary[key] = (summary[key] || 0) + 1;
    }
    console.log("Summary ulasan:", summary);
  }
}

main().catch(console.error);
