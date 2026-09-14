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
    id: "gemini-3.5-flash-lite",
    label: "Gemini 3.5 Flash-Lite",
    description: "Paling cepat dan hemat untuk analisis ulasan dalam jumlah besar.",
    profile: "cepat" as const,
  },
  {
    id: "gemini-3.5-flash",
    label: "Gemini 3.5 Flash",
    description: "Rekomendasi untuk akurasi lebih tinggi dengan latensi tetap rendah.",
    profile: "seimbang" as const,
  },
  {
    id: "gemini-3.6-flash",
    label: "Gemini 3.6 Flash",
    description: "Keseimbangan kecepatan dan kedalaman analisis.",
    profile: "seimbang" as const,
  },
  {
    id: "gemini-3.8-flash",
    label: "Gemini 3.8 Flash",
    description: "Kemampuan analisis lebih tinggi untuk ulasan yang kompleks.",
    profile: "mendalam" as const,
  },
];

function providerKey(provider: AIProvider): string {
  if (provider === "gemini") return process.env.GEMINI_API_KEY ?? "";
  if (provider === "nvidia") return process.env.NVIDIA_API_KEY ?? "";
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
        providerName: String(parsed.providerName || parsed.provider || "Custom AI"),
        baseUrl: String(parsed.baseUrl).replace(/\/$/, ""),
        apiKey: String(parsed.apiKey || ""),
        model: String(parsed.model),
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
      model: customConfig.model,
      apiKey: customConfig.apiKey || "",
      baseUrl: customConfig.baseUrl.replace(/\/$/, ""),
    };
  }

  const options = getAIModelOptions();
  const normalized = normalizeLegacyModel(preferredModel);
  const defaultGemini = process.env.GEMINI_MODEL?.trim() || "gemini-3.5-flash-lite";
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
