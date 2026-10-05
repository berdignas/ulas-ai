import { send } from "@vercel/queue";
import { supabase } from "./db";
import { analisis } from "./db/schema";
import { finalisasiAnalisisDihentikan, mulaiProsesAnalisis } from "./analyzer";

export const ANALYSIS_TOPIC = "ulas_analysis";

export async function antrekanAnalisis(analisisId: number, checkpoint?: number, runId = crypto.randomUUID(), retryAttempt = 0, delaySeconds = 0): Promise<void> {
  await send(ANALYSIS_TOPIC, { analisisId, runId, retryAttempt }, {
    idempotencyKey: `analysis-${analisisId}-${runId}-${checkpoint ?? "start"}-${retryAttempt}`,
    delaySeconds,
    retentionSeconds: 604800,
  });
}

export async function jalankanBatchAntrean(analisisId: number, runId: string, retryAttempt: number): Promise<void> {
  const { data: current } = await supabase.from(analisis)
    .select("status")
    .eq("id", analisisId)
    .single();
  if (current?.status !== "berjalan") return;

  const token = crypto.randomUUID();
  const { data: claimed, error: claimError } = await supabase.rpc("claim_analisis_worker", {
    p_analisis_id: analisisId,
    p_token: token,
  });
  if (claimError) throw new Error(`Gagal mengunci worker: ${claimError.message}`);
  if (!claimed) throw new Error("Worker lain masih memproses dataset ini.");

  let hasilProses: boolean | number = false;
  try {
    const proses = mulaiProsesAnalisis(analisisId, true, 1);
    if (!proses) throw new Error("Worker lokal masih memproses dataset ini.");
    hasilProses = await proses;
  } finally {
    const { error } = await supabase.rpc("release_analisis_worker", {
      p_analisis_id: analisisId,
      p_token: token,
    });
    if (error) throw new Error(`Gagal melepas kunci worker: ${error.message}`);
  }

  if (hasilProses) {
    const { data: checkpoint } = await supabase.from(analisis)
      .select("status, ulasan_diproses, total_ulasan")
      .eq("id", analisisId)
      .single();
    if (checkpoint?.status === "berjalan") {
      if (typeof hasilProses === "number") {
        if (retryAttempt >= 4) {
          await finalisasiAnalisisDihentikan(analisisId, checkpoint.total_ulasan, "Provider AI masih membatasi permintaan setelah beberapa percobaan");
        } else {
          await antrekanAnalisis(analisisId, checkpoint.ulasan_diproses, runId, retryAttempt + 1, Math.min(300, 30 * 2 ** retryAttempt));
        }
      } else {
        await antrekanAnalisis(analisisId, checkpoint.ulasan_diproses, runId);
      }
    }
  }
}
