import { supabase } from "./lib/db/index.ts";
import { parseCustomAIConfig } from "./lib/ai-config.ts";

function parseResponseJsonText(text: string) {
  const cleaned = text.trim();
  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    return JSON.parse(cleaned.slice(firstBrace, lastBrace + 1));
  }
  return JSON.parse(text);
}

function extractJson(text: string): unknown {
  let cleaned = text.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
  cleaned = cleaned.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  if (!cleaned) throw new Error("Respons AI kosong");
  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(cleaned.slice(start, end + 1));
      } catch {}
    }
    throw new Error("Respons AI bukan JSON valid");
  }
}

async function main() {
  const { data: rs } = await supabase.from("rumah_sakit").select("*").eq("id", 2).limit(1);
  const config = parseCustomAIConfig(rs?.[0]?.ai_api_key);

  const { data: reviews } = await supabase
    .from("ulasan")
    .select("id, teks_ulasan, rating")
    .eq("analisis_id", 16)
    .limit(3);

  const url = `${config?.baseUrl?.replace(/\/$/, '')}/chat/completions`;
  const body = {
    model: config?.model || "deepseek-v4.1-flash",
    temperature: 0,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: `Anda adalah analis ulasan rumah sakit. Kembalikan JSON valid dengan schema: {"hasil": [{"id": number, "sentimen": "positif"|"negatif"|"netral", "unitLayanan": string, "kategoriMasalah": string, "faktorUrgensiMedis": boolean, "saranDrafBalasan": string, "aspek": [{"aspek": string, "sentimen": string, "kutipan": string}], "lokasiLayanan": string[]}]}`
      },
      {
        role: "user",
        content: JSON.stringify({
          ulasan: reviews?.map(r => ({ id: r.id, rating: r.rating, ulasan: r.teks_ulasan }))
        })
      }
    ]
  };

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config?.apiKey}`,
    },
    body: JSON.stringify(body),
  });

  const rawText = await res.text();
  const data = parseResponseJsonText(rawText);
  console.log("data parsed successfully! choices length:", data.choices?.length);
  const content = data.choices?.[0]?.message?.content ?? "";
  const parsed = extractJson(content);
  console.log("content JSON parsed successfully! Hasil count:", (parsed as any).hasil?.length);
  console.log("First item:", (parsed as any).hasil?.[0]);
}

main().catch(console.error);
