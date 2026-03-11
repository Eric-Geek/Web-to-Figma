# Product Requirements Document (PRD): Web-to-Figma Converter

**English** | [简体中文](./PRD.md)

> Version: v0.2 (Review-optimized edition)
> Last updated: 2026-03-09

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Target Users & Use Cases](#2-target-users--use-cases)
3. [Competitive Analysis & Differentiation](#3-competitive-analysis--differentiation)
4. [User Workflow](#4-user-workflow)
5. [Core System Architecture](#5-core-system-architecture)
6. [Detailed Functional Requirements](#6-detailed-functional-requirements)
7. [Non-Functional Requirements](#7-non-functional-requirements)
8. [Edge Cases & Error Handling](#8-edge-cases--error-handling)
9. [Phased Delivery Goals](#9-phased-delivery-goals)
10. [Technology Recommendations](#10-technology-recommendations)
11. [Open Questions & Pending Decisions](#11-open-questions--pending-decisions)

---

## 1. Project Overview

This project aims to develop an **open-source** Figma plugin along with a companion browser extension (Chrome Extension). The core functionality is to extract the DOM structure and CSS styles from a target webpage and **faithfully** reproduce them as editable layers in Figma.

Unlike similar closed-source products on the market, this project's core differentiator is its **AI Hot-swapping Architecture**, which allows users to connect different AI models (such as Claude, GPT-4o, Gemini, or locally deployed open-source models) to leverage AI's visual understanding and logical reasoning for:

- Semantic layer renaming
- Auto Layout intelligent inference
- Component pattern recognition and classification

**Project positioning**: Open-source first, community-driven, AI enhancement optional (basic functionality works without AI).

---

## 2. Target Users & Use Cases

### 2.1 Target Users

| User Role | Core Need | Usage Frequency |
|-----------|-----------|-----------------|
| UI/UX Designer | Quickly convert existing websites into editable Figma design files for redesign or competitive analysis | Medium |
| Frontend Developer | Reverse-engineer live pages into design files for alignment with designers or documentation | Low |
| Product Manager | Quickly capture competitor page structures for analysis and presentations | Low |
| Design System Maintainer | Extract component structures from existing websites to help build design systems | Low |

### 2.2 Core Use Cases

1. **Competitive analysis**: A designer wants to convert a competitor's website into a Figma file for annotation and re-layout.
2. **Design-to-implementation audit**: After development is complete, a PM/designer wants to reverse-engineer the live result into Figma layers for comparison with the original design.
3. **Legacy project documentation**: An old project has no design files; one needs to be reverse-generated from the live pages.
4. **Rapid prototyping**: Quickly generate an editable design starting point based on an existing website.

---

## 3. Competitive Analysis & Differentiation

### 3.1 Existing Competitors

| Product | Strengths | Weaknesses |
|---------|-----------|------------|
| [html.to.design](https://html.to.design) | Mature and stable, supports Auto Layout | Closed-source, paid ($39/mo+), no custom AI support, messy layer naming |
| [Figma Official Copy as Figma](https://www.figma.com/) | Native integration | Only supports simple elements, not full pages |
| Manual screenshot + image tracing | Zero cost | Not editable, no layer structure |

### 3.2 Our Differentiation

- **Open-source and free**: Core functionality is completely free; the community can audit and contribute.
- **AI hot-swapping**: Users can connect any LLM provider without vendor lock-in.
- **AI optional**: The no-AI mode still outputs absolutely positioned basic layers (MVP core).
- **Extensible Schema**: Standardized intermediate JSON format, enabling future integration with other design tools (Sketch, Penpot, etc.).

---

## 4. User Workflow

### 4.1 Basic Flow (No AI)

```
User opens the target webpage in Chrome
        │
        ▼
Clicks the browser extension icon → Popup control panel appears
        │
        ▼
Selects extraction scope (full page extraction)
        │
        ▼
Browser extension traverses the DOM, generates intermediate JSON
        │
        ▼
JSON data is transferred to the Figma plugin (see §5.2 for methods)
        │
        ▼
Figma plugin parses JSON and generates layers on the canvas
        │
        ▼
User views and edits the result in Figma
```

### 4.2 AI-Enhanced Flow

Between the "JSON data transferred to Figma plugin" step in the basic flow, an AI processing stage is inserted:

```
Intermediate JSON generation complete
        │
        ▼
JSON preprocessing (slimming / dimensionality reduction / chunking)
        │
        ▼
Call the user-configured LLM API
        │
        ▼
AI returns enhanced JSON (with Auto Layout, semantic naming, component markers)
        │
        ▼
Enhanced JSON is transferred to the Figma plugin for rendering
```

### 4.3 Data Flow Key Issues

> **Pending decision**: Data transfer method from Chrome Extension to Figma Plugin. Candidate approaches:
>
> | Approach | Pros | Cons |
> |----------|------|------|
> | A. Clipboard | Zero dependencies | Data size limited (~1MB), poor UX |
> | B. Local WebSocket relay service | Real-time, large data support | Requires additional local service installation |
> | C. Cloud relay (Firebase / Supabase) | No local service needed | Requires network, privacy concerns, latency |
> | D. Extension generates file + Plugin reads it | Simple and direct | Requires manual operation (export/import) |
> | E. Figma plugin with built-in browser capture (headless) | No extension needed | Strict Figma sandbox limitations, limited functionality |
>
> **Recommendation**: Use approach D (file import/export) for MVP phase, evolve to approach C for V1 phase.

---

## 5. Core System Architecture

### 5.1 Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        Chrome Extension                         │
│  ┌─────────────┐   ┌──────────────┐   ┌──────────────────────┐ │
│  │  Popup UI   │──▶│Content Script│──▶│  Data Extractor      │ │
│  │(Control Panel)│  │ (DOM Access) │   │  (AST Serialization) │ │
│  └─────────────┘   └──────────────┘   └──────────┬───────────┘ │
│                                                   │             │
│  ┌──────────────────┐                            │             │
│  │Background Script │◀───────────────────────────┘             │
│  │(Proxy/CORS)      │                                          │
│  └────────┬─────────┘                                          │
└───────────┼─────────────────────────────────────────────────────┘
            │ Intermediate JSON (transfer method see §4.3)
            ▼
┌─────────────────────────────────────────────────────────────────┐
│                   AI Adapter Layer (Optional)                    │
│  ┌──────────────┐  ┌───────────────┐  ┌──────────────────────┐ │
│  │ Preprocessor │─▶│ LLM Router   │─▶│  Postprocessor       │ │
│  │(Slim/Chunk)  │  │(Hot-swap API) │  │ (Merge/Validate)     │ │
│  └──────────────┘  └───────────────┘  └──────────────────────┘ │
│                                                                 │
│  Runtime: Chrome Extension Background Script / standalone       │
│           local service                                         │
└────────────────────────────────┬────────────────────────────────┘
                                 │ Enhanced JSON
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                        Figma Plugin                             │
│  ┌─────────────┐   ┌──────────────┐   ┌──────────────────────┐ │
│  │  Plugin UI   │──▶│ JSON Parser  │──▶│  Figma Renderer      │ │
│  │(Import/Settings)│ │(Schema Valid.)│  │ (Node Creation Engine)│ │
│  └─────────────┘   └──────────────┘   └──────────────────────┘ │
│                                                                 │
│  Sandbox environment: only Figma Plugin API, limited networking │
└─────────────────────────────────────────────────────────────────┘
```

### 5.2 Key Architectural Constraints

1. **Figma plugin sandbox limitations**:
   - The plugin UI layer (iframe) can make network requests (`fetch`), but the main thread (sandbox) cannot directly access the network.
   - The UI layer and sandbox communicate via `postMessage`.
   - Therefore, AI API calls should be placed in the **plugin UI layer** or the **Chrome Extension Background Script**, not in the Figma sandbox.

2. **Chrome Extension permission model**:
   - Content Script can access the DOM but is subject to page CSP restrictions.
   - Background Script (Service Worker) can make cross-origin requests, making it suitable for CORS proxying and AI API calls.

3. **Data size estimates**:
   - A moderately complex page (~500 DOM nodes) produces approximately 200KB-1MB of intermediate JSON.
   - After AI slimming, the data sent to the LLM is approximately 30KB-100KB (~8K-25K tokens).

---

## 6. Detailed Functional Requirements

### 6.1 Module 1: Data Extractor

**Runtime environment**: Chrome Extension Content Script

**Responsibility**: Traverse the DOM tree, extract visual information, and serialize it into intermediate JSON.

#### 6.1.1 Intermediate JSON Schema (v1)

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
    "tag": "div",                          // Original HTML tag
    "type": "CONTAINER",                   // Enum: CONTAINER | TEXT | IMAGE | SVG | INPUT | VIDEO | IFRAME
    "className": "flex justify-between",   // Original class names (for AI reference)
    "bounds": {
      "x": 0,
      "y": 0,
      "width": 1440,
      "height": 900
    },
    "styles": {
      // Background
      "backgroundColor": "rgba(255,255,255,1)",
      "backgroundImage": null,             // Gradient or image URL
      "backgroundSize": "cover",
      "backgroundPosition": "center",

      // Border (independent per side)
      "borderTop": { "width": 0, "style": "none", "color": "transparent" },
      "borderRight": { "width": 0, "style": "none", "color": "transparent" },
      "borderBottom": { "width": 0, "style": "none", "color": "transparent" },
      "borderLeft": { "width": 0, "style": "none", "color": "transparent" },

      // Border radius (independent per corner)
      "borderRadius": { "topLeft": 0, "topRight": 0, "bottomRight": 0, "bottomLeft": 0 },

      // Text (TEXT type only)
      "fontFamily": "Inter",
      "fontSize": 16,
      "fontWeight": 400,
      "fontStyle": "normal",
      "lineHeight": 1.5,                  // Multiplier or pixel value
      "letterSpacing": 0,
      "textAlign": "left",
      "textDecoration": "none",
      "textTransform": "none",
      "color": "rgba(0,0,0,1)",

      // Layout-related
      "display": "flex",
      "flexDirection": "row",
      "justifyContent": "space-between",
      "alignItems": "center",
      "gap": 16,
      "padding": { "top": 0, "right": 0, "bottom": 0, "left": 0 },
      "overflow": "visible",

      // Visual effects
      "opacity": 1,
      "visibility": "visible",
      "boxShadow": [],                    // Array, supports multiple shadows
      "transform": "none",               // CSS transform string
      "filter": "none",
      "mixBlendMode": "normal",
      "zIndex": "auto"
    },
    "textContent": null,                   // Only has value for TEXT type
    "imageUrl": null,                      // Only has value for IMAGE type
    "svgContent": null,                    // Only has value for SVG type (inline SVG string)
    "pseudoElements": {                    // ::before / ::after extraction results
      "before": null,
      "after": null
    },
    "children": [
      // Recursive child nodes...
    ]
  }
}
```

#### 6.1.2 Extraction Rules

| Rule | Description |
|------|-------------|
| Filter invisible nodes | `display: none`, `visibility: hidden` (configurable whether to keep hidden), `opacity: 0` (configurable) |
| Filter non-visual tags | `<script>`, `<style>`, `<link>`, `<meta>`, `<noscript>`, `<template>` |
| Merge pure text nodes | Consecutive TextNodes are merged into a single TEXT type node |
| Pseudo-element extraction | Obtained via `getComputedStyle(el, '::before')` for content and styles, converted to virtual child nodes |
| Image handling | Both `<img>` and `background-image` need extraction; `<img>` maps to IMAGE type, background images are preserved in styles |
| SVG handling | Inline `<svg>` extracts the full SVG string; `<img src="*.svg">` is treated as an image |
| iframe handling | Only records bounds and placeholder, does not extract further (restricted by same-origin policy) |

### 6.2 Module 2: AI Adapter Layer

**Runtime environment**: Chrome Extension Background Script **or** Figma Plugin UI iframe **or** standalone local service

> Note: This module is an optional enhancement. The base version (MVP) does not depend on AI.

#### 6.2.1 Unified LLM Interface Protocol

```typescript
interface AIAdapter {
  name: string;                    // e.g., "openai", "anthropic", "local-ollama"

  configure(config: {
    apiKey?: string;
    baseUrl: string;
    model: string;
    maxTokens?: number;
    temperature?: number;
  }): void;

  /**
   * Send a structured request to the LLM
   * @param systemPrompt  System prompt
   * @param userMessage   User message (containing slimmed JSON)
   * @param options       Optional parameters (e.g., JSON mode)
   * @returns LLM text response
   */
  chat(
    systemPrompt: string,
    userMessage: string,
    options?: { jsonMode?: boolean; stream?: boolean }
  ): Promise<string | AsyncIterable<string>>;
}
```

#### 6.2.2 Built-in Adapters

| Adapter | Compatible Providers | Description |
|---------|---------------------|-------------|
| OpenAI Compatible | OpenAI, DeepSeek, Groq, Together AI, various compatible gateways | Based on OpenAI Chat Completions API format |
| Anthropic | Anthropic Claude series | Messages API format |
| Ollama (Local) | Locally deployed open-source models via Ollama | localhost access, no API Key required |

#### 6.2.3 AI Task Definitions

**Task 1: Auto Layout Inference**

- **Input**: A parent node and its direct children's relative position information (absolute coordinates removed, converted to relative offsets)
- **AI Output**:
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
- **Fallback strategy**: If AI inference confidence is low (can be self-reported by AI), fall back to absolute positioning.

**Task 2: Semantic Renaming**

- **Input**: Node's tag, className, textContent summary, hierarchical position in the tree
- **AI Output**: `{ "name": "Header / Navigation / Logo" }`
- **Naming convention**: Use `/` to separate hierarchy levels, e.g., `Section_Hero / Content / Title`

**Task 3: Component Recognition** (V2)

- **Input**: Similar subtree structures that appear repeatedly in the page
- **AI Output**: Marks which subtrees can be abstracted as Figma Components, along with component names

#### 6.2.4 Token Budget Management

| Strategy | Description |
|----------|-------------|
| Chunked processing | Split the DOM tree by depth or region, sending each chunk to AI independently (avoids exceeding single-request limits) |
| Progressive processing | Process top-level structure first, then refine layer by layer |
| Field trimming | Remove `bounds` absolute coordinates, `imageUrl`, `svgContent`, and other large fields before sending to AI |
| Budget cap | Users can configure the maximum token consumption per conversion (default 50K tokens) |
| Cost estimation | Before calling AI, show the user estimated token count and cost |

### 6.3 Module 3: Figma Renderer

**Runtime environment**: Figma Plugin Sandbox

#### 6.3.1 Node Type Mapping

| Intermediate JSON type | Figma Node | Notes |
|-----------------------|------------|-------|
| CONTAINER | `FrameNode` | If Auto Layout data is present, set `layoutMode` and related properties |
| TEXT | `TextNode` | Requires asynchronous font loading |
| IMAGE | `RectangleNode` + `ImagePaint` | Image as fill |
| SVG | `createNodeFromSvg()` or `RectangleNode` + PNG fallback | |
| INPUT | `FrameNode` + `TextNode` simulation | |
| VIDEO / IFRAME | `RectangleNode` placeholder + annotation | |

#### 6.3.2 Rendering Flow

```
1. Schema version validation
        │
2. Create top-level Frame (set viewport dimensions)
        │
3. Preload all fonts (parallel loadFontAsync)
   ├─ Success → Use original font
   └─ Failure → Fall back to { family: "Inter", style: "Regular" }
        │
4. Recursively traverse JSON tree, DFS node creation
   ├─ Set bounds (x, y, width, height)
   ├─ Set styles (colors, borders, border radius, shadows, etc.)
   ├─ Handle Auto Layout (if AI-enhanced data is present)
   └─ Handle image resources (async fetch + createImage)
        │
5. z-index sorting (reorder sibling nodes)
        │
6. Progress callback → UI displays completion percentage
        │
7. Center canvas view on newly created top-level Frame
```

#### 6.3.3 Style Mapping Details

| CSS Property | Figma API | Notes |
|-------------|-----------|-------|
| `background-color` | `fills: [{ type: 'SOLID', color }]` | Must parse rgba to `{ r, g, b }` + opacity |
| `linear-gradient` | `fills: [{ type: 'GRADIENT_LINEAR', gradientStops }]` | Must parse direction and color stops |
| `box-shadow` | `effects: [{ type: 'DROP_SHADOW', ... }]` | `inset` maps to `INNER_SHADOW` |
| `border-radius` | `topLeftRadius`, `topRightRadius`, etc. | Independent per corner |
| `border` | `strokes` + `strokeWeight` | Figma does not directly support independent per-side borders; simulate with nested Frames or use the maximum value |
| `opacity` | `opacity` | Direct mapping |
| `overflow: hidden` | `clipsContent = true` | |
| `transform` | Not supported yet, recorded as annotation | V2 will consider supporting rotate/scale |
| `filter: blur()` | `effects: [{ type: 'LAYER_BLUR' }]` | |

#### 6.3.4 Image Handling Strategy

```
Image URL
    │
    ├─ Same-origin → Content Script fetches directly → convert to Uint8Array → createImage
    │
    ├─ Cross-origin → Background Script proxies fetch → convert to base64 → pass back → createImage
    │
    ├─ Data URL → Decode directly → createImage
    │
    └─ Failure → Generate gray placeholder rectangle + original URL annotation
```

---

## 7. Non-Functional Requirements

### 7.1 Performance

| Metric | Target |
|--------|--------|
| DOM extraction speed (500 nodes) | < 3 seconds |
| Figma rendering speed (500 nodes, no AI) | < 10 seconds |
| AI processing speed (500 nodes) | < 30 seconds (depends on LLM response time) |
| Maximum supported node count | 2000 nodes (prompt for partitioned processing if exceeded) |

### 7.2 Security

- **API Key storage**: User LLM API Keys are stored in the Chrome Extension's `chrome.storage.local` and are never transmitted to any third-party server. On the Figma plugin side, `figma.clientStorage` is used.
- **Data privacy**: Extracted webpage data is only processed and transferred locally on the user's machine (approach D), never passing through any project-owned servers.
- **AI call transparency**: The prompt and response of each AI call can be viewed in the plugin (debug mode).

### 7.3 Usability

- The plugin UI must support Figma's Light / Dark themes.
- Key operations must have progress indicators (extraction progress, rendering progress, AI processing progress).
- Error messages must be user-friendly: non-technical descriptions + suggested actions.

---

## 8. Edge Cases & Error Handling

| Scenario | Handling Strategy |
|----------|------------------|
| **Pseudo-elements** (`::before`, `::after`) | Query separately via `getComputedStyle(el, '::before')` in the extraction layer, convert to absolutely positioned child nodes inserted into the parent |
| **CORS cross-origin images** | Proxy requests through Chrome Extension Background Script (Service Workers are not subject to CORS restrictions) |
| **SVG parsing failure** | When Figma's `createNodeFromSvg()` fails, fall back to HTML Canvas rasterization → PNG → ImagePaint |
| **Very large pages** (height > 5000px) | In full-page mode, automatically partition extraction and place in multiple Frames |
| **Font unavailable** | Fall back to the Inter font family (built into Figma), preserve the original font name as a layer annotation |
| **Dynamic content** (SPA / lazy loading) | Extraction is triggered manually by the user; suggest scrolling to load all content first; optional "wait for loading" delay setting |
| **CSS variables / calc()** | `getComputedStyle` returns computed values, automatically resolved |
| **`position: fixed / sticky`** | Extract absolute coordinates but mark `positionType`; uniformly convert to absolute positioning in Figma |
| **Canvas / WebGL elements** | Screenshot as PNG, handled as IMAGE type nodes |
| **AI call failure / timeout** | Automatically fall back to no-AI mode (absolute positioning), notify user that AI enhancement was not applied |
| **AI returns malformed output** | JSON Schema validation → on failure, discard AI results and fall back to basic mode |

---

## 9. Phased Delivery Goals

### MVP Phase (Estimated 4-6 weeks)

**Goal**: Complete the core pipeline and output usable basic layers.

| Deliverable | Acceptance Criteria |
|-------------|-------------------|
| Chrome Extension — Data Extractor | Can extract DOM from at least 3 representative websites (e.g., GitHub repo page, Hacker News, Stripe homepage) and output Schema-compliant JSON |
| Figma Plugin — Basic Renderer | Can import JSON files and generate **absolutely positioned** Figma layers (Frame, Text, Image) |
| Basic style support | Colors, fonts, font sizes, border radius, borders, and opacity are correctly reproduced |
| Image handling | Same-origin images display correctly, cross-origin images show placeholders |
| Font fallback | Automatically falls back to Inter when font loading fails |

**Not included**: AI Adapter Layer.

### V1 Phase (4-6 weeks after MVP)

**Goal**: Integrate AI, implement intelligent layout.

| Deliverable | Acceptance Criteria |
|-------------|-------------------|
| AI Adapter Layer | Support at least OpenAI Compatible and Anthropic adapters |
| Auto Layout inference | After AI processing, 90%+ of flex containers are correctly identified as Horizontal/Vertical Layout |
| Semantic naming | AI generates meaningful layer names (not `div_001`-style naming) |
| CORS proxy | Cross-origin images are correctly fetched through Background Script proxy |
| SVG support | Inline SVGs render correctly in Figma |
| Token budget management | Large pages are automatically chunked, staying within LLM context limits |

### V2 Phase (6-8 weeks after V1)

**Goal**: Polish the experience, open-source release.

| Deliverable | Acceptance Criteria |
|-------------|-------------------|
| Component recognition | AI identifies repeated structures and marks them as Figma Components |
| Custom Prompts | Users can edit AI prompt templates |
| Plugin UI polish | Settings panel, history, progress display, error messages |
| Export as JSON file | For sharing and archiving |
| GitHub open-source | Complete README, Contributing Guide, CI/CD |

---

## 10. Technology Recommendations

| Module | Recommended Technology | Rationale |
|--------|----------------------|-----------|
| Chrome Extension | Manifest V3 + TypeScript | V3 is the current Chrome standard; TS ensures type safety |
| Figma Plugin UI | Preact/React + Tailwind CSS | Lightweight; Figma plugin UI requires small bundle size |
| Figma Plugin Sandbox | TypeScript | Figma Plugin API has comprehensive TS type definitions |
| AI Adapter Layer | TypeScript | Unified language with upstream and downstream |
| Build tool | Vite / esbuild | Fast builds, supports multiple entry points (extension + plugin) |
| Testing | Vitest + Playwright (E2E) | Unit tests + browser automation tests |
| Monorepo management | pnpm workspace or Turborepo | Unified management of multiple packages (extension / plugin / shared) |

### 10.1 Suggested Project Structure

```
Web-to-Figma/
├── packages/
│   ├── shared/              # Shared type definitions, Schema, utility functions
│   │   ├── src/
│   │   │   ├── schema.ts    # Intermediate JSON Schema types
│   │   │   ├── types.ts     # Shared types
│   │   │   └── utils.ts     # Utility functions
│   │   └── package.json
│   │
│   ├── extractor/           # Chrome Extension
│   │   ├── src/
│   │   │   ├── manifest.json
│   │   │   ├── popup/       # Extension popup UI
│   │   │   ├── content/     # Content Script (DOM extraction)
│   │   │   └── background/  # Background Script (CORS proxy)
│   │   └── package.json
│   │
│   ├── ai-adapter/          # AI Adapter Layer
│   │   ├── src/
│   │   │   ├── interface.ts # Unified adapter interface
│   │   │   ├── adapters/    # Provider-specific adapter implementations
│   │   │   ├── preprocessor.ts
│   │   │   └── prompts/     # Prompt templates
│   │   └── package.json
│   │
│   └── figma-plugin/        # Figma Plugin
│       ├── src/
│       │   ├── ui/          # Plugin UI (iframe)
│       │   ├── sandbox/     # Plugin main thread (Figma API)
│       │   └── renderer/    # Rendering engine
│       ├── manifest.json    # Figma plugin manifest
│       └── package.json
│
├── pnpm-workspace.yaml
├── package.json
├── tsconfig.base.json
└── README.md
```

---

## 11. Open Questions & Pending Decisions

| # | Question | Impact Area | Recommendation |
|---|----------|-------------|----------------|
| 1 | Data transfer method between Chrome Extension and Figma Plugin | Core architecture | Use file import/export for MVP, evaluate cloud relay for V1 |
| 2 | Which process should the AI Adapter Layer run in | Architecture, security | Chrome Background Script (can make cross-origin requests directly and access API Keys in storage) |
| 3 | Whether to support Firefox and other browsers | Workload | MVP: Chrome only; V2: evaluate Firefox (WebExtensions API has good compatibility) |
| 4 | How to map CSS `transform` to Figma | Rendering accuracy | MVP: ignore; V2: support `rotate` and `scale` |
| 5 | Whether to support responsive extraction (multiple viewport widths) | Feature scope | V2 consideration: extract the same page at 375px / 768px / 1440px separately |
| 6 | How to handle Web Fonts unavailable in Figma | User experience | Fall back to Inter + annotate original font name, prompt user to install manually |
| 7 | Whether a backend service is needed (for AI proxy, data relay, etc.) | Deployment complexity | Avoid if possible; maintain a pure client-side architecture to lower the barrier to entry |
| 8 | Open-source license selection | Legal | Recommend MIT or Apache 2.0 |
