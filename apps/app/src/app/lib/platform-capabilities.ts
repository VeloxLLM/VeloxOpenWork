import { isElectronRuntime } from "./runtime-env";

export type PlatformCapabilities = {
  nativeFilePicker: boolean;
  revealInFileManager: boolean;
  terminal: boolean;
  osNotifications: boolean;
  localRuntimeControl: boolean;
  desktopBootstrap: boolean;
};

export function platformCapabilities(): PlatformCapabilities {
  const desktop = isElectronRuntime();
  return {
    nativeFilePicker: desktop,
    revealInFileManager: desktop,
    terminal: desktop,
    osNotifications: desktop,
    localRuntimeControl: desktop,
    desktopBootstrap: desktop,
  };
}
