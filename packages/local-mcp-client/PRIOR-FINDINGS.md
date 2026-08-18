# Local MCP Client Design Notes

This package is the protocol-focused remote MCP client used by VeloxOpenWork's local desktop runtime. It intentionally has no Cloud, organization, account, or enterprise control-plane behavior.

| Concern | Package behavior | Desktop runtime responsibility |
| --- | --- | --- |
| Connection failures | Preserves safe operation and request-phase errors. | Presents a localized user message without exposing credentials. |
| OAuth callback origin | Accepts an explicit callback URI and never derives it from process environment. | Opens the browser and provides the local desktop callback route. |
| Concurrent OAuth attempts | Binds authorization state, verifier, and client revision to independent transactions. | Encrypts and persists credentials through the local secure store. |
| Expired or invalid credentials | Distinguishes invalid token, expired authorization, and lifecycle deadline failures. | Removes stale local credentials and asks the user to reconnect. |
| SSE, redirects, and response size | Enforces bounded catalog and response behavior, cancellation, and safe redirect handling. | Applies desktop network policy and proxy configuration. |
| MCP tool errors | Treats an MCP `isError` result as a typed operation failure. | Shows a safe error and leaves retry decisions to the user. |

## Scope Boundary

The package does not own:

- Electron `safeStorage`, user-data paths, or local configuration files;
- UI state, notifications, authorization prompts, or browser windows;
- Provider API keys or per-Provider proxy settings;
- workspace file access, command approval, or extension policy.

These concerns are composed by the local Electron runtime and app shell. Keeping them outside the package preserves a small, testable protocol boundary.
