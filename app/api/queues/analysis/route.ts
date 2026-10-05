import { handleCallback } from "@vercel/queue";
import { jalankanBatchAntrean } from "@/lib/analysis-queue";

export const runtime = "nodejs";
export const maxDuration = 300;

export const POST = handleCallback(async (message: { analisisId: number; runId: string; retryAttempt?: number }) => {
  if (!Number.isSafeInteger(message?.analisisId) || message.analisisId < 1 ||
      typeof message.runId !== "string" || !/^[0-9a-f-]{36}$/i.test(message.runId)) return;
  await jalankanBatchAntrean(message.analisisId, message.runId, Number.isSafeInteger(message.retryAttempt) ? message.retryAttempt! : 0);
}, { visibilityTimeoutSeconds: 300 });
