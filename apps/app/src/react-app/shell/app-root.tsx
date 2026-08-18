/** @jsxImportSource react */

import { useEffect } from "react";
import { Navigate, Route, Routes } from "react-router";

import { initAnalytics } from "../../app/lib/analytics";
import { AppMenuProvider } from "./app-menu";
import { OpenworkControlProvider, OpenworkRouteControlActions } from "./control/control-provider";
import { OpenworkContextPublisher } from "./openwork-context-publisher";
import { SessionRoute } from "./session-route";
import { SettingsRoute } from "./settings-route";
import { ShellConfigProvider } from "./shell-config";
import { useDesktopFontZoomBehavior } from "./font-zoom";
import { useVisualViewportInset } from "../../hooks/use-visual-viewport-inset";
import { DevProfiler } from "./dev-profiler";

let appOpenedCaptured = false;

export function AppRoot() {
  useDesktopFontZoomBehavior();
  useVisualViewportInset();

  useEffect(() => {
    if (appOpenedCaptured) return;
    appOpenedCaptured = true;
    initAnalytics();
  }, []);

  return (
    <DevProfiler id="AppRoot">
      <ShellConfigProvider>
        <AppMenuProvider>
          <OpenworkControlProvider>
            <OpenworkRouteControlActions />
            <OpenworkContextPublisher />
            <Routes>
              <Route path="/session/*" element={<SessionRoute />} />
              <Route path="/settings/*" element={<SettingsRoute />} />
              <Route path="*" element={<Navigate to="/session" replace />} />
            </Routes>
          </OpenworkControlProvider>
        </AppMenuProvider>
      </ShellConfigProvider>
    </DevProfiler>
  );
}
