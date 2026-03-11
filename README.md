<div align="center">

# Web-to-Figma

**Convert any website into editable Figma designs — with optional AI-powered Auto Layout and semantic naming.**

[![CI](https://github.com/nicepkg/Web-to-Figma/actions/workflows/ci.yml/badge.svg)](https://github.com/nicepkg/Web-to-Figma/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)

[English](./README.md) · [简体中文](./README.zh-CN.md)

</div>

---

## Highlights

- **High-fidelity extraction** — Captures DOM structure, computed styles, fonts, images, and pseudo-elements from any web page.
- **AI Hot-swapping** — Plug in any LLM (OpenAI, Anthropic Claude, local Ollama, etc.) for intelligent Auto Layout inference and semantic layer naming.
- **Works without AI** — The core extraction → rendering pipeline is fully functional without any AI configuration.
- **Open source** — MIT licensed. No vendor lock-in, no subscription fees.

## Architecture

```
┌─────────────────────┐     ┌─────────────────────┐     ┌─────────────────────┐
│   Chrome Extension   │     │   AI Adapter Layer   │     │    Figma Plugin      │
│                     │     │     (optional)        │     │                     │
│  Content Script     │     │  Preprocessor        │     │  JSON Parser        │
│  (DOM Extraction)   │────▶│  LLM Router          │────▶│  Renderer Engine    │
│                     │     │  (OpenAI / Claude /   │     │  (Figma Plugin API) │
│  Background Script  │     │   Ollama / ...)       │     │                     │
│  (CORS Proxy)       │     │  Postprocessor       │     │  Plugin UI          │
└─────────────────────┘     └─────────────────────┘     └─────────────────────┘
        │                                                         ▲
        │              Intermediate JSON (Schema v1)               │
        └─────────────────────────────────────────────────────────┘
```

## Project Structure

This is a **pnpm monorepo** managed with [Turborepo](https://turbo.build/):

```
Web-to-Figma/
├── packages/
│   ├── shared/           # Shared types, JSON schema, utilities
│   ├── extractor/        # Chrome Extension (Manifest V3)
│   ├── ai-adapter/       # AI adapter layer (hot-swappable LLMs)
│   └── figma-plugin/     # Figma plugin (renderer engine)
├── docs/
│   └── PRD.md            # Product Requirements Document
├── .github/              # CI workflows, issue & PR templates
├── turbo.json
├── pnpm-workspace.yaml
└── package.json
```

| Package | Description |
|---------|-------------|
| `@web-to-figma/shared` | Intermediate JSON schema types and shared utilities |
| `@web-to-figma/extractor` | Chrome Extension that extracts DOM + computed styles |
| `@web-to-figma/ai-adapter` | Hot-swappable AI adapters (OpenAI, Anthropic, Ollama) |
| `@web-to-figma/figma-plugin` | Figma plugin that renders JSON into editable layers |

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) >= 18
- [pnpm](https://pnpm.io/) >= 9

### Installation

```bash
git clone https://github.com/nicepkg/Web-to-Figma.git
cd Web-to-Figma
pnpm install
```

### Development

```bash
# Build all packages
pnpm build

# Watch mode for all packages
pnpm dev
```

### Loading the Chrome Extension (Development)

1. Run `pnpm build` in the project root.
2. Open `chrome://extensions/` in Chrome.
3. Enable **Developer mode**.
4. Click **Load unpacked** and select `packages/extractor/dist/`.

### Loading the Figma Plugin (Development)

1. Run `pnpm build` in the project root.
2. Open Figma Desktop.
3. Go to **Plugins → Development → Import plugin from manifest…**
4. Select `packages/figma-plugin/manifest.json`.

## How It Works

1. **Extract** — The Chrome Extension traverses the DOM tree, captures `getBoundingClientRect()` and `getComputedStyle()` for every visible node, and serializes it into an intermediate JSON format.

2. **Enhance (optional)** — The AI adapter layer preprocesses the JSON (strips heavy fields to stay within token limits), sends it to your configured LLM, and receives back Auto Layout parameters and semantic layer names.

3. **Render** — The Figma plugin parses the JSON and creates corresponding Figma nodes (`FrameNode`, `TextNode`, `RectangleNode`, etc.) with correct positioning, colors, fonts, and effects.

## AI Configuration

Web-to-Figma supports multiple AI providers through a unified adapter interface:

| Provider | Config |
|----------|--------|
| **OpenAI / Compatible** (GPT-4o, DeepSeek, Groq, etc.) | `baseUrl` + `apiKey` + `model` |
| **Anthropic** (Claude) | `baseUrl` + `apiKey` + `model` |
| **Ollama** (Local models) | `baseUrl` (default: `http://localhost:11434`) + `model` |

AI is **entirely optional**. Without it, the plugin generates absolute-positioned layers with basic styling — still useful for quick design extraction.

## Roadmap

- [x] Project scaffolding & monorepo setup
- [x] **MVP** — Chrome extractor → JSON → Figma absolute-positioned layers
- [x] **V1** — AI-powered Auto Layout inference & semantic naming
- [ ] **V2** — Component detection, custom prompts, polished UI

See the full [Product Requirements Document](./docs/PRD.md) for details.

## Contributing

We welcome contributions! Please read the [Contributing Guide](./CONTRIBUTING.md) before submitting a PR.

## License

[MIT](./LICENSE) © Web-to-Figma Contributors
