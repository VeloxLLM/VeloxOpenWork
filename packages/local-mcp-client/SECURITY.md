# Local MCP Client Security Contract

- Document status: active local desktop reference
- Last review: 2026-08-19
- Re-review when the MCP SDK, protocol baseline, or desktop OAuth flow changes

The local MCP client is protocol code. It receives explicit network, clock, persistence, and OAuth ports from the VeloxOpenWork desktop runtime. It must not read secrets directly from process environment variables or ordinary configuration files.

## Required Boundaries

| Boundary | Client requirement | Desktop runtime responsibility |
| --- | --- | --- |
| Network | Use the supplied fetch port with cancellation and lifecycle deadlines. | Enforce HTTP(S), redirect, TLS, DNS/IP, response-size, and proxy policy. |
| OAuth | Validate authorization state, PKCE verifier, callback issuer, and expiry. | Open the browser and store authorization transactions and tokens securely. |
| Credentials | Treat access and refresh tokens as opaque secret values. | Encrypt values using Electron `safeStorage`; never log them. |
| Diagnostics | Emit only safe phase and code information. | Localize errors and redact URLs containing credentials, `Proxy-Authorization`, API keys, and tokens. |
| Persistence | Require explicit, revision-aware read/write ports. | Serialize local writes and remove invalid or expired records. |

## Expiration Rules

| Record | Validation | Expired behavior |
| --- | --- | --- |
| Operation lifecycle | The absolute deadline remains active until completion. | Abort and return `MCP_LIFECYCLE_DEADLINE`; do not commit late work. |
| OAuth authorization and PKCE | State, verifier, client revision, and expiry must match. | Delete the transaction and require a new desktop authorization. |
| Access token | Require a finite, non-negative expiry when supplied. | Refresh only through the bounded OAuth path; otherwise require reconnect. |
| Refresh token | Treat provider rotation as authoritative. | Preserve an old token only when a successful refresh validly omits a replacement. |

## Validation

Validate before secrets cross a boundary:

- configuration uses non-empty identifiers and HTTP(S) URLs without embedded credentials or fragments;
- OAuth state, authorization code, timeouts, and TTLs are bounded;
- protocol initialization occurs before catalog traversal or tool execution;
- pagination, response bodies, SSE streams, redirects, and tool schemas remain bounded;
- raw provider messages are not treated as user-facing diagnostic text.

The package tests protocol behavior and port semantics. It does not claim to verify a third-party MCP provider's live policy, service availability, consent screen, egress network, or account limits.
