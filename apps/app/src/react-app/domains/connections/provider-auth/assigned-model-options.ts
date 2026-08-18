import type { ModelOption } from "@/app/types";

export function mergeModelOptions(
  primary: readonly ModelOption[],
  fallback: readonly ModelOption[],
): ModelOption[] {
  const merged = new Map<string, ModelOption>();
  for (const option of fallback) {
    merged.set(`${option.providerID}:${option.modelID}`, option);
  }
  for (const option of primary) {
    merged.set(`${option.providerID}:${option.modelID}`, option);
  }
  return [...merged.values()];
}
