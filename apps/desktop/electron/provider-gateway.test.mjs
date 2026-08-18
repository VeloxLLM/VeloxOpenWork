import assert from "node:assert/strict";
import { createServer } from "node:http";
import test from "node:test";

import { createProviderGateway } from "./provider-gateway.mjs";

async function listen(handler) {
  const server = createServer(handler);
  await new Promise((resolve) => server.listen(0, () => resolve(undefined)));
  const info = server.address();
  if (!info || typeof info === "string") throw new Error("Expected an IP socket");
  return {
    url: `http://127.0.0.1:${info.port}`,
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}

test("gateway only forwards registered tokenized provider routes", async () => {
  const upstream = await listen((request, response) => {
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify({ path: request.url }));
  });
  const gateway = createProviderGateway({ getProxyUrl: async () => null });
  try {
    const registered = await gateway.register({ providerId: "kilo", baseUrl: `${upstream.url}/v1?source=base` });
    const response = await fetch(`${registered}/models?request=one`);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { path: "/v1/models?source=base&request=one" });

    const gatewayOrigin = new URL(registered).origin;
    const unregistered = await fetch(`${gatewayOrigin}/provider/kilo?target=${encodeURIComponent(upstream.url)}`);
    assert.equal(unregistered.status, 404);
  } finally {
    await gateway.stop();
    await upstream.close();
  }
});

test("gateway preserves SSE streaming responses", async () => {
  const upstream = await listen((_request, response) => {
    response.writeHead(200, { "content-type": "text/event-stream" });
    response.write("data: first\n\n");
    setTimeout(() => response.end("data: second\n\n"), 10);
  });
  const gateway = createProviderGateway({ getProxyUrl: async () => null });
  try {
    const registered = await gateway.register({ providerId: "stream", baseUrl: upstream.url });
    const response = await fetch(registered);
    assert.equal(response.headers.get("content-type"), "text/event-stream");
    assert.equal(await response.text(), "data: first\n\ndata: second\n\n");
  } finally {
    await gateway.stop();
    await upstream.close();
  }
});

test("gateway reports a localized timeout", async () => {
  const upstream = await listen(() => {});
  const gateway = createProviderGateway({ getProxyUrl: async () => null, requestTimeoutMs: 20 });
  try {
    const registered = await gateway.register({ providerId: "slow", baseUrl: upstream.url });
    const response = await fetch(registered);
    assert.equal(response.status, 504);
    assert.deepEqual(await response.json(), { error: "代理连接超时" });
  } finally {
    await gateway.stop();
    await upstream.close();
  }
});
