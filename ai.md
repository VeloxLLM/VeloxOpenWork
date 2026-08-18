# VeloxOpenWork 交接

> 本文件是给 AI 的工作交接文档，请先阅读此文档再继续对本仓库进行操作。

## 一、还没做完的事 & 动手前注意

### 尚未完成 / 待办

- [ ] 明确 VeloxLLM 的后端接入方式、API 协议和配置项。
- [ ] 在当前最小仓库基础上实现 VeloxOpenWork 的桌面应用代码。
- [ ] 根据实际实现更新 `README.md`，避免把规划中的能力写成已完成能力。
- [ ] 确认后续新增代码的许可证范围，尤其是复用 OpenWork 代码时的归属和许可证要求。
- [ ] 补充构建、开发、测试和发布说明。

### 动手前注意事项

1. 当前 `main` 分支只包含 `README.md`、`LICENSE` 和本交接文件；不要假设仓库中已有 OpenWork 源代码。
2. 不要提交 API Key、访问令牌、个人配置或其他密钥；新增环境配置时使用示例值和 `.env.example`。
3. 如果复用或修改 OpenWork 代码，先检查对应目录和第三方依赖的许可证，并保留必要的版权及许可证声明。
4. 保持默认工作分支为 `main`，提交前检查 `git status`、提交内容和根目录文件结构。
5. `git push` 会改变远程仓库状态；除非用户明确要求，否则先完成本地提交并等待确认。
6. 本地存在 `archive/openwork-history` 分支，保存此前导入的 OpenWork 历史；该分支未推送到 VeloxOpenWork 远程仓库。

## 二、历史记录（我们做了什么、怎么做的）

- 日期：2026-08-18。检查并完成 `different-ai/openwork` 的本地检出，目录为 `E:\code\openwork`，当前分支为 `dev`。
- 日期：2026-08-18。克隆 `https://github.com/VeloxLLM/VeloxOpenWork.git`；远程仓库最初为空。
- 日期：2026-08-18。将 OpenWork 基础代码复制到 VeloxOpenWork，并创建提交 `94d78f8`：`chore: initialize from openwork`。
- 日期：2026-08-18。清理 VeloxOpenWork，仅保留 `README.md` 和 `LICENSE`，创建提交 `dcf4c1c`：`chore: keep only readme and license`。
- 日期：2026-08-18。将 README 改写为 VeloxOpenWork 项目介绍，创建提交 `af9bde8`：`docs: add VeloxOpenWork project readme`。
- 日期：2026-08-18。调整 README 为中文在前、英文在后，创建提交 `62a6a14`：`docs: localize readme with Chinese first`。
- 日期：2026-08-18。建立只包含 README 和 LICENSE 的干净 `main` 根提交 `a3f9018`：`chore: initialize VeloxOpenWork`，并执行 `git push -u origin main` 推送到远程。
- 日期：2026-08-18。根据 `https://ai.drx.ac.cn/aimd` 的三段式规范创建本文件；本次提交和推送待完成。

当前仓库文件结构：

```text
VeloxOpenWork/
├── .git/
├── LICENSE
├── README.md
└── ai.md
```

当前远程：`https://github.com/VeloxLLM/VeloxOpenWork.git`

## 三、为什么做这件事

- 目标：让任何新接手的 AI 或开发者只阅读根目录的 `ai.md`，就能了解 VeloxOpenWork 当前的真实状态、已完成工作和下一步任务。
- 价值：避免把 OpenWork 的历史代码、VeloxOpenWork 的现状和未来规划混在一起，降低重复探索、误删文件和错误提交的风险。
- 复用方式：后续每完成一项工作，就在“历史记录”中补充真实日期、文件、命令和提交号；每新增任务，就在“尚未完成 / 待办”中加入可勾选条目。
