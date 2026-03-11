# Contributing to Web-to-Figma

**English** | [简体中文](./CONTRIBUTING.zh-CN.md)

Thank you for your interest in contributing! This document provides guidelines to make the contribution process smooth for everyone.

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) >= 18
- [pnpm](https://pnpm.io/) >= 9

### Setup

```bash
# Clone the repository
git clone https://github.com/nicepkg/Web-to-Figma.git
cd Web-to-Figma

# Install dependencies
pnpm install

# Build all packages
pnpm build

# Start development mode
pnpm dev
```

## Project Structure

This is a monorepo managed with pnpm workspaces and Turborepo:

| Package | Description |
|---------|-------------|
| `packages/shared` | Shared types, schema definitions, and utilities |
| `packages/extractor` | Chrome Extension for DOM extraction |
| `packages/ai-adapter` | AI adapter layer with hot-swappable LLM support |
| `packages/figma-plugin` | Figma plugin for rendering layers |

## Development Workflow

1. **Create a branch** from `main` for your feature or fix:
   ```bash
   git checkout -b feat/your-feature-name
   ```

2. **Make your changes** in the relevant package(s).

3. **Run type checking** to make sure everything compiles:
   ```bash
   pnpm typecheck
   ```

4. **Commit your changes** following the [Conventional Commits](https://www.conventionalcommits.org/) specification:
   ```
   feat: add new AI adapter for Ollama
   fix: handle CORS error in image proxy
   docs: update README with setup instructions
   refactor: simplify DOM traversal logic
   ```

5. **Open a Pull Request** against `main`.

## Commit Message Convention

We follow [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` — A new feature
- `fix:` — A bug fix
- `docs:` — Documentation changes
- `style:` — Code style changes (formatting, etc.)
- `refactor:` — Code changes that neither fix a bug nor add a feature
- `perf:` — Performance improvements
- `test:` — Adding or updating tests
- `chore:` — Maintenance tasks

## Pull Request Guidelines

- Keep PRs focused on a single change.
- Include a clear description of what changed and why.
- Update documentation if your change affects the public API.
- Ensure all existing tests pass and add tests for new functionality.

## Reporting Bugs

Please use [GitHub Issues](https://github.com/nicepkg/Web-to-Figma/issues) with the **Bug Report** template. Include:

- Steps to reproduce
- Expected vs. actual behavior
- Browser version, OS, and Figma desktop version
- Screenshots or screen recordings if applicable

## Feature Requests

Open a [GitHub Issue](https://github.com/nicepkg/Web-to-Figma/issues) with the **Feature Request** template. Describe:

- The problem you're trying to solve
- Your proposed solution
- Alternative solutions you've considered

## Code of Conduct

Be respectful, inclusive, and constructive. We follow the [Contributor Covenant](https://www.contributor-covenant.org/) Code of Conduct.

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](./LICENSE).
