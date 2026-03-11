# 产品需求文档 (PRD): Web-to-Figma 转换器

[English](./PRD.en.md) | **简体中文**

> 版本: v0.2 (审阅优化版)
> 最后更新: 2026-03-09

---

## 目录

1. [项目概述](#1-项目概述)
2. [目标用户与使用场景](#2-目标用户与使用场景)
3. [竞品分析与差异化](#3-竞品分析与差异化)
4. [用户操作流程](#4-用户操作流程)
5. [核心系统架构](#5-核心系统架构)
6. [功能需求详细说明](#6-功能需求详细说明)
7. [非功能性需求](#7-非功能性需求)
8. [边界条件与异常处理](#8-边界条件与异常处理)
9. [阶段性交付目标](#9-阶段性交付目标)
10. [技术选型建议](#10-技术选型建议)
11. [开放问题与待决策项](#11-开放问题与待决策项)

---

## 1. 项目概述

本项目旨在开发一款**开源**的 Figma 插件及其配套的浏览器扩展（Chrome Extension）。核心功能是将目标网页的 DOM 结构和 CSS 样式提取，并**高保真**地还原为 Figma 中可编辑的图层。

区别于市面上的同类闭源产品，本项目的核心壁垒在于 **AI 热插拔架构（AI Hot-swapping Architecture）**，允许用户接入不同的 AI 模型（如 Claude、GPT-4o、Gemini 或本地部署的开源模型），利用 AI 的视觉理解和逻辑推理能力进行：

- 图层语义化重命名
- Auto Layout 智能推断
- 组件模式识别与归类

**项目定位**：开源优先，社区驱动，AI 增强可选（无 AI 也能使用基础功能）。

---

## 2. 目标用户与使用场景

### 2.1 目标用户

| 用户角色 | 核心需求 | 使用频率 |
|---------|---------|---------|
| UI/UX 设计师 | 快速将现有网站转为可编辑的 Figma 设计稿，用于重设计或竞品分析 | 中频 |
| 前端开发者 | 将线上页面逆向为设计稿，便于与设计师对齐或文档化 | 低频 |
| 产品经理 | 快速截取竞品页面结构用于分析和演示 | 低频 |
| 设计系统维护者 | 从现有网站提取组件结构，辅助建立设计系统 | 低频 |

### 2.2 核心使用场景

1. **竞品分析**：设计师想把竞品网站转为 Figma 稿，在上面标注和重新排版。
2. **设计还原审计**：开发完成后，PM/设计师想把线上实际效果逆向为 Figma 图层，与原始设计稿对比偏差。
3. **遗留项目文档化**：老项目没有设计稿，需要从线上页面逆向生成一份。
4. **快速原型**：基于现有网站快速生成一个可编辑的设计起点。

---

## 3. 竞品分析与差异化

### 3.1 现有竞品

| 产品 | 优势 | 不足 |
|------|------|------|
| [html.to.design](https://html.to.design) | 成熟稳定，支持 Auto Layout | 闭源、付费（$39/月起）、不支持自定义 AI、图层命名混乱 |
| [Figma 官方 Copy as Figma](https://www.figma.com/) | 原生集成 | 仅支持简单元素，不支持完整页面 |
| 手动截图 + 图片追踪 | 零成本 | 不可编辑、无图层结构 |

### 3.2 我们的差异化

- **开源免费**：核心功能完全免费，社区可审计和贡献。
- **AI 热插拔**：用户可接入任意 LLM 提供商，不被单一厂商绑定。
- **AI 可选**：无 AI 模式仍可输出绝对定位的基础图层（MVP 核心）。
- **可扩展的 Schema**：标准化中间态 JSON 格式，未来可对接其他设计工具（Sketch、Penpot 等）。

---

## 4. 用户操作流程

### 4.1 基础流程（无 AI）

```
用户在 Chrome 中打开目标网页
        │
        ▼
点击浏览器扩展图标 → 弹出控制面板
        │
        ▼
选择提取范围（整页提取）
        │
        ▼
浏览器扩展遍历 DOM，生成中间态 JSON
        │
        ▼
JSON 数据传输至 Figma 插件（方式见 §5.2）
        │
        ▼
Figma 插件解析 JSON，在画布上生成图层
        │
        ▼
用户在 Figma 中查看和编辑结果
```

### 4.2 AI 增强流程

在基础流程的"JSON 数据传输至 Figma 插件"步骤之间，插入 AI 处理环节：

```
中间态 JSON 生成完毕
        │
        ▼
JSON 预处理（瘦身 / 降维 / 分块）
        │
        ▼
调用用户配置的 LLM API
        │
        ▼
AI 返回增强后的 JSON（含 Auto Layout、语义命名、组件标记）
        │
        ▼
增强 JSON 传输至 Figma 插件进行渲染
```

### 4.3 数据流关键问题

> **待决策**：Chrome 扩展 → Figma 插件的数据传输方式。候选方案：
>
> | 方案 | 优点 | 缺点 |
> |------|------|------|
> | A. 剪贴板 | 零依赖 | 数据量受限（~1MB）、用户体验差 |
> | B. 本地 WebSocket 中继服务 | 实时、大数据量 | 需要额外安装本地服务 |
> | C. 云端中转（Firebase / Supabase） | 无需本地服务 | 需要网络、有隐私顾虑、有延迟 |
> | D. 浏览器扩展生成文件 + Figma 插件读取 | 简单直接 | 需手动操作（导出/导入） |
> | E. Figma 插件内置浏览器抓取（无头） | 无需扩展 | Figma 沙箱限制严格、功能受限 |
>
> **建议**：MVP 阶段采用方案 D（文件导入导出），V1 阶段演进到方案 C。

---

## 5. 核心系统架构

### 5.1 架构总览

```
┌─────────────────────────────────────────────────────────────────┐
│                        Chrome Extension                         │
│  ┌─────────────┐   ┌──────────────┐   ┌──────────────────────┐ │
│  │  Popup UI   │──▶│Content Script│──▶│  Data Extractor      │ │
│  │ (控制面板)   │   │ (DOM 访问)   │   │  (AST 序列化)        │ │
│  └─────────────┘   └──────────────┘   └──────────┬───────────┘ │
│                                                   │             │
│  ┌──────────────────┐                            │             │
│  │Background Script │◀───────────────────────────┘             │
│  │(代理请求/CORS)   │                                          │
│  └────────┬─────────┘                                          │
└───────────┼─────────────────────────────────────────────────────┘
            │ 中间态 JSON (传输方式见 §4.3)
            ▼
┌─────────────────────────────────────────────────────────────────┐
│                   AI Adapter Layer (可选)                        │
│  ┌──────────────┐  ┌───────────────┐  ┌──────────────────────┐ │
│  │ 预处理器      │─▶│ LLM Router   │─▶│  后处理器             │ │
│  │ (瘦身/分块)   │  │ (热插拔接口)  │  │ (结果合并/校验)      │ │
│  └──────────────┘  └───────────────┘  └──────────────────────┘ │
│                                                                 │
│  运行环境：Chrome 扩展的 Background Script / 独立本地服务        │
└────────────────────────────────┬────────────────────────────────┘
                                 │ 增强后的 JSON
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                        Figma Plugin                             │
│  ┌─────────────┐   ┌──────────────┐   ┌──────────────────────┐ │
│  │  Plugin UI   │──▶│ JSON Parser  │──▶│  Figma Renderer      │ │
│  │ (导入/设置)  │   │ (Schema校验) │   │  (节点创建引擎)      │ │
│  └─────────────┘   └──────────────┘   └──────────────────────┘ │
│                                                                 │
│  沙箱环境：仅可调用 Figma Plugin API，网络受限                    │
└─────────────────────────────────────────────────────────────────┘
```

### 5.2 关键架构约束

1. **Figma 插件沙箱限制**：
   - 插件 UI 层（iframe）可以发起网络请求（`fetch`），但主线程（sandbox）不能直接访问网络。
   - UI 层与 sandbox 之间通过 `postMessage` 通信。
   - 因此 AI API 调用应放在**插件 UI 层**或**Chrome 扩展的 Background Script** 中，而非 Figma sandbox。

2. **Chrome 扩展权限模型**：
   - Content Script 可访问 DOM，但受页面 CSP 限制。
   - Background Script (Service Worker) 可发起跨域请求，适合做 CORS 代理和 AI API 调用。

3. **数据量预估**：
   - 一个中等复杂度页面（~500 DOM 节点）的中间态 JSON 约 200KB-1MB。
   - 经过 AI 瘦身后送入 LLM 的数据约 30KB-100KB（约 8K-25K tokens）。

---

## 6. 功能需求详细说明

### 6.1 模块一：Data Extractor（数据提取层）

**运行环境**：Chrome Extension Content Script

**职责**：遍历 DOM 树，提取视觉相关信息，序列化为中间态 JSON。

#### 6.1.1 中间态 JSON Schema（v1）

```jsonc
{
  "version": "1.0",
  "metadata": {
    "url": "https://example.com",
    "title": "Example Page",
    "viewport": { "width": 1440, "height": 900 },
    "extractedAt": "2026-03-09T12:00:00Z",
    "totalNodes": 342
  },
  "fonts": [
    { "family": "Inter", "weights": [400, 500, 700], "source": "google" }
  ],
  "tree": {
    "id": "node_001",
    "tag": "div",                          // 原始 HTML 标签
    "type": "CONTAINER",                   // 枚举: CONTAINER | TEXT | IMAGE | SVG | INPUT | VIDEO | IFRAME
    "className": "flex justify-between",   // 原始类名（供 AI 参考）
    "bounds": {
      "x": 0,
      "y": 0,
      "width": 1440,
      "height": 900
    },
    "styles": {
      // 背景
      "backgroundColor": "rgba(255,255,255,1)",
      "backgroundImage": null,             // 渐变或图片 URL
      "backgroundSize": "cover",
      "backgroundPosition": "center",

      // 边框（四边独立）
      "borderTop": { "width": 0, "style": "none", "color": "transparent" },
      "borderRight": { "width": 0, "style": "none", "color": "transparent" },
      "borderBottom": { "width": 0, "style": "none", "color": "transparent" },
      "borderLeft": { "width": 0, "style": "none", "color": "transparent" },

      // 圆角（四角独立）
      "borderRadius": { "topLeft": 0, "topRight": 0, "bottomRight": 0, "bottomLeft": 0 },

      // 文字（仅 TEXT 类型）
      "fontFamily": "Inter",
      "fontSize": 16,
      "fontWeight": 400,
      "fontStyle": "normal",
      "lineHeight": 1.5,                  // 倍数或像素值
      "letterSpacing": 0,
      "textAlign": "left",
      "textDecoration": "none",
      "textTransform": "none",
      "color": "rgba(0,0,0,1)",

      // 布局相关
      "display": "flex",
      "flexDirection": "row",
      "justifyContent": "space-between",
      "alignItems": "center",
      "gap": 16,
      "padding": { "top": 0, "right": 0, "bottom": 0, "left": 0 },
      "overflow": "visible",

      // 视觉效果
      "opacity": 1,
      "visibility": "visible",
      "boxShadow": [],                    // 数组，支持多重阴影
      "transform": "none",               // CSS transform 字符串
      "filter": "none",
      "mixBlendMode": "normal",
      "zIndex": "auto"
    },
    "textContent": null,                   // 仅 TEXT 类型有值
    "imageUrl": null,                      // 仅 IMAGE 类型有值
    "svgContent": null,                    // 仅 SVG 类型有值（内联 SVG 字符串）
    "pseudoElements": {                    // ::before / ::after 提取结果
      "before": null,
      "after": null
    },
    "children": [
      // 递归子节点...
    ]
  }
}
```

#### 6.1.2 提取规则

| 规则 | 说明 |
|------|------|
| 过滤不可见节点 | `display: none`、`visibility: hidden`（可配置是否保留 hidden）、`opacity: 0`（可配置） |
| 过滤无视觉标签 | `<script>`, `<style>`, `<link>`, `<meta>`, `<noscript>`, `<template>` |
| 合并纯文本节点 | 连续的 TextNode 合并为单个 TEXT 类型节点 |
| 伪元素提取 | 通过 `getComputedStyle(el, '::before')` 获取 content、样式，转为虚拟子节点 |
| 图片处理 | `<img>` 和 `background-image` 均需提取；`<img>` 映射为 IMAGE 类型，背景图保留在 styles 中 |
| SVG 处理 | 内联 `<svg>` 提取完整 SVG 字符串；`<img src="*.svg">` 按图片处理 |
| iframe 处理 | 仅记录 bounds 和占位，不深入提取（受同源策略限制） |

### 6.2 模块二：AI Adapter Layer（AI 适配层）

**运行环境**：Chrome Extension Background Script **或** Figma Plugin UI iframe **或** 独立本地服务

> 注意：此模块为可选增强。基础版（MVP）不依赖 AI。

#### 6.2.1 统一 LLM 接口协议

```typescript
interface AIAdapter {
  name: string;                    // 如 "openai", "anthropic", "local-ollama"
  
  configure(config: {
    apiKey?: string;
    baseUrl: string;
    model: string;
    maxTokens?: number;
    temperature?: number;
  }): void;

  /**
   * 发送结构化请求给 LLM
   * @param systemPrompt  系统提示词
   * @param userMessage   用户消息（含瘦身后的 JSON）
   * @param options       可选参数（如 JSON mode）
   * @returns LLM 的文本响应
   */
  chat(
    systemPrompt: string,
    userMessage: string,
    options?: { jsonMode?: boolean; stream?: boolean }
  ): Promise<string | AsyncIterable<string>>;
}
```

#### 6.2.2 内置适配器

| 适配器 | 兼容厂商 | 说明 |
|--------|---------|------|
| OpenAI Compatible | OpenAI, DeepSeek, Groq, Together AI, 各类兼容网关 | 基于 OpenAI Chat Completions API 格式 |
| Anthropic | Anthropic Claude 系列 | Messages API 格式 |
| Ollama (Local) | 本地 Ollama 部署的开源模型 | localhost 访问，无需 API Key |

#### 6.2.3 AI 任务定义

**任务 1：Auto Layout 推断**

- **输入**：一个父节点及其直接子节点的相对位置信息（去除绝对坐标，转为相对偏移量）
- **AI 输出**：
  ```jsonc
  {
    "layoutMode": "HORIZONTAL" | "VERTICAL" | "NONE",
    "primaryAxisAlignItems": "MIN" | "CENTER" | "MAX" | "SPACE_BETWEEN",
    "counterAxisAlignItems": "MIN" | "CENTER" | "MAX",
    "paddingTop": 16,
    "paddingRight": 24,
    "paddingBottom": 16,
    "paddingLeft": 24,
    "itemSpacing": 12,
    "layoutWrap": "NO_WRAP" | "WRAP"
  }
  ```
- **降级策略**：若 AI 推断置信度低（可通过 AI 自报告），回退到绝对定位。

**任务 2：语义化重命名**

- **输入**：节点的 tag、className、textContent 摘要、在树中的层级位置
- **AI 输出**：`{ "name": "Header / Navigation / Logo" }`
- **命名约定**：使用 `/` 分隔层级，如 `Section_Hero / Content / Title`

**任务 3：组件识别**（V2）

- **输入**：页面中重复出现的相似子树结构
- **AI 输出**：标记哪些子树可以抽象为 Figma Component，以及组件名称

#### 6.2.4 Token 预算管理

| 策略 | 说明 |
|------|------|
| 分块处理 | 将 DOM 树按深度或区域分块，每块独立发给 AI（避免单次超限） |
| 渐进式处理 | 先处理顶层结构，再逐层细化 |
| 字段裁剪 | 发给 AI 时移除 `bounds` 绝对坐标、`imageUrl`、`svgContent` 等大字段 |
| 预算上限 | 用户可配置单次转换的最大 Token 消耗（默认 50K tokens） |
| 成本预估 | 在调用 AI 前，向用户展示预估 Token 量和费用 |

### 6.3 模块三：Figma Renderer（Figma 渲染引擎）

**运行环境**：Figma Plugin Sandbox

#### 6.3.1 节点类型映射

| 中间态 JSON type | Figma Node | 说明 |
|-----------------|------------|------|
| CONTAINER | `FrameNode` | 若有 Auto Layout 数据，设置 `layoutMode` 等属性 |
| TEXT | `TextNode` | 需异步加载字体 |
| IMAGE | `RectangleNode` + `ImagePaint` | 图片作为 fill |
| SVG | `createNodeFromSvg()` 或 `RectangleNode` + PNG fallback | |
| INPUT | `FrameNode` + `TextNode` 模拟 | |
| VIDEO / IFRAME | `RectangleNode` 占位 + 标注 | |

#### 6.3.2 渲染流程

```
1. Schema 版本校验
        │
2. 创建顶层 Frame（设置 viewport 尺寸）
        │
3. 预加载所有字体（并行 loadFontAsync）
   ├─ 成功 → 使用原始字体
   └─ 失败 → 回退到 { family: "Inter", style: "Regular" }
        │
4. 递归遍历 JSON 树，DFS 创建节点
   ├─ 设置 bounds (x, y, width, height)
   ├─ 设置 styles (颜色、边框、圆角、阴影等)
   ├─ 处理 Auto Layout（若有 AI 增强数据）
   └─ 处理图片资源（异步 fetch + createImage）
        │
5. z-index 排序（调整同级节点顺序）
        │
6. 进度回调 → UI 显示完成百分比
        │
7. 居中画布视图到新创建的顶层 Frame
```

#### 6.3.3 样式映射细则

| CSS 属性 | Figma API | 注意事项 |
|----------|-----------|---------|
| `background-color` | `fills: [{ type: 'SOLID', color }]` | 需解析 rgba 为 `{ r, g, b }` + opacity |
| `linear-gradient` | `fills: [{ type: 'GRADIENT_LINEAR', gradientStops }]` | 需解析方向和色标 |
| `box-shadow` | `effects: [{ type: 'DROP_SHADOW', ... }]` | `inset` 映射为 `INNER_SHADOW` |
| `border-radius` | `topLeftRadius`, `topRightRadius` 等 | 四角独立 |
| `border` | `strokes` + `strokeWeight` | Figma 不直接支持四边独立 border，需用嵌套 Frame 模拟或取最大值 |
| `opacity` | `opacity` | 直接映射 |
| `overflow: hidden` | `clipsContent = true` | |
| `transform` | 暂不支持，记录为注释 | V2 考虑支持 rotate/scale |
| `filter: blur()` | `effects: [{ type: 'LAYER_BLUR' }]` | |

#### 6.3.4 图片处理策略

```
图片 URL
    │
    ├─ 同源 → Content Script 直接 fetch → 转 Uint8Array → createImage
    │
    ├─ 跨域 → Background Script 代理 fetch → 转 base64 → 传回 → createImage
    │
    ├─ Data URL → 直接解码 → createImage
    │
    └─ 失败 → 生成灰色占位矩形 + 原始 URL 标注
```

---

## 7. 非功能性需求

### 7.1 性能

| 指标 | 目标 |
|------|------|
| DOM 提取速度（500 节点） | < 3 秒 |
| Figma 渲染速度（500 节点，无 AI） | < 10 秒 |
| AI 处理速度（500 节点） | < 30 秒（取决于 LLM 响应速度） |
| 最大支持节点数 | 2000 节点（超出提示分区处理） |

### 7.2 安全性

- **API Key 存储**：用户的 LLM API Key 存储在 Chrome Extension 的 `chrome.storage.local` 中，不传输到任何第三方服务器。Figma 插件侧使用 `figma.clientStorage`。
- **数据隐私**：提取的网页数据仅在用户本地处理和传输（方案 D），不经过项目方的任何服务器。
- **AI 调用透明**：每次 AI 调用的 prompt 和 response 可在插件中查看（调试模式）。

### 7.3 可用性

- 插件 UI 需支持 Figma 的 Light / Dark 主题。
- 关键操作需有进度指示（提取进度、渲染进度、AI 处理进度）。
- 错误信息需对用户友好，非技术性描述 + 建议操作。

---

## 8. 边界条件与异常处理

| 场景 | 处理策略 |
|------|---------|
| **伪元素** (`::before`, `::after`) | 在提取层通过 `getComputedStyle(el, '::before')` 单独查询，转换为绝对定位子节点插入父节点 |
| **CORS 跨域图片** | 通过 Chrome Extension Background Script 代理请求（Service Worker 不受 CORS 限制） |
| **SVG 解析失败** | Figma `createNodeFromSvg()` 失败时，降级为 HTML Canvas 光栅化 → PNG → ImagePaint |
| **超大页面** (高度 > 5000px) | 整页模式下自动分区提取，分多个 Frame 放置 |
| **字体不可用** | 回退到 Inter 字体族（Figma 内置），保留原始字体名称为图层标注 |
| **动态内容** (SPA / 懒加载) | 提取时机为用户手动触发，建议用户先滚动加载完内容；可选"等待加载"延迟选项 |
| **CSS 变量 / calc()** | `getComputedStyle` 返回的是计算后的值，已自动解析 |
| **`position: fixed / sticky`** | 提取绝对坐标，但标记 `positionType`，Figma 中统一转为绝对定位 |
| **Canvas / WebGL 元素** | 截图为 PNG，作为 IMAGE 类型节点处理 |
| **AI 调用失败 / 超时** | 自动回退到无 AI 模式（绝对定位），提示用户 AI 增强未生效 |
| **AI 返回格式错误** | JSON Schema 校验 → 失败则丢弃 AI 结果，回退基础模式 |

---

## 9. 阶段性交付目标

### MVP 阶段（预计 4-6 周）

**目标**：跑通核心链路，输出可用的基础图层。

| 交付物 | 验收标准 |
|--------|---------|
| Chrome 扩展 — Data Extractor | 能提取至少 3 个代表性网站（如 GitHub 仓库页、Hacker News、Stripe 首页）的 DOM 并输出符合 Schema 的 JSON |
| Figma 插件 — 基础 Renderer | 能导入 JSON 文件并生成**绝对定位**的 Figma 图层（Frame、Text、Image） |
| 基础样式支持 | 颜色、字体、字号、圆角、边框、opacity 正确还原 |
| 图片处理 | 同源图片可正确显示，跨域图片显示占位符 |
| 字体回退 | 字体加载失败时自动回退到 Inter |

**不包含**：AI 适配层。

### V1 阶段（MVP 后 4-6 周）

**目标**：接入 AI，实现智能布局。

| 交付物 | 验收标准 |
|--------|---------|
| AI Adapter Layer | 至少支持 OpenAI Compatible 和 Anthropic 两个适配器 |
| Auto Layout 推断 | AI 处理后的结果，90%+ 的 flex 容器能正确识别为 Horizontal/Vertical Layout |
| 语义化命名 | AI 为图层生成有意义的名称（非 `div_001` 式命名） |
| CORS 代理 | 跨域图片通过 Background Script 代理正确获取 |
| SVG 支持 | 内联 SVG 可在 Figma 中正确渲染 |
| Token 预算管理 | 大页面自动分块处理，不超出 LLM 上下文限制 |

### V2 阶段（V1 后 6-8 周）

**目标**：完善体验，开源发布。

| 交付物 | 验收标准 |
|--------|---------|
| 组件识别 | AI 识别重复结构并标记为 Figma Component |
| 自定义 Prompt | 用户可编辑 AI prompt 模板 |
| 插件 UI 完善 | 设置面板、历史记录、进度展示、错误提示 |
| 导出为 JSON 文件 | 便于分享和存档 |
| GitHub 开源 | 完整的 README、Contributing Guide、CI/CD |

---

## 10. 技术选型建议

| 模块 | 推荐技术 | 理由 |
|------|---------|------|
| Chrome 扩展 | Manifest V3 + TypeScript | V3 是 Chrome 当前标准，TS 保证类型安全 |
| Figma 插件 UI | Preact/React + Tailwind CSS | 轻量级，Figma 插件 UI 需要小打包体积 |
| Figma 插件 Sandbox | TypeScript | Figma Plugin API 有完善的 TS 类型定义 |
| AI Adapter Layer | TypeScript | 与上下游统一语言 |
| 构建工具 | Vite / esbuild | 快速构建，支持多 entry 点（扩展 + 插件） |
| 测试 | Vitest + Playwright (E2E) | 单元测试 + 浏览器自动化测试 |
| Monorepo 管理 | pnpm workspace 或 Turborepo | 统一管理多个包（extension / plugin / shared） |

### 10.1 建议项目结构

```
Web-to-Figma/
├── packages/
│   ├── shared/              # 共享类型定义、Schema、工具函数
│   │   ├── src/
│   │   │   ├── schema.ts    # 中间态 JSON Schema 类型
│   │   │   ├── types.ts     # 共享类型
│   │   │   └── utils.ts     # 工具函数
│   │   └── package.json
│   │
│   ├── extractor/           # Chrome Extension
│   │   ├── src/
│   │   │   ├── manifest.json
│   │   │   ├── popup/       # 扩展弹出 UI
│   │   │   ├── content/     # Content Script (DOM 提取)
│   │   │   └── background/  # Background Script (CORS 代理)
│   │   └── package.json
│   │
│   ├── ai-adapter/          # AI 适配层
│   │   ├── src/
│   │   │   ├── interface.ts # 统一适配器接口
│   │   │   ├── adapters/    # 各厂商适配器实现
│   │   │   ├── preprocessor.ts
│   │   │   └── prompts/     # Prompt 模板
│   │   └── package.json
│   │
│   └── figma-plugin/        # Figma 插件
│       ├── src/
│       │   ├── ui/          # 插件 UI (iframe)
│       │   ├── sandbox/     # 插件主线程 (Figma API)
│       │   └── renderer/    # 渲染引擎
│       ├── manifest.json    # Figma 插件 manifest
│       └── package.json
│
├── pnpm-workspace.yaml
├── package.json
├── tsconfig.base.json
└── README.md
```

---

## 11. 开放问题与待决策项

| # | 问题 | 影响范围 | 建议 |
|---|------|---------|------|
| 1 | Chrome 扩展与 Figma 插件之间的数据传输方式 | 架构核心 | MVP 用文件导入导出，V1 评估云端中转 |
| 2 | AI 适配层运行在哪个进程中 | 架构、安全 | Chrome Background Script（可直接发起跨域请求且可访问 storage 中的 API Key） |
| 3 | 是否需要支持 Firefox 等其他浏览器 | 工作量 | MVP 仅 Chrome，V2 评估 Firefox (WebExtensions API 兼容性较好) |
| 4 | CSS `transform` 如何映射到 Figma | 渲染精度 | MVP 忽略，V2 支持 `rotate` 和 `scale` |
| 5 | 是否支持响应式提取（多视口宽度） | 功能范围 | V2 考虑：同一页面在 375px / 768px / 1440px 下分别提取 |
| 6 | 如何处理 Web Font 在 Figma 中不可用的情况 | 用户体验 | 回退 Inter + 标注原始字体名，提示用户手动安装 |
| 7 | 是否需要后端服务（用于 AI 代理、数据中转等） | 部署复杂度 | 尽量避免，保持纯客户端架构，降低用户使用门槛 |
| 8 | 开源协议选择 | 法务 | 建议 MIT 或 Apache 2.0 |
