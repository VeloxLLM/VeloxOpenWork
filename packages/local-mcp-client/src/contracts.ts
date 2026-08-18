import type { OAuthDiscoveryState } from "@modelcontextprotocol/sdk/client/auth.js"
import type { OAuthClientInformationMixed, OAuthTokens } from "@modelcontextprotocol/sdk/shared/auth.js"
import type { Client } from "@modelcontextprotocol/sdk/client/index.js"
import type { Implementation, ServerCapabilities, Tool } from "@modelcontextprotocol/sdk/types.js"

/** Epoch milliseconds. The package never reads a database or environment clock. */
export type RemoteMcpEpochMs = number

export type RemoteMcpFetch = (url: string | URL, init?: RequestInit) => Promise<Response>

export interface RemoteMcpClock {
  now(): RemoteMcpEpochMs
}

export type RemoteMcpLifecycle = {
  expiresAt: RemoteMcpEpochMs
  signal: AbortSignal
}

export type RemoteMcpPersistenceContext = {
  connectionId: string
  /**
   * A persistence adapter must reject or roll back a write that cannot commit
   * before this absolute deadline. Checking only before a database call is not
   * sufficient because the operation may settle after its caller timed out.
   */
  commitExpiresAt: RemoteMcpEpochMs
  signal: AbortSignal
}

export type RemoteMcpOAuthClientRegistration = {
  clientInformation: OAuthClientInformationMixed
  /** Opaque adapter-owned compare-and-swap revision. */
  revision: string
  /** Absolute client/client-secret expiration, when the provider declares one. */
  expiresAt?: RemoteMcpEpochMs
  source: "pre-registered" | "client-metadata" | "dynamic"
}

export interface RemoteMcpOAuthClientRegistrationPort {
  load(context: RemoteMcpPersistenceContext): Promise<RemoteMcpOAuthClientRegistration | undefined>
  /**
   * First-writer-wins for concurrent dynamic registration. Implementations
   * return the winning record and never silently replace a different client.
   */
  save(input: {
    context: RemoteMcpPersistenceContext
    clientInformation: OAuthClientInformationMixed
    expiresAt?: RemoteMcpEpochMs
    source: "client-metadata" | "dynamic"
  }): Promise<RemoteMcpOAuthClientRegistration>
  invalidate(input: {
    context: RemoteMcpPersistenceContext
    reason: "expired" | "provider-rejected"
  }): Promise<void>
}

export interface RemoteMcpOAuthDiscoveryPort {
  load(context: RemoteMcpPersistenceContext): Promise<OAuthDiscoveryState | undefined>
  save(input: {
    context: RemoteMcpPersistenceContext
    state: OAuthDiscoveryState
  }): Promise<void>
  invalidate(input: {
    context: RemoteMcpPersistenceContext
    reason: "issuer-mismatch" | "provider-rejected"
  }): Promise<void>
}

export type RemoteMcpOAuthCredential = {
  tokens: OAuthTokens
  /** Absolute access-token expiration, computed when tokens are committed. */
  expiresAt?: RemoteMcpEpochMs
  /** Opaque adapter-owned compare-and-swap revision. */
  revision: string
}

export type RemoteMcpOAuthAuthorizationHandle = {
  id: string
  /** Opaque single-use transaction revision. */
  revision: string
  expiresAt: RemoteMcpEpochMs
  clientRegistrationRevision?: string
}

export interface RemoteMcpOAuthAuthorizationPort {
  /**
   * Persist a bounded PKCE transaction. The id is the caller's signed OAuth
   * state and must be stored as a keyed hash or equivalent non-reversible key.
   */
  begin(input: {
    context: RemoteMcpPersistenceContext
    id: string
    codeVerifier: string
    expiresAt: RemoteMcpEpochMs
    clientRegistrationRevision?: string
  }): Promise<void>
  /** Load without consuming; successful token commit consumes atomically. */
  load(input: {
    context: RemoteMcpPersistenceContext
    id: string
  }): Promise<{ handle: RemoteMcpOAuthAuthorizationHandle; codeVerifier: string } | undefined>
  invalidate(input: {
    context: RemoteMcpPersistenceContext
    id: string
    reason: "expired" | "abandoned" | "provider-rejected"
  }): Promise<void>
}

