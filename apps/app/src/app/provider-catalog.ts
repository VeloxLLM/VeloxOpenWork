export type ProviderPreset = {
  id: string;
  name: string;
  baseUrl: string;
  modelIds: string[];
  description: string;
  requiresApiKey: boolean;
};

export const DEFAULT_PROVIDER_PRESETS: ProviderPreset[] = [
  {
    id: "opencode",
    name: "OpenCode Zen",
    baseUrl: "https://opencode.ai/zen/v1",
    modelIds: ["big-pickle", "minimax-m2.5-free", "nemotron-3-super-free"],
    description: "OpenCode 官方精选模型，免费模型和额度以官方状态为准。",
    requiresApiKey: true,
  },
  {
    id: "kilo",
    name: "Kilo Auto Free",
    baseUrl: "https://api.kilo.ai/api/gateway",
    modelIds: ["kilo-auto/free"],
    description: "Kilo 免费自动路由，可能受限流和数据策略影响。",
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
    requiresApiKey: true,
  },
  {
    id: "google",
    name: "Google Gemini",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta",
    modelIds: ["gemini-2.5-flash"],
    description: "Google Gemini API，需要官方 API Key 和免费额度。",
    requiresApiKey: true,
  },
];

export function providerPresetById(id: string): ProviderPreset | null {
  return [...DEFAULT_PROVIDER_PRESETS, ...OPTIONAL_PROVIDER_PRESETS]
    .find((preset) => preset.id === id) ?? null;
}

export function providerGatewayBaseUrl(gatewayUrl: string | null, providerId: string, target: string): string {
  if (!gatewayUrl) return target.replace(/\/$/, "");
  const url = new URL(`/provider/${encodeURIComponent(providerId)}`, gatewayUrl);
  url.searchParams.set("target", target.replace(/\/$/, ""));
  return url.toString();
}

export function buildProviderPresetConfig(preset: ProviderPreset, gatewayUrl: string | null) {
  return {
    name: preset.name,
    options: {
      baseURL: providerGatewayBaseUrl(gatewayUrl, preset.id, preset.baseUrl),
    },
    models: Object.fromEntries(preset.modelIds.map((modelId) => [modelId, { name: modelId }])),
  };
}
