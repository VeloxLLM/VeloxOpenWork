export const LOCAL_DESKTOP_DISTRIBUTION = Object.freeze({
  flavor: String("local"),
  appName: "VeloxOpenWork",
  appIdentifier: "com.veloxllm.veloxopenwork",
  protocolScheme: "openwork",
  requireSignin: false,
  requireActivation: false,
});

export const PUBLIC_DESKTOP_DISTRIBUTION = LOCAL_DESKTOP_DISTRIBUTION;
export const CLOUD_DESKTOP_DISTRIBUTION = LOCAL_DESKTOP_DISTRIBUTION;
export const ENTERPRISE_DESKTOP_DISTRIBUTION = LOCAL_DESKTOP_DISTRIBUTION;

export function resolveDesktopDistribution(_options = {}) {
  return LOCAL_DESKTOP_DISTRIBUTION;
}

export function desktopActivationRequired(_distribution, _config) {
  return false;
}

export function enterpriseActivationComplete(_config) {
  return false;
}

export function enterprisePreactivationCommandAllowed(_command) {
  return false;
}
