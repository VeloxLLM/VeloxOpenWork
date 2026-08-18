# VeloxOpenWork 改造记录

## 中文

本项目基于 [different-ai/openwork](https://github.com/different-ai/openwork) 的本地桌面能力迁移，并统一品牌为 **VeloxOpenWork**。

### 已完成

- 桌面应用仅保留本地工作区、文件树、聊天、流式输出、MCP 和本地 OpenCode Runtime。
- 语言入口仅保留 English 与中文，其他语言回退到 English。
- 欢迎、设置、命令面板和启动流程不再要求 Account、Cloud 或组织登录。
- provider 添加弹窗改为手动填写 Provider ID、名称、Base URL、API Key 和 Model ID。
- 默认仅预置 OpenCode Zen 与 Kilo Auto Free；OpenRouter Free 与 Google Gemini 作为可选模板，已移除 Ollama、LM Studio 及本地模型拉取逻辑。
- 每个 provider 支持独立 HTTP/HTTPS 代理，代理凭证通过 Electron `safeStorage` 保存，并由本机 Loopback Gateway 按 provider 转发普通与流式请求。
- 首次启动默认使用中文，并移除空工作区在 `/session` 与 `/welcome` 之间的循环跳转。
- API Key 通过 Electron `safeStorage` 加密保存到用户数据目录，不写入普通 OpenCode 配置。
- provider 的非敏感配置写入全局 OpenCode 配置，并支持后续刷新模型列表。
- 移除自动更新器、更新菜单、恢复启动覆盖层及恢复测试模块。
- Electron 应用名、应用标识、发行配置和启动错误前缀改为 VeloxOpenWork。

### 验证

- `pnpm --filter @openwork/app typecheck`
- `pnpm --filter @openwork/app test`
- `pnpm --filter @openwork/app build`
- `pnpm --filter @openwork/desktop typecheck:electron`
- `node --check apps/desktop/electron/main.mjs`
- `node --check apps/desktop/electron/preload.mjs`
- `pnpm exec bun test tests/provider-catalog.test.ts tests/extension-taxonomy.test.ts`（`apps/app`）
- `pnpm --filter @openwork/desktop test`
- `node --check apps/desktop/electron/provider-gateway.mjs`
- `pnpm build`

Electron 开发启动和生产构建均已完成验证。Windows 开发脚本已调整为跨平台写法，Provider Gateway 也已公开 `start()` 生命周期方法。

### 许可证与致谢

保留上游 OpenWork 的版权和许可证归属。请同时遵守仓库中的 MIT、Fair Source 及第三方依赖许可证。

## English

VeloxOpenWork is a local desktop adaptation based on the desktop capabilities of [different-ai/openwork](https://github.com/different-ai/openwork), with all user-facing branding changed to **VeloxOpenWork**.

### Completed

- Kept local workspaces, file browsing, chat, streaming output, MCP, and the local OpenCode runtime.
- Kept only English and Chinese in the language selector; other locales fall back to English.
- Removed Account, Cloud, organization sign-in, and the related startup gates from the local desktop flow.
- Replaced provider discovery and OAuth with a manual form for Provider ID, name, Base URL, API Key, and Model IDs.
- Preconfigured only OpenCode Zen and Kilo Auto Free; kept OpenRouter Free and Google Gemini as optional templates and removed Ollama, LM Studio, and local model pulling.
- Added independent HTTP/HTTPS proxy settings per provider, encrypted proxy credentials with Electron `safeStorage`, and routed requests through a provider-aware loopback gateway.
- Made Chinese the first-run language and removed the empty-workspace `/session` to `/welcome` redirect loop.
- Stored API keys through Electron `safeStorage` instead of ordinary OpenCode configuration files.
- Wrote non-sensitive provider metadata to the global OpenCode configuration.
- Removed the automatic updater, update menu, recovery boot overlay, and recovery test modules.
- Updated the Electron application name, identifier, distribution configuration, and startup prefixes to VeloxOpenWork.

### Verification

- `pnpm --filter @openwork/app typecheck`
- `pnpm --filter @openwork/app test`
- `pnpm --filter @openwork/app build`
- `pnpm --filter @openwork/desktop typecheck:electron`
- `node --check apps/desktop/electron/main.mjs`
- `node --check apps/desktop/electron/preload.mjs`
- `pnpm exec bun test tests/provider-catalog.test.ts tests/extension-taxonomy.test.ts` (`apps/app`)
- `pnpm --filter @openwork/desktop test`
- `node --check apps/desktop/electron/provider-gateway.mjs`
- `pnpm build`

Electron development startup and the production build have both been verified. The Windows development scripts now use cross-platform syntax, and the Provider Gateway exposes its `start()` lifecycle method.

### License and Acknowledgements

OpenWork copyright and license attribution are retained. The MIT, Fair Source, and third-party dependency licenses in this repository continue to apply.
