# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

`source-skeleton` is a TypeScript CLI library that generates collapsed "skeleton" views of TypeScript/JavaScript files. It strips function/method bodies down to `{ /* ... */ }` while preserving signatures, imports, types, and structural context. Collapsed blocks are annotated with external dependency calls (imported identifiers and constructor-injected services).

## Commands

```bash
npm run build          # tsc -> dist/
npm test               # vitest run (all tests)
npx vitest run test/collapse.test.ts   # run a single test file
npx vitest run -t "test name"          # run a single test by name
npm run lint           # eslint src/ test/
npm run check          # tsc --noEmit (type-check including tests)
npm run ci             # check + lint + test
```

## Dependencies

- `@ast-grep/napi` -- Node.js bindings for ast-grep, used to parse and traverse the AST. No external CLI tools required.
- `@modelcontextprotocol/sdk` + `zod` -- MCP server support.

## Architecture

Pure TypeScript library (ESM, Node16 module resolution) with a thin CLI wrapper. Three-phase pipeline:

1. **Collapse** (`src/collapse.ts`) -- Parses the source with `@ast-grep/napi`, finds all function-like AST nodes, and rewrites their bodies to `{ /* ... */ }`. Returns the collapsed source and metadata (original line ranges for each collapsed block).
2. **Import parsing** (`src/imports.ts`) -- Parses imports and constructor parameters to identify external identifiers (imported names) and injected services (constructor parameter names).
3. **Call annotation** (`src/calls.ts`, `src/formatter.ts`) -- Finds member call expressions in the original source, filters to those using external/injected identifiers, and annotates each collapsed block with the calls it contained. The formatter maps skeleton lines back to original line numbers using difflib-style sequence matching.

### Entry points

- `src/cli.ts` -- CLI entry point (`source-skeleton <file>`, `--mcp`, `--init`, `--uninit`)
- `src/mcp.ts` / `src/mcp-bin.ts` -- MCP server exposing `source_skeleton` tool (stdio transport)
- `src/index.ts` -- Public API re-exports (`skeleton`, `format`, `render`, `init`, `uninit`)

### Init/Uninit system

`src/init.ts` and `src/uninit.ts` manage a CLAUDE.md snippet that teaches Claude Code how to use source-skeleton. `--init` appends the snippet, `--uninit` removes it. Both support `--global` to target `~/.claude/CLAUDE.md`. Detection uses `SNIPPET_MARKER` (first heading line from the snippet) so it never drifts.

## Testing

Tests live in `test/` and use vitest. Fixtures are TypeScript files in `test/fixtures/`. The `tsconfig.test.json` extends the base config, adds `test/` to includes, and excludes `test/fixtures/` from type-checking.
