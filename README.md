# VeloxOpenWork

> 由 VeloxLLM 加速、基于 [different-ai/openwork](https://github.com/different-ai/openwork) 桌面能力演进的本地 AI 工作空间。

## 中文

VeloxOpenWork 是仅面向本地工作区的 Electron 桌面应用。它保留文件浏览、聊天、流式输出、本地 OpenCode Runtime 和 MCP，同时移除了 Cloud、Account、组织登录、远程工作区、企业版、自动更新和恢复入口。

### 主要能力

- 本地工作区、文件树、多轮对话和流式任务输出。
- 本地 MCP：可添加本地命令或远程 HTTP MCP，并支持 OAuth MCP 的桌面授权流程。
- 仅提供中文和 English；首次启动默认中文。
- 手动管理模型 Provider：Provider ID、名称、Base URL、API Key、多个 Model ID 和默认模型。
- 默认预置 OpenCode Zen 与 Kilo Auto Free；OpenRouter Free 和 Google Gemini 作为可选模板。
- 每个 Provider 可独立使用 HTTP/HTTPS 代理。API Key、代理用户名和密码由 Electron `safeStorage` 保护；请求经本机 Loopback Gateway 转发，流式响应保持可用。
- 本地优先的人工确认和权限审计流程，用于危险命令和敏感文件写入。

### 开发

```powershell
pnpm install
pnpm dev
```

常用验证命令：

```powershell
pnpm typecheck
pnpm test
pnpm build
```

### 致谢与许可证

感谢 [OpenWork](https://github.com/different-ai/openwork) 社区和贡献者提供的开源基础。VeloxOpenWork 保留上游版权归属；仓库内容采用 MIT 许可证，第三方组件继续遵守其原始许可证。详见 [LICENSE](./LICENSE)。

---

## English

VeloxOpenWork is an Electron desktop app for local workspaces. It retains file browsing, chat, streaming output, the local OpenCode runtime, and MCP, while removing Cloud, Account, organization sign-in, remote workspaces, enterprise features, automatic updates, and recovery entry points.

### Highlights

- Local workspaces, file tree, multi-turn chat, and streamed task output.
- Local MCP management for command-based and remote HTTP MCP servers, including desktop OAuth for compatible MCP servers.
- Chinese and English only, with Chinese selected on first launch.
- Manual model-provider management: Provider ID, name, Base URL, API key, multiple Model IDs, and default model.
- OpenCode Zen and Kilo Auto Free are seeded by default; OpenRouter Free and Google Gemini are optional templates.
- Per-provider HTTP/HTTPS proxies. Electron `safeStorage` protects API keys and proxy credentials; a loopback gateway forwards standard and streaming requests independently for each provider.
- Local-first human approval and permission auditing for dangerous commands and sensitive file writes.

### Development

```powershell
pnpm install
pnpm dev
```

Common verification commands:

```powershell
pnpm typecheck
pnpm test
pnpm build
```

### Acknowledgements and License

Thanks to the [OpenWork](https://github.com/different-ai/openwork) community and contributors for the open-source foundation. VeloxOpenWork retains upstream copyright attribution. Repository content is available under the MIT License, while third-party components remain under their original licenses. See [LICENSE](./LICENSE).
