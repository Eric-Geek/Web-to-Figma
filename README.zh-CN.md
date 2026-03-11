<div align="center">

# Web-to-Figma

**将任何网站转换为可编辑的 Figma 设计稿 —— 支持 AI 驱动的 Auto Layout 和语义化命名。**

[![CI](https://github.com/nicepkg/Web-to-Figma/actions/workflows/ci.yml/badge.svg)](https://github.com/nicepkg/Web-to-Figma/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)

[English](./README.md) · [简体中文](./README.zh-CN.md)

</div>

---

## 亮点

- **高保真提取** — 从网页中捕获 DOM 结构、计算样式、字体、图片和伪元素。
- **AI 热插拔** — 可接入任意 LLM（OpenAI、Anthropic Claude、本地 Ollama 等），用于智能 Auto Layout 推断和语义化图层命名。
- **无需 AI 也能用** — 核心的提取 → 渲染流程完全独立于 AI，无需配置即可使用。
- **开源免费** — MIT 协议，无厂商绑定，无订阅费用。

## 架构

```
┌─────────────────────┐     ┌─────────────────────┐     ┌─────────────────────┐
│   Chrome 浏览器扩展   │     │    AI 适配层         │     │    Figma 插件        │
│                     │     │    （可选）           │     │                     │
│  Content Script     │     │  预处理器             │     │  JSON 解析器        │
│  （DOM 提取）        │────▶│  LLM 路由器          │────▶│  渲染引擎            │
│                     │     │ （OpenAI / Claude /  │     │ （Figma Plugin API） │
│  Background Script  │     │  Ollama / ...）      │     │                     │
│  （CORS 代理）       │     │  后处理器             │     │  插件 UI             │
└─────────────────────┘     └─────────────────────┘     └─────────────────────┘
        │                                                         ▲
        │               中间态 JSON（Schema v1）                    │
        └─────────────────────────────────────────────────────────┘
```

## 项目结构

这是一个使用 [Turborepo](https://turbo.build/) 管理的 **pnpm monorepo**：

```
Web-to-Figma/
├── packages/
│   ├── shared/           # 共享类型定义、JSON Schema、工具函数
│   ├── extractor/        # Chrome 浏览器扩展（Manifest V3）
│   ├── ai-adapter/       # AI 适配层（可热插拔的 LLM 支持）
│   └── figma-plugin/     # Figma 插件（渲染引擎）
├── docs/
│   └── PRD.md            # 产品需求文档
├── .github/              # CI 工作流、Issue 和 PR 模板
├── turbo.json
├── pnpm-workspace.yaml
└── package.json
```

| 包名 | 说明 |
|------|------|
| `@web-to-figma/shared` | 中间态 JSON Schema 类型和共享工具 |
| `@web-to-figma/extractor` | 提取 DOM 和计算样式的 Chrome 扩展 |
| `@web-to-figma/ai-adapter` | 可热插拔的 AI 适配器（OpenAI、Anthropic、Ollama） |
| `@web-to-figma/figma-plugin` | 将 JSON 渲染为可编辑图层的 Figma 插件 |

## 快速开始

### 环境要求

- [Node.js](https://nodejs.org/) >= 18
- [pnpm](https://pnpm.io/) >= 9

### 安装

```bash
git clone https://github.com/nicepkg/Web-to-Figma.git
cd Web-to-Figma
pnpm install
```

### 开发

```bash
# 构建所有包
pnpm build

# 监听模式
pnpm dev
```

### 加载 Chrome 扩展（开发模式）

1. 在项目根目录运行 `pnpm build`。
2. 在 Chrome 中打开 `chrome://extensions/`。
3. 开启右上角的**开发者模式**。
4. 点击**加载已解压的扩展程序**，选择 `packages/extractor/dist/` 目录。

### 加载 Figma 插件（开发模式）

1. 在项目根目录运行 `pnpm build`。
2. 打开 Figma 桌面版。
3. 进入 **插件 → 开发 → 从 manifest 导入插件…**
4. 选择 `packages/figma-plugin/manifest.json`。

## 工作原理

1. **提取** — Chrome 扩展遍历 DOM 树，通过 `getBoundingClientRect()` 和 `getComputedStyle()` 捕获每个可见节点的信息，序列化为中间态 JSON 格式。

2. **增强（可选）** — AI 适配层对 JSON 进行预处理（裁剪大字段以控制 Token 量），发送给用户配置的 LLM，获取 Auto Layout 参数和语义化图层名称。

3. **渲染** — Figma 插件解析 JSON，调用 Figma Plugin API 创建对应节点（`FrameNode`、`TextNode`、`RectangleNode` 等），设置正确的位置、颜色、字体和效果。

## AI 配置

Web-to-Figma 通过统一的适配器接口支持多个 AI 提供商：

| 提供商 | 配置方式 |
|--------|---------|
| **OpenAI / 兼容接口**（GPT-4o、DeepSeek、Groq 等） | `baseUrl` + `apiKey` + `model` |
| **Anthropic**（Claude） | `baseUrl` + `apiKey` + `model` |
| **Ollama**（本地模型） | `baseUrl`（默认 `http://localhost:11434`）+ `model` |

AI 是**完全可选**的。不配置 AI 时，插件会生成绝对定位的基础图层 —— 仍然可以快速提取设计。

## 路线图

- [x] 项目脚手架和 monorepo 搭建
- [x] **MVP** — Chrome 提取器 → JSON → Figma 绝对定位图层
- [x] **V1** — AI 驱动的 Auto Layout 推断和语义化命名
- [ ] **V2** — 组件识别、自定义 Prompt、完善 UI

详见完整的[产品需求文档](./docs/PRD.md)。

## 参与贡献

欢迎贡献代码！请先阅读[贡献指南](./CONTRIBUTING.zh-CN.md)。

## 开源协议

[MIT](./LICENSE) © Web-to-Figma Contributors
