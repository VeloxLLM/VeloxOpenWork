/** @jsxImportSource react */
import * as React from "react";
import ReactDOM from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, HashRouter } from "react-router";

import { TooltipProvider } from "@/components/ui/tooltip";
import { initializeDenBootstrapConfig } from "./app/lib/den";
import { getOpenWorkDeployment } from "./app/lib/openwork-deployment";
import { readOpencodeConfig, writeOpencodeConfig, providerGatewayUrl } from "./app/lib/desktop";
import { DEFAULT_PROVIDER_PRESETS, buildProviderPresetConfig } from "./app/provider-catalog";
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
await initializeDenBootstrapConfig();

if (isDesktopRuntime()) {
  try {
    const current = await readOpencodeConfig("global", "");
    const config = current.content?.trim() ? JSON.parse(current.content) as Record<string, unknown> : {};
    const providers = config.provider && typeof config.provider === "object"
      ? { ...(config.provider as Record<string, unknown>) }
      : {};
    const gatewayUrl = await providerGatewayUrl();
    let changed = false;
    for (const preset of DEFAULT_PROVIDER_PRESETS) {
      if (providers[preset.id]) continue;
      providers[preset.id] = buildProviderPresetConfig(preset, gatewayUrl);
      changed = true;
    }
    if (changed) {
      config.provider = providers;
      await writeOpencodeConfig("global", "", `${JSON.stringify(config, null, 2)}\n`);
    }
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
