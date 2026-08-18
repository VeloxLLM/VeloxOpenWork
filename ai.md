# VeloxOpenWork 改造记录

## 中文

本项目基于 [different-ai/openwork](https://github.com/different-ai/openwork) 的本地桌面能力迁移，并统一品牌为 **VeloxOpenWork**。

### 已完成

- 桌面应用仅保留本地工作区、文件树、聊天、流式输出、MCP 和本地 OpenCode Runtime。
- 语言入口仅保留 English 与中文，其他语言回退到 English。
- 欢迎、设置、命令面板和启动流程不再要求 Account、Cloud 或组织登录。
- provider 添加弹窗改为手动填写 Provider ID、名称、Base URL、API Key 和 Model ID。
- API Key 通过 Electron `safeStorage` 加密保存到用户数据目录，不写入普通 OpenCode 配置。
- provider 的非敏感配置写入全局 OpenCode 配置，并支持后续刷新模型列表。
- 移除自动更新器、更新菜单、恢复启动覆盖层及恢复测试模块。
- Electron 应用名、应用标识、发行配置和启动错误前缀改为 VeloxOpenWork。

### 验证

- `pnpm --filter @openwork/app typecheck`
- `pnpm --filter @openwork/app build`
- `pnpm --filter @openwork/desktop typecheck:electron`
- `node --check apps/desktop/electron/main.mjs`
- `node --check apps/desktop/electron/preload.mjs`

桌面原生构建仍受当前机器缺少 Visual Studio C++ Build Tools 影响，`better-sqlite3` 的安装脚本无法完成；依赖已使用 `--ignore-scripts` 安装，前端构建和类型检查不受影响。

### 许可证与致谢

保留上游 OpenWork 的版权和许可证归属。请同时遵守仓库中的 MIT、Fair Source 及第三方依赖许可证。

## English

VeloxOpenWork is a local desktop adaptation based on the desktop capabilities of [different-ai/openwork](https://github.com/different-ai/openwork), with all user-facing branding changed to **VeloxOpenWork**.

### Completed

- Kept local workspaces, file browsing, chat, streaming output, MCP, and the local OpenCode runtime.
- Kept only English and Chinese in the language selector; other locales fall back to English.
- Removed Account, Cloud, organization sign-in, and the related startup gates from the local desktop flow.
- Replaced provider discovery and OAuth with a manual form for Provider ID, name, Base URL, API Key, and Model IDs.
- Stored API keys through Electron `safeStorage` instead of ordinary OpenCode configuration files.
- Wrote non-sensitive provider metadata to the global OpenCode configuration.
- Removed the automatic updater, update menu, recovery boot overlay, and recovery test modules.
- Updated the Electron application name, identifier, distribution configuration, and startup prefixes to VeloxOpenWork.

### Verification

- `pnpm --filter @openwork/app typecheck`
- `pnpm --filter @openwork/app build`
- `pnpm --filter @openwork/desktop typecheck:electron`
- `node --check apps/desktop/electron/main.mjs`
- `node --check apps/desktop/electron/preload.mjs`

The native desktop build is still blocked on this machine because Visual Studio C++ Build Tools are unavailable for the `better-sqlite3` install script. Dependencies were installed with `--ignore-scripts`; frontend build and type checks pass.

### License and Acknowledgements

OpenWork copyright and license attribution are retained. The MIT, Fair Source, and third-party dependency licenses in this repository continue to apply.
