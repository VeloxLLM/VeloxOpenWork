import { z } from "zod"
import type {
  RemoteMcpDiagnosticSink,
  RemoteMcpClock,
  RemoteMcpFetch,
  RemoteMcpOperationPhase,
  RemoteMcpRequestPhase,
} from "./contracts.js"
import { boundedRedactedResponseBodyExcerpt } from "./response-body-excerpt.js"

const jsonRpcRequestSchema = z.object({
  method: z.string(),
}).passthrough()

function requestBodyText(body: BodyInit | null | undefined): string | null {
  if (typeof body === "string") return body
  if (body instanceof URLSearchParams) return body.toString()
  return null
}

function bodyRequestPhase(body: BodyInit | null | undefined): RemoteMcpRequestPhase | null {
  const text = requestBodyText(body)
  if (!text) return null

  const form = new URLSearchParams(text)
  const grantType = form.get("grant_type")
  if (grantType === "authorization_code") return "oauth-token-exchange"
  if (grantType === "refresh_token") return "oauth-token-refresh"

  try {
    const parsed: unknown = JSON.parse(text)
    const request = jsonRpcRequestSchema.safeParse(parsed)
    if (!request.success) {
      if (typeof parsed === "object" && parsed !== null && "redirect_uris" in parsed) {
        return "oauth-client-registration"
      }
      return null
    }
    if (request.data.method === "initialize") return "mcp-initialize"
    if (request.data.method === "tools/list") return "mcp-tool-discovery"
    if (request.data.method === "tools/call") return "mcp-tool-execution"
    if (request.data.method === "resources/list" || request.data.method === "resources/templates/list") return "mcp-resource-discovery"
    if (request.data.method === "resources/read") return "mcp-resource-read"
  } catch {
    return null
  }

  return null
}

function isMcpRequestPhase(phase: RemoteMcpRequestPhase): boolean {
  return phase === "endpoint-request"
    || phase === "mcp-initialize"
    || phase === "mcp-tool-discovery"
    || phase === "mcp-tool-execution"
    || phase === "mcp-resource-discovery"
    || phase === "mcp-resource-read"
}

export function classifyRemoteMcpRequest(url: URL, init?: RequestInit): RemoteMcpRequestPhase {
  const bodyPhase = bodyRequestPhase(init?.body)
  if (bodyPhase) return bodyPhase

  if (url.pathname.includes("/.well-known/oauth-protected-resource")) {
    return "oauth-resource-discovery"
  }
  if (url.pathname.includes("/.well-known/oauth-authorization-server") || url.pathname.includes("/.well-known/openid-configuration")) {
    return "oauth-server-discovery"
  }
  if (init?.method === "POST" && url.pathname.includes("register")) {
    return "oauth-client-registration"
  }
  return "endpoint-request"
}

export type RemoteMcpRequestObserver = {
  fetch: RemoteMcpFetch
  lastRequestPhase(): RemoteMcpRequestPhase | null
  lastFailedRequestPhase(): RemoteMcpRequestPhase | null
  lastRequestFailure(): {
    requestPhase: RemoteMcpRequestPhase
    httpStatus?: number
    bearerChallenge: boolean
    insufficientScope: boolean
    invalidToken: boolean
  } | null
}

export function createRemoteMcpRequestObserver(input: {
  connectionId: string
  operationPhase: RemoteMcpOperationPhase
  fetch: RemoteMcpFetch
  diagnosticSink?: RemoteMcpDiagnosticSink
  signal: AbortSignal
  clock: RemoteMcpClock
}): RemoteMcpRequestObserver {
  let lastRequestPhase: RemoteMcpRequestPhase | null = null
  let lastFailedRequestPhase: RemoteMcpRequestPhase | null = null
  let lastRequestFailure: ReturnType<RemoteMcpRequestObserver["lastRequestFailure"]> = null
  const emitDiagnostic: RemoteMcpDiagnosticSink = (event) => {
    try {
      input.diagnosticSink?.(event)
    } catch {
      // Diagnostics must never change the request outcome they observe.
    }
  }

  return {
    lastRequestPhase: () => lastRequestPhase,
    lastFailedRequestPhase: () => lastFailedRequestPhase,
    lastRequestFailure: () => lastRequestFailure,
    fetch: async (rawUrl, init) => {
      const url = rawUrl instanceof URL ? rawUrl : new URL(rawUrl)
      const requestPhase = classifyRemoteMcpRequest(url, init)
      lastRequestPhase = requestPhase
      const startedAt = input.clock.now()
      emitDiagnostic({
        kind: "request",
        connectionId: input.connectionId,
        operationPhase: input.operationPhase,
        requestPhase,
        outcome: "started",
      })

      try {
        const signal = init?.signal
          ? AbortSignal.any([init.signal, input.signal])
          : input.signal
        const response = await input.fetch(rawUrl, { ...init, signal })
        if (!response.ok) {
          lastFailedRequestPhase = requestPhase
          const challenge = response.headers.get("www-authenticate")?.toLowerCase() ?? ""
          lastRequestFailure = {
            requestPhase,
            httpStatus: response.status,
            bearerChallenge: challenge.includes("bearer"),
            insufficientScope: challenge.includes("insufficient_scope"),
            invalidToken: challenge.includes("invalid_token"),
          }
        } else if (isMcpRequestPhase(requestPhase)) {
          // A successful retry proves that a preceding challenge was
          // recoverable. OAuth discovery/refresh requests deliberately do not
          // erase the resource's last rejection before that retry completes.
          lastRequestFailure = null
        }
        const responseBodyExcerpt = !response.ok && isMcpRequestPhase(requestPhase)
          ? await boundedRedactedResponseBodyExcerpt(response)
          : undefined
        emitDiagnostic({
          kind: "request",
          connectionId: input.connectionId,
          operationPhase: input.operationPhase,
          requestPhase,
          outcome: response.ok ? "succeeded" : "failed",
          durationMs: input.clock.now() - startedAt,
          httpStatus: response.status,
          ...(responseBodyExcerpt ? { responseBodyExcerpt } : {}),
        })
        return response
      } catch (error) {
        lastFailedRequestPhase = requestPhase
        lastRequestFailure = {
          requestPhase,
          bearerChallenge: false,
          insufficientScope: false,
          invalidToken: false,
        }
        emitDiagnostic({
          kind: "request",
          connectionId: input.connectionId,
          operationPhase: input.operationPhase,
          requestPhase,
          outcome: "failed",
          durationMs: input.clock.now() - startedAt,
        })
        throw error
      }
    },
  }
}
