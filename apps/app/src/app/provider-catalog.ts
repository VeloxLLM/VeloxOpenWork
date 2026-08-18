export type ProviderPreset = {
  id: string;
  name: string;
  baseUrl: string;
  modelIds: string[];
  description: string;
  descriptionEn: string;
  requiresApiKey: boolean;
};

export const DEFAULT_PROVIDER_PRESETS: ProviderPreset[] = [
  {
    id: "opencode",
    name: "OpenCode Zen",
    baseUrl: "https://opencode.ai/zen/v1",
    modelIds: ["big-pickle", "minimax-m2.5-free", "nemotron-3-super-free"],
    description: "OpenCode 官方精选模型，免费模型和额度以官方状态为准。",
    descriptionEn: "Official OpenCode models. Free availability and quotas are determined by OpenCode.",
    requiresApiKey: true,
  },
  {
    id: "kilo",
    name: "Kilo Auto Free",
    baseUrl: "https://api.kilo.ai/api/gateway",
    modelIds: ["kilo-auto/free"],
    description: "Kilo 免费自动路由，可能受限流和数据策略影响。",
    descriptionEn: "Kilo's free auto route is subject to IP rate limits and data processing policies.",
    requiresApiKey: false,
  },
];

export const OPTIONAL_PROVIDER_PRESETS: ProviderPreset[] = [
  {
    id: "openrouter",
    name: "OpenRouter Free",
    baseUrl: "https://openrouter.ai/api/v1",
    modelIds: ["openrouter/free"],
    description: "OpenRouter 免费模型路由，需要 API Key。",
    descriptionEn: "OpenRouter's free model route requires your own API key.",
    requiresApiKey: true,
  },
  {
    id: "google",
    name: "Google Gemini",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta",
    modelIds: ["gemini-2.5-flash"],
    description: "Google Gemini API，需要官方 API Key 和免费额度。",
    descriptionEn: "Google Gemini API requires your own API key and is subject to Google's free-tier limits.",
    requiresApiKey: true,
  },
];

export function providerPresetById(id: string): ProviderPreset | null {
  return [...DEFAULT_PROVIDER_PRESETS, ...OPTIONAL_PROVIDER_PRESETS]
    .find((preset) => preset.id === id) ?? null;
}

export function originalProviderBaseUrl(baseUrl: string): string {
  const normalized = baseUrl.trim().replace(/\/$/, "");
  try {
    const url = new URL(normalized);
    const legacyTarget = url.searchParams.get("target");
    if (legacyTarget) return new URL(legacyTarget).toString().replace(/\/$/, "");
    const route = url.pathname.match(/\/provider\/[^/]+\/([^/]+)/);
    if (route?.[1]) {
      const pathTarget = decodeURIComponent(route[1]);
      if (/^https?:\/\//.test(pathTarget)) return new URL(pathTarget).toString().replace(/\/$/, "");
    }
    return normalized;
  } catch {
    return normalized;
  }
}

export function buildProviderPresetConfig(preset: ProviderPreset, gatewayUrl: string | null) {
  const options: Record<string, string> = {
    baseURL: gatewayUrl ?? preset.baseUrl,
  };
  if (preset.requiresApiKey) {
    const safeId = preset.id.toUpperCase().replace(/[^A-Z0-9]+/g, "_");
    options.apiKey = `\${VELOXOPENWORK_PROVIDER_${safeId}_API_KEY}`;
  }
  return {
    name: preset.name,
    options,
    models: Object.fromEntries(preset.modelIds.map((modelId) => [modelId, { name: modelId }])),
  };
}
