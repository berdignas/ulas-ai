import { supabase } from "./lib/db/index.ts";
import { parseCustomAIConfig } from "./lib/ai-config.ts";

async function main() {
  const { data: rs } = await supabase.from("rumah_sakit").select("*").eq("id", 2).limit(1);
  console.log("RS config:", rs?.[0]?.ai_model, rs?.[0]?.ai_api_key?.slice(0, 10));

  const config = parseCustomAIConfig(rs?.[0]?.ai_api_key);
  console.log("Parsed config:", {
    baseUrl: config?.baseUrl,
    model: config?.model,
    hasKey: Boolean(config?.apiKey),
  });

  const url = `${config?.baseUrl?.replace(/\/$/, '')}/chat/completions`;
  console.log("Calling URL:", url);

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config?.apiKey}`,
    },
    body: JSON.stringify({
      model: config?.model || "deepseek-v4.1-flash",
      messages: [
        { role: "user", content: 'Halo, jawab dalam JSON: {"status": "ok"}' }
      ],
      temperature: 0.1,
    }),
  });

  console.log("Status:", res.status, res.statusText);
  const text = await res.text();
  console.log("Raw Response (first 500 chars):", text.slice(0, 500));
}

main().catch(console.error);
