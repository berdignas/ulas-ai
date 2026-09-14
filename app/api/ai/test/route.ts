import { NextResponse } from "next/server";
import { resolveAIConfig, parseCustomAIConfig, type CustomAIConfig } from "@/lib/ai-config";
import { supabase } from "@/lib/db";
import { rumahSakit } from "@/lib/db/schema";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const customConfig: CustomAIConfig | null = body.customAI ? {
      providerName: body.customAI.providerName || "Custom AI Provider",
      baseUrl: String(body.customAI.baseUrl || "").trim(),
      apiKey: String(body.customAI.apiKey || "").trim(),
      model: String(body.customAI.model || "").trim(),
    } : null;

    if (customConfig) {
      if (!customConfig.baseUrl || !customConfig.model) {
        return NextResponse.json({
          sukses: false,
          pesan: "Base URL dan Nama Model wajib diisi untuk Custom Provider.",
        }, { status: 400 });
      }

      if (!customConfig.apiKey && body.rsId) {
        const { data } = await supabase
          .from(rumahSakit)
          .select("ai_api_key")
          .eq("id", Number(body.rsId))
          .single();
        if (data?.ai_api_key) {
          const saved = parseCustomAIConfig(data.ai_api_key);
          if (saved?.apiKey) {
            customConfig.apiKey = saved.apiKey;
          }
        }
      }
    }

    const config = resolveAIConfig(String(body.model || "").trim() || null, customConfig);

    const isLocalhost = config.baseUrl.includes("localhost") || config.baseUrl.includes("127.0.0.1");
    if (!config.apiKey && !isLocalhost) {
      return NextResponse.json({
        sukses: false,
        model: config.model,
        provider: config.providerLabel,
        pesan: `API key ${config.providerLabel} belum diisi.`,
      }, { status: 400 });
    }

    const start = Date.now();
    const isGemini = config.provider === "gemini";
    const url = isGemini
      ? `${config.baseUrl}/models/${config.model}:generateContent?key=${config.apiKey}`
      : `${config.baseUrl}/chat/completions`;

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (!isGemini && config.apiKey) {
      headers["Authorization"] = `Bearer ${config.apiKey}`;
    }

    const res = await fetch(url, {
      method: "POST",
      headers,
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
        pesan: `${config.providerLabel} error (${res.status}): ${errorText.slice(0, 200)}`,
      });
    }

    return NextResponse.json({
      sukses: true,
      provider: config.providerLabel,
      model: config.model,
      latencyMs,
      pesan: `Koneksi berhasil! ${config.providerLabel} · ${config.model} merespons dalam ${latencyMs} ms.`,
    });
  } catch (error) {
    return NextResponse.json({
      sukses: false,
      pesan: error instanceof Error ? error.message : "Terjadi kesalahan saat menguji AI.",
    }, { status: 500 });
  }
}
