import { NextResponse } from "next/server";
import { resolveAIConfig } from "@/lib/ai-config";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const config = resolveAIConfig(String(body.model || "").trim() || null);

    if (!config.apiKey) {
      return NextResponse.json({
        sukses: false,
        model: config.model,
        provider: config.providerLabel,
        pesan: `API key ${config.providerLabel} belum dikonfigurasi di environment Vercel.`,
      }, { status: 400 });
    }

    const start = Date.now();
    const isGemini = config.provider === "gemini";
    const url = isGemini
      ? `${config.baseUrl}/models/${config.model}:generateContent?key=${config.apiKey}`
      : `${config.baseUrl}/chat/completions`;
    const res = await fetch(url, {
      method: "POST",
      headers: isGemini
        ? { "Content-Type": "application/json" }
        : { Authorization: `Bearer ${config.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(isGemini
        ? { contents: [{ parts: [{ text: "Balas hanya dengan kata OK" }] }] }
        : {
            model: config.model,
            temperature: 0,
            max_tokens: 8,
            messages: [{ role: "user", content: "Balas hanya dengan kata OK" }],
          }),
    });
    const latencyMs = Date.now() - start;

    if (!res.ok) {
      const errorText = await res.text().catch(() => "");
      return NextResponse.json({
        sukses: false,
        model: config.model,
        provider: config.providerLabel,
        pesan: `${config.providerLabel} error (${res.status}): ${errorText.slice(0, 180)}`,
      });
    }

    return NextResponse.json({
      sukses: true,
      provider: config.providerLabel,
      model: config.model,
      latencyMs,
      pesan: `${config.providerLabel} · ${config.model} siap digunakan (${latencyMs} ms).`,
    });
  } catch (error) {
    return NextResponse.json({
      sukses: false,
      pesan: error instanceof Error ? error.message : "Terjadi kesalahan saat menguji AI.",
    }, { status: 500 });
  }
}
