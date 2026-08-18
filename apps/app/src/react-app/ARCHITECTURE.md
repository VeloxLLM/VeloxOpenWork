# VeloxOpenWork App Architecture

`apps/app` is the React 19 and Vite user interface for the local Electron desktop application. `src/index.react.tsx` is the only entry point. The application communicates with the local OpenWork server and OpenCode runtime over loopback HTTP, and uses Electron IPC for desktop-only storage and window capabilities.

## Runtime Boundaries

```text
src/index.react.tsx
  -> AppProviders
     -> ServerProvider
        -> LocalProvider
           -> AppRoot
              -> /session/*
              -> /settings/*
```

- `/session/*` is the local workspace and chat surface. `/welcome` is not part of the startup flow.
- `/settings/*` contains local preferences, manual Provider management, MCP, extensions, appearance, environment, and advanced runtime settings.
- Any unmatched route redirects to `/session`.
- Workspace and session data come from the local OpenWork server. Local fallback configuration is read from the desktop bridge when necessary.

## Source Layout

```text
src/
├── app/                       Framework-independent helpers and contracts
│   ├── lib/                   OpenCode, OpenWork server, desktop IPC, analytics
│   ├── provider-catalog.ts    Default and optional manual Provider templates
│   ├── extensions.ts          Extension manifest helpers
│   └── types.ts               Shared UI and runtime types
├── i18n/                      English and Chinese locale dictionaries
└── react-app/
    ├── shell/                 Routes, startup, menus, settings and session composition
    ├── kernel/                Local platform and runtime state providers
    ├── infra/                 Query client and Provider-list cache
    ├── domains/session/       Chat, composer, sidebar, artifacts, panels and sync
    ├── domains/settings/      Local settings, MCP and extension UI
    ├── domains/workspace/     Local workspace create, rename and share flows
    └── domains/connections/   Local MCP configuration and OAuth helpers
```

## Provider Flow

1. The user creates or edits a Provider in Settings.
2. Non-sensitive fields are written to the global OpenCode configuration.
3. API keys and proxy credentials are stored by Electron `safeStorage`.
4. Provider requests use a tokenized loopback gateway route.
5. The gateway resolves the Provider's original Base URL and optional independent HTTP/HTTPS proxy, then forwards regular and SSE responses.

The UI never writes API keys or proxy credentials to ordinary configuration files or logs.

## Dependency Rules

1. `src/app/` and `src/i18n/` must not import React domain code.
2. `kernel/` and `infra/` provide shared infrastructure; they must not depend on feature domains.
3. `shell/` composes routes and may depend on all lower layers.
4. Electron-specific behavior is accessed through `app/lib/desktop.ts` and guarded by desktop runtime checks.
5. Shared cross-process contracts live in `packages/types`.

## Testing

- App unit tests: `pnpm --filter @openwork/app test`
- App type check: `pnpm --filter @openwork/app typecheck`
- Desktop Electron tests: `pnpm --filter @openwork/desktop test`
- Desktop Electron type check: `pnpm --filter @openwork/desktop typecheck:electron`
- Production build: `pnpm build`