export interface RemoteMcpOAuthCredentialPort {
  load(context: RemoteMcpPersistenceContext): Promise<RemoteMcpOAuthCredential | undefined>
  /**
   * For authorization-code commits, the adapter MUST atomically validate and
   * consume `authorization`, validate `clientRegistrationRevision`, persist
   * the tokens, and enforce `context.commitExpiresAt`. Refresh commits enforce
   * the same lifecycle fence but do not consume an authorization transaction.
   */
  save(input: {
    context: RemoteMcpPersistenceContext
    tokens: OAuthTokens
    expiresAt?: RemoteMcpEpochMs
    source: "authorization-code" | "refresh"
    authorization?: RemoteMcpOAuthAuthorizationHandle
    clientRegistrationRevision?: string
    /** Required for refresh commits; rejects a response based on stale tokens. */
    expectedCredentialRevision?: string
  }): Promise<void>
  invalidate(input: {
    context: RemoteMcpPersistenceContext
    reason: "expired" | "provider-rejected" | "post-authorization-validation-failed"
  }): Promise<void>
}

/** Application-owned ports. No database, tenant, or deployment shape leaks in. */
export type RemoteMcpOAuthPersistence = {
  clientRegistrations: RemoteMcpOAuthClientRegistrationPort
  credentials: RemoteMcpOAuthCredentialPort
  authorizations: RemoteMcpOAuthAuthorizationPort
  discovery?: RemoteMcpOAuthDiscoveryPort
}

export type RemoteMcpOAuthConfiguration = {
  applicationType: "web" | "native"
  clientMetadataUrl?: string
  authorizationServerIssuer?: string
  requestedScopes?: string[]
}

export type RemoteMcpRequestPhase =
  | "endpoint-request"
  | "oauth-resource-discovery"
  | "oauth-server-discovery"
  | "oauth-client-registration"
  | "oauth-token-exchange"
  | "oauth-token-refresh"
  | "mcp-initialize"
  | "mcp-tool-discovery"
  | "mcp-tool-execution"
  | "mcp-resource-discovery"
  | "mcp-resource-read"
  | "unknown-request"

export type RemoteMcpOperationPhase =
  | "configuration"
  | "requirements-discovery"
  | "connection-handshake"
  | "authorization-callback"
  | "protocol-initialize"
  | "tool-discovery"
  | "tool-execution"
  | "resource-discovery"
  | "resource-read"
  | "shutdown"

export type RemoteMcpDiagnosticEvent =
  | {
    kind: "request" | "operation"
    connectionId: string
    operationPhase: RemoteMcpOperationPhase
    requestPhase: RemoteMcpRequestPhase | null
    outcome: "started" | "succeeded" | "failed"
    durationMs?: number
    httpStatus?: number
    responseBodyExcerpt?: string
    protocolVersionFallback?: string
  }
  | {
    kind: "credential-invalidation"
    connectionId: string
    operationPhase: RemoteMcpOperationPhase
    requestPhase: RemoteMcpRequestPhase
    httpStatus?: number
    invalidToken: boolean
  }

export type RemoteMcpDiagnosticSink = (event: RemoteMcpDiagnosticEvent) => void

export type RemoteMcpAuthorization =
  | { type: "none" }
  | { type: "api-key"; token: string }
  | {
    type: "oauth"
    persistence: RemoteMcpOAuthPersistence
    configuration?: RemoteMcpOAuthConfiguration
  }

export type RemoteMcpConnection = {
  id: string
  serverUrl: string
  authorization: RemoteMcpAuthorization
}

export type RemoteMcpConnectInput = {
  connection: RemoteMcpConnection
  redirectUri: string
  /** Required only when OAuth must begin; normally a signed, expiring state. */
  authorizationId?: string
}

export type RemoteMcpConnectResult =
  | { status: "connected" }
  | { status: "needs_auth"; authorizeUrl: string }

export type RemoteMcpCompleteAuthorizationInput = {
  connection: RemoteMcpConnection
  redirectUri: string
  code: string
  /** The exact signed state returned by the provider callback. */
  authorizationId: string
}

export type RemoteMcpAbandonAuthorizationInput = {
  connection: RemoteMcpConnection
  authorizationId: string
  reason: "provider-rejected" | "abandoned"
}

export type RemoteMcpListToolsInput = {
  connection: RemoteMcpConnection
  redirectUri: string
}

export type RemoteMcpCallToolInput = {
  connection: RemoteMcpConnection
  redirectUri: string
  toolName: string
  arguments: Record<string, unknown>
}

export type RemoteMcpListResourcesInput = {
  connection: RemoteMcpConnection
  redirectUri: string
}

