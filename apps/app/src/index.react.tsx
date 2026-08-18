/** @jsxImportSource react */
import * as React from "react";
import ReactDOM from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, HashRouter } from "react-router";

import { TooltipProvider } from "@/components/ui/tooltip";
import { getOpenWorkDeployment } from "./app/lib/openwork-deployment";
import { readOpencodeConfig, writeOpencodeConfig, providerGatewayUrl } from "./app/lib/desktop";
import { DEFAULT_PROVIDER_PRESETS, buildProviderPresetConfig, originalProviderBaseUrl } from "./app/provider-catalog";
import { bootstrapTheme } from "./app/theme";
import { isDesktopRuntime } from "./app/utils";
import { initLocale } from "./i18n";
import { getReactQueryClient } from "./react-app/infra/query-client";
import {
  createDefaultPlatform,
  PlatformProvider,
} from "./react-app/kernel/platform";
import { AppProviders } from "./react-app/shell/providers";
import { AppRoot } from "./react-app/shell/app-root";
import { setWebNotificationHandler } from "./react-app/shell/desktop-notifications";
import { startDeepLinkBridge } from "./react-app/shell/startup-deep-links";
import "./app/index.css";

bootstrapTheme();
initLocale();
startDeepLinkBridge();

if (isDesktopRuntime()) {
  try {
    const current = await readOpencodeConfig("global", "");
    const config = current.content?.trim() ? JSON.parse(current.content) as Record<string, unknown> : {};
    const providers = config.provider && typeof config.provider === "object"
      ? { ...(config.provider as Record<string, unknown>) }
      : {};
    const defaultsSeededKey = "veloxopenwork.providers.seeded.v1";
    const shouldSeedDefaults = window.localStorage.getItem(defaultsSeededKey) !== "true";
    let changed = false;
    if (shouldSeedDefaults) {
      for (const preset of DEFAULT_PROVIDER_PRESETS) {
        if (!providers[preset.id]) {
          providers[preset.id] = buildProviderPresetConfig(preset, null);
          changed = true;
        }
      }
    }
    for (const [providerId, providerValue] of Object.entries(providers)) {
      if (!providerValue || typeof providerValue !== "object") continue;
      const provider = { ...(providerValue as Record<string, unknown>) };
      const options = provider.options && typeof provider.options === "object"
        ? { ...(provider.options as Record<string, unknown>) }
        : {};
      const configuredBaseUrl = typeof options.baseURL === "string" ? options.baseURL : "";
      const preset = DEFAULT_PROVIDER_PRESETS.find((item) => item.id === providerId);
      const originalBaseUrl = originalProviderBaseUrl(configuredBaseUrl || preset?.baseUrl || "");
      if (!originalBaseUrl) continue;
      const gatewayUrl = await providerGatewayUrl({ providerId, baseUrl: originalBaseUrl });
      if (gatewayUrl && options.baseURL !== gatewayUrl) {
        options.baseURL = gatewayUrl;
        provider.options = options;
        providers[providerId] = provider;
        changed = true;
      }
    }
    if (changed) {
      config.provider = providers;
      await writeOpencodeConfig("global", "", `${JSON.stringify(config, null, 2)}\n`);
    }
    if (shouldSeedDefaults) window.localStorage.setItem(defaultsSeededKey, "true");
  } catch (error) {
    console.warn("Unable to seed default local providers", error);
  }
}

const root = document.getElementById("root");

if (!root) {
  throw new Error("Root element not found");
}

root.dataset.openworkDeployment = getOpenWorkDeployment();

const platform = createDefaultPlatform();
setWebNotificationHandler(platform.notify);
const queryClient = getReactQueryClient();
const Router = isDesktopRuntime() ? HashRouter : BrowserRouter;

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <PlatformProvider value={platform}>
          <AppProviders>
            <Router>
              <AppRoot />
            </Router>
          </AppProviders>
        </PlatformProvider>
      </TooltipProvider>
    </QueryClientProvider>
  </React.StrictMode>,
);
