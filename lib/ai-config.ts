export type AIProvider = "gemini" | "nvidia" | "opencode";

export interface AIModelOption {
  id: string;
  provider: AIProvider;
  providerLabel: string;
  label: string;
  description: string;
  profile: "cepat" | "seimbang" | "mendalam" | "kustom";
  configured: boolean;
}

export interface AIExecutionConfig {
  provider: AIProvider;
  providerLabel: string;
  model: string;
  apiKey: string;
  baseUrl: string;
}

const GEMINI_MODELS = [
  {
    id: "gemini-2.0-flash",
    label: "Gemini 2.0 Flash",
    description: "Model resmi Google terbaru, cepat dan hemat untuk analisis ulasan.",
    profile: "cepat" as const,
  },
  {
    id: "gemini-1.5-flash",
    label: "Gemini 1.5 Flash",
    description: "Stabil dan efisien untuk pemrosesan ulasan dalam jumlah besar.",
    profile: "seimbang" as const,
  },
  {
    id: "gemini-1.5-pro",
    label: "Gemini 1.5 Pro",
    description: "Penalaran mendalam untuk ulasan panjang dan kompleks.",
    profile: "mendalam" as const,
  },
];

function providerKey(provider: AIProvider): string {
  if (provider === "gemini") {
    const key = process.env.GEMINI_API_KEY?.trim() ?? "";
    // Hanya valid jika diawali AIzaSy (kunci resmi Google AI Studio)
    return key.startsWith("AIzaSy") ? key : "";
  }
  if (provider === "nvidia") {
    const key = process.env.NVIDIA_API_KEY?.trim() ?? "";
    return process.env.NVIDIA_MODEL ? key : "";
  }
  return process.env.OPENCODE_ZEN_API_KEY ?? "";
}

export function getAIModelOptions(): AIModelOption[] {
  const options: AIModelOption[] = GEMINI_MODELS.map((model) => ({
    ...model,
    provider: "gemini",
    providerLabel: "Google Gemini",
    configured: Boolean(providerKey("gemini")),
  }));

  const nvidiaModel = process.env.NVIDIA_MODEL?.trim();
  if (nvidiaModel) {
    options.push({
      id: nvidiaModel,
      provider: "nvidia",
      providerLabel: "NVIDIA NIM",
      label: `NVIDIA · ${nvidiaModel}`,
      description: "Model NVIDIA yang dikonfigurasi oleh administrator.",
      profile: "kustom",
      configured: Boolean(providerKey("nvidia")),
    });
  }

  const openCodeModel = process.env.OPENCODE_ZEN_MODEL?.trim();
  if (openCodeModel) {
    options.push({
      id: openCodeModel,
      provider: "opencode",
      providerLabel: "OpenCode Zen",
      label: `OpenCode · ${openCodeModel}`,
      description: "Model OpenCode Zen yang dikonfigurasi oleh administrator.",
      profile: "kustom",
      configured: Boolean(providerKey("opencode")),
    });
  }

  return options;
}

export interface CustomAIConfig {
  providerName: string;
  baseUrl: string;
  apiKey: string;
  model: string;
}

export function parseCustomAIConfig(raw?: string | null): CustomAIConfig | null {
  if (!raw || typeof raw !== "string") return null;
  try {
    const trimmed = raw.trim();
    if (!trimmed.startsWith("{")) return null;
    const parsed = JSON.parse(trimmed);
    if (parsed && typeof parsed === "object" && parsed.baseUrl && parsed.model) {
      return {
        providerName: String(parsed.providerName || parsed.provider || "Custom AI").trim(),
        baseUrl: String(parsed.baseUrl).trim().replace(/\/chat\/completions\/?$/i, "").replace(/\/$/, ""),
        apiKey: String(parsed.apiKey || "").trim().replace(/^Bearer\s+/i, "").replace(/^["']|["']$/g, ""),
        model: String(parsed.model).trim(),
      };
    }
  } catch {
    // raw might not be a valid JSON
  }
  return null;
}

function normalizeLegacyModel(model?: string | null): string | null {
  const value = model?.trim();
  if (!value) return null;
  if (/gemini|antigravity/i.test(value) && !value.startsWith("gemini-")) {
    return process.env.GEMINI_MODEL?.trim() || "gemini-3.5-flash-lite";
  }
  if (/nvidia|nemotron/i.test(value) && !getAIModelOptions().some((item) => item.id === value)) {
    return process.env.NVIDIA_MODEL?.trim() || null;
  }
  return value;
}

export function resolveAIConfig(
  preferredModel?: string | null,
  customConfig?: CustomAIConfig | null
): AIExecutionConfig {
  // If custom config is provided and has baseUrl & model, use it directly (OpenAI-compatible)
  if (customConfig && customConfig.baseUrl && customConfig.model) {
    return {
      provider: "opencode",
      providerLabel: customConfig.providerName || "Custom AI Provider",
      model: customConfig.model.trim(),
      apiKey: customConfig.apiKey.trim().replace(/^Bearer\s+/i, "").replace(/^["']|["']$/g, ""),
      baseUrl: customConfig.baseUrl.trim().replace(/\/chat\/completions\/?$/i, "").replace(/\/$/, ""),
    };
  }

  const options = getAIModelOptions();
  const normalized = normalizeLegacyModel(preferredModel);
  const defaultGemini = process.env.GEMINI_MODEL?.trim() || "gemini-2.0-flash";
  const defaultOption = options.find((item) => item.id === defaultGemini);
  const selected =
    (normalized ? options.find((item) => item.id === normalized) : undefined) ??
    (defaultOption?.configured ? defaultOption : undefined) ??
    options.find((item) => item.configured) ??
    defaultOption ?? options[0];

  if (!selected) throw new Error("Tidak ada model AI yang tersedia");

  if (selected.provider === "gemini") {
    return {
      provider: selected.provider,
      providerLabel: selected.providerLabel,
      model: selected.id,
      apiKey: providerKey(selected.provider),
      baseUrl: "https://generativelanguage.googleapis.com/v1beta",
    };
  }

  return {
    provider: selected.provider,
    providerLabel: selected.providerLabel,
    model: selected.id,
    apiKey: providerKey(selected.provider),
    baseUrl: (selected.provider === "nvidia"
      ? process.env.NVIDIA_BASE_URL ?? "https://integrate.api.nvidia.com/v1"
      : process.env.OPENCODE_ZEN_BASE_URL ?? "https://opencode.ai/zen/v1"
    ).replace(/\/$/, ""),
  };
}

export function isAIModelConfigured(
  preferredModel?: string | null,
  customConfig?: CustomAIConfig | null
): boolean {
  if (customConfig && customConfig.baseUrl && customConfig.model) {
    return (
      customConfig.baseUrl.includes("localhost") ||
      customConfig.baseUrl.includes("127.0.0.1") ||
      Boolean(customConfig.apiKey)
    );
  }
  return Boolean(resolveAIConfig(preferredModel).apiKey);
}
