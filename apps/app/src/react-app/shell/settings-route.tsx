/** @jsxImportSource react */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Navigate, useLocation, useNavigate, useParams } from "react-router";
import { toast } from "@/components/ui/sonner";

import {
  SUGGESTED_PLUGINS,
  filterOpenWorkExtensionCatalogForPlatform,
  resolveOpenWorkExtensionCatalogPlatform,
} from "@/app/constants";
import type { EnablementContext } from "@/app/enablement";
import { createClient, unwrap } from "@/app/lib/opencode";
import {
  createOpenworkServerClient,
  isLoopbackOpenworkServerUrl,
  readOpenworkServerSettings,
  type OpenworkServerCapabilities,
  type OpenworkServerClient,
  type OpenworkWorkspaceInfo,
} from "@/app/lib/openwork-server";
import { buildOpenworkEnvRuntimeKey } from "@/app/lib/openwork-env-runtime";
import {
  getInitialThemeMode,
  setThemeMode as setAppThemeMode,
  type ThemeMode,
} from "@/app/theme";
import type {
  Client,
  ProviderListItem,
  SettingsTab,
  WorkspaceConnectionState,
  WorkspaceDisplay,
  WorkspaceSessionGroup,
} from "@/app/types";
import { getWorkspaceTaskLoadErrorDisplay } from "@/app/utils";
import { currentLocale, t, setLocale, type Language } from "@/i18n";
import { useModelPicker } from "@/react-app/domains/session/modals/use-model-picker";
import {
  type RouteWorkspace,
  type RouteSession,
  describeRouteError,
  downloadWorkspaceJson,
  getSessionStatus,
  isActiveSessionStatus,
  mapDesktopWorkspace,
  mergeRouteWorkspaces,
  orderRouteWorkspaces,
  toSessionGroups,
  workspaceExportFilename,
  workspaceLabel,
} from "@/react-app/shell/route-workspaces";
import { createConnectionsStore, useConnectionsStoreSnapshot } from "@/react-app/domains/connections/store";
import { createOpenworkServerStore, useOpenworkServerStoreSnapshot } from "@/react-app/domains/connections/openwork-server-store";
import ProviderAuthModal, { type ManualProviderInput } from "@/react-app/domains/connections/provider-auth/provider-auth-modal";
import ConnectionsModals from "@/react-app/domains/connections/modals";
import { AiSettingsView } from "@/react-app/domains/settings/pages/ai-view";
// Side-effect imports: register extension config components into the registry.
import "@/react-app/domains/settings/computer-use-config";
import "@/react-app/domains/settings/browser-extension-config";
import "@/react-app/domains/settings/openwork-voice-config";
import { useSettingsExtensionController } from "@/react-app/domains/settings/settings-extension-controller";
import { buildExtensionItems } from "@/react-app/domains/settings/extension-items";
import { isOpenWorkExtensionEnabled, OPENWORK_EXTENSION_STATE_CHANGED } from "@/react-app/domains/settings/extension-state";
import { PreferencesView } from "@/react-app/domains/settings/pages/preferences-view";
import { GeneralSettingsView } from "@/react-app/domains/settings/pages/general-view";
import { AuthorizedFoldersPanel } from "@/react-app/domains/settings/panels/authorized-folders-panel";
import { SettingsStack } from "@/react-app/domains/settings/settings-section";
import { AdvancedView } from "@/react-app/domains/settings/pages/advanced-view";
import { AppearanceView } from "@/react-app/domains/settings/pages/appearance-view";
import { useFeatureFlagsPreferences } from "@/react-app/domains/settings/state/feature-flags-preferences";
import { EnvironmentView } from "@/react-app/domains/settings/pages/environment-view";
import { ExtensionsView, type ExtensionsSection } from "@/react-app/domains/settings/pages/extensions-view";
import { McpView } from "@/react-app/domains/settings/pages/mcp-view";
import { useBootState } from "./boot-state";
import { SettingsShell } from "@/react-app/domains/settings/shell/settings-shell";
import { SettingsContent } from "@/react-app/domains/settings/shell/panel";
import { createExtensionsStore } from "@/react-app/domains/settings/state/extensions-store";
import { usePlatform } from "@/react-app/kernel/platform";
import { useLocal } from "@/react-app/kernel/local-provider";
import {
  openworkServerInfo,
  openworkServerRestart,
  engineStart,
  engineRestart,
  resolveWorkspaceListSelectedId,
  workspaceBootstrap,
  workspaceForget,
  workspaceSetRuntimeActive,
  workspaceSetSelected,
  desktopBridge,
  readOpencodeConfig,
  writeOpencodeConfig,
  providerCredentialsGet,
  providerCredentialsSet,
  providerCredentialsDelete,
  providerGatewayUrl,
  providerGatewayTest,
  type WorkspaceInfo,
  type WorkspaceList,
  revealDesktopItemInDir,
} from "@/app/lib/desktop";
import { originalProviderBaseUrl } from "@/app/provider-catalog";
import {
  isDesktopRuntime,
  isElectronRuntime,
  isMacPlatform,
  normalizeDirectoryPath,
  resolveModelDisplayName,
  resolveProviderDisplayName,
  safeStringify,
} from "@/app/utils";
import { RenameWorkspaceModal } from "@/react-app/domains/workspace/rename-workspace-modal";
import { ShareWorkspaceModal } from "@/react-app/domains/workspace/share-workspace-modal";
import { useShareWorkspaceState } from "@/react-app/domains/workspace/share-workspace-state";
import { ModelPickerModal } from "@/react-app/domains/session/modals/model-picker-modal";
import type { ModelRef } from "@/app/types";
import { workspaceSwatchColor } from "@/react-app/domains/session/sidebar/utils";
import { recordInspectorEvent } from "../../app/lib/app-inspector";
import {
  ensureDesktopLocalOpenworkConnection,
  shouldAttemptDesktopLocalReconnect,
} from "./desktop-local-openwork";
import { reloadEngineWithDesktopFallback } from "./engine-reload-escalation";
import { resolveOpenworkConnection } from "./openwork-connection";
import { abortSessionSafe, listCommands } from "@/app/lib/opencode-session";
import { notifyAlert } from "./notifications";
import { useReloadCoordinator } from "./reload-coordinator";
import { CommandPalette } from "./command-palette";
import { buildCommandPaletteSessions } from "./command-palette-sessions";
import { useCommandPaletteShortcut } from "./use-shell-shortcuts";
import { buildFeedbackUrl } from "@/app/lib/feedback";
import { readActiveWorkspaceId, writeActiveWorkspaceId } from "./session-memory";
import {
  globalExtensionsRoute,
  workspaceExtensionsRoute,
  workspaceSessionRoute,
  workspaceSettingsRoute,
} from "./workspace-routes";
import { getReactQueryClient } from "@/react-app/infra/query-client";
import { refreshProviderListQueries } from "@/react-app/infra/provider-list-query";
import {
  createWorkspaceServerClientResolver,
  useWorkspaceServerClient,
} from "@/react-app/infra/workspace-server-client";
import { OPENAI_IMAGE_EXTENSION_ID, OPENAI_IMAGE_MODEL } from "@/react-app/domains/settings/openai-image-extension";
import {
  libraryAgentsFromOpencode,
  libraryCommandsFromSlashOptions,
  type LibraryAgentItem,
  type LibraryCommandItem,
} from "@/react-app/domains/settings/library";

const ROUTE_OPENWORK_CAPABILITIES: OpenworkServerCapabilities = {
  skills: { read: true, write: true, source: "openwork" },
  plugins: { read: true, write: true },
  mcp: { read: true, write: true },
  commands: { read: true, write: true },
  config: { read: true, write: true },
};

async function reloadEngineOrRestartDesktop(
  client: Pick<OpenworkServerClient, "reloadEngine">,
  workspaceId: string,
  afterRestart?: () => Promise<void>,
): Promise<void> {
  const { restartedEngine } = await reloadEngineWithDesktopFallback(client, workspaceId);
  if (restartedEngine) {
    await afterRestart?.();
  }
}

function normalizeComputerUsePermissions(value: unknown) {
  if (typeof value !== "object" || value === null) return null;
  return {
    accessibility: "accessibility" in value && value.accessibility === true,
    screenRecording: "screenRecording" in value && value.screenRecording === true,
  };
}

function reconcileSelectedWorkspaceId(
  currentId: string,
  serverList: { activeId?: string | null },
  desktopList: WorkspaceList | null,
  workspaces: RouteWorkspace[],
) {
  const current = currentId.trim();
  const serverIds = new Set(workspaces.map((workspace) => workspace.id));
  if (current && serverIds.has(current)) return current;

  const desktopSelectedId = resolveWorkspaceListSelectedId(desktopList);
  const desktopSelected = desktopSelectedId
    ? desktopList?.workspaces?.find((workspace) => workspace.id === desktopSelectedId)
    : null;
  const currentDesktop = current
    ? desktopList?.workspaces?.find((workspace) => workspace.id === current)
    : null;
  const selectedPath = normalizeDirectoryPath((currentDesktop ?? desktopSelected)?.path ?? "");

  if (selectedPath) {
    const pathMatch = workspaces.find(
      (workspace) => normalizeDirectoryPath(workspace.path ?? "") === selectedPath,
    );
    if (pathMatch) return pathMatch.id;
  }

  return serverList.activeId?.trim() || desktopSelectedId || workspaces[0]?.id || "";
}

const SETTINGS_HIDE_TITLEBAR_KEY = "openwork.react.settings.hide-titlebar";

export function parseSettingsPath(pathname: string): {
  tab: SettingsTab;
  redirectPath: string | null;
  extensionsSection?: ExtensionsSection;
  extensionDetailId?: string;
} {
  const trimmed = pathname
    .replace(/^\/workspace\/[^/]+\/settings\/?/, "")
    .replace(/^\/settings\/?/, "")
    .replace(/^\/+|\/+$/g, "");
  if (!trimmed) {
    return { tab: "general", redirectPath: "general" };
  }

  const [head, tail] = trimmed.split("/");
  switch (head) {
    case "general":
    case "ai":
    case "preferences":
    case "permissions":
    case "advanced":
    case "appearance":
    case "environment":
    case "debug":
      return { tab: "advanced", redirectPath: "advanced" };
    case "connect":
      return { tab: "extensions", redirectPath: "extensions", extensionsSection: "all" };
    case "skills":
      return { tab: "extensions", redirectPath: "extensions/skills", extensionsSection: "skills" };
    case "mcp":
      return { tab: "extensions", redirectPath: "extensions/mcps", extensionsSection: "mcps" };
    case "extensions":
      if (tail === "mcp") return { tab: "extensions", redirectPath: "extensions/mcps", extensionsSection: "mcps" };
      if (
        tail === "apps"
        || tail === "connections"
        || tail === "mcps"
        || tail === "skills"
        || tail === "commands"
        || tail === "agents"
        || tail === "plugins"
        || tail === "needs-sign-in"
        || tail === "needs-admin-setup"
        || tail === "ready"
      ) {
        return { tab: "extensions", redirectPath: null, extensionsSection: tail };
      }
      if (tail) {
        return {
          tab: "extensions",
          redirectPath: null,
          extensionsSection: "all",
          extensionDetailId: decodeURIComponent(tail),
        };
      }
      return { tab: "extensions", redirectPath: null, extensionsSection: "all" };
    default:
      return { tab: "general", redirectPath: "general" };
  }
}

