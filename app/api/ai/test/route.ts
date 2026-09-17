import { NextResponse } from "next/server";
import { resolveAIConfig, parseCustomAIConfig, type CustomAIConfig } from "@/lib/ai-config";
import { supabase } from "@/lib/db";
import { rumahSakit } from "@/lib/db/schema";
import { getCurrentUser, isAdmin } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!isAdmin(user)) return NextResponse.json({ sukses: false, pesan: "Hanya admin yang dapat menguji konfigurasi AI." }, { status: 403 });
  try {
    const body = await req.json().catch(() => ({}));
    const customConfig: CustomAIConfig | null = body.customAI ? {
      providerName: String(body.customAI.providerName || "Custom AI Provider").trim(),
      baseUrl: String(body.customAI.baseUrl || "").trim().replace(/\/chat\/completions\/?$/i, "").replace(/\/$/, ""),
      apiKey: String(body.customAI.apiKey || "").trim().replace(/^Bearer\s+/i, "").replace(/^["']|["']$/g, ""),
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
    const cleanKey = config.apiKey.trim().replace(/^Bearer\s+/i, "").replace(/^["']|["']$/g, "");
    const cleanBaseUrl = config.baseUrl.trim().replace(/\/chat\/completions\/?$/i, "").replace(/\/$/, "");
    const url = isGemini
      ? `${cleanBaseUrl}/models/${config.model}:generateContent?key=${cleanKey}`
      : `${cleanBaseUrl}/chat/completions`;

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (!isGemini && cleanKey) {
      headers["Authorization"] = `Bearer ${cleanKey}`;
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
      let errorMessage = errorText.slice(0, 300);
      try {
        const parsed = JSON.parse(errorText);
        if (parsed.error?.message) {
          errorMessage = parsed.error.message;
        } else if (typeof parsed.error === "string") {
          errorMessage = parsed.error;
        }
      } catch {}

      let detailHint = "";
      if (res.status === 401) {
        detailHint = " — Kunci API (API Key) tidak valid atau salah salin.";
      } else if (res.status === 404) {
        if (/does not exist or you do not have access/i.test(errorMessage)) {
          detailHint = " — Akun Groq Anda belum memiliki akses ke model 70B ini. Solusi: Gunakan model 'llama-3.1-8b-instant' yang aktif dan gratis untuk seluruh akun Groq.";
        } else {
          detailHint = " — Endpoint URL atau nama Model tidak ditemukan di provider ini.";
        }
      } else if (res.status === 429) {
        detailHint = " — Batas kuota (rate limit) provider telah tercapai.";
      }

      return NextResponse.json({
        sukses: false,
        model: config.model,
        provider: config.providerLabel,
        pesan: `${config.providerLabel} (${res.status}): ${errorMessage}${detailHint}`,
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
