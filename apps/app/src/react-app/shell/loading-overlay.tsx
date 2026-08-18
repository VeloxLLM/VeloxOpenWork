/** @jsxImportSource react */
import { bootOverlayCanHide, useBootState, useBootOverlayVisible } from "./boot-state";

/** Minimal local-runtime boot surface without version recovery actions. */
export function LoadingOverlay() {
  const visible = useBootOverlayVisible();
  const { phase, routeReady, message, error } = useBootState();
  if (!visible) return null;
  const fading = bootOverlayCanHide(phase, routeReady);
  return (
    <div
      className={`pointer-events-auto fixed inset-0 z-[1000] flex items-center justify-center bg-dls-surface transition-opacity duration-[160ms] ${fading ? "opacity-0" : "opacity-100"}`}
      aria-live="polite"
      aria-busy={!fading}
      role="status"
    >
      <div className="flex max-w-[360px] flex-col gap-3 px-6 text-center">
        <div className="text-base font-medium text-dls-primary">VeloxOpenWork</div>
        <div className="text-sm text-dls-secondary">{error ?? message ?? "正在启动本地工作区..."}</div>
        {error ? <div className="text-xs text-destructive">请检查本地运行时后重新启动应用。</div> : null}
      </div>
    </div>
  );
}
