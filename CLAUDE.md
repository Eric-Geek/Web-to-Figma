# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Install dependencies
pnpm install

# Build all packages (required before running tests/lint/typecheck)
pnpm build

# Watch mode (all packages)
pnpm dev

# Run all tests
pnpm test

# Run tests for a single package
cd packages/shared && pnpm test
cd packages/ai-adapter && pnpm test

# Run a single test file
cd packages/shared && npx vitest run src/__tests__/color.test.ts

# Type checking
pnpm typecheck

# Lint
pnpm lint

# Full clean (removes all dist + node_modules)
pnpm clean
```

> Turborepo respects dependency order: `build` always runs `^build` first, so `shared` builds before `extractor`, `ai-adapter`, and `figma-plugin`.

## Architecture

This is a pnpm + Turborepo monorepo. The system extracts DOM structure from a live website (Chrome Extension) and renders it as editable Figma layers (Figma Plugin), with an optional AI step in between.

```
Chrome Extension  →  Intermediate JSON (schema v1)  →  (optional AI)  →  Figma Plugin
```

### Packages

| Package | Build tool | Tests |
|---|---|---|
| `packages/shared` | `tsc` | vitest |
| `packages/extractor` | esbuild (custom script) | none |
| `packages/ai-adapter` | `tsc` | vitest |
| `packages/figma-plugin` | esbuild (custom script) | none |

### `packages/shared`
The data contract for the whole system. All other packages import from here.
- `schema.ts` — `IntermediateDocument`, `IntermediateNode`, `NodeStyles`, `AutoLayoutData` (the central types)
- `types.ts` — `AIAdapter`, `AIAdapterConfig`, `AIProvider`, `PluginSettings`
- `color.ts` — CSS color parsing utilities
- `validate.ts` — JSON schema validation for `IntermediateDocument`

### `packages/extractor` (Chrome Extension, Manifest V3)
Three entry points bundled independently by esbuild:
- `src/content/index.ts` — IIFE, injected into pages. Calls `extractor.ts` which walks the DOM, calls `getBoundingClientRect()` + `getComputedStyle()` on every visible node, and serializes to `IntermediateDocument`
- `src/background/index.ts` — ESM service worker, acts as CORS proxy
- `src/popup/index.ts` — ESM, the extension popup UI

Content scripts **must be IIFE** (no native ES module support in injected scripts). Background and popup use ESM.

### `packages/ai-adapter`
Hot-swappable LLM layer. Runs in the **Figma plugin UI iframe** (has `fetch`; never in the plugin sandbox).
- `adapters/factory.ts` — `createAdapter(provider, config)` returns the right `AIAdapter` implementation
- `adapters/openai-compatible.ts` / `anthropic.ts` / `ollama.ts` — concrete adapters
- `preprocessor.ts` — strips heavy fields from the node tree to fit within token budgets
- `postprocess.ts` — `mergeAutoLayout()` and `mergeSemanticNames()` write AI responses back into the node tree
- `pipeline.ts` — `runAIPipeline()` orchestrates preprocess → LLM call(s) → postprocess; handles JSON extraction from LLM responses (strips markdown fences, finds `{...}`)
- `prompts/index.ts` — system prompts for Auto Layout and semantic naming

### `packages/figma-plugin`
Two distinct execution contexts — **do not mix their capabilities**:

| Context | File | Capabilities |
|---|---|---|
| Sandbox (main thread) | `src/sandbox/index.ts` | Figma Plugin API only. **No `fetch`**, no ES module `import` at runtime. Built as IIFE. |
| UI (iframe) | `src/ui/index.html` | Standard browser APIs, `fetch`, LLM calls. Script is inline in the HTML file. |

The sandbox communicates with the UI via `figma.ui.postMessage` / `figma.ui.onmessage`. Message types: `IMPORT_JSON`, `RENDER_PROGRESS`, `RENDER_COMPLETE`, `RENDER_ERROR`, `CANCEL`, `SETTINGS_LOADED`.

The esbuild build script uses a `sharedAlias` plugin to resolve `@web-to-figma/shared` directly from source (`../shared/src/index.ts`) — it does **not** depend on `shared` being pre-built.

## Key Constraints

- **Figma plugin sandbox**: no `fetch`, no dynamic `import`, must be a single IIFE file
- **Figma plugin UI**: all AI/LLM calls happen here, not in the sandbox
- **Content scripts**: must be IIFE format (no native ES modules)
- **Unused variables**: prefix with `_` to satisfy the ESLint rule (`@typescript-eslint/no-unused-vars`)
- **Console usage**: `console.warn`, `console.error`, `console.info` are allowed; `console.log` is a lint warning

## ESLint Rules

Configured in root `eslint.config.mjs` using `typescript-eslint`. Applies to `packages/shared/src` and `packages/ai-adapter/src` (extractor and figma-plugin have placeholder lint scripts).
- Unused vars prefixed with `_` are allowed
- `no-console` warns on `log` but allows `warn`, `error`, `info`
- `no-explicit-any` is a warning (allowed in practice, especially in tests)