export type RemoteMcpReadResourceInput = {
  connection: RemoteMcpConnection
  redirectUri: string
  uri: string
}

export type RemoteMcpListResourceTemplatesInput = {
  connection: RemoteMcpConnection
  redirectUri: string
}

export type RemoteMcpToolResult = Awaited<ReturnType<Client["callTool"]>>
export type RemoteMcpResourceList = Awaited<ReturnType<Client["listResources"]>>["resources"]
export type RemoteMcpResourceTemplateList = Awaited<ReturnType<Client["listResourceTemplates"]>>["resourceTemplates"]
export type RemoteMcpResourceResult = Awaited<ReturnType<Client["readResource"]>>

export type RemoteMcpServerDescriptor = {
  capabilities: ServerCapabilities
  serverInfo?: Implementation
  instructions?: string
}

export type RemoteMcpRequirementWarning = {
  code: string
  message: string
}

export type RemoteMcpManualRequirement = {
  code: string
  label: string
  reason: string
  required: boolean
}

export type RemoteMcpAuthorizationServerRequirement = {
  issuer: string
  authorizationEndpoint?: string
  tokenEndpoint?: string
  registrationEndpoint?: string
  clientIdMetadataDocumentSupported: boolean
  scopesSupported?: string[]
  grantTypesSupported?: string[]
  codeChallengeMethodsSupported?: string[]
  tokenEndpointAuthMethodsSupported?: string[]
}

export type RemoteMcpConnectionRequirements = {
  status: "ready" | "manual_action_required" | "unsupported" | "unreachable"
  server: {
    url: string
    protocolVersion?: string
    initialize: "succeeded" | "authentication_required" | "failed"
  }
  authentication: {
    kind: "none" | "oauth" | "manual_bearer" | "unknown"
    resource?: string
    protectedResourceMetadataUrl?: string
    authorizationServers: RemoteMcpAuthorizationServerRequirement[]
    requiredScopes: string[]
    recommendedScopes: string[]
    refreshSupport: "supported" | "not_advertised" | "unknown"
    availableRegistrationMethods: Array<"pre_registered" | "client_metadata" | "dynamic">
    recommendedRegistrationMethod: "client_metadata" | "dynamic" | "pre_registered"
  }
  tools: {
    visibility: "available_without_auth" | "requires_auth" | "unavailable"
    count?: number
    items?: Array<{
      name: string
      readOnlyHint?: boolean
      destructiveHint?: boolean
      openWorldHint?: boolean
    }>
  }
  manualRequirements: RemoteMcpManualRequirement[]
  warnings: RemoteMcpRequirementWarning[]
}

export type DiscoverRemoteMcpConnectionRequirementsInput = {
  serverUrl: string
  fetch: RemoteMcpFetch
  timeoutMs?: number
  maxAuthorizationServers?: number
  maxTools?: number
}

export type RemoteMcpClientOptions = {
  /**
   * Required outbound port. The composition root owns SSRF, DNS rebinding,
   * proxy, TLS, redirect, response-size, and secret-forwarding policy.
   */
  fetch: RemoteMcpFetch
  clock?: RemoteMcpClock
  diagnosticSink?: RemoteMcpDiagnosticSink
  operationTimeoutMs?: number
  closeTimeoutMs?: number
  authorizationTransactionTtlMs?: number
  expirationSkewMs?: number
  clientName?: string
  clientVersion?: string
  lifecycle?: RemoteMcpLifecycle
}

export interface RemoteMcpClient {
  connect(input: RemoteMcpConnectInput): Promise<RemoteMcpConnectResult>
  completeAuthorization(input: RemoteMcpCompleteAuthorizationInput): Promise<void>
  abandonAuthorization(input: RemoteMcpAbandonAuthorizationInput): Promise<void>
  listTools(input: RemoteMcpListToolsInput): Promise<Tool[]>
  callTool(input: RemoteMcpCallToolInput): Promise<RemoteMcpToolResult>
  callToolRaw(input: RemoteMcpCallToolInput): Promise<RemoteMcpToolResult>
  listResources(input: RemoteMcpListResourcesInput): Promise<RemoteMcpResourceList>
  readResource(input: RemoteMcpReadResourceInput): Promise<RemoteMcpResourceResult>
  listResourceTemplates(input: RemoteMcpListResourceTemplatesInput): Promise<RemoteMcpResourceTemplateList>
  describeServer(input: RemoteMcpListResourcesInput): Promise<RemoteMcpServerDescriptor>
}
