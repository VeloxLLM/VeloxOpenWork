import { describe, expect, test } from "bun:test";

import {
  DEFAULT_PROVIDER_PRESETS,
  OPTIONAL_PROVIDER_PRESETS,
  buildProviderPresetConfig,
  originalProviderBaseUrl,
} from "../src/app/provider-catalog";

describe("local provider catalog", () => {
  test("ships only Zen and Kilo as default providers", () => {
    expect(DEFAULT_PROVIDER_PRESETS.map((provider) => provider.id)).toEqual(["opencode", "kilo"]);
    expect(DEFAULT_PROVIDER_PRESETS.find((provider) => provider.id === "kilo")?.modelIds).toEqual(["kilo-auto/free"]);
    expect(OPTIONAL_PROVIDER_PRESETS.map((provider) => provider.id)).toEqual(["openrouter", "google"]);
    expect(buildProviderPresetConfig(DEFAULT_PROVIDER_PRESETS[0], null).options.apiKey)
      .toBe("${VELOXOPENWORK_PROVIDER_OPENCODE_API_KEY}");
    expect(buildProviderPresetConfig(DEFAULT_PROVIDER_PRESETS[1], null).options.apiKey).toBeUndefined();
  });

  test("migrates legacy gateway URLs and accepts registered gateway URLs", () => {
    const legacy = "http://127.0.0.1:4311/provider/kilo?target=https%3A%2F%2Fapi.kilo.ai%2Fapi%2Fgateway";
    expect(originalProviderBaseUrl(legacy)).toBe("https://api.kilo.ai/api/gateway");
    const registered = "http://127.0.0.1:4311/token/provider/kilo/https%3A%2F%2Fapi.kilo.ai%2Fapi%2Fgateway";
    expect(originalProviderBaseUrl(registered)).toBe("https://api.kilo.ai/api/gateway");
    expect(buildProviderPresetConfig(DEFAULT_PROVIDER_PRESETS[1], registered).options.baseURL).toBe(registered);
  });
});
