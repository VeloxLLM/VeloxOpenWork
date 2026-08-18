export const LOCAL_DESKTOP_DISTRIBUTION = Object.freeze({
  flavor: String("local"),
  appName: "VeloxOpenWork",
  appIdentifier: "com.veloxllm.veloxopenwork",
  protocolScheme: "openwork",
  requireSignin: false,
  requireActivation: false,
});

export function resolveDesktopDistribution(_options = {}) {
  return LOCAL_DESKTOP_DISTRIBUTION;
}
