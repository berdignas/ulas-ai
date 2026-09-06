import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const reqModel = String(body.model || "").trim();
    const reqKey = String(body.apiKey || "").trim();

    const isNVIDIA = /nvidia|nemotron/i.test(reqModel);

    if (isNVIDIA) {
      const apiKey = reqKey || process.env.NVIDIA_API_KEY || "";
      const baseUrl = (process.env.NVIDIA_BASE_URL || "https://api.nvidia.com/v1").replace(/\/$/, "");
      const model = process.env.NVIDIA_MODEL || "nemotron";

      if (!apiKey) {
        return NextResponse.json({
          sukses: false,
          pesan: "API Key NVIDIA belum diisi.",
        }, { status: 400 });
      }

      const start = Date.now();
      const res = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          temperature: 0,
          messages: [{ role: "user", content: "Ping test" }],
        }),
      });

      const elapsed = Date.now() - start;

      if (!res.ok) {
        const errText = await res.text().catch(() => "");
        return NextResponse.json({
          sukses: false,
          pesan: `NVIDIA API error (${res.status}): ${errText.slice(0, 160)}`,
        });
      }

      return NextResponse.json({
        sukses: true,
        provider: "NVIDIA",
        model,
        latencyMs: elapsed,
        pesan: `Koneksi ke NVIDIA AI (${model}) berhasil! Latensi: ${elapsed}ms`,
      });
    }

    // Default to Google Gemini (Antigravity Engine)
    const apiKey = reqKey || process.env.GEMINI_API_KEY || "";
    const model = process.env.GEMINI_MODEL || "gemini-3.6-flash";

    if (!apiKey) {
      return NextResponse.json({
        sukses: false,
        pesan: "API Key Google Gemini belum diisi.",
      }, { status: 400 });
    }

    const start = Date.now();
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: "Ping test" }] }],
      }),
    });

    const elapsed = Date.now() - start;

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      const msg = errData.error?.message || (await res.text().catch(() => "Unknown error"));
      return NextResponse.json({
        sukses: false,
        pesan: `Gemini API error (${res.status}): ${msg.slice(0, 200)}`,
      });
    }

    return NextResponse.json({
      sukses: true,
      provider: "Google Gemini",
      model,
      latencyMs: elapsed,
      pesan: `Koneksi ke Google Gemini (${model}) berhasil! Respons normal (${elapsed}ms).`,
    });
  } catch (error) {
    console.error("[POST /api/ai/test] Error:", error);
    return NextResponse.json({
      sukses: false,
      pesan: error instanceof Error ? error.message : "Terjadi kesalahan saat menguji AI.",
    }, { status: 500 });
  }
}
