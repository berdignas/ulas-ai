import { NextResponse } from "next/server";
import { supabase, toCamel, toSnake } from "@/lib/db";
import { rumahSakit, ulasan, sinkronLog, lokasiLayananRs, RumahSakitRow } from "@/lib/db/schema";
import { getAIModelOptions, parseCustomAIConfig } from "@/lib/ai-config";
import { LOKASI_DEFAULT } from "@/lib/service-taxonomy";

export const runtime = "nodejs";

function modelValid(model: unknown): model is string {
  if (typeof model !== "string") return false;
  if (model === "custom" || model.startsWith("custom:")) return true;
  return getAIModelOptions().some((item) => item.id === model);
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const onlyActive = searchParams.get("active") === "true";

  let query = supabase
    .from(rumahSakit)
    .select("id,nama,kode,google_maps_place_id,apify_actor_id,apify_token,aktif,zona_waktu,jam_sinkron,ai_model,ai_api_key,kop_surat,dibuat_pada,diperbarui_pada")
    .order("id", { ascending: false });

  if (onlyActive) {
    query = query.eq("aktif", true);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rumahSakitList = toCamel<RumahSakitRow[]>(data ?? []).map((rs) => {
    const custom = parseCustomAIConfig(rs.aiApiKey);
    return {
      ...rs,
      customAI: custom ? {
        providerName: custom.providerName,
        baseUrl: custom.baseUrl,
        model: custom.model,
        hasApiKey: Boolean(custom.apiKey),
        maskedKey: custom.apiKey ? `${custom.apiKey.slice(0, 4)}••••${custom.apiKey.slice(-4)}` : "",
      } : null,
      aiApiKey: undefined,
    };
  });

  return NextResponse.json({ rumahSakit: rumahSakitList });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { nama, kode, googleMapsPlaceId, apifyActorId, apifyToken, zonaWaktu, jamSinkron, aiModel, customAI } = body;
    if (!nama || !kode) {
      return NextResponse.json({ error: "Nama dan kode rumah sakit wajib diisi" }, { status: 400 });
    }
    if (!modelValid(aiModel)) {
      return NextResponse.json({ error: "Model AI tidak tersedia." }, { status: 400 });
    }

    const { data: existing } = await supabase.from(rumahSakit).select("id").eq("kode", kode).limit(1);
    if (existing && existing.length) {
      return NextResponse.json({ error: "Kode rumah sakit sudah digunakan" }, { status: 409 });
    }

    let aiApiKeyToSave: string | null = null;
    let aiModelToSave: string = aiModel ?? "gemini-3.5-flash-lite";

    if (aiModel === "custom" || aiModel?.startsWith("custom:")) {
      if (customAI && typeof customAI === "object" && customAI.baseUrl && customAI.model) {
        const cleaned = {
          providerName: String(customAI.providerName || "Custom AI").trim(),
          baseUrl: String(customAI.baseUrl).trim().replace(/\/chat\/completions\/?$/i, "").replace(/\/$/, ""),
          apiKey: String(customAI.apiKey || "").trim().replace(/^Bearer\s+/i, "").replace(/^["']|["']$/g, ""),
          model: String(customAI.model).trim(),
        };
        aiApiKeyToSave = JSON.stringify(cleaned);
        aiModelToSave = `custom:${cleaned.model}`;
      }
    }

    const { data: created, error } = await supabase
      .from(rumahSakit)
      .insert(toSnake({
        nama,
        kode,
        googleMapsPlaceId: googleMapsPlaceId ?? null,
        apifyActorId: apifyActorId ?? "compass/google-maps-reviews-scraper",
        apifyToken: apifyToken ?? null,
        zonaWaktu: zonaWaktu ?? "Asia/Jakarta",
        jamSinkron: jamSinkron ?? 6,
        aktif: true,
        aiModel: aiModelToSave,
        aiApiKey: aiApiKeyToSave,
        dibuatPada: new Date().toISOString(),
        diperbaruiPada: new Date().toISOString(),
      }))
      .select("id");

    if (error || !created?.[0]) {
      return NextResponse.json({ error: "Gagal membuat: " + (error?.message || "Unknown error") }, { status: 500 });
    }

    await supabase.from(lokasiLayananRs).insert(
      LOKASI_DEFAULT.map((item) => ({
        rumah_sakit_id: created[0].id,
        nama: item.nama,
        jenis: item.jenis,
        kata_kunci: item.kataKunci,
        aktif: true,
        urutan: item.urutan,
      }))
    );

    return NextResponse.json({ id: created[0].id });
  } catch (e) {
    console.error('[POST /api/rumah-sakit] error:', e);
    return NextResponse.json({ error: "Gagal membuat: " + (e instanceof Error ? e.message : String(e)) }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  const body = await req.json();
  const { id, nama, kode, googleMapsPlaceId, apifyActorId, apifyToken, zonaWaktu, jamSinkron, aktif, aiModel, customAI, kopSurat } = body;
  if (!id || !nama || !kode) {
    return NextResponse.json({ error: "ID, nama dan kode wajib diisi" }, { status: 400 });
  }
  if (!modelValid(aiModel)) {
    return NextResponse.json({ error: "Model AI tidak tersedia." }, { status: 400 });
  }

  const { data: existing } = await supabase.from(rumahSakit).select("id").eq("kode", kode).limit(1);
  if (existing && existing.length && existing[0].id !== id) {
    return NextResponse.json({ error: "Kode rumah sakit sudah digunakan" }, { status: 409 });
  }

  const updatePayload: Record<string, unknown> = {
    nama,
    kode,
    googleMapsPlaceId: googleMapsPlaceId ?? null,
    apifyActorId: apifyActorId ?? "compass/google-maps-reviews-scraper",
    apifyToken: apifyToken ?? null,
    zonaWaktu: zonaWaktu ?? "Asia/Jakarta",
    jamSinkron: jamSinkron ?? 6,
    aktif: aktif ?? true,
    diperbaruiPada: new Date().toISOString(),
  };

  // Only update fields if provided
  if (aiModel !== undefined) {
    if (aiModel === "custom" || aiModel.startsWith("custom:")) {
      if (customAI && typeof customAI === "object" && customAI.baseUrl && customAI.model) {
        const cleaned = {
          providerName: String(customAI.providerName || "Custom AI").trim(),
          baseUrl: String(customAI.baseUrl).trim().replace(/\/chat\/completions\/?$/i, "").replace(/\/$/, ""),
          apiKey: String(customAI.apiKey || "").trim().replace(/^Bearer\s+/i, "").replace(/^["']|["']$/g, ""),
          model: String(customAI.model).trim(),
        };
        updatePayload.aiModel = `custom:${cleaned.model}`;
        if (cleaned.apiKey) {
          updatePayload.aiApiKey = JSON.stringify(cleaned);
        } else {
          // preserve existing key if user left it blank
          const { data: currentRS } = await supabase.from(rumahSakit).select("ai_api_key").eq("id", id).limit(1);
          const oldConfig = parseCustomAIConfig(currentRS?.[0]?.ai_api_key);
          if (oldConfig) {
            updatePayload.aiApiKey = JSON.stringify({
              ...oldConfig,
              providerName: cleaned.providerName || oldConfig.providerName,
              baseUrl: cleaned.baseUrl || oldConfig.baseUrl,
              model: cleaned.model || oldConfig.model,
            });
          } else {
            updatePayload.aiApiKey = JSON.stringify(cleaned);
          }
        }
      } else {
        updatePayload.aiModel = aiModel;
      }
    } else {
      updatePayload.aiModel = aiModel;
      updatePayload.aiApiKey = null;
    }
  }
  if (kopSurat !== undefined) updatePayload.kopSurat = kopSurat;

  const { data: updated, error } = await supabase
    .from(rumahSakit)
    .update(toSnake(updatePayload))
    .eq("id", id)
    .select("id");

  if (error || !updated?.length) {
    return NextResponse.json({ error: "Rumah sakit tidak ditemukan atau gagal diperbarui" }, { status: 404 });
  }
  return NextResponse.json({ id: updated[0].id });
}

export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    const { id, kopSurat } = body;
    if (!id) {
      return NextResponse.json({ error: "ID rumah sakit wajib diisi" }, { status: 400 });
    }

    const { data: updated, error } = await supabase
      .from(rumahSakit)
      .update(toSnake({
        kopSurat: kopSurat ?? null,
        diperbaruiPada: new Date().toISOString(),
      }))
      .eq("id", id)
      .select("id, kop_surat");

    if (error || !updated?.length) {
      return NextResponse.json({ error: "Gagal menyimpan kop surat: " + (error?.message || "Not found") }, { status: 500 });
    }

    return NextResponse.json({ success: true, id: updated[0].id, kopSurat: updated[0].kop_surat });
  } catch (e) {
    return NextResponse.json({ error: "Gagal menyimpan: " + (e instanceof Error ? e.message : String(e)) }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "ID wajib" }, { status: 400 });

  try {
    const rsId = Number(id);
    await supabase.from(ulasan).delete().eq("rumah_sakit_id", rsId);
    await supabase.from(sinkronLog).delete().eq("rumah_sakit_id", rsId);
    const { data: deleted, error } = await supabase.from(rumahSakit).delete().eq("id", rsId).select("id");

    if (error || !deleted?.length) {
      return NextResponse.json({ error: "Rumah sakit tidak ditemukan" }, { status: 404 });
    }
    return NextResponse.json({ success: true, id: deleted[0].id });
  } catch (e) {
    return NextResponse.json({ error: "Gagal menghapus: " + (e instanceof Error ? e.message : String(e)) }, { status: 500 });
  }
}
