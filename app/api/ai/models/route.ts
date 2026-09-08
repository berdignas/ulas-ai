import { NextResponse } from "next/server";
import { getAIModelOptions, resolveAIConfig } from "@/lib/ai-config";

export const runtime = "nodejs";

export async function GET() {
  const models = getAIModelOptions();
  const defaultModel = resolveAIConfig().model;
  return NextResponse.json({ models, defaultModel });
}
