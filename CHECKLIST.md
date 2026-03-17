# Source-Skeleton Production Readiness Checklist

## Technology Decision
- [ ] Research: Verify @ast-grep/napi API supports pattern match + rewrite with variable substitution
- [ ] Research: Verify @ast-grep/napi supports all rule patterns from skeleton-rules-deep.yml
- [ ] Decision: Confirm pure TypeScript/Node.js approach (no bash, no python)

## Project Structure
- [ ] package.json (name, version, bin, main, scripts, engines, keywords, license)
- [ ] tsconfig.json
- [ ] .gitignore (node_modules, dist, coverage)
- [ ] LICENSE (MIT)
- [ ] README.md (usage, install, examples, API)
- [ ] CLAUDE.md updated to reflect new architecture
- [ ] Remove old bash script and embedded Python after TS version works

## Core Implementation (TypeScript)
- [ ] src/index.ts - main entry point / library export
- [ ] src/cli.ts - CLI entry point (bin)
- [ ] src/skeleton.ts - core skeleton generation logic
- [ ] src/patterns.ts - ast-grep pattern definitions (replaces YAML rules)
- [ ] src/imports.ts - import parsing to identify external identifiers
- [ ] src/annotations.ts - call annotation logic (external dependency tracking)
- [ ] src/line-mapping.ts - line number mapping (original -> skeleton)
- [ ] bin/source-skeleton - thin CLI wrapper (#!/usr/bin/env node)

## Test Coverage
- [ ] Test fixtures: simple function file
- [ ] Test fixtures: class with methods (public/private/protected/async/static)
- [ ] Test fixtures: arrow functions and callbacks
- [ ] Test fixtures: imports (default, named, namespace, type imports)
- [ ] Test fixtures: constructor injection patterns
- [ ] Test fixtures: complex real-world-like file
- [ ] Test fixtures: edge cases (empty file, no functions, syntax edge cases)
- [ ] Integration tests: run skeleton on each fixture, compare with expected output
- [ ] Unit tests: import parsing
- [ ] Unit tests: line mapping
- [ ] Unit tests: annotation logic
- [ ] All tests pass via `npm test`

## CI & Quality
- [ ] ESLint configuration
- [ ] Prettier configuration
- [ ] GitHub Actions workflow (lint, test, build)
- [ ] npm prepublish build script

## Distribution
- [ ] Research: npm global install (`npm i -g source-skeleton`)
- [ ] Research: npx usage (`npx source-skeleton file.ts`)
- [ ] Research: Claude Code / Codex integration options
- [ ] .npmignore or package.json files field
- [ ] Verify `npm pack` produces clean tarball

## Final Validation
- [ ] Review: code quality and consistency
- [ ] Review: all tests pass
- [ ] Review: README is complete and accurate
- [ ] Review: package installs and runs correctly from clean env
- [ ] Commit history is clean with conventional commits
