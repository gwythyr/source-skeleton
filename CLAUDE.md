# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

`source-skeleton` is a TypeScript CLI library that generates collapsed "skeleton" views of TypeScript/JavaScript files. It strips function/method bodies down to `{ /* ... */ }` while preserving signatures, imports, types, and structural context. Collapsed blocks are annotated with external dependency calls (imported identifiers and constructor-injected services).

## Usage

```bash
source-skeleton <file.ts|file.js>
```

Output is tab-delimited: original line number(s), then the skeleton line. Collapsed methods include `→ dependency.method()` annotations showing which external calls were made in the original body.

## Dependencies

- `@ast-grep/napi` -- Node.js bindings for ast-grep, used to parse and traverse the AST. No external CLI tools required.

## Architecture

Pure TypeScript library with a thin CLI wrapper. Three-phase pipeline:

1. **Collapse** (`src/collapse.ts`) -- Parses the source with `@ast-grep/napi`, finds all function-like AST nodes, and rewrites their bodies to `{ /* ... */ }`. Returns the collapsed source and metadata (original line ranges for each collapsed block).
2. **Import parsing** (`src/imports.ts`) -- Parses imports and constructor parameters to identify external identifiers (imported names) and injected services (constructor parameter names).
3. **Call annotation** (`src/calls.ts`, `src/formatter.ts`) -- Finds member call expressions in the original source, filters to those using external/injected identifiers, and annotates each collapsed block with the calls it contained. The formatter maps skeleton lines back to original line numbers using difflib-style sequence matching.

### Source files

- `src/types.ts` -- shared interfaces (`SkeletonResult`, `SkeletonLine`, `CollapsedBlock`, `ExternalCall`)
- `src/collapse.ts` -- AST-based body collapsing
- `src/imports.ts` -- import and constructor parameter parsing
- `src/calls.ts` -- external call extraction
- `src/skeleton.ts` -- orchestrates the pipeline, returns `SkeletonResult`
- `src/formatter.ts` -- formats result into labeled, annotated output lines
- `src/index.ts` -- public API re-exports
- `src/cli.ts` -- CLI entry point
