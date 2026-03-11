# 贡献指南

[English](./CONTRIBUTING.md) | **简体中文**

感谢你对本项目的关注！本文档提供了贡献指南，帮助大家顺畅地参与协作。

## 快速开始

### 前置要求

- [Node.js](https://nodejs.org/) >= 18
- [pnpm](https://pnpm.io/) >= 9

### 环境搭建

```bash
# 克隆仓库
git clone https://github.com/nicepkg/Web-to-Figma.git
cd Web-to-Figma

# 安装依赖
pnpm install

# 构建所有包
pnpm build

# 启动开发模式
pnpm dev
```

## 项目结构

本项目是使用 pnpm workspaces 和 Turborepo 管理的 monorepo：

| 包 | 说明 |
|---|------|
| `packages/shared` | 共享类型、Schema 定义和工具函数 |
| `packages/extractor` | Chrome 扩展，用于 DOM 提取 |
| `packages/ai-adapter` | AI 适配层，支持热插拔 LLM |
| `packages/figma-plugin` | Figma 插件，渲染图层 |

## 开发工作流

1. **从 `main` 创建分支**：
   ```bash
   git checkout -b feat/your-feature-name
   ```

2. **在相关包中进行修改**。

3. **运行类型检查**，确保编译通过：
   ```bash
   pnpm typecheck
   ```

4. **提交更改**，遵循 [Conventional Commits](https://www.conventionalcommits.org/) 规范：
   ```
   feat: add new AI adapter for Ollama
   fix: handle CORS error in image proxy
   docs: update README with setup instructions
   refactor: simplify DOM traversal logic
   ```

5. **向 `main` 提交 Pull Request**。

## 提交消息规范

我们遵循 [Conventional Commits](https://www.conventionalcommits.org/)：

- `feat:` — 新功能
- `fix:` — Bug 修复
- `docs:` — 文档变更
- `style:` — 代码风格变更（格式化等）
- `refactor:` — 既不修复 Bug 也不添加功能的代码变更
- `perf:` — 性能优化
- `test:` — 添加或更新测试
- `chore:` — 日常维护

## Pull Request 指南

- 保持 PR 聚焦于单一变更。
- 包含清晰的描述，说明改了什么以及为什么。
- 如果更改影响了公共 API，请更新相关文档。
- 确保所有现有测试通过，并为新功能添加测试。

## 报告 Bug

请使用 [GitHub Issues](https://github.com/nicepkg/Web-to-Figma/issues) 的 **Bug Report** 模板，包含以下信息：

- 复现步骤
- 期望行为 vs 实际行为
- 浏览器版本、操作系统和 Figma 桌面版版本
- 如适用，附上截图或录屏

## 功能建议

使用 [GitHub Issues](https://github.com/nicepkg/Web-to-Figma/issues) 的 **Feature Request** 模板，描述：

- 你想解决的问题
- 你建议的解决方案
- 你考虑过的替代方案

## 行为准则

请保持尊重、包容和建设性。我们遵循 [Contributor Covenant](https://www.contributor-covenant.org/) 行为准则。

## 许可证

参与贡献即表示你同意你的贡献将以 [MIT 许可证](./LICENSE) 发布。
