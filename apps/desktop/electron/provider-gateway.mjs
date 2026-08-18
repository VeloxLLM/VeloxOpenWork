import { randomBytes } from "node:crypto";
import { createServer } from "node:http";
import { ProxyAgent, fetch as undiciRequest } from "undici";

const MAX_REQUEST_BYTES = 12 * 1024 * 1024;
const DEFAULT_TIMEOUT_MS = 30_000;

function validateProviderId(value) {
  const providerId = String(value ?? "").trim();
  if (!/^[a-z0-9][a-z0-9._-]*$/i.test(providerId)) throw new Error("Provider ID 无效");
  return providerId;
}

function validateTarget(value) {
  const target = new URL(value);
  if (!/^https?:$/.test(target.protocol)) throw new Error("Provider 地址无效：仅支持 HTTP/HTTPS");
  return target;
}

function validateProxy(value) {
  if (!value?.trim()) return null;
  const proxy = new URL(value);
  if (!/^https?:$/.test(proxy.protocol)) throw new Error("代理地址无效：仅支持 HTTP/HTTPS 代理");
  return proxy;
}

async function readBody(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > MAX_REQUEST_BYTES) throw new Error("Provider 请求内容过大");
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

function copyRequestHeaders(request) {
  const headers = new Headers();
  for (const [name, value] of Object.entries(request.headers)) {
    if (!value || ["connection", "content-length", "host", "proxy-authorization"].includes(name.toLowerCase())) continue;
    headers.set(name, Array.isArray(value) ? value.join(", ") : value);
  }
  return headers;
}

function copyResponseHeaders(response, target) {
  for (const [name, value] of response.headers) {
    if (["connection", "content-length", "transfer-encoding"].includes(name.toLowerCase())) continue;
    target.setHeader(name, value);
  }
}

function gatewayError(error) {
  const message = error instanceof Error ? error.message : String(error ?? "");
  if (/abort|timeout|timed out/i.test(message)) return { status: 504, message: "代理连接超时" };
  if (/407|proxy authentication/i.test(message)) return { status: 502, message: "代理认证失败" };
  if (/proxy/i.test(message)) return { status: 502, message: "代理无法连接" };
  if (/connect|fetch|socket|network|ECONN/i.test(message)) return { status: 502, message: "目标 Provider 无法连接" };
  return { status: 400, message };
}

