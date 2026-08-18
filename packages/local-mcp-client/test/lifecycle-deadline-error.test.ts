import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { ErrorCode, McpError } from "@modelcontextprotocol/sdk/types.js"
import {
  RemoteMcpClientError,
  RemoteMcpLifecycleDeadlineError,
  isRemoteMcpLifecycleDeadline,
} from "../src/index.js"

describe("lifecycle deadline error", () => {
  it("aborts with an McpError so the SDK rethrows it instead of stringifying the reason", () => {
    const error = new RemoteMcpLifecycleDeadlineError("tool-execution")

    // The SDK only passes an abort reason through untouched when it is already
    // an McpError; anything else becomes String(reason) on a new RequestTimeout.
    assert.ok(error instanceof McpError)
    assert.equal(error.code, ErrorCode.RequestTimeout)
    assert.equal(error.operationPhase, "tool-execution")
    assert.match(error.message, /exceeded its lifecycle deadline/)
  })

  it("carries a marker that survives an SDK round trip", () => {
    const reason = new RemoteMcpLifecycleDeadlineError("tool-execution")
    const rethrown = reason instanceof McpError ? reason : new McpError(ErrorCode.RequestTimeout, String(reason))

    assert.ok(isRemoteMcpLifecycleDeadline(rethrown))
  })

  it("detects the deadline through a wrapped cause chain", () => {
    const wrapped = new RemoteMcpClientError({
      operationPhase: "tool-execution",
      requestPhase: "mcp-tool-execution",
      cause: new RemoteMcpLifecycleDeadlineError("tool-execution"),
    })

    assert.ok(isRemoteMcpLifecycleDeadline(wrapped))
  })

  it("does not claim a provider's own RequestTimeout as ours", () => {
    const providerError = new McpError(ErrorCode.RequestTimeout, "upstream is busy", { provider_detail: "busy" })

    assert.equal(isRemoteMcpLifecycleDeadline(providerError), false)
    assert.equal(isRemoteMcpLifecycleDeadline(new Error("unrelated")), false)
    assert.equal(isRemoteMcpLifecycleDeadline(undefined), false)
  })
})
