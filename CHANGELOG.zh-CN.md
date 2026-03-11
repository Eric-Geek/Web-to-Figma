# 更新日志

[English](./CHANGELOG.md) | **简体中文**

本项目的所有重要变更都将记录在此文件中。

格式基于 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，
版本管理遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

## [未发布]

## [0.1.0] - 2026-03-11

### 新增
- 基于 pnpm + Turborepo 的 monorepo 项目脚手架
- `@web-to-figma/shared` — 中间态 JSON Schema、共享类型、CSS 颜色解析和校验工具
- `@web-to-figma/extractor` — Chrome 扩展（Manifest V3），支持文本、图片、SVG、输入框、渐变、阴影、变换和伪元素的 DOM 提取
- `@web-to-figma/ai-adapter` — AI 适配层，支持 OpenAI、Anthropic 和 Ollama，用于 Auto Layout 推断和语义化命名
- `@web-to-figma/figma-plugin` — Figma 插件渲染器，支持字体加载、渐变/阴影/边框、Auto Layout 和拖放导入 JSON
- GitHub Actions CI 流水线（Node 18/20/22 矩阵测试）
- 基于 typescript-eslint 的 ESLint 配置
- 49 个单元测试，覆盖共享工具和 AI 适配器逻辑
- 产品需求文档（`docs/PRD.md`）
- 贡献指南、Issue 模板和 PR 模板
