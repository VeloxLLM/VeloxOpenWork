declare const describe: (name: string, fn: () => void) => void;
declare const test: (name: string, fn: () => void) => void;
declare const expect: (value: unknown) => {
  toBe: (expected: unknown) => void;
};

import { resolveModelPickerEmptyState } from "./model-picker-modal";

describe("resolveModelPickerEmptyState", () => {
  test("offers local provider setup when no models are configured", () => {
    const state = resolveModelPickerEmptyState({
      providerGroupCount: 0,
      query: "",
    });

    expect(state?.messageKey).toBe("models.no_models_available");
    expect(state?.showConnectProvider).toBe(true);
  });
});