export function parseExtensionsPath(pathname: string): ReturnType<typeof parseSettingsPath> {
  const extensionPath = pathname
    .replace(/^\/workspace\/[^/]+\/extensions\/?/, "")
    .replace(/^\/extensions\/?/, "")
    .replace(/^\/+|\/+$/g, "");
  return parseSettingsPath(`/settings/extensions${extensionPath ? `/${extensionPath}` : ""}`);
}

function readStoredBoolean(key: string, fallback: boolean) {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (raw == null) return fallback;
    return raw === "1";
  } catch {
    return fallback;
  }
}

function writeStoredBoolean(key: string, value: boolean) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, value ? "1" : "0");
  } catch {
    // ignore persistence failures
  }
}

function readNavigationWorkspaceId(state: unknown): string | null {
  if (!state || typeof state !== "object") return null;
  const value = (state as { workspaceId?: unknown }).workspaceId;
  return typeof value === "string" ? value.trim() || null : null;
}

function readNavigationSessionId(state: unknown): string | null {
  if (!state || typeof state !== "object") return null;
  const value = (state as { sessionId?: unknown }).sessionId;
  return typeof value === "string" ? value.trim() || null : null;
}

function findSessionWorkspaceId(
  sessionId: string | null,
  entries: Array<{ workspaceId: string; sessions: any[] }>,
) {
  const id = sessionId?.trim();
  if (!id) return null;
  return entries.find((entry) => entry.sessions.some((session) => session?.id === id))?.workspaceId ?? null;
}

export function settingsPathForRoute(route: ReturnType<typeof parseSettingsPath>) {
  if (route.tab === "extensions" && route.extensionDetailId) {
    return `extensions/${encodeURIComponent(route.extensionDetailId)}`;
  }
  if (route.tab === "extensions" && route.extensionsSection && route.extensionsSection !== "all") {
    return `extensions/${route.extensionsSection}`;
  }
  return route.tab;
}

export function extensionsPathForRoute(route: ReturnType<typeof parseSettingsPath>) {
  if (route.extensionDetailId) {
    return encodeURIComponent(route.extensionDetailId);
  }
  if (route.extensionsSection && route.extensionsSection !== "all") {
    return route.extensionsSection;
  }
  return "";
}

export type SettingsSurfaceProps = {
  embedded?: boolean;
  standaloneExtensions?: boolean;
  initialPath?: string;
  workspaceId?: string;
  onClose?: () => void;
};

