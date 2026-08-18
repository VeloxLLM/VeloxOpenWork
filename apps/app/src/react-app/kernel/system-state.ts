import { useCallback, useMemo, useState } from "react";

import type {
  ReloadReason,
  ReloadTrigger,
} from "../../app/types";
import {
  safeStringify,
} from "../../app/utils";
import { t } from "../../i18n";

export type ReloadState = {
  reloadPending: boolean;
  reloadReasons: ReloadReason[];
  reloadLastTriggeredAt: number | null;
  reloadTrigger: ReloadTrigger | null;
  reloadBusy: boolean;
  reloadError: string | null;
};

export type SystemStateControls = {
  reload: ReloadState;
  reloadCopy: { title: string; body: string };
  markReloadRequired: (reason: ReloadReason, trigger?: ReloadTrigger) => void;
  clearReloadRequired: () => void;
  reloadWorkspaceEngine: () => Promise<void>;
  canReloadWorkspaceEngine: boolean;
  setError: (message: string | null) => void;
};

type UseSystemStateOptions = {
  hasActiveRuns: () => boolean;
  reloadWorkspaceEngine?: () => Promise<boolean>;
  canReloadWorkspaceEngine?: () => boolean;
  onReloadComplete?: () => void | Promise<void>;
  setError: (message: string | null) => void;
};

export function useSystemState(
  options: UseSystemStateOptions,
): SystemStateControls {
  const [reloadPending, setReloadPending] = useState(false);
  const [reloadReasons, setReloadReasons] = useState<ReloadReason[]>([]);
  const [reloadLastTriggeredAt, setReloadLastTriggeredAt] = useState<
    number | null
  >(null);
  const [reloadTrigger, setReloadTrigger] = useState<ReloadTrigger | null>(null);
  const [reloadBusy, setReloadBusy] = useState(false);
  const [reloadError, setReloadError] = useState<string | null>(null);

  const markReloadRequired = useCallback(
    (reason: ReloadReason, trigger?: ReloadTrigger) => {
      setReloadPending(true);
      setReloadLastTriggeredAt(Date.now());
      setReloadReasons((current) =>
        current.includes(reason) ? current : [...current, reason],
      );
      setReloadTrigger(
        trigger ??
          ({
            type:
              reason === "plugins"
                ? "plugin"
                : reason === "skills"
                  ? "skill"
                  : reason === "agents"
                    ? "agent"
                    : reason === "commands"
                      ? "command"
                      : reason,
          } as ReloadTrigger),
      );
    },
    [],
  );

  const clearReloadRequired = useCallback(() => {
    setReloadPending(false);
    setReloadReasons([]);
    setReloadTrigger(null);
    setReloadError(null);
  }, []);

  const reloadCopy = useMemo(() => {
    const title = t("system.reload_required");
    const bodyKey =
      reloadReasons.length === 1 && reloadReasons[0] === "plugins"
        ? "system.reload_body_plugins"
        : reloadReasons.length === 1 && reloadReasons[0] === "skills"
          ? "system.reload_body_skills"
          : reloadReasons.length === 1 && reloadReasons[0] === "agents"
            ? "system.reload_body_agents"
            : reloadReasons.length === 1 && reloadReasons[0] === "commands"
              ? "system.reload_body_commands"
              : reloadReasons.length === 1 && reloadReasons[0] === "config"
                ? "system.reload_body_config"
                : reloadReasons.length === 1 && reloadReasons[0] === "mcp"
                  ? "system.reload_body_mcp"
                  : reloadReasons.length > 0
                    ? "system.reload_body_mixed"
                    : "system.reload_body_default";
    return { title, body: t(bodyKey) };
  }, [reloadReasons]);

  const canReloadWorkspaceEngine =
    !reloadBusy && options.canReloadWorkspaceEngine?.() !== false;

  const reloadWorkspaceEngine = useCallback(async () => {
    if (reloadBusy) return;
    if (options.canReloadWorkspaceEngine?.() === false) {
      setReloadError(t("system.reload_unavailable"));
      return;
    }
    setReloadBusy(true);
    setReloadError(null);
    options.setError(null);
    try {
      const ok = options.reloadWorkspaceEngine
        ? await options.reloadWorkspaceEngine()
        : false;
      if (ok === false) {
        setReloadError(t("system.reload_failed"));
        return;
      }
      await options.onReloadComplete?.();
      clearReloadRequired();
    } catch (error) {
      const message = error instanceof Error ? error.message : safeStringify(error);
      setReloadError(message || t("system.reload_failed"));
    } finally {
      setReloadBusy(false);
    }
  }, [clearReloadRequired, options, reloadBusy]);

  return useMemo<SystemStateControls>(
    () => ({
      reload: {
        reloadPending,
        reloadReasons,
        reloadLastTriggeredAt,
        reloadTrigger,
        reloadBusy,
        reloadError,
      },
      reloadCopy,
      markReloadRequired,
      clearReloadRequired,
      reloadWorkspaceEngine,
      canReloadWorkspaceEngine,
      setError: options.setError,
    }),
    [
      clearReloadRequired,
      markReloadRequired,
      options.setError,
      reloadCopy,
      reloadBusy,
      reloadWorkspaceEngine,
      canReloadWorkspaceEngine,
      reloadError,
      reloadLastTriggeredAt,
      reloadPending,
      reloadReasons,
      reloadTrigger,
    ],
  );
}
