import { describe, expect, test } from "bun:test";

import { mergeRuntimeProviderUpdate } from "./runtime-opencode-config-store.js";

describe("mergeRuntimeProviderUpdate", () => {
  const localProvider = { npm: "@ai-sdk/openai-compatible", name: "Custom provider" };
  const cloud = { npm: "@ai-sdk/openai-compatible", name: "Cloud Provider" };

  test("upserts new providers and keeps existing ones", () => {
    expect(mergeRuntimeProviderUpdate({ custom: localProvider }, { lpr_x: cloud })).toEqual({
      custom: localProvider,
      lpr_x: cloud,
    });
  });

  test("replaces an existing provider wholesale", () => {
    const next = { ...cloud, name: "Renamed" };
    expect(mergeRuntimeProviderUpdate({ lpr_x: cloud }, { lpr_x: next })).toEqual({ lpr_x: next });
  });

  test("null deletes a provider without touching others", () => {
    expect(mergeRuntimeProviderUpdate({ custom: localProvider, lpr_x: cloud }, { lpr_x: null })).toEqual({
      custom: localProvider,
    });
  });

  test("returns undefined when the map empties", () => {
    expect(mergeRuntimeProviderUpdate({ lpr_x: cloud }, { lpr_x: null })).toBeUndefined();
  });

  test("ignores non-record, non-null values", () => {
    expect(mergeRuntimeProviderUpdate({ custom: localProvider }, { bad: "string", worse: 42 })).toEqual({
      custom: localProvider,
    });
  });

  test("deleting a missing provider is a no-op", () => {
    expect(mergeRuntimeProviderUpdate({ custom: localProvider }, { lpr_missing: null })).toEqual({ custom: localProvider });
  });
});
