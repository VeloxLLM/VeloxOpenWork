/** @jsxImportSource react */

import { useEffect, type ReactNode } from "react";

import { Toaster } from "@/components/ui/sonner";
import { isWebDeployment } from "@/app/lib/openwork-deployment";
import { hydrateOpenworkServerSettingsFromEnv } from "@/app/lib/openwork-server";
import { isDesktopRuntime } from "@/app/utils";
import { LocalProvider } from "@/react-app/kernel/local-provider";
import { ServerProvider } from "@/react-app/kernel/server-provider";
import { BootStateProvider } from "./boot-state";
import { DesktopRuntimeBoot } from "./desktop-runtime-boot";
import { startDebugLogger, stopDebugLogger } from "./debug-logger";
import { resolveOpenworkConnection } from "./openwork-connection";
import { ReloadCoordinatorProvider } from "./reload-coordinator";

function resolveDefaultServerUrl(): string {
  if (isDesktopRuntime()) return "http://127.0.0.1:4096";

  const openworkUrl =
    typeof import.meta.env?.VITE_OPENWORK_URL === "string"
      ? import.meta.env.VITE_OPENWORK_URL.trim()
      : "";
  if (openworkUrl) return `${openworkUrl.replace(/\/+$/, "")}/opencode`;

  if (isWebDeployment() && import.meta.env.PROD && typeof window !== "undefined") {
    return `${window.location.origin}/opencode`;
  }

  const envUrl =
    typeof import.meta.env?.VITE_OPENCODE_URL === "string"
      ? import.meta.env.VITE_OPENCODE_URL.trim()
      : "";
  return envUrl || "http://127.0.0.1:4096";
}

export function AppProviders({ children }: { children: ReactNode }) {
  hydrateOpenworkServerSettingsFromEnv();

  useEffect(() => {
    startDebugLogger({
      serverUrl: async () => (await resolveOpenworkConnection()).normalizedBaseUrl,
    });
    return () => stopDebugLogger();
  }, []);

  return (
    <BootStateProvider>
      <ServerProvider defaultUrl={resolveDefaultServerUrl()}>
        <DesktopRuntimeBoot />
        <LocalProvider>
          <ReloadCoordinatorProvider>
            {children}
          </ReloadCoordinatorProvider>
          <Toaster />
        </LocalProvider>
      </ServerProvider>
    </BootStateProvider>
  );
}
