# source-skeleton

Generate collapsed skeleton views of TypeScript/JavaScript files. Designed for AI coding agents to efficiently explore codebases.

## What it does

- Collapses function/method bodies to `{ /* ... */ }`
- Preserves imports, types, interfaces, and signatures
- Annotates collapsed blocks with external dependency calls (`→` arrows)
- Maps skeleton lines back to original line numbers

## Install

```bash
npm install -g source-skeleton
```

Or use with npx:

```bash
npx source-skeleton src/service.ts
```

## Usage

### CLI

```bash
source-skeleton <file.ts|file.js>
```

Example output for `src/skeleton.ts`:

```
1	import { collapse } from './collapse.js';
2	import { parseImports } from './imports.js';
3	import { findExternalCalls } from './calls.js';
4	import type { SkeletonResult } from './types.js';
5
6	/**
7	 * Generate a skeleton view of TypeScript/JavaScript source code.
8	 * Collapses function bodies and annotates external calls.
9	 */
10	export function skeleton(source: string): SkeletonResult { /* ... */ }
	→ collapse()
	→ parseImports()
	→ findExternalCalls()
28
```

Example output for `src/formatter.ts`:

```
1	import type { CollapsedBlock, ExternalCall, SkeletonResult, SkeletonLine } from './types.js';
2
3	const COLLAPSED_MARKER = /\{\s*\/\*\s*\.\.\.\s*\*\/\s*\}/;
4
5	/**
6	 * Format a skeleton result into labeled, annotated output lines.
7	 */
8	export function format(result: SkeletonResult): SkeletonLine[] { /* ... */ }
63
64	/**
65	 * Render formatted skeleton lines as a string (tab-delimited output).
66	 */
67	export function render(lines: SkeletonLine[]): string { /* ... */ }
92
```

### Programmatic API

```typescript
import { skeleton, format, render } from 'source-skeleton';
import { readFileSync } from 'node:fs';

const source = readFileSync('service.ts', 'utf-8');
const result = skeleton(source);
const lines = format(result);
const output = render(lines);
console.log(output);
```

## Output Format

Tab-delimited: `<line-number>\t<code>`

Collapsed blocks are followed by `→ dependency()` annotation lines showing which external calls (imported identifiers or constructor-injected services) were made inside the collapsed body.

## Use with AI Coding Agents

Install globally and use `source-skeleton <file>` in your tool definitions or agent prompts to get compact, navigable overviews of large files without consuming excessive context.

- **Claude Code**: install globally (`npm install -g source-skeleton`) or add as a custom tool
- **Codex / other agents**: install globally and reference in tool definitions

## Requirements

- Node.js >= 18

## License

MIT