export function createProviderGateway({ getProxyUrl, requestTimeoutMs = DEFAULT_TIMEOUT_MS }) {
  const agents = new Map();
  const targets = new Map();
  const accessToken = randomBytes(24).toString("hex");
  let server = null;
  let address = null;

  function providerRoute(pathname) {
    const prefix = `/${accessToken}/provider/`;
    if (!pathname.startsWith(prefix)) return null;
    const rest = pathname.slice(prefix.length);
    const firstSlash = rest.indexOf("/");
    if (firstSlash < 0) return null;
    const encodedId = rest.slice(0, firstSlash);
    const targetAndSuffix = rest.slice(firstSlash + 1);
    const secondSlash = targetAndSuffix.indexOf("/");
    const encodedTarget = secondSlash < 0 ? targetAndSuffix : targetAndSuffix.slice(0, secondSlash);
    if (!encodedId || !encodedTarget) return null;
    return {
      providerId: decodeURIComponent(encodedId),
      targetMarker: encodedTarget,
      suffix: secondSlash < 0 ? "/" : targetAndSuffix.slice(secondSlash),
    };
  }

  async function dispatcherFor(providerId, overrideProxy) {
    const proxy = validateProxy(overrideProxy === undefined ? await getProxyUrl(providerId) : overrideProxy);
    if (!proxy) return undefined;
    const key = proxy.toString();
    let dispatcher = agents.get(key);
    if (!dispatcher) {
      dispatcher = new ProxyAgent({ uri: key });
      agents.set(key, dispatcher);
    }
    return dispatcher;
  }

  async function proxyRequest(request, response) {
    const incoming = new URL(request.url, "http://127.0.0.1");
    const route = providerRoute(incoming.pathname);
    const registered = route ? targets.get(route.providerId) : null;
    if (!route || !registered || registered.marker !== route.targetMarker) {
      response.writeHead(404, { "content-type": "application/json; charset=utf-8" });
      response.end(JSON.stringify({ error: "Provider Gateway 路由不存在" }));
      return;
    }

    try {
      const target = new URL(registered.target.toString());
      target.pathname = `${target.pathname.replace(/\/$/, "")}${route.suffix}`.replace(/\/+/g, "/");
      for (const [name, value] of incoming.searchParams) {
        if (name !== "target") target.searchParams.append(name, value);
      }
      const dispatcher = await dispatcherFor(route.providerId);
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), requestTimeoutMs);
      request.once("aborted", () => controller.abort());
      try {
        const body = ["GET", "HEAD"].includes(request.method || "GET") ? undefined : await readBody(request);
        const upstream = await undiciRequest(target, {
          method: request.method,
          headers: copyRequestHeaders(request),
          body,
          dispatcher,
          signal: controller.signal,
        });
        response.statusCode = upstream.status;
        copyResponseHeaders(upstream, response);
        if (upstream.body) {
          for await (const chunk of upstream.body) response.write(chunk);
        }
        response.end();
      } finally {
        clearTimeout(timeout);
      }
    } catch (error) {
      const failure = gatewayError(error);
      if (!response.headersSent) response.writeHead(failure.status, { "content-type": "application/json; charset=utf-8" });
      response.end(JSON.stringify({ error: failure.message }));
    }
  }

  async function start() {
    if (server) return address;
    server = createServer((request, response) => void proxyRequest(request, response));
    await new Promise((resolve, reject) => {
      server.once("error", reject);
      server.listen({ host: "127.0.0.1", port: 0 }, () => {
        server.off("error", reject);
        resolve();
      });
    });
    const info = server.address();
    address = info && typeof info === "object" ? `http://127.0.0.1:${info.port}` : null;
    return address;
  }

  return {
    start,
    async register(input) {
      const providerId = validateProviderId(input.providerId);
      const target = validateTarget(input.baseUrl);
      const gatewayUrl = await start();
      const marker = encodeURIComponent(target.toString().replace(/\/$/, ""));
      targets.set(providerId, { target, marker });
      if (!gatewayUrl) return null;
      // The endpoint is encoded as one path segment so SDKs can safely append
      // /models and other paths. It is also checked against the in-memory
      // allowlist and cannot override the registered target.
      return new URL(
        `/${accessToken}/provider/${encodeURIComponent(providerId)}/${marker}`,
        gatewayUrl,
      ).toString().replace(/\/$/, "");
    },
    async test(input) {
      validateProviderId(input.providerId);
      const target = validateTarget(input.baseUrl);
      const proxy = validateProxy(input.proxyUrl);
      const dispatcher = proxy ? new ProxyAgent({ uri: proxy.toString() }) : undefined;
      try {
        const response = await undiciRequest(target, {
          method: "GET",
          dispatcher,
          signal: AbortSignal.timeout(requestTimeoutMs),
        });
        if (response.status === 401 || response.status === 403) throw new Error("Provider 返回认证失败");
        if (response.status === 429) throw new Error("Provider 返回限流");
        if (response.status >= 500) throw new Error(`Provider 服务异常（HTTP ${response.status}）`);
        return { ok: true, status: response.status, stdout: `已连接到 ${target.origin}`, stderr: "" };
      } catch (error) {
        const failure = gatewayError(error);
        return { ok: false, status: failure.status, stdout: "", stderr: failure.message };
      } finally {
        await dispatcher?.close().catch(() => undefined);
      }
    },
    async stop() {
      for (const agent of agents.values()) await agent.close().catch(() => undefined);
      agents.clear();
      targets.clear();
      if (server) await new Promise((resolve) => server.close(() => resolve()));
      server = null;
      address = null;
    },
  };
}