function SettingsRouteContent(props: SettingsSurfaceProps = {}) {
  const navigate = useNavigate();
  const location = useLocation();
  const params = useParams<{ workspaceId?: string }>();
  const routeWorkspaceId = props.workspaceId?.trim() || params.workspaceId?.trim() || "";
  const local = useLocal();
  const {
    continuousEngineEnabled,
    memoryEnabled,
    setContinuousEngine,
    toggleMemory,
  } = useFeatureFlagsPreferences();
  const platform = usePlatform();
  const allowLocalFeatures = useCallback(() => true, []);
  const reloadCoordinator = useReloadCoordinator();
  const [embeddedPath, setEmbeddedPath] = useState(props.initialPath ?? "general");
  const route = props.embedded
    ? parseSettingsPath(`/settings/${embeddedPath}`)
    : props.standaloneExtensions
      ? parseExtensionsPath(location.pathname)
      : parseSettingsPath(location.pathname);
  const navigationWorkspaceId = readNavigationWorkspaceId(location.state);
  const navigationSessionId = readNavigationSessionId(location.state);

  const [loading, setLoading] = useState(true);
  const [workspaces, setWorkspaces] = useState<RouteWorkspace[]>([]);
  const [sessionsByWorkspaceId, setSessionsByWorkspaceId] = useState<Record<string, RouteSession[]>>({});
  const [errorsByWorkspaceId, setErrorsByWorkspaceId] = useState<Record<string, string | null>>({});
  const [workspaceConnectionOverrides, setWorkspaceConnectionOverrides] = useState<Record<string, WorkspaceConnectionState>>({});
  const [legacySelectedWorkspaceId, setLegacySelectedWorkspaceId] = useState(() => navigationWorkspaceId ?? readActiveWorkspaceId() ?? "");
  const selectedWorkspaceId = routeWorkspaceId || legacySelectedWorkspaceId;

  useEffect(() => {
    if (!props.embedded || !route.redirectPath) return;
    setEmbeddedPath(route.redirectPath);
  }, [props.embedded, route.redirectPath]);

  const navigateSettingsPath = useCallback((path: string) => {
    if (props.embedded) {
      setEmbeddedPath(path);
      return;
    }
    if (props.standaloneExtensions) {
      const extensionPath = path.replace(/^extensions\/?/, "");
      navigate(
        selectedWorkspaceId
          ? workspaceExtensionsRoute(selectedWorkspaceId, extensionPath)
          : globalExtensionsRoute(extensionPath),
      );
      return;
    }
    navigate(selectedWorkspaceId ? workspaceSettingsRoute(selectedWorkspaceId, path) : `/settings/${path}`);
  }, [navigate, props.embedded, props.standaloneExtensions, selectedWorkspaceId]);
  const [baseUrl, setBaseUrl] = useState("");
  const [token, setToken] = useState("");
  const [openworkClient, setOpenworkClient] = useState<OpenworkServerClient | null>(null);
  const [activeClient, setActiveClient] = useState<Client | null>(null);
  const [busy, setBusy] = useState(false);
  const [busyLabel, setBusyLabel] = useState<string | null>(null);
  const [continuousEngineBusy, setContinuousEngineBusy] = useState(false);
  const workspacesRef = useRef<RouteWorkspace[]>([]);
  const refreshInFlightRef = useRef(false);
  const reconnectAttemptedWorkspaceIdRef = useRef("");
  const refreshMcpServersRef = useRef<(() => void | Promise<void>) | null>(null);
  const notifyMcpReloadingRef = useRef<(() => void) | null>(null);
  const pollMcpServersAfterReloadRef = useRef<(() => void | Promise<void>) | null>(null);
  const [providers, setProviders] = useState<ProviderListItem[]>([]);
  const [providerConnectedIds, setProviderConnectedIds] = useState<string[]>([]);
  const [editingProvider, setEditingProvider] = useState<Partial<ManualProviderInput> | null>(null);
  const [disabledProviders, setDisabledProviders] = useState<string[]>([]);
  const [providerModalOpen, setProviderModalOpen] = useState(false);
  const [providerBusy, setProviderBusy] = useState(false);
  const [providerError, setProviderError] = useState<string | null>(null);
  const [developerMode, setDeveloperMode] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem("openwork.developerMode") === "1";
  });
  const [themeMode, setThemeModeState] = useState<ThemeMode>(getInitialThemeMode);
  const [hideTitlebar, setHideTitlebar] = useState(() => readStoredBoolean(SETTINGS_HIDE_TITLEBAR_KEY, false));
  const [configActionStatus, setConfigActionStatus] = useState<string | null>(null);
  const [revealConfigBusy, setRevealConfigBusy] = useState(false);
  const [renameWorkspaceId, setRenameWorkspaceId] = useState<string | null>(null);
  const [renameWorkspaceTitle, setRenameWorkspaceTitle] = useState("");
  const [renameWorkspaceBusy, setRenameWorkspaceBusy] = useState(false);
  const [exportWorkspaceBusy, setExportWorkspaceBusy] = useState(false);
  const [autoCompactContext, setAutoCompactContext] = useState(true);
  const [autoCompactContextBusy, setAutoCompactContextBusy] = useState(false);
  const [autoCompactContextLoaded, setAutoCompactContextLoaded] = useState(false);
  const [imageExtensionBusy, setImageExtensionBusy] = useState(false);
  const [imageExtensionStatus, setImageExtensionStatus] = useState<string | null>(null);
  const [imageExtensionError, setImageExtensionError] = useState<string | null>(null);
  const [computerUsePermissions, setComputerUsePermissions] = useState<{ accessibility: boolean; screenRecording: boolean } | null>(null);
  const [extensionStateVersion, setExtensionStateVersion] = useState(0);
  const [imageGenerationBusy, setImageGenerationBusy] = useState(false);
  const [imageGenerationStatus, setImageGenerationStatus] = useState<string | null>(null);
  const [imageGenerationError, setImageGenerationError] = useState<string | null>(null);
  const [voiceBusy, setVoiceBusy] = useState(false);
  const [voiceStatus, setVoiceStatus] = useState<string | null>(null);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [userEnvKeys, setUserEnvKeys] = useState<string[]>([]);
  const emptyWorkspaceDisplay = useMemo<WorkspaceDisplay>(
    () => ({
      id: "",
      name: t("session.workspace_fallback"),
      path: "",
      preset: "starter",
      workspaceType: "local",
    }),
    [],
  );

  const routeStateRef = useRef({
    activeClient: null as Client | null,
    providerBaseUrl: "",
    selectedWorkspaceId: "",
    selectedWorkspaceRoot: "",
    selectedWorkspaceType: "local" as "local" | "remote",
    runtimeWorkspaceId: null as string | null,
    openworkServerClient: null as OpenworkServerClient | null,
    selectedWorkspaceOpenworkClient: null as OpenworkServerClient | null,
    openworkServerStatus: "disconnected" as "connected" | "disconnected",
    openworkServerCapabilities: null as OpenworkServerCapabilities | null,
    selectedWorkspaceDisplay: emptyWorkspaceDisplay as WorkspaceDisplay,
    providerItems: [] as ProviderListItem[],
    providerConnectedIds: [] as string[],
    disabledProviders: [] as string[],
    developerMode: false,
  });

  const selectedWorkspace = useMemo(
    () => workspaces.find((workspace) => workspace.id === selectedWorkspaceId) ?? (selectedWorkspaceId ? null : workspaces[0] ?? null),
    [selectedWorkspaceId, workspaces],
  );
  const workspaceConnectionStateById = useMemo(() => {
    const next: Record<string, WorkspaceConnectionState> = { ...workspaceConnectionOverrides };
    for (const workspace of workspaces) {
      if (workspace.workspaceType !== "remote") continue;
      const error = errorsByWorkspaceId[workspace.id]?.trim();
      if (!error || next[workspace.id]?.status === "connecting") continue;
      next[workspace.id] ??= {
        status: "error",
        message: getWorkspaceTaskLoadErrorDisplay(workspace, error).message || error,
        checkedAt: null,
      };
    }
    return next;
  }, [errorsByWorkspaceId, workspaceConnectionOverrides, workspaces]);
  const selectedWorkspaceRoot = selectedWorkspace?.path?.trim() || "";
  const selectedWorkspaceDisplay = useMemo<WorkspaceDisplay>(
    () =>
      selectedWorkspace
        ? {
            id: selectedWorkspace.id,
            name: selectedWorkspace.name ?? selectedWorkspace.displayNameResolved,
            path: selectedWorkspace.path ?? "",
            preset: "starter",
            workspaceType: selectedWorkspace.workspaceType ?? "local",
            displayName: selectedWorkspace.displayNameResolved,
            openworkWorkspaceName: selectedWorkspace.openworkWorkspaceName,
          }
        : emptyWorkspaceDisplay,
    [emptyWorkspaceDisplay, selectedWorkspace],
  );
  const workspaceServerClientResolver = useMemo(
    () => createWorkspaceServerClientResolver({ baseUrl, token }),
    [baseUrl, token],
  );
  const selectedWorkspaceEndpoint = useWorkspaceServerClient(selectedWorkspace, { baseUrl, token });
  const opencodeBaseUrl = selectedWorkspaceEndpoint?.opencodeBaseUrl ?? "";

  routeStateRef.current = {
    activeClient,
    providerBaseUrl: opencodeBaseUrl,
    selectedWorkspaceId,
    selectedWorkspaceRoot,
    selectedWorkspaceType: selectedWorkspace?.workspaceType ?? "local",
    runtimeWorkspaceId: selectedWorkspace?.id ?? null,
    openworkServerClient: openworkClient,
    selectedWorkspaceOpenworkClient: openworkClient,
    openworkServerStatus: openworkClient ? "connected" : "disconnected",
    openworkServerCapabilities: openworkClient ? ROUTE_OPENWORK_CAPABILITIES : null,
    selectedWorkspaceDisplay,
    providerItems: providers,
    providerConnectedIds,
    disabledProviders,
    developerMode,
  };

  const activeReloadBlockingSessions = useMemo(
    () =>
      Object.values(sessionsByWorkspaceId)
        .flat()
        .flatMap((session) => {
          if (!isActiveSessionStatus(getSessionStatus(session))) return [];
          const id = String(session?.id ?? "");
          if (!id) return [];
          return [{
            id,
            title:
              String(session?.title ?? session?.slug ?? session?.id ?? "").trim() ||
              t("session.untitled"),
          }];
        }),
    [sessionsByWorkspaceId],
  );

  const openworkServerStore = useMemo(
    () =>
      createOpenworkServerStore({
        startupPreference: () => {
          // In desktop mode, loopback URLs are ephemeral local runtime details.
          // Only non-loopback stored URLs indicate an explicit remote/manual
          // server connection preference.
          if (!isDesktopRuntime()) return "server";
          const stored = readOpenworkServerSettings();
          const storedUrl = stored.urlOverride?.trim() ?? "";
          return storedUrl && !isLoopbackOpenworkServerUrl(storedUrl) ? "server" : "local";
        },
        documentVisible: () => typeof document === "undefined" || document.visibilityState === "visible",
        developerMode: () => routeStateRef.current.developerMode,
        runtimeWorkspaceId: () => routeStateRef.current.runtimeWorkspaceId,
        activeClient: () => routeStateRef.current.activeClient,
        selectedWorkspaceDisplay: () => routeStateRef.current.selectedWorkspaceDisplay,
        restartLocalServer: async () => {
          if (!isDesktopRuntime()) return false;
          try {
            await openworkServerRestart({
              remoteAccessEnabled:
                readOpenworkServerSettings().remoteAccessEnabled === true,
            });
            return true;
          } catch {
            return false;
          }
        },
        createRemoteWorkspaceFlow: async () => false,
      }),
    [],
  );
  const connectionsStore = useMemo(
    () =>
      createConnectionsStore({
        client: () => routeStateRef.current.activeClient,
        setClient: setActiveClient,
        projectDir: () => routeStateRef.current.selectedWorkspaceRoot,
        selectedWorkspaceId: () => routeStateRef.current.selectedWorkspaceId,
        selectedWorkspaceRoot: () => routeStateRef.current.selectedWorkspaceRoot,
        workspaceType: () => routeStateRef.current.selectedWorkspaceType,
        openworkServer: openworkServerStore,
        runtimeWorkspaceId: () => routeStateRef.current.runtimeWorkspaceId,
        ensureRuntimeWorkspaceId: async () =>
          routeStateRef.current.runtimeWorkspaceId?.trim() ||
          routeStateRef.current.selectedWorkspaceId.trim() ||
          null,
        developerMode: () => routeStateRef.current.developerMode,
        markReloadRequired: reloadCoordinator.markReloadRequired,
      }),
    [openworkServerStore, reloadCoordinator.markReloadRequired],
  );
  refreshMcpServersRef.current = connectionsStore.refreshMcpServers;
  notifyMcpReloadingRef.current = connectionsStore.notifyMcpReloading;
  pollMcpServersAfterReloadRef.current = connectionsStore.pollMcpServersAfterReload;
  const extensionsStore = useMemo(
    () =>
      createExtensionsStore({
        client: () => routeStateRef.current.activeClient,
        projectDir: () => routeStateRef.current.selectedWorkspaceRoot,
        selectedWorkspaceId: () => routeStateRef.current.selectedWorkspaceId,
        selectedWorkspaceRoot: () => routeStateRef.current.selectedWorkspaceRoot,
        workspaceType: () => routeStateRef.current.selectedWorkspaceType,
        openworkServer: openworkServerStore,
        openworkServerConnection: () => ({
          openworkServerClient: routeStateRef.current.openworkServerClient,
          openworkServerStatus: routeStateRef.current.openworkServerStatus,
          openworkServerCapabilities: routeStateRef.current.openworkServerCapabilities,
        }),
        runtimeWorkspaceId: () => routeStateRef.current.runtimeWorkspaceId,
        ensureRuntimeWorkspaceId: async () =>
          routeStateRef.current.runtimeWorkspaceId?.trim() ||
          routeStateRef.current.selectedWorkspaceId.trim() ||
          null,
        setBusy,
        setBusyLabel,
        setBusyStartedAt: () => {},
        setError: (message) => {
          if (message) {
            toast.error(message);
          }
        },
        markReloadRequired: reloadCoordinator.markReloadRequired,
      }),
    [openworkServerStore, reloadCoordinator.markReloadRequired],
  );
  const openworkServerSnapshot = useOpenworkServerStoreSnapshot(openworkServerStore);
  const connectionsSnapshot = useConnectionsStoreSnapshot(connectionsStore);

  const openworkServerStatusForMcp = openworkServerSnapshot.openworkServerStatus;
  useEffect(() => {
    if (openworkServerStatusForMcp !== "connected") return;
    // The first MCP read races the openwork-server store's initial health
    // check (a fresh store always starts "disconnected"), so it falls back
    // to config files where server-runtime (config.remote) entries — notably
    // the cloud control MCP — don't exist. Without this re-read the built-in
    // cards show "Tap to connect" until the next full remount even though
    // the entries are configured and healthy.
    void connectionsStore.refreshMcpServers();
  }, [connectionsStore, openworkServerStatusForMcp]);

  const refreshLocalProviders = useCallback(async () => {
    const current = await readOpencodeConfig("global", "");
    let config: Record<string, unknown> = {};
    if (current.content?.trim()) {
      try {
        config = JSON.parse(current.content) as Record<string, unknown>;
      } catch {
        setProviders([]);
        setProviderConnectedIds([]);
        return;
      }
    }
    const providerMap = config.provider && typeof config.provider === "object"
      ? config.provider as Record<string, unknown>
      : {};
    const localProviders = Object.entries(providerMap).flatMap(([id, value]) => {
      if (!value || typeof value !== "object") return [];
      const provider = value as Record<string, unknown>;
      const rawModels = provider.models && typeof provider.models === "object"
        ? provider.models as Record<string, unknown>
        : {};
      const models = Object.fromEntries(Object.entries(rawModels).map(([modelId, model]) => [
        modelId,
        model && typeof model === "object" ? model : { name: modelId },
      ]));
      return [{
        id,
        name: typeof provider.name === "string" ? provider.name : id,
        source: "config",
        models,
      } as ProviderListItem];
    });
    setProviders(localProviders);
    setProviderConnectedIds(localProviders.map((provider) => provider.id));
    setDisabledProviders([]);
    await refreshProviderListQueries(getReactQueryClient());
  }, []);

  const handleOpenProviderAuth = useCallback(() => {
    setEditingProvider(null);
    setProviderError(null);
    setProviderModalOpen(true);
  }, []);

  const handleEditProvider = useCallback(async (providerId: string) => {
    const current = await readOpencodeConfig("global", "");
    const config = current.content?.trim() ? JSON.parse(current.content) as Record<string, unknown> : {};
    const providerMap = config.provider && typeof config.provider === "object"
      ? config.provider as Record<string, unknown>
      : {};
    const provider = providerMap[providerId];
    if (!provider || typeof provider !== "object") throw new Error(t("providers.unknown_provider"));
    const providerConfig = provider as Record<string, unknown>;
    const options = providerConfig.options && typeof providerConfig.options === "object"
      ? providerConfig.options as Record<string, unknown>
      : {};
    const models = providerConfig.models && typeof providerConfig.models === "object"
      ? Object.keys(providerConfig.models as Record<string, unknown>)
      : [];
    const credentials = await providerCredentialsGet(providerId)
      .catch(() => ({ hasApiKey: false, proxy: null }));
    setEditingProvider({
      id: providerId,
      name: typeof providerConfig.name === "string" ? providerConfig.name : providerId,
      baseUrl: originalProviderBaseUrl(typeof options.baseURL === "string" ? options.baseURL : ""),
      modelIds: models,
      proxyEnabled: Boolean(credentials.proxy),
      proxyUrl: credentials.proxy?.url ?? "",
      proxyUsername: credentials.proxy?.username ?? "",
      defaultModelId: local.prefs.defaultModel?.providerID === providerId
        ? local.prefs.defaultModel.modelID
        : models[0] ?? "",
    });
    setProviderError(null);
    setProviderModalOpen(true);
  }, [local.prefs.defaultModel]);

  const shareWorkspaceState = useShareWorkspaceState({
    workspaces,
    openworkServerHostInfo: openworkServerSnapshot.openworkServerHostInfo,
    openworkServerSettings: openworkServerSnapshot.openworkServerSettings,
    engineInfo: null,
    exportWorkspaceBusy,
    openLink: (url) => platform.openLink(url),
    workspaceLabel,
  });

  const workspaceSessionGroups = useMemo(
    // Settings has no per-workspace loading state; the empty set keeps the
    // previous behavior (error -> "error", otherwise "ready").
    () => toSessionGroups(workspaces, sessionsByWorkspaceId, errorsByWorkspaceId, new Set()),
    [errorsByWorkspaceId, sessionsByWorkspaceId, workspaces],
  );

  const runtimeWorkspaceId = selectedWorkspaceEndpoint?.workspaceId ?? selectedWorkspace?.id ?? null;
  routeStateRef.current.runtimeWorkspaceId = runtimeWorkspaceId;
  routeStateRef.current.selectedWorkspaceOpenworkClient = selectedWorkspaceEndpoint?.client ?? openworkClient;

  const opencodeClient = useMemo(() => {
    if (!selectedWorkspaceEndpoint || !selectedWorkspaceEndpoint.token) return null;
    return createClient(
      selectedWorkspaceEndpoint.opencodeBaseUrl,
      selectedWorkspaceRoot || undefined,
      {
        token: selectedWorkspaceEndpoint.token,
        mode: "openwork",
      },
    );
  }, [selectedWorkspaceEndpoint, selectedWorkspaceRoot]);

  useEffect(() => {
    setActiveClient(opencodeClient);
  }, [opencodeClient]);

  const [libraryCommands, setLibraryCommands] = useState<LibraryCommandItem[]>([]);
  const [libraryAgents, setLibraryAgents] = useState<LibraryAgentItem[]>([]);
  const loadLibraryLists = useCallback(async () => {
    if (opencodeClient) {
      try {
        const [commands, agents] = await Promise.all([
          listCommands(opencodeClient, selectedWorkspaceRoot || undefined),
          opencodeClient.app.agents()
            .then((result) => unwrap(result))
            .catch(() => []),
        ]);
        setLibraryCommands(libraryCommandsFromSlashOptions(commands));
        setLibraryAgents(libraryAgentsFromOpencode(Array.isArray(agents) ? agents : []));
      } catch {
        setLibraryCommands([]);
        setLibraryAgents([]);
      }
    } else {
      setLibraryCommands([]);
      setLibraryAgents([]);
    }
  }, [opencodeClient, selectedWorkspaceRoot]);
  useEffect(() => {
    void loadLibraryLists();
  }, [loadLibraryLists]);

  const handleModelPickerLoadError = useCallback((error: unknown) => {
    toast.error(error instanceof Error ? error.message : t("app.unknown_error"));
  }, []);
  const modelPicker = useModelPicker({
    client: opencodeClient,
    baseUrl: opencodeBaseUrl,
    workspaceRoot: selectedWorkspaceRoot,
    onLoadError: handleModelPickerLoadError,
  });
  const { commandPaletteOpen, setCommandPaletteOpen } = useCommandPaletteShortcut(!props.embedded);
  const paletteSessionOptions = useMemo(
    () => buildCommandPaletteSessions(workspaces, sessionsByWorkspaceId, selectedWorkspaceId),
    [sessionsByWorkspaceId, selectedWorkspaceId, workspaces],
  );
  const handleCreatePaletteSession = useCallback(async () => {
    if (!opencodeClient || !selectedWorkspaceId) {
      navigate(selectedWorkspaceId ? workspaceSessionRoute(selectedWorkspaceId) : "/session");
      return;
    }
    try {
      const session = unwrap(
        await opencodeClient.session.create({ directory: selectedWorkspaceRoot || undefined }),
      );
      navigate(workspaceSessionRoute(selectedWorkspaceId, session.id));
    } catch (error) {
      toast.error(describeRouteError(error));
    }
  }, [navigate, opencodeClient, selectedWorkspaceId, selectedWorkspaceRoot]);
  // Keep the local settings list synchronized when the model picker opens.
  useEffect(() => {
    if (!modelPicker.open) return;
    void refreshLocalProviders();
  }, [modelPicker.open, refreshLocalProviders]);

  useEffect(() => {
    const refresh = () => setExtensionStateVersion((value) => value + 1);
    window.addEventListener(OPENWORK_EXTENSION_STATE_CHANGED, refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener(OPENWORK_EXTENSION_STATE_CHANGED, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  useEffect(() => {
    if (!isDesktopRuntime() || !isMacPlatform()) return;
    let cancelled = false;
    void desktopBridge.checkComputerUsePermissions()
      .then((result) => {
        if (cancelled) return;
        const permissions = normalizeComputerUsePermissions(result);
        if (permissions) setComputerUsePermissions(permissions);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!openworkClient) {
      setUserEnvKeys([]);
      return;
    }
    let cancelled = false;
    void openworkClient.listUserEnvKeys()
      .then((response) => { if (!cancelled) setUserEnvKeys(response.keys); })
      .catch(() => { if (!cancelled) setUserEnvKeys([]); });
    return () => { cancelled = true; };
  }, [openworkClient]);

  const installOpenAiImageExtension = useCallback(async (apiKey: string) => {
    const resolvedApiKey = apiKey.trim();
    if (!openworkClient) {
      setImageExtensionError("OpenWork server is not connected.");
      return;
    }
    if (!resolvedApiKey) {
      setImageExtensionError("OpenAI API key is required.");
      return;
    }

    setImageExtensionBusy(true);
    setImageExtensionStatus(null);
    setImageExtensionError(null);
    try {
      await openworkClient.upsertUserEnv([{ key: "OPENAI_API_KEY", value: resolvedApiKey }]);
      setUserEnvKeys((current) => Array.from(new Set([...current, "OPENAI_API_KEY"])));
      setImageExtensionStatus("Saved OPENAI_API_KEY. Agents can use OpenWork extension actions for image generation.");
    } catch (error) {
      setImageExtensionError(describeRouteError(error));
    } finally {
      setImageExtensionBusy(false);
    }
  }, [openworkClient]);

  const generateOpenAiTestImage = useCallback(async (input: { apiKey: string; prompt: string }) => {
    const client = selectedWorkspaceEndpoint?.client ?? openworkClient;
    const workspaceId = runtimeWorkspaceId?.trim() ?? "";
    const apiKey = input.apiKey.trim();
    const prompt = input.prompt.trim();
    if (!client || !workspaceId) {
      setImageGenerationError("OpenWork server is not connected for this workspace.");
      return;
    }
    if (!apiKey) {
      setImageGenerationError("OpenAI API key is required.");
      return;
    }
    if (!prompt) {
      setImageGenerationError("Prompt is required.");
      return;
    }

    setImageGenerationBusy(true);
    setImageGenerationStatus(null);
    setImageGenerationError(null);
    try {
      if (openworkClient) {
        await openworkClient.upsertUserEnv([{ key: "OPENAI_API_KEY", value: apiKey }]);
        setUserEnvKeys((current) => Array.from(new Set([...current, "OPENAI_API_KEY"])));
      }
      const response = await client.callExtensionAction({
        extensionId: OPENAI_IMAGE_EXTENSION_ID,
        action: "image_generate",
        args: { prompt },
        context: { directory: selectedWorkspaceRoot || undefined },
      });
      if (!response.ok) {
        setImageGenerationError(response.message);
        return;
      }
      const result = response.result;
      const path = typeof result === "object" && result !== null && "path" in result && typeof result.path === "string"
        ? result.path
        : "an artifact";
      setImageGenerationStatus(`Generated ${path} with ${OPENAI_IMAGE_MODEL}.`);
    } catch (error) {
      setImageGenerationError(describeRouteError(error));
    } finally {
      setImageGenerationBusy(false);
    }
  }, [openworkClient, runtimeWorkspaceId, selectedWorkspaceEndpoint, selectedWorkspaceRoot]);

  const saveVoiceApiKey = useCallback(async (apiKey: string) => {
    const resolvedApiKey = apiKey.trim();
    if (!openworkClient || !resolvedApiKey) {
      setVoiceError("OpenAI API key is required.");
      return;
    }
    setVoiceBusy(true);
    setVoiceStatus(null);
    setVoiceError(null);
    try {
      await openworkClient.upsertUserEnv([{ key: "OPENAI_API_KEY", value: resolvedApiKey }]);
      setUserEnvKeys((current) => Array.from(new Set([...current, "OPENAI_API_KEY"])));
      setVoiceStatus("Saved OPENAI_API_KEY for Voice Mode.");
    } catch (error) {
      setVoiceError(describeRouteError(error));
    } finally {
      setVoiceBusy(false);
    }
  }, [openworkClient]);

  const testVoiceSession = useCallback(async () => {
    if (!openworkClient) {
      setVoiceError("OpenWork server is not connected.");
      return;
    }
    setVoiceBusy(true);
    setVoiceStatus(null);
    setVoiceError(null);
    try {
      const session = await openworkClient.createVoiceRealtimeSession();
      setVoiceStatus(`Realtime ready with ${session.model} (${session.tools.length} OpenWork tools).`);
    } catch (error) {
      setVoiceError(describeRouteError(error));
    } finally {
      setVoiceBusy(false);
    }
  }, [openworkClient]);

  const saveManualProvider = useCallback(async (input: {
    id: string;
    name: string;
    baseUrl: string;
    apiKey: string;
    modelIds: string[];
    proxyUrl: string;
    proxyUsername: string;
    proxyPassword: string;
    proxyEnabled: boolean;
    defaultModelId: string;
  }) => {
    const providerId = input.id.trim();
    if (!/^[a-z0-9][a-z0-9._-]*$/i.test(providerId)) {
      throw new Error(t("providers.provider_id_required"));
    }
    const baseUrl = new URL(input.baseUrl.trim());
    if (baseUrl.protocol !== "http:" && baseUrl.protocol !== "https:") {
      throw new Error(t("providers.invalid_base_url"));
    }
    if (input.modelIds.length === 0) throw new Error(t("providers.model_required"));

    const credentials = await providerCredentialsGet(providerId)
      .catch(() => ({ hasApiKey: false, proxy: null }));
    const hadPreviousSecret = credentials.hasApiKey;
    let nextProxy: string | null = null;
    if (input.proxyEnabled) {
      if (!input.proxyUrl.trim()) throw new Error(t("providers.proxy_url_required"));
      const proxy = new URL(input.proxyUrl.trim());
      if (proxy.protocol !== "http:" && proxy.protocol !== "https:") {
        throw new Error(t("providers.invalid_proxy_url"));
      }
      if (input.proxyUsername.trim()) proxy.username = input.proxyUsername.trim();
      if (input.proxyPassword) proxy.password = input.proxyPassword;
      nextProxy = proxy.toString();
    }

    const current = await readOpencodeConfig("global", "");
    let config: Record<string, unknown> = {};
    if (current.content?.trim()) {
      try {
        config = JSON.parse(current.content) as Record<string, unknown>;
      } catch {
        throw new Error(t("providers.invalid_global_config"));
      }
    }
    const providers = config.provider && typeof config.provider === "object"
      ? { ...(config.provider as Record<string, unknown>) }
      : {};
    const existing = providers[providerId] && typeof providers[providerId] === "object"
      ? providers[providerId] as Record<string, unknown>
      : {};
    const models = Object.fromEntries(input.modelIds.map((modelId) => [modelId, { name: modelId }]));
    const gatewayUrl = await providerGatewayUrl({
      providerId,
      baseUrl: baseUrl.toString().replace(/\/$/, ""),
    });
    const options = {
      ...(existing.options && typeof existing.options === "object" ? existing.options : {}),
      baseURL: gatewayUrl ?? baseUrl.toString().replace(/\/$/, ""),
    } as Record<string, unknown>;
    if (input.apiKey.trim() || hadPreviousSecret) {
      options.apiKey = "${VELOXOPENWORK_PROVIDER_" + providerId.toUpperCase().replace(/[^A-Z0-9]+/g, "_") + "_API_KEY}";
    } else {
      delete options.apiKey;
    }
    // Proxy credentials never enter opencode.json. The loopback gateway
    // resolves this marker from OS secure storage for this provider only.
    if (nextProxy) {
      options.proxy = "${VELOXOPENWORK_PROVIDER_" + providerId.toUpperCase().replace(/[^A-Z0-9]+/g, "_") + "_PROXY}";
    } else {
      delete options.proxy;
    }
    providers[providerId] = {
      ...existing,
      name: input.name,
      options,
      models,
    };
    config.provider = providers;
    const previousConfigContent = current.content ?? "{}\n";
    await writeOpencodeConfig("global", "", `${JSON.stringify(config, null, 2)}\n`);
    try {
      await providerCredentialsSet({
        providerId,
        apiKey: input.apiKey.trim() || null,
        proxyEnabled: Boolean(nextProxy),
        proxyUrl: nextProxy ?? undefined,
        proxyUsername: input.proxyUsername.trim(),
        proxyPassword: input.proxyPassword,
      });
    } catch (error) {
      await writeOpencodeConfig("global", "", previousConfigContent).catch(() => undefined);
      throw error;
    }
    local.setPrefs((previous) => ({
      ...previous,
      defaultModel: {
        providerID: providerId,
        modelID: input.defaultModelId || input.modelIds[0],
      },
    }));
    setConfigActionStatus(t("providers.saved", { name: input.name }));
    await refreshLocalProviders();
    reloadCoordinator.markReloadRequired("config", { type: "config", name: "opencode.json", action: "updated" });
  }, [local, refreshLocalProviders, reloadCoordinator]);

  const deleteManualProvider = useCallback(async (providerId: string) => {
    const current = await readOpencodeConfig("global", "");
    const config = current.content?.trim()
      ? JSON.parse(current.content) as Record<string, unknown>
      : {};
    const providers = config.provider && typeof config.provider === "object"
      ? { ...(config.provider as Record<string, unknown>) }
      : {};
    const provider = providers[providerId] as { name?: unknown } | undefined;
    delete providers[providerId];
    config.provider = providers;
    const previousConfigContent = current.content ?? "{}\n";
    await writeOpencodeConfig("global", "", `${JSON.stringify(config, null, 2)}\n`);
    try {
      await providerCredentialsDelete(providerId);
    } catch (error) {
      await writeOpencodeConfig("global", "", previousConfigContent).catch(() => undefined);
      throw error;
    }
    local.setPrefs((previous) => previous.defaultModel?.providerID === providerId
      ? { ...previous, defaultModel: null, modelVariant: null }
      : previous);
    setConfigActionStatus(t("providers.removed", {
      name: typeof provider?.name === "string" ? provider.name : providerId,
    }));
    await refreshLocalProviders();
    reloadCoordinator.markReloadRequired("config", { type: "config", name: "opencode.json", action: "updated" });
  }, [local, refreshLocalProviders, reloadCoordinator]);

  useEffect(() => {
    local.setUi((previous) => ({ ...previous, view: "settings", tab: route.tab }));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- local is stable via context
  }, [route.tab]);

  useEffect(() => {
    setAppThemeMode(themeMode);
  }, [themeMode]);

  useEffect(() => {
    writeStoredBoolean(SETTINGS_HIDE_TITLEBAR_KEY, hideTitlebar);
  }, [hideTitlebar]);


  const {
    markRouteReady: markBootRouteReady,
    phase: bootPhase,
    routeReady: bootRouteReady,
  } = useBootState();
  const refreshRouteState = useMemo(() => async () => {
    if (refreshInFlightRef.current) return;
    refreshInFlightRef.current = true;
    setLoading(true);
    let desktopList: WorkspaceList | null = null;
    let desktopWorkspaces = workspacesRef.current;
    try {
      if (isDesktopRuntime()) {
        try {
          desktopList = await workspaceBootstrap() as WorkspaceList;
          desktopWorkspaces = (desktopList.workspaces ?? [])
            .map(mapDesktopWorkspace)
            .filter((workspace) => workspace.workspaceType !== "remote");
        } catch (error) {
          const message = describeRouteError(error);
          console.error("[settings-route] workspaceBootstrap failed", error);
          recordInspectorEvent("route.workspace_bootstrap.error", {
            route: "settings",
            message,
            preservedWorkspaceCount: workspacesRef.current.length,
          });
          desktopWorkspaces = workspacesRef.current;
        }
      }
      const { normalizedBaseUrl, resolvedToken, resolvedHostToken } = await resolveOpenworkConnection();

      if (!normalizedBaseUrl || !resolvedToken) {
        setOpenworkClient(null);
        setBaseUrl("");
        setToken("");
        setWorkspaces(desktopWorkspaces);
        setSessionsByWorkspaceId({});
        setErrorsByWorkspaceId({});
        setLegacySelectedWorkspaceId((current) => {
          const next = current || readActiveWorkspaceId() || resolveWorkspaceListSelectedId(desktopList) || desktopWorkspaces[0]?.id || "";
          writeActiveWorkspaceId(next || null);
          return next;
        });
        return;
      }

      const client = createOpenworkServerClient({
        baseUrl: normalizedBaseUrl,
        token: resolvedToken,
        hostToken: resolvedHostToken || undefined,
      });
      const list = await client.listWorkspaces();
      const serverWorkspaceIds = new Set(list.items.map((workspace) => workspace.id));
      const nextWorkspaces = mergeRouteWorkspaces(list.items, desktopWorkspaces)
        .filter((workspace) => workspace.workspaceType !== "remote");
      const routeWorkspaceServerClientResolver = createWorkspaceServerClientResolver({
        baseUrl: normalizedBaseUrl,
        token: resolvedToken,
      });
      const sessionEntries = await Promise.all(
        nextWorkspaces.map(async (workspace) => {
          const endpoint = routeWorkspaceServerClientResolver(workspace);
          if (!endpoint) {
            return { workspaceId: workspace.id, sessions: [], error: null as string | null };
          }
          if (!endpoint.isRemote && !serverWorkspaceIds.has(workspace.id)) {
            return { workspaceId: workspace.id, sessions: [], error: null as string | null };
          }
          try {
            const response = await endpoint.client.listSessions(endpoint.workspaceId, { limit: 200 });
            const workspaceRoot = normalizeDirectoryPath(workspace.path ?? "");
            const items = workspaceRoot && !endpoint.isRemote
              ? (response.items ?? []).filter((session) =>
                  normalizeDirectoryPath(session?.directory ?? "") === workspaceRoot,
                )
              : (response.items ?? []);
            return {
              workspaceId: workspace.id,
              sessions: items,
              error: null as string | null,
              connectionState: null as WorkspaceConnectionState | null,
            };
          } catch (error) {
            const fallback = error instanceof Error ? error.message : t("app.unknown_error");
            return {
              workspaceId: workspace.id,
              sessions: [],
              error: fallback,
              connectionState: null,
            };
          }
        }),
      );

      setOpenworkClient(client);
      setBaseUrl(normalizedBaseUrl);
      setToken(resolvedToken);
      setWorkspaces(nextWorkspaces);
      setSessionsByWorkspaceId(Object.fromEntries(sessionEntries.map((entry) => [entry.workspaceId, entry.sessions])));
      setErrorsByWorkspaceId(Object.fromEntries(sessionEntries.map((entry) => [entry.workspaceId, entry.error])));
      setWorkspaceConnectionOverrides((current) => {
        const next = { ...current };
        for (const entry of sessionEntries) {
          if (entry.connectionState) {
            next[entry.workspaceId] = entry.connectionState;
          } else if (next[entry.workspaceId]?.status === "error") {
            delete next[entry.workspaceId];
          }
        }
        return next;
      });
      setLegacySelectedWorkspaceId((current) => {
        const sessionWorkspaceId = findSessionWorkspaceId(navigationSessionId, sessionEntries);
        const preferred = routeWorkspaceId || sessionWorkspaceId || navigationWorkspaceId || current || readActiveWorkspaceId() || "";
        const next = reconcileSelectedWorkspaceId(preferred, list, desktopList, nextWorkspaces);
        writeActiveWorkspaceId(next || null);
        return next;
      });
    } catch (error) {
      const message = describeRouteError(error);
      console.error("[settings-route] refreshRouteState failed", error);
      recordInspectorEvent("route.refresh.error", {
        route: "settings",
        message,
        preservedWorkspaceCount: desktopWorkspaces.length,
      });
      // Fires on mount/auto-refresh too, not just user actions.
      notifyAlert({
        kind: "system",
        title: t("notifications.refresh_failed"),
        body: message,
        dedupeKey: "settings-route-refresh",
      });
      if (desktopWorkspaces.length > 0) {
        setWorkspaces(desktopWorkspaces);
        setLegacySelectedWorkspaceId((current) => {
          const next = current || readActiveWorkspaceId() || resolveWorkspaceListSelectedId(desktopList) || desktopWorkspaces[0]?.id || "";
          writeActiveWorkspaceId(next || null);
          return next;
        });
      }
    } finally {
      setLoading(false);
      refreshInFlightRef.current = false;
      // Settings can be the first route a user lands on (direct link, deep
      // link, or after reload). Let the boot overlay dismiss once we've
      // completed our first data load.
      markBootRouteReady();
    }
  }, [markBootRouteReady, navigationSessionId, navigationWorkspaceId, routeWorkspaceId]);

  const handleToggleContinuousEngine = useCallback(async () => {
    if (!isDesktopRuntime()) return;
    if (activeReloadBlockingSessions.length > 0) {
      toast.error(t("settings.engine_rollover_blocked"));
      return;
    }
    const next = !continuousEngineEnabled;
    setContinuousEngineBusy(true);
    setContinuousEngine(next);
    try {
      await engineRestart({ engineRollover: next });
      await openworkServerStore.reconnectOpenworkServer();
      await refreshRouteState();
    } catch (error) {
      setContinuousEngine(!next);
      toast.error(t("settings.engine_rollover_failed"), {
        description: describeRouteError(error),
      });
    } finally {
      setContinuousEngineBusy(false);
    }
  }, [
    activeReloadBlockingSessions.length,
    continuousEngineEnabled,
    openworkServerStore,
    refreshRouteState,
    setContinuousEngine,
  ]);

  const reloadWorkspaceEngineFromUi = useCallback(async () => {
    const workspaceId = routeStateRef.current.runtimeWorkspaceId?.trim() || selectedWorkspaceId.trim();
    if (!openworkClient || !workspaceId) {
      toast.error(t("app.error_connect_first"));
      return false;
    }

    await reloadEngineOrRestartDesktop(openworkClient, workspaceId, refreshRouteState);
    await refreshProviderListQueries(getReactQueryClient());

    try {
      window.dispatchEvent(new CustomEvent("openwork-server-settings-changed"));
    } catch {
      // ignore browser event dispatch failures
    }

    // OpenCode reconnects MCPs async after dispose — the store polls until
    // statuses settle so users don't have to collapse/expand the card.
    void pollMcpServersAfterReloadRef.current?.();

    return true;
  }, [openworkClient, refreshRouteState, selectedWorkspaceId]);

  useEffect(() => {
    return reloadCoordinator.registerWorkspaceReloadControls({
      canReloadWorkspaceEngine: () => Boolean(openworkClient && (selectedWorkspace?.id || selectedWorkspaceId)),
      reloadWorkspaceEngine: reloadWorkspaceEngineFromUi,
      activeSessions: () => activeReloadBlockingSessions,
      stopSession: async (sessionId) => {
        if (!activeClient) return;
        await abortSessionSafe(activeClient, sessionId, undefined, {
          source: "settings.reload_workspace.stop_session",
          initiator: "user",
          reason: "stop active session before workspace engine reload",
        });
      },
    });
  }, [
    activeClient,
    activeReloadBlockingSessions,
    openworkClient,
    reloadCoordinator,
    reloadWorkspaceEngineFromUi,
    selectedWorkspace?.id,
    selectedWorkspaceId,
  ]);

  useEffect(() => {
    workspacesRef.current = workspaces;
  }, [workspaces]);

  useEffect(() => {
    const activeWorkspaceIds = new Set(workspaces.map((workspace) => workspace.id));
    setWorkspaceConnectionOverrides((current) => {
      let changed = false;
      const next: Record<string, WorkspaceConnectionState> = {};
      for (const [workspaceId, state] of Object.entries(current)) {
        if (activeWorkspaceIds.has(workspaceId)) {
          next[workspaceId] = state;
        } else {
          changed = true;
        }
      }
      return changed ? next : current;
    });
  }, [workspaces]);

  useEffect(() => {
    if (openworkClient) {
      reconnectAttemptedWorkspaceIdRef.current = "";
    }
    // Same gate as the session route: reconnect must not probe the local
    // server while desktop runtime bootstrap is still starting it.
    if (
      !shouldAttemptDesktopLocalReconnect({
        desktopRuntime: isDesktopRuntime(),
        bootPhase,
        bootRouteReady,
        routeLoading: loading,
        hasClient: Boolean(openworkClient),
        connectionPending: false,
        workspaceType: selectedWorkspace?.workspaceType ?? null,
      })
    ) {
      return;
    }
    if (!selectedWorkspace) return;
    const workspaceId = selectedWorkspace.id?.trim() ?? "";
    if (!workspaceId || reconnectAttemptedWorkspaceIdRef.current === workspaceId) return;
    reconnectAttemptedWorkspaceIdRef.current = workspaceId;

    void ensureDesktopLocalOpenworkConnection({
      route: "settings",
      workspace: selectedWorkspace,
      allWorkspaces: workspaces,
    }).catch((error) => {
      const message = error instanceof Error ? error.message : describeRouteError(error);
      // Background auto-reconnect: alert + persistent center entry.
      notifyAlert({
        kind: "system",
        title: t("notifications.reconnect_failed"),
        body: message,
        dedupeKey: "server-reconnect",
      });
    });
  }, [bootPhase, bootRouteReady, loading, openworkClient, selectedWorkspace, workspaces]);

  useEffect(() => {
    void refreshRouteState();
    const handleSettingsChange = () => {
      void refreshRouteState();
    };
    window.addEventListener("openwork-server-settings-changed", handleSettingsChange);
    return () => {
      window.removeEventListener("openwork-server-settings-changed", handleSettingsChange);
    };
  }, [refreshRouteState]);

  // Load auto-compaction state from OpenCode config on workspace change.
  useEffect(() => {
    if (!openworkClient || !selectedWorkspaceId) return;
    const workspaceId = routeStateRef.current.runtimeWorkspaceId?.trim() || selectedWorkspaceId;
    let cancelled = false;
    (async () => {
      try {
        const config = await openworkClient.getConfig(workspaceId);
        if (cancelled) return;
        const compaction = config.opencode?.compaction;
        const auto = compaction && typeof compaction === "object" && "auto" in compaction
          ? (compaction as { auto?: boolean }).auto
          : undefined;
        setAutoCompactContext(auto !== false);
        setAutoCompactContextLoaded(true);
      } catch {
        if (!cancelled) setAutoCompactContextLoaded(true);
      }
    })();
    return () => { cancelled = true; };
  }, [openworkClient, selectedWorkspaceId]);

  const toggleAutoCompactContext = useCallback(async () => {
    if (autoCompactContextBusy) return;
    const workspaceId = routeStateRef.current.runtimeWorkspaceId?.trim() || selectedWorkspaceId;
    if (!openworkClient || !workspaceId) return;
    const next = !autoCompactContext;
    setAutoCompactContext(next);
    setAutoCompactContextBusy(true);
    try {
      await openworkClient.patchConfig(workspaceId, {
        opencode: { compaction: { auto: next } },
      });
      reloadCoordinator.markReloadRequired("config", {
        type: "config",
        name: "opencode.json",
        action: "updated",
      });
    } catch {
      setAutoCompactContext(!next);
    } finally {
      setAutoCompactContextBusy(false);
    }
  }, [autoCompactContext, autoCompactContextBusy, openworkClient, reloadCoordinator, selectedWorkspaceId]);

  useEffect(() => {
    openworkServerStore.start();
    connectionsStore.start();
    extensionsStore.start();

    return () => {
      extensionsStore.dispose();
      connectionsStore.dispose();
      openworkServerStore.dispose();
    };
  }, [connectionsStore, extensionsStore, openworkServerStore]);

  useEffect(() => {
    openworkServerStore.syncFromOptions();
    connectionsStore.syncFromOptions();
    extensionsStore.syncFromOptions();
  }, [
    activeClient,
    connectionsStore,
    extensionsStore,
    openworkServerStore,
    selectedWorkspace?.id,
    selectedWorkspace?.workspaceType,
    selectedWorkspaceRoot,
  ]);

  useEffect(() => {
    void refreshLocalProviders();
    if (activeClient) void connectionsStore.refreshMcpServers();
  }, [activeClient, connectionsStore, refreshLocalProviders, selectedWorkspace?.id]);

  const selectedWorkspaceName = selectedWorkspace?.displayNameResolved ?? t("session.workspace_fallback");
  const workspaceOptions = workspaces.map((workspace) => ({
    id: workspace.id,
    name: workspace.displayNameResolved,
    color: workspaceSwatchColor(workspace.id),
  }));
  const selectedWorkspaceColor = workspaceSwatchColor(selectedWorkspaceId);
  const workspaceType = selectedWorkspace?.workspaceType ?? "local";
  const isRemoteWorkspace = workspaceType === "remote";
  const canWriteWorkspacePlugins =
    !isRemoteWorkspace || openworkServerSnapshot.openworkServerCanWritePlugins;
  const pluginsAccessHint =
    isRemoteWorkspace && !canWriteWorkspacePlugins ? t("app.plugins_hint_readonly") : null;
  const defaultModelLabel = local.prefs.defaultModel
    ? (() => {
        const provider = providers.find((item) => item.id === local.prefs.defaultModel?.providerID);
        const model = provider?.models?.[local.prefs.defaultModel.modelID];
        const providerLabel = provider?.name ?? resolveProviderDisplayName(local.prefs.defaultModel.providerID);
        const modelLabel = model?.name ?? resolveModelDisplayName(local.prefs.defaultModel.modelID);
        return `${providerLabel} - ${modelLabel}`;
      })()
    : t("session.default_model");
  const providerStatusLabel = providerConnectedIds.length > 0 ? t("status.connected") : t("status.disconnected_label");
  const providerSummary = providerConnectedIds.length > 0
    ? t("status.providers_connected", { count: providerConnectedIds.length })
    : t("settings.no_providers_connected");
  const providerConnectedIdSet = new Set(providerConnectedIds);
  const disabledProviderIdSet = new Set(
    disabledProviders.map((id) => id.trim().toLowerCase()).filter(Boolean),
  );
  const connectedProviders = providers.flatMap((provider) =>
    providerConnectedIdSet.has(provider.id) &&
    !disabledProviderIdSet.has(provider.id.trim().toLowerCase())
      ? [{
          id: provider.id,
          name: provider.name ?? provider.id,
          source: provider.source,
        }]
      : [],
  );

  // Build enablement context from all available runtime state.
  const enablementContext = useMemo<EnablementContext>(() => {
    const mcpConfigured = new Set(connectionsSnapshot.mcpServers.map((s) => s.name));
    const connectedProviders = new Set(providerConnectedIds);
    const configuredEnvKeys = new Set(userEnvKeys);
    const loadedPlugins = new Set<string>();
    // Browser plugin detection: check if any configured plugin matches the chrome-devtools name.
    // For now, treat it as loaded if the plugin is in the MCP/plugin list — this will
    // be refined when we add a real plugin-loaded signal from the engine.
    const browserPluginConfigured = connectionsSnapshot.mcpServers.some(
      (s) => s.name === "opencode-chrome-devtools" || s.config.command?.some((c: string) => c.includes("chrome-devtools")),
    );
    if (browserPluginConfigured) loadedPlugins.add("opencode-chrome-devtools");

    return {
      mcpStatuses: connectionsSnapshot.mcpStatuses,
      mcpConfigured,
      loadedPlugins,
      connectedProviders,
      configuredEnvKeys,
      permissions: computerUsePermissions ?? undefined,
      // Toggle state reader for extensions with defaultEnabled / explicit toggle.
      isToggleEnabled: (ref: string) => {
        const catalog = connectionsStore.quickConnect;
        const match = catalog.find((e: { id?: string; serverName?: string }) => (e.id ?? e.serverName) === ref);
        return match ? isOpenWorkExtensionEnabled(match) : false;
      },
    };
  }, [computerUsePermissions, connectionsSnapshot, extensionStateVersion, providerConnectedIds, userEnvKeys]);
  const builtInExtensionsDisabled = false;
  const restartExtensionLocalServer = useCallback(async () => {
    if (!isDesktopRuntime()) return false;
    try {
      await openworkServerRestart({
        remoteAccessEnabled:
          readOpenworkServerSettings().remoteAccessEnabled === true,
      });
      await openworkServerStore.reconnectOpenworkServer();
      await refreshRouteState();
      return true;
    } catch {
      return false;
    }
  }, [openworkServerStore, refreshRouteState]);
  const extensionController = useSettingsExtensionController({
    openworkServerClient: selectedWorkspaceEndpoint?.client ?? openworkClient,
    hostOpenworkServerClient: openworkClient,
    enablementContext,
    mcpServers: connectionsSnapshot.mcpServers,
    mcpConnectingName: connectionsSnapshot.mcpConnectingName,
    onComputerUsePermissionsChange: setComputerUsePermissions,
    restartLocalServer: restartExtensionLocalServer,
    connectMcp: async (entry) => {
      await connectionsStore.connectMcp(entry);
    },
    refreshMcpServers: () => connectionsStore.refreshMcpServers(),
    providers,
    providerConnectedIds,
    userEnvKeys,
    imageExtension: {
      busy: imageExtensionBusy || imageGenerationBusy,
      status: imageExtensionStatus ?? imageGenerationStatus,
      error: imageExtensionError ?? imageGenerationError,
      onInstall: installOpenAiImageExtension,
      onTestGenerate: generateOpenAiTestImage,
    },
    voiceExtension: {
      busy: voiceBusy,
      status: voiceStatus,
      error: voiceError,
      onSaveApiKey: saveVoiceApiKey,
      onTestSession: testVoiceSession,
    },
  });
  const extensionCatalogPlatform = resolveOpenWorkExtensionCatalogPlatform(platform.platform, platform.os);
  const quickConnectCatalog = useMemo(
    () => filterOpenWorkExtensionCatalogForPlatform(connectionsStore.quickConnect, extensionCatalogPlatform),
    [connectionsStore.quickConnect, extensionCatalogPlatform],
  );
  const extensionItems = useMemo(
    () => buildExtensionItems({
      quickConnect: quickConnectCatalog,
      mcpServers: connectionsSnapshot.mcpServers,
      installedSkills: extensionsStore.skills(),
      importedCloudPlugins: {},
      pendingCloudPluginChanges: {},
      cloudMarketplaces: [],
      orgMcpConnections: [],
      enablementContext,
      isBuiltInConnected: extensionController.isConnected,
    }),
    [connectionsSnapshot.mcpServers, enablementContext, extensionController, extensionsStore, quickConnectCatalog],
  );
  const routeOpenworkStatus = openworkClient ? "connected" : "disconnected";
  const notFoundRouteError = !loading && routeWorkspaceId && !selectedWorkspace
    ? "Workspace was not found. Select a new workspace from the sidebar."
    : null;
  useEffect(() => {
    if (notFoundRouteError) {
      notifyAlert({
        kind: "system",
        title: notFoundRouteError,
        dedupeKey: "workspace-not-found",
      });
    }
  }, [notFoundRouteError]);
  const routeOpenworkCapabilities: OpenworkServerCapabilities | null = openworkClient
    ? ROUTE_OPENWORK_CAPABILITIES
    : null;
  const environmentRuntimeKey = buildOpenworkEnvRuntimeKey({
    baseUrl: openworkServerSnapshot.openworkServerBaseUrl || openworkServerSnapshot.openworkServerUrl,
    pid: openworkServerSnapshot.openworkServerHostInfo?.pid ?? null,
    port: openworkServerSnapshot.openworkServerHostInfo?.port ?? null,
  });

  const handleApplyEnvironmentChanges = async () => {
    if (!isDesktopRuntime()) {
      throw new Error(t("settings.environment.apply_unavailable"));
    }
    if (activeReloadBlockingSessions.length > 0) {
      throw new Error(t("settings.environment.apply_blocked_active_tasks"));
    }
    if (!selectedWorkspaceRoot) {
      throw new Error(t("settings.environment.apply_no_local_workspace"));
    }
    const workspacePaths = Array.from(
      new Set(
        workspaces.flatMap((workspace) => {
          const path = workspace.workspaceType !== "remote" ? workspace.path?.trim() ?? "" : "";
          return path ? [path] : [];
        }),
      ),
    );
    const workspacePathSet = new Set(workspacePaths);
    if (!workspacePathSet.has(selectedWorkspaceRoot)) {
      workspacePaths.unshift(selectedWorkspaceRoot);
    }
    await engineStart(selectedWorkspaceRoot, {
      preferSidecar: true,
      runtime: "direct",
      workspacePaths,
      openworkRemoteAccess: openworkServerSnapshot.openworkServerSettings.remoteAccessEnabled === true,
    });
    const reconnected = await openworkServerStore.reconnectOpenworkServer();
    if (!reconnected) {
      await refreshRouteState().catch(() => {});
      return { statusMessage: t("settings.environment.apply_refresh_failed") };
    }
    await refreshRouteState();
  };

  const handleSelectSettingsWorkspace = useCallback((workspaceId: string) => {
    if (workspaceId === selectedWorkspaceId) return;
    setLegacySelectedWorkspaceId(workspaceId);
    writeActiveWorkspaceId(workspaceId);
    const workspace = workspaces.find((item) => item.id === workspaceId) ?? null;
    const endpoint = workspaceServerClientResolver(workspace);
    if (endpoint) {
      void endpoint.client.activateWorkspace(endpoint.workspaceId, { persist: true }).catch(() => undefined);
    }
    if (isDesktopRuntime()) {
      void workspaceSetSelected(workspaceId).catch(() => undefined);
      void workspaceSetRuntimeActive(workspaceId).catch(() => undefined);
    }
    navigate(
      props.standaloneExtensions
        ? workspaceExtensionsRoute(workspaceId, extensionsPathForRoute(route))
        : workspaceSettingsRoute(workspaceId, settingsPathForRoute(route)),
      { state: location.state },
    );
  }, [location, navigate, props.standaloneExtensions, route, selectedWorkspaceId, workspaceServerClientResolver, workspaces]);

  const handleOpenRenameWorkspace = useCallback((workspaceId: string) => {
    const workspace = workspaces.find((item) => item.id === workspaceId);
    if (!workspace) return;
    setRenameWorkspaceId(workspaceId);
    setRenameWorkspaceTitle(workspaceLabel(workspace));
  }, [workspaces]);

  const handleSaveRenameWorkspace = useCallback(async () => {
    if (!renameWorkspaceId) return;
    const trimmed = renameWorkspaceTitle.trim();
    if (!trimmed) return;
    setRenameWorkspaceBusy(true);
    try {
      if (!openworkClient) {
        toast.error("OpenWork server is unavailable. Reconnect the server before renaming workspaces.");
        return;
      }
      await openworkClient.updateWorkspaceDisplayName(renameWorkspaceId, trimmed);
      setRenameWorkspaceId(null);
      setRenameWorkspaceTitle("");
      await refreshRouteState();
    } catch (error) {
      toast.error("Workspace rename failed", {
        description: describeRouteError(error),
      });
    } finally {
      setRenameWorkspaceBusy(false);
    }
  }, [openworkClient, refreshRouteState, renameWorkspaceId, renameWorkspaceTitle]);

  const handleRevealWorkspace = useCallback(async (workspaceId: string) => {
    const workspace = workspaces.find((item) => item.id === workspaceId);
    const path = workspace?.path?.trim();
    if (!path || !isDesktopRuntime()) return;
    await revealDesktopItemInDir(path).catch(() => undefined);
  }, [workspaces]);

  const handleExportWorkspaceConfig = useCallback(async (workspaceId: string) => {
    const workspace = workspaces.find((item) => item.id === workspaceId) ?? null;
    if (!workspace) return;
    const endpoint = workspaceServerClientResolver(workspace);
    if (endpoint) {
      setExportWorkspaceBusy(true);
      try {
        const payload = await endpoint.client.exportWorkspace(endpoint.workspaceId);
        downloadWorkspaceJson(workspaceExportFilename(workspace), payload);
      } finally {
        setExportWorkspaceBusy(false);
      }
      return;
    }
    throw new Error("OpenWork server is unavailable. Reconnect the server before exporting workspace config.");
  }, [workspaceServerClientResolver, workspaces]);

  const handleForgetWorkspace = useCallback(async (workspaceId: string) => {
    if (typeof window !== "undefined") {
      const message = t("workspace_list.remove_confirm") || "Remove this workspace from the sidebar?";
      if (!window.confirm(message)) return;
    }
    if (openworkClient) {
      await openworkClient.deleteWorkspace(workspaceId).catch(() => undefined);
    }
    if (isDesktopRuntime()) {
      await workspaceForget(workspaceId).catch(() => undefined);
    }
    if (selectedWorkspaceId === workspaceId) {
      const nextWorkspace = workspaces.find((workspace) => workspace.id !== workspaceId);
      const nextId = nextWorkspace?.id ?? "";
      setLegacySelectedWorkspaceId(nextId);
      if (nextId) {
        await workspaceSetSelected(nextId).catch(() => undefined);
      }
    }
    await refreshRouteState();
  }, [openworkClient, refreshRouteState, selectedWorkspaceId, workspaces]);

  if (route.redirectPath && !props.embedded) {
    const target = props.standaloneExtensions
      ? selectedWorkspaceId
        ? workspaceExtensionsRoute(selectedWorkspaceId, extensionsPathForRoute(route))
        : globalExtensionsRoute(extensionsPathForRoute(route))
      : selectedWorkspaceId
        ? workspaceSettingsRoute(selectedWorkspaceId, route.redirectPath)
        : `/settings/${route.redirectPath}`;
    return <Navigate to={target} replace state={location.state} />;
  }

  if (!props.embedded && !routeWorkspaceId && selectedWorkspaceId) {
    const target = props.standaloneExtensions
      ? workspaceExtensionsRoute(selectedWorkspaceId, extensionsPathForRoute(route))
      : workspaceSettingsRoute(selectedWorkspaceId, settingsPathForRoute(route));
    return <Navigate to={target} replace state={location.state} />;
  }

  const settingsView = (() => {
    switch (route.tab) {
      case "general":
        return (
          <GeneralSettingsView
            onNavigateTab={(tab) => navigateSettingsPath(tab)}
            developerMode={developerMode}
            onSendFeedback={() => platform.openLink(buildFeedbackUrl({ entrypoint: "settings" }))}
            onJoinDiscord={() => platform.openLink("https://discord.gg/VEhNQXxYMB")}
            onReportIssue={() => platform.openLink("https://github.com/different-ai/openwork/issues/new?template=bug.yml")}
          />
        );
      case "permissions":
        return (
          <SettingsStack>
            <AuthorizedFoldersPanel
              openworkServerClient={openworkClient}
              openworkServerStatus={routeOpenworkStatus}
              openworkServerCapabilities={routeOpenworkCapabilities}
              runtimeWorkspaceId={runtimeWorkspaceId}
              selectedWorkspaceRoot={selectedWorkspaceRoot}
              activeWorkspaceType={workspaceType}
              onConfigUpdated={() => {
                setConfigActionStatus(t("settings.config_updated"));
                void refreshLocalProviders();
                void connectionsStore.refreshMcpServers();
              }}
            />
          </SettingsStack>
        );
      case "ai":
        return (
          <AiSettingsView
            busy={busy}
            providerAuthBusy={providerBusy}
            providerStatusLabel={providerStatusLabel}
            providerSummary={providerSummary}
            connectedProviders={connectedProviders}
            providerConnectError={providerError}
            providerDisconnectStatus={configActionStatus}
            onOpenProviderAuth={handleOpenProviderAuth}
            onDisconnectProvider={async (providerId) => {
              await deleteManualProvider(providerId);
            }}
            onEditProvider={(providerId) => handleEditProvider(providerId)}
            canDisconnectProvider={(provider) =>
              provider.id.trim().toLowerCase() === "opencode" || provider.source !== "env"
            }
            canAddProviders
          />
        );
      case "preferences":
        return (
          <PreferencesView
            busy={busy}
            showThinking={local.prefs.showThinking}
            onToggleShowThinking={() => {
              local.setPrefs((previous) => ({ ...previous, showThinking: !previous.showThinking }));
            }}
            autoCompactContext={autoCompactContext}
            autoCompactContextBusy={autoCompactContextBusy}
            onToggleAutoCompactContext={toggleAutoCompactContext}
            analyticsEnabled={local.prefs.analyticsEnabled}
            onToggleAnalytics={() => {
              local.setPrefs((previous) => ({ ...previous, analyticsEnabled: !previous.analyticsEnabled }));
            }}
            desktopNotifications={local.prefs.desktopNotifications}
            onDesktopNotificationsChange={(desktopNotifications) => {
              local.setPrefs((previous) => ({ ...previous, desktopNotifications }));
            }}
            continuousEngineAvailable={isDesktopRuntime()}
            continuousEngineEnabled={continuousEngineEnabled}
            continuousEngineBusy={continuousEngineBusy || activeReloadBlockingSessions.length > 0}
            onToggleContinuousEngine={handleToggleContinuousEngine}
            memoryEnabled={memoryEnabled}
            onToggleMemory={toggleMemory}
          />
        );
      case "extensions":
        return (
          <ExtensionsView
            busy={busy}
            hideDescription={props.standaloneExtensions !== true}
            selectedWorkspaceRoot={selectedWorkspaceRoot}
            isRemoteWorkspace={isRemoteWorkspace}
            canEditPlugins={canWriteWorkspacePlugins}
            canUseGlobalScope={!isRemoteWorkspace}
            accessHint={pluginsAccessHint}
            suggestedPlugins={SUGGESTED_PLUGINS}
            extensions={extensionsStore}
            initialSection={route.extensionsSection}
            detailId={route.extensionDetailId ?? null}
            onDetailIdChange={(id) => {
              navigateSettingsPath(id ? `extensions/${encodeURIComponent(id)}` : "extensions");
            }}
            setSectionRoute={(section) => {
              const path = section === "all" ? "extensions" : `extensions/${section}`;
              navigateSettingsPath(path);
            }}
            onRefresh={() => {
              void connectionsStore.refreshMcpServers();
              void extensionsStore.refreshPlugins();
            }}
            mcpView={({ initialFilter, onFilterChange, initialState, onStateChange, detailId, onDetailIdChange, onRefresh }) => (
              <McpView
                busy={busy}
                selectedWorkspaceRoot={selectedWorkspaceRoot}
                isRemoteWorkspace={isRemoteWorkspace}
                mcpServers={connectionsSnapshot.mcpServers}
                mcpStatus={connectionsSnapshot.mcpStatus}
                mcpLastUpdatedAt={connectionsSnapshot.mcpLastUpdatedAt}
                mcpStatuses={connectionsSnapshot.mcpStatuses}
                managedOAuthAvailable={connectionsSnapshot.managedOAuthAvailable}
                mcpConnectingName={connectionsSnapshot.mcpConnectingName}
                selectedMcp={connectionsSnapshot.selectedMcp}
                setSelectedMcp={(name) => connectionsStore.setSelectedMcp(name)}
                quickConnect={extensionItems.quickConnectEntries}
                enablementContext={enablementContext}
                builtInExtensionsDisabled={builtInExtensionsDisabled}
                connectMcp={(entry) => {
                  return connectionsStore.connectMcp(entry);
                }}
                configSlotForEntry={extensionController.configSlotForEntry}
                isExtensionConnected={extensionController.isConnected}
                authorizeMcp={(entry) => {
                  void connectionsStore.authorizeMcp(entry);
                }}
                logoutMcpAuth={(name) => connectionsStore.logoutMcpAuth(name)}
                removeMcp={(name) => {
                  void connectionsStore.removeMcp(name);
                }}
                setMcpEnabled={
                  routeOpenworkStatus === "connected" && routeOpenworkCapabilities?.mcp?.write
                    ? (name, enabled) => connectionsStore.setMcpEnabled(name, enabled)
                    : undefined
                }
                readConfigFile={(scope) => connectionsStore.readMcpConfigFile(scope)}
                installedSkills={extensionItems.installedSkills}
                installedCommands={libraryCommands}
                installedAgents={libraryAgents}
                availableConnectMcpServers={[]}
                availableConnectMcpStatuses={{}}
                inventoryLoading={false}
                installedPlugins={[]}
                orgMcpItems={[]}
                organizationName={null}
                orgMcpError={null}
                uninstallSkill={(name) => { void extensionsStore.uninstallSkill(name); }}
                removeCloudPlugin={() => {}}
                orgMcpConnectingId={null}
                connectOrgMcp={() => {}}
                reconnectOrgMcp={() => {}}
                orgMcpDisconnectingId={null}
                disconnectOrgMcp={() => {}}
                readSkill={(name) => extensionsStore.readSkill(name)}
                previewClaudePlugin={(url) => extensionsStore.previewClaudePlugin(url)}
                installClaudePlugin={(url) => extensionsStore.installClaudePlugin(url)}
                createLibraryItem={(kind, input) => extensionsStore.createLibraryItem(kind, input)}
                onLibraryListsRefresh={loadLibraryLists}
                initialFilter={initialFilter}
                onFilterChange={onFilterChange}
                initialState={initialState}
                onStateChange={onStateChange}
                detailId={detailId}
                onDetailIdChange={onDetailIdChange}
                onRefresh={onRefresh}
              />
            )}

          />
        );
      case "advanced":
        return (
          <AdvancedView
            busy={busy}
            clientConnected={Boolean(opencodeClient)}
            opencodeConnectStatus={null}
            openworkServerStatus={openworkServerSnapshot.openworkServerStatus}
            developerMode={developerMode}
            toggleDeveloperMode={() => setDeveloperMode((current) => {
              const next = !current;
              try { window.localStorage.setItem("openwork.developerMode", next ? "1" : "0"); } catch {}
              return next;
            })}
            opencodeDevModeEnabled={false}
            openDebugDeepLink={async () => ({ ok: false, message: "Debug deep links are not wired into the React settings route yet." })}
            canMigrateRuntimeConfig={Boolean(openworkClient && selectedWorkspaceId)}
            migrateRuntimeConfig={async () => {
              if (!openworkClient || !selectedWorkspaceId) {
                throw new Error("Select a workspace before migrating legacy runtime config.");
              }
              const result = await openworkClient.migrateRuntimeConfig(selectedWorkspaceId);
              if (result.migrated) {
                void connectionsStore.refreshMcpServers();
                void extensionsStore.refreshPlugins();
              }
              return { migrated: result.migrated, keys: result.keys };
            }}
            getRuntimeConfigStatus={async () => {
              if (!openworkClient || !selectedWorkspaceId) {
                throw new Error("Select a workspace to inspect runtime config.");
              }
              return openworkClient.getRuntimeConfigStatus(selectedWorkspaceId);
            }}
          />
        );
      case "appearance":
        return (
          <AppearanceView
            busy={busy}
            themeMode={themeMode}
            setThemeMode={setThemeModeState}
            language={currentLocale() as Language}
            setLanguage={setLocale}
            hideTitlebar={hideTitlebar}
            toggleHideTitlebar={() => setHideTitlebar((current) => !current)}
          />
        );
      case "environment":
        return (
          <EnvironmentView
            client={openworkServerSnapshot.openworkServerClient}
            isRemoteWorkspace={isRemoteWorkspace}
            onApplyChanges={isDesktopRuntime() && !isRemoteWorkspace ? handleApplyEnvironmentChanges : undefined}
            applyBlocked={activeReloadBlockingSessions.length > 0}
            applyBlockedReason={
              activeReloadBlockingSessions.length > 0
                ? t("settings.environment.apply_blocked_active_tasks")
                : null
            }
            runtimeKey={environmentRuntimeKey}
          />
        );
      default:
        return null;
    }
  })();

  return (
    <>
      {props.standaloneExtensions ? (
        <div data-extensions-main-surface className="flex h-full min-h-0 w-full flex-col overflow-hidden bg-background">
          <SettingsContent>{settingsView}</SettingsContent>
        </div>
      ) : (
        <SettingsShell
          activeTab={route.tab}
          onSelectTab={(tab) => navigateSettingsPath(tab)}
          developerMode={developerMode}
          selectedWorkspaceId={selectedWorkspaceId}
          selectedWorkspaceName={selectedWorkspaceName}
          selectedWorkspaceColor={selectedWorkspaceColor}
          workspaces={workspaceOptions}
          onSelectWorkspace={handleSelectSettingsWorkspace}
          headerStatus={routeOpenworkStatus}
          busyHint={loading ? t("session.loading_detail") : busyLabel}
          onClose={props.onClose ?? (() => navigate(selectedWorkspaceId ? workspaceSessionRoute(selectedWorkspaceId) : "/session"))}
          compact={props.embedded}
        >
          {settingsView}
        </SettingsShell>
      )}

      <CommandPalette
        open={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
        onCreateNewSession={() => void handleCreatePaletteSession()}
        onOpenSession={(workspaceId, sessionId) => {
          navigate(workspaceSessionRoute(workspaceId, sessionId));
        }}
        onOpenSettings={(path = "/settings/general") => {
          const settingsPath = path.replace(/^\/settings\//, "");
          if (props.standaloneExtensions) {
            navigate(
              selectedWorkspaceId
                ? workspaceSettingsRoute(selectedWorkspaceId, settingsPath)
                : `/settings/${settingsPath}`,
            );
            return;
          }
          navigateSettingsPath(settingsPath);
        }}
        onOpenExtensions={() => {
          const target = selectedWorkspaceId
            ? workspaceExtensionsRoute(selectedWorkspaceId)
            : globalExtensionsRoute();
          navigate(target);
        }}
        onOpenModelPicker={() => {
          modelPicker.setQuery("");
          modelPicker.setRecentProviderIds(new Set());
          window.requestAnimationFrame(() => modelPicker.setOpen(true));
        }}
        selectedModelLabel={defaultModelLabel}
        sessions={paletteSessionOptions}
      />

      <ProviderAuthModal
        open={providerModalOpen}
        loading={false}
        submitting={providerBusy}
        error={providerError}
        initialProvider={editingProvider}
        onSubmitManual={async (input) => {
          setProviderBusy(true);
          setProviderError(null);
          try {
            await saveManualProvider(input);
          } catch (error) {
            const message = error instanceof Error ? error.message : t("providers.manual_save_failed");
            setProviderError(message);
            throw error;
          } finally {
            setProviderBusy(false);
          }
        }}
        onTestConnection={async (input) => {
          setProviderBusy(true);
          setProviderError(null);
          try {
          let proxyUrl = input.proxyEnabled ? input.proxyUrl.trim() : "";
          if (proxyUrl && (input.proxyUsername.trim() || input.proxyPassword)) {
            const proxy = new URL(proxyUrl);
            if (input.proxyUsername.trim()) proxy.username = input.proxyUsername.trim();
            if (input.proxyPassword) proxy.password = input.proxyPassword;
            proxyUrl = proxy.toString();
          }
          if (input.proxyEnabled && !input.proxyPassword && editingProvider?.id === input.id) {
            proxyUrl = "";
          }
          const result = await providerGatewayTest({
            providerId: input.id,
            baseUrl: input.baseUrl,
            proxyUrl: proxyUrl || (input.proxyEnabled ? undefined : null),
          });
          if (!result.ok) throw new Error(result.stderr || result.stdout || "连接失败。");
          return result.stdout || "连接成功。";
          } catch (error) {
            const message = error instanceof Error ? error.message : t("providers.manual_test_failed");
            setProviderError(message);
            throw error;
          } finally {
            setProviderBusy(false);
          }
        }}
        onClose={() => {
          setEditingProvider(null);
          setProviderError(null);
          setProviderModalOpen(false);
        }}
      />
      <RenameWorkspaceModal
        open={renameWorkspaceId !== null}
        title={renameWorkspaceTitle}
        busy={renameWorkspaceBusy}
        canSave={!renameWorkspaceBusy && renameWorkspaceTitle.trim().length > 0}
        onClose={() => {
          if (renameWorkspaceBusy) return;
          setRenameWorkspaceId(null);
          setRenameWorkspaceTitle("");
        }}
        onSave={() => void handleSaveRenameWorkspace()}
        onTitleChange={setRenameWorkspaceTitle}
      />
      {shareWorkspaceState.shareWorkspaceOpen ? (
        <ShareWorkspaceModal
          open
          onClose={shareWorkspaceState.closeShareWorkspace}
          workspaceName={shareWorkspaceState.shareWorkspaceName}
          workspaceDetail={shareWorkspaceState.shareWorkspaceDetail}
          fields={shareWorkspaceState.shareFields}
          note={shareWorkspaceState.shareNote}
          onExportConfig={
            shareWorkspaceState.exportDisabledReason === null
              ? () => {
                  const id = shareWorkspaceState.shareWorkspaceId;
                  if (!id) return;
                  void handleExportWorkspaceConfig(id);
                }
              : undefined
          }
          exportDisabledReason={shareWorkspaceState.exportDisabledReason}
        />
      ) : null}
      <ConnectionsModals
        client={activeClient}
        projectDir={selectedWorkspaceRoot}
        reloadBlocked={activeReloadBlockingSessions.length > 0}
        activeSessions={activeReloadBlockingSessions}
        isRemoteWorkspace={selectedWorkspace?.workspaceType === "remote"}
        onForceStopSession={async (sessionId) => {
          if (!activeClient) return;
          await abortSessionSafe(activeClient, sessionId, undefined, {
            source: "settings.connections.force_stop_session",
            initiator: "user",
            reason: "force stop active session from connections modal",
          });
        }}
        onReloadEngine={reloadCoordinator.reloadWorkspaceEngine}
        modalState={{
          mcpAuthModalOpen: connectionsSnapshot.mcpAuthModalOpen,
          mcpAuthEntry: connectionsSnapshot.mcpAuthEntry,
          mcpAuthNeedsReload: connectionsSnapshot.mcpAuthNeedsReload,
        }}
        onCloseMcpAuthModal={() => connectionsStore.closeMcpAuthModal()}
        onCompleteMcpAuthModal={() => connectionsStore.completeMcpAuthModal()}
      />
      <ModelPickerModal
        open={modelPicker.open}
        options={modelPicker.options}
        query={modelPicker.query}
        setQuery={modelPicker.setQuery}
        target="default"
        current={
          local.prefs.defaultModel ?? { providerID: "", modelID: "" }
        }
        onSelect={(next: ModelRef) => {
          local.setPrefs((prev) => ({
            ...prev,
            defaultModel: next,
            modelVariant: prev.defaultModel?.providerID === next.providerID && prev.defaultModel.modelID === next.modelID
              ? prev.modelVariant
              : null,
          }));
          modelPicker.setOpen(false);
        }}
        onBehaviorChange={() => {}}
        onOpenSettings={() => {}}
        onClose={() => modelPicker.setOpen(false)}
      />
    </>
  );
}

export function SettingsRoute() {
  return <SettingsSurface />;
}

export function SettingsSurface(props: SettingsSurfaceProps) {
  return <SettingsRouteContent {...props} />;
}
