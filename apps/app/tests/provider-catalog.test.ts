import { describe, expect, test } from "bun:test";

import {
  DEFAULT_PROVIDER_PRESETS,
  OPTIONAL_PROVIDER_PRESETS,
  buildProviderPresetConfig,
  providerGatewayBaseUrl,
} from "../src/app/provider-catalog";

describe("local provider catalog", () => {
  test("ships only Zen and Kilo as default providers", () => {
    expect(DEFAULT_PROVIDER_PRESETS.map((provider) => provider.id)).toEqual(["opencode", "kilo"]);
    expect(DEFAULT_PROVIDER_PRESETS.find((provider) => provider.id === "kilo")?.modelIds).toEqual(["kilo-auto/free"]);
    expect(OPTIONAL_PROVIDER_PRESETS.map((provider) => provider.id)).toEqual(["openrouter", "google"]);
  });

  test("routes provider configuration through the loopback gateway", () => {
    const url = providerGatewayBaseUrl("http://127.0.0.1:4311", "kilo", "https://api.kilo.ai/api/gateway");
    expect(url).toBe("http://127.0.0.1:4311/provider/kilo?target=https%3A%2F%2Fapi.kilo.ai%2Fapi%2Fgateway");
    expect(buildProviderPresetConfig(DEFAULT_PROVIDER_PRESETS[1], "http://127.0.0.1:4311").options.baseURL).toBe(url);
  });
});
