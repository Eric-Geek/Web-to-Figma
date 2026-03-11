# Changelog

**English** | [简体中文](./CHANGELOG.zh-CN.md)

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.0] - 2026-03-11

### Added
- Initial project scaffolding with pnpm + Turborepo monorepo
- `@web-to-figma/shared` — Intermediate JSON schema, shared types, CSS color parsing, and validation
- `@web-to-figma/extractor` — Chrome Extension (Manifest V3) for DOM extraction with support for text, images, SVGs, inputs, gradients, shadows, transforms, and pseudo-elements
- `@web-to-figma/ai-adapter` — AI adapter layer with OpenAI, Anthropic, and Ollama support for Auto Layout inference and semantic naming
- `@web-to-figma/figma-plugin` — Figma plugin renderer with font loading, gradient/shadow/border support, Auto Layout, and drag-and-drop JSON import
- CI pipeline with GitHub Actions (Node 18/20/22 matrix)
- ESLint configuration with typescript-eslint
- 49 unit tests covering shared utilities and AI adapter logic
- PRD documentation (`docs/PRD.md`)
- Contributing guide, issue templates, and PR template
