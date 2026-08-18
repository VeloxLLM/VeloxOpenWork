import { createServer } from "node:http";
import { ProxyAgent, fetch as undiciRequest } from "undici";

const MAX_REQUEST_BYTES = 12 * 1024 * 1024;

function providerPath(pathname) {
  const match = pathname.match(/^\/provider\/([^/]+)(\/.*)?$/);
  if (!match) return null;
  return { providerId: decodeURIComponent(match[1]), suffix: match[2] || "/" };
}

function validateTarget(value) {
  const target = new URL(value);
  if (!/^https?:$/.test(target.protocol)) throw new Error("Only HTTP and HTTPS provider URLs are supported.");
  return target;
}

function validateProxy(value) {
  if (!value?.trim()) return null;
  const proxy = new URL(value);
  if (!/^https?:$/.test(proxy.protocol)) throw new Error("Only HTTP and HTTPS proxies are supported.");
  return proxy;
}

async function readBody(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > MAX_REQUEST_BYTES) throw new Error("Provider request body is too large.");
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

export function createProviderGateway({ getProxyUrl }) {
  const agents = new Map();
  let server = null;
  let address = null;

  async function proxyRequest(request, response) {
    const route = providerPath(new URL(request.url, "http://127.0.0.1").pathname);
    if (!route) {
      response.writeHead(404, { "content-type": "application/json" });
      response.end(JSON.stringify({ error: "Provider gateway route not found" }));
      return;
    }

    try {
      const incoming = new URL(request.url, "http://127.0.0.1");
      const targetBase = validateTarget(incoming.searchParams.get("target") || "");
      const target = new URL(targetBase.toString());
      const basePath = target.pathname.replace(/\/$/, "");
      target.pathname = `${basePath}${route.suffix}`.replace(/\/+/g, "/");
      target.search = incoming.search;
      target.searchParams.delete("target");

      const proxyValue = await getProxyUrl(route.providerId);
      const proxy = validateProxy(proxyValue);
      const proxyKey = proxy?.toString() || "direct";
      let dispatcher = agents.get(proxyKey);
      if (!dispatcher) {
        dispatcher = proxy ? new ProxyAgent({ uri: proxy.toString() }) : undefined;
        if (dispatcher) agents.set(proxyKey, dispatcher);
      }

      const body = ["GET", "HEAD"].includes(request.method || "GET") ? undefined : await readBody(request);
      const upstream = await undiciRequest(target, {
        method: request.method,
        headers: copyRequestHeaders(request),
        body,
        dispatcher,
        signal: request.signal,
      });
      response.statusCode = upstream.status;
      copyResponseHeaders(upstream, response);
      if (!upstream.body) {
        response.end();
        return;
      }
      for await (const chunk of upstream.body) response.write(chunk);
      response.end();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Provider request failed";
      const status = /proxy|connect|timeout|fetch/i.test(message) ? 502 : 400;
      response.writeHead(status, { "content-type": "application/json" });
      response.end(JSON.stringify({ error: message }));
    }
  }

  return {
    async start() {
      if (server) return address;
      server = createServer((request, response) => {
        void proxyRequest(request, response);
      });
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
    },
    async test(input) {
      const target = validateTarget(input.baseUrl);
      const proxy = validateProxy(input.proxyUrl);
      const dispatcher = proxy ? new ProxyAgent({ uri: proxy.toString() }) : undefined;
      try {
        const response = await undiciRequest(target, { method: "GET", dispatcher });
        if (!response.ok) throw new Error(`Provider returned HTTP ${response.status}`);
        return { ok: true, status: response.status, stdout: `Connected to ${target.origin}`, stderr: "" };
      } finally {
        await dispatcher?.close().catch(() => undefined);
      }
    },
    async stop() {
      for (const agent of agents.values()) await agent.close().catch(() => undefined);
      agents.clear();
      if (server) await new Promise((resolve) => server.close(() => resolve()));
      server = null;
      address = null;
    },
  };
}
