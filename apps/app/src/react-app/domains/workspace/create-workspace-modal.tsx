/** @jsxImportSource react */
import { useEffect, useMemo, useState } from "react";

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { t } from "../../../i18n";
import { CreateWorkspaceLocalPanel } from "./create-workspace-local-panel";
import type { CreateWorkspaceModalProps } from "./types";

export function CreateWorkspaceModal(props: CreateWorkspaceModalProps) {
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [pickingFolder, setPickingFolder] = useState(false);
  const [projectLabel, setProjectLabel] = useState("");
  const [showProgressDetails, setShowProgressDetails] = useState(false);
  const [now, setNow] = useState(Date.now());
  const preset = props.defaultPreset ?? "starter";
  const submitting = props.submitting ?? false;
  const progress = props.submittingProgress ?? null;

  useEffect(() => {
    if (!props.open) return;
    setSelectedFolder(null);
    setProjectLabel("");
    setShowProgressDetails(false);
  }, [props.open]);

  useEffect(() => {
    if (!submitting) return;
    const timer = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(timer);
  }, [submitting]);

  const workerDebugLines = useMemo(
    () => (props.workerDebugLines ?? []).map((line) => line.trim()).filter(Boolean),
    [props.workerDebugLines],
  );
  const elapsedSeconds = progress?.startedAt
    ? Math.max(0, Math.floor((now - progress.startedAt) / 1000))
    : 0;

  async function pickFolder() {
    if (pickingFolder || props.localDisabled) return;
    setPickingFolder(true);
    try {
      const next = await props.onPickFolder();
      if (next) setSelectedFolder(next);
    } finally {
      setPickingFolder(false);
    }
  }

  return (
    <Dialog open={props.open} onOpenChange={(open) => { if (!open) props.onClose(); }}>
      <DialogContent showCloseButton={props.showClose ?? true} className="flex max-h-[90vh] min-h-0 w-full max-w-xl flex-col overflow-hidden sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{props.title ?? t("dashboard.create_local_workspace_title")}</DialogTitle>
          <DialogDescription>{props.subtitle ?? props.localDisabledReason ?? t("dashboard.create_local_workspace_subtitle")}</DialogDescription>
        </DialogHeader>
        <CreateWorkspaceLocalPanel
          selectedFolder={selectedFolder}
          hasSelectedFolder={Boolean(selectedFolder?.trim())}
          pickingFolder={pickingFolder}
          onPickFolder={() => void pickFolder()}
          projectLabel={props.showProjectLabel === false ? "" : projectLabel}
          onProjectLabelInput={setProjectLabel}
          showProjectLabel={props.showProjectLabel ?? true}
          submitting={submitting}
          localError={props.localError?.trim() || null}
          onClose={props.onClose}
          onSubmit={() => props.onConfirm(preset, selectedFolder, { projectLabel: projectLabel.trim() || null })}
          confirmLabel={props.confirmLabel}
          workerLabel={props.workerLabel}
          onConfirmWorker={props.onConfirmWorker}
          preset={preset}
          workerSubmitting={props.workerSubmitting ?? false}
          workerDisabled={Boolean(props.workerDisabled)}
          workerDisabledReason={props.workerDisabledReason?.trim() ?? ""}
          workerCtaLabel={props.workerCtaLabel}
          workerCtaDescription={props.workerCtaDescription}
          onWorkerCta={props.onWorkerCta}
          workerRetryLabel={props.workerRetryLabel}
          onWorkerRetry={props.onWorkerRetry}
          workerDebugLines={workerDebugLines}
          progress={progress}
          elapsedSeconds={elapsedSeconds}
          showProgressDetails={showProgressDetails}
          onToggleProgressDetails={() => setShowProgressDetails((value) => !value)}
        />
      </DialogContent>
    </Dialog>
  );
}
